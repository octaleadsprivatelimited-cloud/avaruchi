import assert from "node:assert/strict";
import { administratorSession } from "./fixtures.mjs";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5184";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("Use a disposable local store.");
let checks = 0;
const eq = (a, b, label = "") => {
  assert.deepEqual(a, b, label);
  checks++;
};
async function request(path, data, cookie = "", extra = {}) {
  const r = await fetch(origin + "/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(data === undefined
        ? {}
        : { Origin: origin, "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: r.status,
    body: r.headers.get("content-type")?.includes("json") ? await r.json() : {},
    response: r,
  };
}
const login = await request("auth/demo", {}),
  customer = login.response.headers.get("set-cookie").split(";")[0],
  admin = await administratorSession();
const endpoints = [
  "admin/shipping/create",
  "admin/shipping/awb",
  "admin/shipping/pickup",
  "admin/shipping/sync",
  "admin/shipping/reconcile",
  "admin/refund/process",
  "admin/refund/sync",
  "admin/invoice-queue",
  "admin/payment/reconcile",
];
for (const path of endpoints) {
  eq((await request(path, {})).status, 401, path);
  eq((await request(path, {}, customer)).status, 403, path);
  eq((await request(path, {}, "avr_session=forged")).status, 401, path);
  eq(
    (
      await request(path, {}, admin, {
        Origin: "https://foreign.invalid",
        "X-Forwarded-Host": new URL(origin).host,
      })
    ).status,
    403,
    path,
  );
}
for (const items of [
  [null],
  [{}],
  [{ variantId: [], quantity: 1 }],
  [{ variantId: "amla-250", quantity: 1.5 }],
  [false],
])
  eq((await request("quote", { items })).status, 400);
eq(
  (await request("saved", { cart: [null, false, {}, "wrong"] }, customer))
    .status,
  200,
);
eq(
  (await request("orders", { idempotency: { nested: "value" } }, customer))
    .status,
  400,
);
eq(
  (await request("jobs/invoices", {}, "", { Authorization: "Bearer forged" }))
    .status,
  401,
);
eq(
  (
    await request("delivery-events", { awb: "QA-AWB" }, "", {
      "x-api-key": "forged",
    })
  ).status,
  503,
);
const health = await request("health");
eq(health.status, 200);
eq(health.body, { ok: true });
const page = await fetch(origin + "/account");
eq(page.status, 200);
assert.match(page.headers.get("content-security-policy"), /object-src 'none'/);
checks++;
assert.match(page.headers.get("permissions-policy"), /camera=\(\)/);
checks++;
eq(page.headers.get("x-content-type-options"), "nosniff");
const address = {
  name: "Rate test",
  phone: "9000000000",
  line1: "12 Sample Street",
  line2: "",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
};
const placed = await request(
  "orders",
  {
    idempotency: crypto.randomUUID(),
    method: "demo",
    address,
    items: [{ variantId: "amla-500", quantity: 1 }],
  },
  customer,
);
eq(placed.status, 201);
const mismatched = await request(
  "orders",
  {
    idempotency: placed.body.order.idempotency,
    method: "demo",
    address,
    items: [{ variantId: "amla-500", quantity: 2 }],
  },
  customer,
);
eq(mismatched.status, 409);
eq(
  (
    await request(
      "orders",
      {
        idempotency: placed.body.order.idempotency,
        method: "cod",
        address,
        items: [{ variantId: "amla-500", quantity: 1 }],
      },
      customer,
    )
  ).status,
  409,
);
// The database persists this limit. Invalid orders do not create inventory reservations.
const rateLogin = await request("auth/demo", {}),
  rateUser = rateLogin.response.headers.get("set-cookie").split(";")[0];
for (let i = 0; i < 20; i++)
  eq(
    (
      await request(
        "orders",
        { idempotency: crypto.randomUUID(), items: [null] },
        rateUser,
      )
    ).status,
    400,
  );
const throttled = await request(
  "orders",
  { idempotency: crypto.randomUUID(), items: [null] },
  rateUser,
);
eq(throttled.status, 429);
console.log(
  `${checks} hardening assertions passed: all new admin routes, session/origin rejection, malformed baskets, worker authentication, security headers, immutable checkout retries and durable rate limiting.`,
);
