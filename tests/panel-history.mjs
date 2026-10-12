import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { administratorSession } from "./fixtures.mjs";
if (
  process.env.TEST_ALLOW_DATABASE_FIXTURES !== "true" ||
  !["127.0.0.1", "localhost"].includes(process.env.DB_HOST) ||
  !process.env.DB_NAME?.endsWith("_test")
)
  throw new Error("Use a disposable local test database.");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5184";
let checks = 0;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  checks++;
};
async function req(path, cookie = "", data) {
  const r = await fetch(origin + "/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(data === undefined
        ? {}
        : { Origin: origin, "Content-Type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await r.json();
  return { status: r.status, body, r };
}
const customerLogin = await req("auth/demo", "", {}),
  customer = customerLogin.r.headers.get("set-cookie").split(";")[0];
const otherLogin = await req("auth/demo", "", {}),
  other = otherLogin.r.headers.get("set-cookie").split(";")[0];
const user = (await req("session", customer)).body.user;
const admin = await administratorSession();
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
});
try {
  const token = crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 8)
      .toUpperCase(),
    orderIds = [],
    caseIds = [];
  const address = {
    name: "Panel history customer",
    phone: "9000000000",
    line1: "12 Sample Street",
    line2: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
  };
  const item = {
    variantId: "mango-250",
    name: "Mango",
    weight: 250,
    quantity: 1,
    price: 19900,
  };
  const data = {
    demo: true,
    address,
    items: [item],
    subtotal: 19900,
    discount: 0,
    shipping: 5900,
    total: 25800,
    coupon: "",
  };
  for (let i = 0; i < 243; i++) {
    const id = "AVR-" + token + i.toString(16).padStart(8, "0").toUpperCase();
    orderIds.push(id);
    // Equal timestamps deliberately exercise the deterministic ID tie-breaker.
    await conn.execute(
      "INSERT INTO orders(id,user_id,idempotency,status,payment,data,total,created) VALUES (?,?,?,'delivered','demo',?,25800,?)",
      [
        id,
        user.id,
        crypto.randomUUID(),
        JSON.stringify(data),
        1600000000000 + Math.floor(i / 3),
      ],
    );
    await conn.execute("INSERT INTO invoices(order_id,created) VALUES (?,?)", [
      id,
      1600000000000 + i,
    ]);
    if (i < 153) {
      const cid = "CASE-" + crypto.randomUUID();
      caseIds.push(cid);
      const history = [
        {
          status: "requested",
          note: "Synthetic panel history case",
          at: 1600000000000 + i,
        },
      ];
      await conn.execute(
        "INSERT INTO service_requests(id,order_id,user_id,kind,reason,details,status,refund_amount,refund_reference,history,version,created,updated) VALUES (?,?,?,'return','damaged','Synthetic damaged test jar','requested',0,'',?,1,?,?)",
        [
          cid,
          id,
          user.id,
          JSON.stringify(history),
          1600000000000 + Math.floor(i / 3),
          1600000000000 + i,
        ],
      );
    }
  }
  const seen = [];
  let before = "";
  do {
    const r = await req(
      "orders" + (before ? "?before=" + encodeURIComponent(before) : ""),
      customer,
    );
    eq(r.status, 200);
    eq(r.body.pagination.orders.total, 243);
    eq(r.body.pagination.requests.open, 153);
    assert.ok(r.body.orders.length <= 50);
    checks++;
    seen.push(...r.body.orders.map((o) => o.id));
    before = r.body.pagination.orders.next;
  } while (before);
  eq(seen.length, 243);
  eq(new Set(seen).size, 243);
  eq(new Set(seen), new Set(orderIds));
  const cases = [];
  before = "";
  do {
    const r = await req(
      "returns" + (before ? "?before=" + encodeURIComponent(before) : ""),
      customer,
    );
    eq(r.status, 200);
    eq(r.body.pagination.total, 153);
    cases.push(...r.body.requests.map((x) => x.id));
    before = r.body.pagination.next;
  } while (before);
  eq(new Set(cases), new Set(caseIds));
  eq(cases.length, 153);
  eq((await req("orders", other)).body.pagination.orders.total, 0);
  eq((await req("orders?focus=" + orderIds[0], other)).status, 404);
  const focused = await req("orders?focus=" + orderIds[0], customer);
  eq(focused.status, 200);
  eq(focused.body.orders[0].id, orderIds[0]);
  assert.ok(focused.body.orderRequests.some((x) => x.order_id === orderIds[0]));
  checks++;
  assert.ok(focused.body.orders[0].invoice_id);
  checks++;
  eq(
    (
      await fetch(origin + "/api/invoice/" + orderIds[0], {
        headers: { Cookie: customer },
      })
    ).status,
    200,
  );
  eq(
    (
      await fetch(origin + "/api/invoice/" + orderIds[0], {
        headers: { Cookie: other },
      })
    ).status,
    404,
  );
  for (const path of [
    "orders?before=bad",
    "returns?before=-1:bad",
    "admin?ordersBefore=oops",
    "admin?requestsBefore=9007199254740992:bad",
  ])
    eq(
      (await req(path, path.startsWith("admin") ? admin : customer)).status,
      400,
    );
  const initial = await req("admin", admin);
  eq(initial.status, 200);
  assert.ok(initial.body.summary.orders >= 243);
  checks++;
  assert.ok(initial.body.summary.openRequests >= 153);
  checks++;
  eq(initial.body.orders.length, 100);
  const old = await req(
    "admin?order=" + orderIds[0] + "&case=" + caseIds[0],
    admin,
  );
  eq(old.status, 200);
  eq(old.body.orders[0].id, orderIds[0]);
  eq(old.body.requests[0].id, caseIds[0]);
  const allAdminOrders = [];
  before = "";
  do {
    const r = await req(
      "admin" + (before ? "?ordersBefore=" + encodeURIComponent(before) : ""),
      admin,
    );
    eq(r.status, 200);
    allAdminOrders.push(...r.body.orders.map((x) => x.id));
    before = r.body.pagination.orders.next;
  } while (before);
  for (const id of orderIds) assert.ok(allAdminOrders.includes(id));
  checks++;
  eq(new Set(allAdminOrders).size, allAdminOrders.length);
  const allAdminCases = [];
  before = "";
  do {
    const r = await req(
      "admin" + (before ? "?requestsBefore=" + encodeURIComponent(before) : ""),
      admin,
    );
    eq(r.status, 200);
    allAdminCases.push(...r.body.requests.map((x) => x.id));
    before = r.body.pagination.requests.next;
  } while (before);
  for (const id of caseIds) assert.ok(allAdminCases.includes(id));
  checks++;
  eq(new Set(allAdminCases).size, allAdminCases.length);
  const invalidAdmin = await req("admin?order=" + orderIds[0], customer);
  eq(invalidAdmin.status, 403);
  const invoiceSource = (await readFile("lib/invoice.ts", "utf8")).replace(
    /^import .* from "\.\/(brand|invoice-logo)";\n/gm,
    "",
  );
  const source = ts.transpileModule(
    [
      await readFile("lib/brand.ts", "utf8"),
      await readFile("lib/invoice-logo.ts", "utf8"),
      invoiceSource,
    ].join("\n"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const { invoicePdf } = await import(
    "data:text/javascript;base64," + Buffer.from(source).toString("base64")
  );
  const longItems = Array.from({ length: 12 }, (_, i) => ({
    ...item,
    name: `Jar ${i + 1} - Traditional Andhra pickle with extra tangy mango mustard fenugreek and sesame oil`,
    quantity: 10,
  }));
  const total =
    longItems.reduce((sum, x) => sum + x.price * x.quantity, 0) + 5900;
  const full = invoicePdf(
    {
      id: orderIds[0],
      payment: "demo",
      status: "delivered",
      total,
      data: {
        ...data,
        items: longItems,
        subtotal: total - 5900,
        total,
        address: {
          ...address,
          name: "Sample Customer With A Long Name ".repeat(5),
          line1: "Long Sample Street Building Landmark ".repeat(4),
          line2: "Additional address directions ".repeat(4),
        },
      },
    },
    { id: 999999, created: Date.now() },
    {
      address: "Avaruchi Sample Merchant Address ".repeat(7),
      gst: "TEST-GST-REFERENCE",
    },
  );
  const text = new TextDecoder().decode(full);
  assert.match(text, /\/Count 2/);
  checks++;
  assert.match(text, /Jar 12/);
  checks++;
  assert.match(
    text,
    new RegExp("Rs " + (total / 100).toFixed(2).replace(".", "\\.")),
  );
  checks++;
  const standard = invoicePdf(
    {
      id: orderIds[0],
      payment: "demo",
      status: "delivered",
      total: 25800,
      data,
    },
    { id: 100000, created: Date.now() },
    {},
  );
  assert.match(new TextDecoder().decode(standard), /\/Count 1/);
  checks++;
  assert.match(new TextDecoder().decode(standard), /Lakshmis Tapasi Treats/);
  checks++;
  assert.match(
    new TextDecoder().decode(standard),
    /Phone \/ WhatsApp: 9932433243/,
  );
  checks++;
  assert.match(new TextDecoder().decode(standard), /Ramanthapur, Hyderabad/);
  checks++;
  assert.match(new TextDecoder().decode(standard), /\/Subtype \/Image/);
  checks++;
  if (process.env.TEST_INVOICE_OUTPUT_DIR) {
    await writeFile(
      process.env.TEST_INVOICE_OUTPUT_DIR + "/avaruchi-invoice-full-basket.pdf",
      full,
    );
    await writeFile(
      process.env.TEST_INVOICE_OUTPUT_DIR + "/avaruchi-invoice-standard.pdf",
      standard,
    );
  }
  console.log(
    `${checks} panel history and invoice assertions passed: all 243 orders and 153 cases accessible, stable cursor ties, old-order focus/invoice ownership, store-wide admin totals, and page-safe full-basket invoices.`,
  );
} finally {
  await conn.end();
}
