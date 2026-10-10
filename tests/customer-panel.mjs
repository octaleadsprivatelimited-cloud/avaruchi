import assert from "node:assert/strict";
import { administratorSession } from "./fixtures.mjs";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5184";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("Use a disposable local demo database.");
let checks = 0;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  checks++;
};
async function api(path, data, session = "", extra = {}) {
  const r = await fetch(origin + "/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Connection: "close",
      ...(data === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: origin }),
      ...(session ? { Cookie: session } : {}),
      ...extra,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const admin = await administratorSession(),
  customer = (await api("auth/demo", {})).cookie,
  other = (await api("auth/demo", {})).cookie;
const address = {
  name: "Customer Panel QA",
  phone: "9000000000",
  line1: "12 Sample Street",
  line2: "Test apartment",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
};
eq(
  (
    await api(
      "saved",
      { cart: [], wishlist: [], address, validateAddress: true },
      customer,
    )
  ).status,
  200,
);
eq((await api("session", undefined, customer)).data.saved.address, address);
for (const invalid of [{ phone: "123" }, { pincode: "000000" }, { line1: "" }])
  eq(
    (
      await api(
        "saved",
        { address: { ...address, ...invalid }, validateAddress: true },
        customer,
      )
    ).status,
    400,
  );
eq((await api("session", undefined, other)).data.saved, null);
eq((await api("returns")).status, 401);
eq(
  (await api("returns", {}, customer, { Origin: "https://foreign.invalid" }))
    .status,
  403,
);
for (const path of ["admin/shipment", "admin/return"]) {
  eq((await api(path, {})).status, 401);
  eq((await api(path, {}, customer)).status, 403);
}
async function order() {
  const r = await api(
    "orders",
    {
      items: [{ variantId: "amla-250", quantity: 1 }],
      address,
      method: "demo",
      idempotency: crypto.randomUUID(),
    },
    customer,
  );
  eq(r.status, 201);
  return r.data.order;
}
async function transition(id, status, tracking = "") {
  const o = (await api("admin", undefined, admin)).data.orders.find(
    (o) => o.id === id,
  );
  return api(
    "admin/order",
    {
      id,
      status,
      tracking,
      expectedStatus: o.status,
      expectedTracking: o.tracking || "",
    },
    admin,
  );
}
const o = await order(),
  data = {
    orderId: o.id,
    kind: "refund",
    reason: "damaged",
    details: "One jar arrived with a cracked lid.",
  };
eq((await api("returns", data, customer)).status, 409);
eq((await api("returns", data, other)).status, 404);
eq((await transition(o.id, "packed")).status, 200);
eq((await transition(o.id, "shipped", "QA-AWB-001")).status, 200);
for (const trackingUrl of [
  "javascript:alert(1)",
  "http://example.invalid",
  "https://name:password@example.invalid",
])
  eq(
    (
      await api(
        "admin/shipment",
        { id: o.id, expectedVersion: 0, trackingUrl },
        admin,
      )
    ).status,
    400,
  );
eq(
  (
    await api(
      "admin/shipment",
      { id: o.id, expectedVersion: 0, eta: "2026-02-30" },
      admin,
    )
  ).status,
  400,
);
const shipment = {
  id: o.id,
  expectedVersion: 0,
  courier: "QA Courier",
  trackingUrl: "https://example.invalid/track/QA-AWB-001",
  eta: "2026-10-20",
};
eq(
  (
    await Promise.all([
      api("admin/shipment", shipment, admin),
      api("admin/shipment", shipment, admin),
    ])
  )
    .map((x) => x.status)
    .sort(),
  [200, 409],
);
const own = (await api("orders", undefined, customer)).data.orders.find(
  (x) => x.id === o.id,
);
eq(own.shipment.courier, "QA Courier");
eq(own.tracking, "QA-AWB-001");
eq(own.shipment.provider, "manual");
eq((await api("orders", undefined, other)).data.orders.length, 0);
eq((await transition(o.id, "delivered", "QA-AWB-001")).status, 200);
for (const invalid of [
  { kind: "invalid" },
  { reason: "invalid" },
  { reason: "__proto__" },
  { details: "short" },
  { details: "x".repeat(1201) },
])
  eq((await api("returns", { ...data, ...invalid }, customer)).status, 400);
eq(
  (
    await Promise.all([
      api(
        "returns",
        {
          ...data,
          refundAmount: o.total,
          refundReference: "FAKE",
          status: "resolved",
          userId: "other",
        },
        customer,
      ),
      api("returns", data, customer),
    ])
  )
    .map((x) => x.status)
    .sort(),
  [201, 409],
);
let x = (await api("returns", undefined, customer)).data.requests.find(
  (x) => x.order_id === o.id,
);
eq(x.status, "requested");
eq(x.refund_amount, 0);
eq(x.refund_reference, "");
eq((await api("returns", undefined, other)).data.requests.length, 0);
const update = (extra = {}) =>
  api(
    "admin/return",
    {
      id: x.id,
      expectedVersion: x.version,
      status: "approved",
      note: "Your request has been approved.",
      refundAmount: 0,
      refundReference: "",
      ...extra,
    },
    admin,
  );
for (const [extra, status] of [
  [{ expectedVersion: 0 }, 409],
  [{ status: "resolved" }, 400],
  [{ refundAmount: -1 }, 400],
  [{ refundAmount: o.total + 1 }, 400],
  [{ refundAmount: 1.5 }, 400],
  [{ refundReference: "UNVERIFIED" }, 400],
])
  eq((await update(extra)).status, status);
eq(
  (await Promise.all([update(), update()])).map((x) => x.status).sort(),
  [200, 409],
);
x = (await api("returns", undefined, customer)).data.requests.find(
  (x) => x.order_id === o.id,
);
eq((await update({ status: "refund_pending", refundAmount: 0 })).status, 400);
eq(
  (
    await update({
      status: "refund_pending",
      refundAmount: 10000,
      note: "A preview refund of Rs 100 has been approved.",
    })
  ).status,
  200,
);
x = (await api("returns", undefined, customer)).data.requests.find(
  (x) => x.order_id === o.id,
);
eq((await update({ status: "resolved", refundAmount: 10000 })).status, 400);
eq(
  (
    await update({
      status: "resolved",
      refundAmount: 11000,
      refundReference: "QA-REFUND",
    })
  ).status,
  400,
);
eq(
  (
    await update({
      status: "resolved",
      refundAmount: 10000,
      refundReference: "QA-REFUND",
      note: "Preview refund completion recorded. No money transferred.",
    })
  ).status,
  200,
);
x = (await api("returns", undefined, customer)).data.requests.find(
  (x) => x.order_id === o.id,
);
eq(
  x.history.map((h) => h.status),
  ["requested", "approved", "refund_pending", "resolved"],
);
eq(x.refund_reference, "QA-REFUND");
eq((await update({ status: "approved" })).status, 400);
const after = (await api("orders", undefined, customer)).data.orders.find(
  (x) => x.id === o.id,
);
eq(after.total, o.total);
eq(after.payment, "demo");
const second = await order();
await transition(second.id, "packed");
await transition(second.id, "shipped");
await transition(second.id, "delivered");
eq(
  (
    await api(
      "returns",
      { ...data, orderId: second.id, kind: "return" },
      customer,
    )
  ).status,
  201,
);
let ret = (await api("returns", undefined, customer)).data.requests.find(
  (x) => x.order_id === second.id,
);
for (const status of [
  "reviewing",
  "approved",
  "return_in_transit",
  "received",
  "resolved",
]) {
  eq(
    (
      await api(
        "admin/return",
        {
          id: ret.id,
          expectedVersion: ret.version,
          status,
          note: "Preview return processing update.",
          refundAmount: 0,
          refundReference: "",
        },
        admin,
      )
    ).status,
    200,
  );
  ret = (await api("returns", undefined, customer)).data.requests.find(
    (x) => x.id === ret.id,
  );
}
eq(ret.history.length, 6);
eq((await api("admin", undefined, admin)).data.settings.shiprocket, false);
console.log(
  `${checks} customer-panel checks passed: contact saving, isolation, courier details, atomic duplicates, return stages and refund records.`,
);
