import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import ts from "typescript";
import mysql from "mysql2/promise";
import { readFile, writeFile, mkdir, rm, mkdtemp } from "node:fs/promises";
import { pathToFileURL } from "node:url";
if (
  process.env.TEST_ALLOW_DATABASE_FIXTURES !== "true" ||
  !["127.0.0.1", "localhost"].includes(process.env.DB_HOST) ||
  !process.env.DB_NAME?.endsWith("_test")
)
  throw new Error(
    "Use an explicitly enabled disposable local *_test database.",
  );
const temp = await mkdtemp(process.cwd() + "/.data/provider-").catch(
  async () => {
    await mkdir(".data", { recursive: true });
    return mkdtemp(process.cwd() + "/.data/provider-");
  },
);
let conn, closePool;
try {
  for (const name of [
    "api-routes",
    "server",
    "admin-access",
    "operations",
    "database",
    "catalog",
    "invoice",
    "customer",
  ]) {
    const source = await readFile("lib/" + name + ".ts", "utf8");
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
    await writeFile(
      temp + "/" + name + ".mjs",
      compiled +
        (name === "database"
          ? "\nexport const closeTestPool=()=>pool?.end();"
          : ""),
    );
  }
  let handle;
  const { providerJson } = await import(
    pathToFileURL(temp + "/operations.mjs")
  );
  conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });
  const origin = "https://store.example.invalid";
  Object.assign(process.env, {
    SITE_URL: origin,
    DEMO_MODE: "false",
    CATALOG_APPROVED: "true",
    BUSINESS_ADDRESS: "Test merchant address",
    GOOGLE_CLIENT_ID: "test-client",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
    ADMIN_GOOGLE_SUB: "provider-admin",
    SHIPROCKET_ENABLED: "true",
    SHIPROCKET_EMAIL: "shipping@example.invalid",
    SHIPROCKET_PASSWORD: "test-password",
    SHIPROCKET_PICKUP_LOCATION: "TEST",
    SHIPROCKET_WEBHOOK_TOKEN: "test-webhook-token-of-at-least-32-chars",
    RAZORPAY_KEY_ID: "rzp_test_fixture",
    RAZORPAY_KEY_SECRET: "test-payment-secret",
    RAZORPAY_WEBHOOK_SECRET: "test-signature",
    RAZORPAY_REFUNDS_ENABLED: "true",
    RESEND_API_KEY: "test-email-key",
    INVOICE_FROM_EMAIL: "test@example.invalid",
    CRON_SECRET: "test-cron-secret-of-at-least-32-characters",
  });
  const awb = "QA-AWB-" + crypto.randomUUID().slice(0, 8);
  let checks = 0,
    calls = [],
    mailCalls = 0,
    createCalls = 0,
    refundCalls = 0,
    mode = "normal",
    trackedStatus = "IN TRANSIT",
    refundStatus = "pending";
  const eq = (a, b, message = "") => {
    assert.deepEqual(a, b, message);
    checks++;
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    const u = String(url),
      body = init.body
        ? JSON.parse(String(init.body).startsWith("{") ? init.body : "{}")
        : {};
    const ok = (data) => Response.json(data);
    if (u.includes("oauth2.googleapis.com/token"))
      return ok({ access_token: "verified-google-fixture" });
    if (u.includes("openidconnect.googleapis.com"))
      return ok({
        sub: "provider-customer",
        email: "customer@example.invalid",
        email_verified: true,
        name: "Provider test customer",
      });
    if (u.endsWith("/auth/login"))
      return ok({ token: "test-shiprocket-token" });
    if (u.endsWith("/orders/create/adhoc")) {
      createCalls++;
      eq(body.billing_email, "customer@example.invalid");
      eq(body.shipping_is_billing, true);
      eq(body.sub_total, 199);
      eq(body.total_discount, 0);
      eq(body.shipping_charges, 59);
      eq(body.payment_method, "COD");
      if (mode === "shipping-timeout") throw new Error("network interrupted");
      return ok({
        order_id: 4001 + createCalls,
        shipment_id: 5001 + createCalls,
      });
    }
    if (u.endsWith("/courier/assign/awb"))
      return ok({
        awb_assign_status: 1,
        response: {
          data: {
            shipment_id: 5002,
            awb_code: awb,
            courier_name: "QA Courier",
          },
        },
      });
    if (u.endsWith("/courier/generate/pickup"))
      return ok({
        pickup_status: 1,
        response: { pickup_scheduled_date: "2026-10-12 10:00" },
      });
    if (u.includes("/courier/track/awb/"))
      return ok({
        tracking_data: {
          track_url: "https://example.invalid/track/" + awb,
          etd: "2026-10-15",
          shipment_track: [
            {
              awb_code: awb,
              shipment_id: 5002,
              current_status: trackedStatus,
              courier_name: "QA Courier",
            },
          ],
        },
      });
    if (u.includes("/orders/show/"))
      return ok({
        data: {
          id: 4003,
          channel_order_id: uncertainOrder,
          shipments: { id: 5003 },
        },
      });
    if (u === "https://api.resend.com/emails") {
      mailCalls++;
      assert.equal(
        new Headers(init.headers).get("idempotency-key").startsWith("invoice-"),
        true,
      );
      checks++;
      if (mode === "mail-timeout") throw new Error("mail response lost");
      return ok({ id: "mail-test-" + mailCalls });
    }
    if (u.endsWith("/v1/orders")) {
      if (mode === "payment-timeout") throw new Error("provider result lost");
      if (mode === "payment-malformed")
        return ok({ amount: body.amount, currency: "INR" });
      if (mode === "payment-declined")
        return Response.json({ error: "rejected" }, { status: 400 });
      return ok({
        id: "order_checkoutfixture",
        amount: body.amount,
        currency: "INR",
      });
    }
    if (u.endsWith("/orders/order_reconcile"))
      return ok({
        id: "order_reconcile",
        receipt: paymentUncertainOrder,
        amount: 25800,
        currency: "INR",
      });
    if (u.endsWith("/payments/pay_checkout"))
      return ok({
        id: "pay_checkout",
        order_id: "order_checkoutfixture",
        status: mode === "payment-authorized" ? "authorized" : "captured",
        amount: mode === "payment-wrong-amount" ? 1 : 25800,
        currency: "INR",
      });
    if (u.endsWith("/payments/pay_fixture"))
      return ok({
        id: "pay_fixture",
        order_id: "order_fixture",
        status: "captured",
        amount: 25800,
        amount_refunded: 0,
        currency: "INR",
      });
    if (u.endsWith("/payments/pay_fixture/refund")) {
      refundCalls++;
      eq(body.amount, 10000);
      eq(
        new Headers(init.headers).get("x-refund-idempotency"),
        "avaruchi-" + refundCase,
      );
      return ok({
        id: "rfnd_fixture",
        payment_id: "pay_fixture",
        amount: 10000,
        currency: "INR",
        status: refundStatus,
      });
    }
    if (u.endsWith("/refunds/rfnd_fixture"))
      return ok({
        id: "rfnd_fixture",
        payment_id: "pay_fixture",
        amount: 10000,
        currency: "INR",
        status: refundStatus,
      });
    throw new Error("Unexpected provider destination " + u);
  };
  ({ handle } = await import(pathToFileURL(temp + "/server.mjs")));
  ({ closeTestPool: closePool } = await import(
    pathToFileURL(temp + "/database.mjs")
  ));
  async function req(path, data, cookie = "", headers = {}) {
    const r = await handle(
      new Request(origin + "/api/" + path, {
        method: data === undefined ? "GET" : "POST",
        headers: {
          ...(data === undefined
            ? {}
            : { Origin: origin, "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
      path,
    );
    const json = r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : {};
    return { status: r.status, json, response: r };
  }
  async function status(path, data, cookie, expected, headers = {}) {
    const r = await req(path, data, cookie, headers);
    eq(r.status, expected, path + " " + JSON.stringify(r.json));
    return r;
  }
  const adminId = "google:provider-admin",
    adminSession = crypto.randomUUID();
  await conn.execute(
    "INSERT IGNORE INTO users (id,name,kind,email) VALUES (?,'Provider QA admin','google','admin@example.invalid')",
    [adminId],
  );
  await conn.execute(
    "INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)",
    [adminSession, adminId, Date.now() + 3600000],
  );
  const admin = "avr_session=" + adminSession;
  const start = await req("auth/google");
  eq(start.status, 302);
  const redirect = new URL(start.response.headers.get("location"));
  eq(redirect.searchParams.get("code_challenge_method"), "S256");
  const state = redirect.searchParams.get("state"),
    oauthCookie = start.response.headers.get("set-cookie").split(";")[0];
  const oauth = await handle(
    new Request(
      origin + "/api/auth/google/callback?state=" + state + "&code=test",
      { headers: { Cookie: oauthCookie } },
    ),
    "auth/google/callback",
  );
  eq(oauth.status, 302);
  assert.match(oauth.headers.get("set-cookie"), /Secure/);
  checks++;
  const customer = oauth.headers.get("set-cookie").split(";")[0];
  const replay = await handle(
    new Request(
      origin + "/api/auth/google/callback?state=" + state + "&code=test",
      { headers: { Cookie: oauthCookie } },
    ),
    "auth/google/callback",
  );
  eq(replay.status, 401);
  const address = {
    name: "Provider QA customer",
    phone: "9000000000",
    line1: "12 Sample Street",
    line2: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
  };
  let uncertainOrder = "",
    refundCase = "",
    paymentUncertainOrder = "";
  async function place() {
    const r = await status(
      "orders",
      {
        items: [{ variantId: "amla-250", quantity: 1 }],
        address,
        method: "cod",
        idempotency: crypto.randomUUID(),
      },
      customer,
      201,
    );
    return r.json.order;
  }
  async function transition(id, statusValue) {
    const o = (await req("admin", undefined, admin)).json.orders.find(
      (x) => x.id === id,
    );
    return status(
      "admin/order",
      {
        id,
        status: statusValue,
        tracking: o.tracking || "",
        expectedStatus: o.status,
        expectedTracking: o.tracking || "",
      },
      admin,
      200,
    );
  }
  let order = await place();
  eq(mailCalls, 1);
  await transition(order.id, "packed");
  const parcel = {
    id: order.id,
    length: 20,
    breadth: 15,
    height: 10,
    weight: 0.7,
  };
  await status("admin/shipping/create", parcel, customer, 403);
  await status("admin/shipping/create", { ...parcel, weight: 0.1 }, admin, 400);
  const both = await Promise.all([
    req("admin/shipping/create", parcel, admin),
    req("admin/shipping/create", parcel, admin),
  ]);
  assert.equal(
    both.every((x) => [200, 409].includes(x.status)) &&
      both.some((x) => x.status === 200),
    true,
    JSON.stringify(both.map((x) => ({ status: x.status, json: x.json }))),
  );
  checks++;
  eq(createCalls, 1);
  await status("admin/shipping/create", parcel, admin, 200);
  await status(
    "admin/order",
    {
      id: parcel.id,
      expectedStatus: "packed",
      expectedTracking: "",
      status: "delivered",
      tracking: "forged",
    },
    admin,
    409,
  );
  eq(createCalls, 1);
  await status("admin/shipping/create", { ...parcel, weight: 0.9 }, admin, 409);
  await status("admin/shipping/pickup", { id: order.id }, admin, 409);
  await status("admin/shipping/awb", { id: order.id }, admin, 200);
  await status("admin/shipping/awb", { id: order.id }, admin, 200);
  await status("admin/shipping/pickup", { id: order.id }, admin, 200);
  await status("admin/shipping/sync", { id: order.id }, admin, 200);
  eq(
    (await req("orders", undefined, customer)).json.orders.find(
      (x) => x.id === order.id,
    ).status,
    "shipped",
  );
  await status(
    "delivery-events",
    { awb: awb, current_status: "DELIVERED" },
    "",
    401,
    { "x-api-key": "forged" },
  );
  // Forged body status cannot mark delivery. The authoritative provider still reports transit.
  await status(
    "delivery-events",
    { awb: awb, current_status: "DELIVERED" },
    "",
    200,
    { "x-api-key": process.env.SHIPROCKET_WEBHOOK_TOKEN },
  );
  eq(
    (await req("orders", undefined, customer)).json.orders.find(
      (x) => x.id === order.id,
    ).status,
    "shipped",
  );
  trackedStatus = "DELIVERED";
  await status("delivery-events", { awb: awb }, "", 200, {
    "x-api-key": process.env.SHIPROCKET_WEBHOOK_TOKEN,
  });
  trackedStatus = "IN TRANSIT";
  await status("delivery-events", { awb: awb }, "", 200, {
    "x-api-key": process.env.SHIPROCKET_WEBHOOK_TOKEN,
  });
  eq(
    (await req("orders", undefined, customer)).json.orders.find(
      (x) => x.id === order.id,
    ).status,
    "delivered",
  );
  mode = "shipping-timeout";
  const uncertain = await place();
  uncertainOrder = uncertain.id;
  await transition(uncertain.id, "packed");
  await status(
    "admin/shipping/create",
    { ...parcel, id: uncertain.id },
    admin,
    502,
  );
  await status(
    "admin/shipping/create",
    { ...parcel, id: uncertain.id },
    admin,
    409,
  );
  eq(createCalls, 2);
  mode = "normal";
  await status(
    "admin/shipping/reconcile",
    { id: uncertain.id, remoteOrderId: 4003 },
    admin,
    200,
  );
  const beforeMail = mailCalls;
  mode = "mail-timeout";
  const queued = await place();
  eq(mailCalls, beforeMail + 1);
  let [mail] = await conn.execute(
    "SELECT * FROM invoice_jobs WHERE order_id=?",
    [queued.id],
  );
  eq(mail[0].status, "waiting");
  await status("jobs/invoices", {}, "", 401);
  mode = "normal";
  await conn.execute(
    "UPDATE invoice_jobs SET next_attempt=0 WHERE order_id=?",
    [queued.id],
  );
  await status("jobs/invoices", {}, "", 200, {
    Authorization: "Bearer " + process.env.CRON_SECRET,
  });
  eq(mailCalls, beforeMail + 2);
  await status("jobs/invoices", {}, "", 200, {
    Authorization: "Bearer " + process.env.CRON_SECRET,
  });
  eq(mailCalls, beforeMail + 2);
  // Confirm only the test database's fixture payment; no real capture or payout takes place.
  await conn.execute(
    "UPDATE orders SET payment='paid',payment_id='pay_fixture',razorpay_id='order_fixture' WHERE id=?",
    [order.id],
  );
  const opened = await status(
    "returns",
    {
      orderId: order.id,
      kind: "refund",
      reason: "damaged",
      details: "The test jar arrived damaged.",
    },
    customer,
    201,
  );
  refundCase = opened.json.id;
  async function caseUpdate(statusValue, amount = 0) {
    const x = (await req("admin", undefined, admin)).json.requests.find(
      (x) => x.id === refundCase,
    );
    await status(
      "admin/return",
      {
        id: x.id,
        expectedVersion: x.version,
        status: statusValue,
        note: "Provider QA customer update",
        refundAmount: amount,
        refundReference: "",
      },
      admin,
      200,
    );
  }
  await caseUpdate("approved");
  await caseUpdate("refund_pending", 10000);
  let x = (await req("admin", undefined, admin)).json.requests.find(
    (x) => x.id === refundCase,
  );
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version },
    customer,
    403,
  );
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version - 1 },
    admin,
    409,
  );
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version },
    admin,
    200,
  );
  eq(refundCalls, 1);
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version },
    admin,
    200,
  );
  eq(refundCalls, 1);
  await status(
    "admin/return",
    {
      id: x.id,
      expectedVersion: x.version,
      status: "resolved",
      note: "Attempt to replace payout result",
      refundAmount: 10000,
      refundReference: "other",
    },
    admin,
    409,
  );
  refundStatus = "failed";
  await status(
    "admin/refund/sync",
    { id: x.id, expectedVersion: x.version },
    admin,
    200,
  );
  x = (await req("admin", undefined, admin)).json.requests.find(
    (x) => x.id === refundCase,
  );
  eq(x.status, "refund_pending");
  eq(x.refund_reference, "");
  eq(x.history.filter((h) => h.providerStatus === "failed").length, 1);
  const failedHistory = x.history.length;
  await status(
    "admin/refund/sync",
    { id: x.id, expectedVersion: x.version },
    admin,
    200,
  );
  x = (await req("admin", undefined, admin)).json.requests.find(
    (x) => x.id === refundCase,
  );
  eq(x.history.length, failedHistory);
  const customerFailed = (
    await req("returns", undefined, customer)
  ).json.requests.find((r) => r.id === refundCase);
  assert.match(customerFailed.history.at(-1).note, /refund failed/);
  checks++;
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version },
    admin,
    409,
  );
  eq(refundCalls, 1);
  refundStatus = "processed";
  await status(
    "admin/refund/sync",
    { id: x.id, expectedVersion: x.version },
    admin,
    200,
  );
  x = (await req("admin", undefined, admin)).json.requests.find(
    (x) => x.id === refundCase,
  );
  eq(x.status, "resolved");
  eq(x.refund_reference, "rfnd_fixture");
  await status(
    "admin/refund/process",
    { id: x.id, expectedVersion: x.version },
    admin,
    409,
  );
  eq(refundCalls, 1);

  const onlineBody = {
    items: [{ variantId: "amla-250", quantity: 1 }],
    address,
    method: "online",
    idempotency: crypto.randomUUID(),
  };
  const online = (await status("orders", onlineBody, customer, 201)).json.order;
  eq(online.status, "pending");
  eq(online.razorpay_id, "order_checkoutfixture");
  const verify = {
    orderId: online.id,
    razorpay_order_id: "order_checkoutfixture",
    razorpay_payment_id: "pay_checkout",
    razorpay_signature: "forged",
  };
  await status("payments/verify", verify, customer, 401);
  verify.razorpay_signature = createHmac(
    "sha256",
    process.env.RAZORPAY_KEY_SECRET,
  )
    .update("order_checkoutfixture|pay_checkout")
    .digest("hex");
  mode = "payment-authorized";
  await status("payments/verify", verify, customer, 409);
  eq(
    (await req("orders", undefined, customer)).json.orders.find(
      (x) => x.id === online.id,
    ).payment,
    "unpaid",
  );
  mode = "payment-wrong-amount";
  await status("payments/verify", verify, customer, 409);
  mode = "normal";
  const verified = await status("payments/verify", verify, customer, 200);
  eq(verified.json.order.payment, "paid");
  eq(verified.json.order.status, "confirmed");
  await status("payments/verify", verify, customer, 200);
  const captured = {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_checkout",
          order_id: "order_checkoutfixture",
          amount: 25800,
          currency: "INR",
          status: "captured",
        },
      },
    },
  };
  const capturedSignature = createHmac(
    "sha256",
    process.env.RAZORPAY_WEBHOOK_SECRET,
  )
    .update(JSON.stringify(captured))
    .digest("hex");
  await status("webhook", captured, "", 401, {
    "x-razorpay-signature": "forged",
  });
  await status("webhook", captured, "", 200, {
    "x-razorpay-signature": capturedSignature,
  });
  const [invoiceRows] = await conn.execute(
    "SELECT COUNT(*) count FROM invoices WHERE order_id=?",
    [online.id],
  );
  eq(invoiceRows[0].count, 1);
  mode = "payment-timeout";
  const uncertainPayment = { ...onlineBody, idempotency: crypto.randomUUID() };
  await status("orders", uncertainPayment, customer, 502);
  const [uncertainRows] = await conn.execute(
    "SELECT * FROM orders WHERE idempotency=?",
    [uncertainPayment.idempotency],
  );
  paymentUncertainOrder = uncertainRows[0].id;
  eq(uncertainRows[0].status, "pending");
  eq(uncertainRows[0].razorpay_id, null);
  await status("orders", uncertainPayment, customer, 409);
  const [retryRows] = await conn.execute(
    "SELECT COUNT(*) count FROM orders WHERE idempotency=?",
    [uncertainPayment.idempotency],
  );
  eq(retryRows[0].count, 1);
  mode = "payment-malformed";
  const malformed = { ...onlineBody, idempotency: crypto.randomUUID() };
  await status("orders", malformed, customer, 502);
  await status("orders", malformed, customer, 409);
  mode = "payment-declined";
  const declined = { ...onlineBody, idempotency: crypto.randomUUID() };
  const [stockBeforeDeclined] = await conn.execute(
    "SELECT stock FROM variants WHERE id='amla-250'",
  );
  await status("orders", declined, customer, 502);
  const [stockAfterDeclined] = await conn.execute(
    "SELECT stock FROM variants WHERE id='amla-250'",
  );
  eq(stockAfterDeclined[0].stock, stockBeforeDeclined[0].stock);
  const [declinedRows] = await conn.execute(
    "SELECT status FROM orders WHERE idempotency=?",
    [declined.idempotency],
  );
  eq(declinedRows[0].status, "cancelled");
  mode = "normal";
  await status(
    "admin/payment/reconcile",
    { id: paymentUncertainOrder, remoteOrderId: "order_reconcile" },
    customer,
    403,
  );
  await status(
    "admin/payment/reconcile",
    { id: paymentUncertainOrder, remoteOrderId: "order_reconcile" },
    admin,
    200,
  );
  await status("orders/" + paymentUncertainOrder, {}, customer, 400);
  // Provider failures remain bounded and redact arbitrary response text.
  await assert.rejects(
    () =>
      providerJson(
        "https://example.invalid",
        {},
        async () => new Response("secret failure", { status: 500 }),
      ),
    (e) => e.uncertain && !e.message.includes("secret failure"),
  );
  checks++;
  await assert.rejects(
    () =>
      providerJson(
        "https://example.invalid",
        {},
        async () => new Response("{broken}"),
      ),
    (e) => e.uncertain,
  );
  checks++;
  await assert.rejects(
    () =>
      providerJson("https://example.invalid", {}, async () =>
        Response.json({ huge: "a".repeat(310000) }),
      ),
    (e) => e.uncertain,
  );
  checks++;
  await assert.rejects(
    () =>
      providerJson(
        "https://example.invalid",
        {},
        async (u, init) =>
          new Promise((resolve, reject) =>
            init.signal.addEventListener("abort", () =>
              reject(new Error("timeout")),
            ),
          ),
        10,
      ),
    (e) => e.uncertain,
  );
  checks++;
  globalThis.fetch = realFetch;
  console.log(
    `${checks} provider end-to-end assertions passed: Google PKCE/state, shipping duplicate guards, uncertain-response reconciliation, authoritative/replayed tracking, durable invoice retries, and approved/idempotent refunds. All provider calls were mocked; no customer data, shipments or money left the test process.`,
  );
} finally {
  await conn?.end();
  await closePool?.();
  await rm(temp, { recursive: true, force: true });
}
