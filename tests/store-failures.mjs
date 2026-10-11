import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5184";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname))
  throw new Error("Use a disposable local store.");
let checks = 0;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  checks++;
};
const source = await readFile("lib/browser-recovery.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const recovery = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const data = new Map();
const storage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};
storage.setItem("basket", "{broken");
eq(recovery.readStored(storage, "basket"), null);
const unavailable = {
  getItem() {
    throw new Error("Disabled");
  },
  setItem() {
    throw new Error("Full");
  },
  removeItem() {
    throw new Error("Disabled");
  },
};
eq(recovery.readStored(unavailable, "basket"), null);
recovery.writeStored(unavailable, "basket", {});
eq(
  recovery.safeBasket({
    cart: [
      null,
      false,
      {},
      { variantId: "mango-250", quantity: 1 },
      { variantId: "mango-250", quantity: 2 },
      { variantId: "amla-250", quantity: Infinity },
    ],
    wishlist: [null, 42, "mango"],
    address: { name: 42, city: "Hyderabad" },
  }),
  {
    cart: [{ variantId: "mango-250", quantity: 1 }],
    wishlist: ["mango"],
    address: {
      name: "",
      phone: "",
      line1: "",
      line2: "",
      city: "Hyderabad",
      state: "",
      pincode: "",
    },
  },
);
const payload = {
  items: [{ variantId: "mango-250", quantity: 1 }],
  method: "demo",
};
const attempt = recovery.checkoutAttempt(null, "customer", payload);
attempt.submitted = true;
recovery.writeStored(storage, "checkout", attempt);
eq(
  recovery.checkoutAttempt(
    recovery.readStored(storage, "checkout"),
    "customer",
    payload,
  ).key,
  attempt.key,
  "Reload reuses the checkout key",
);
assert.throws(
  () =>
    recovery.checkoutAttempt(attempt, "customer", {
      ...payload,
      method: "cod",
    }),
  /Review your orders/,
);
checks++;
assert.notEqual(
  recovery.checkoutAttempt(attempt, "other-customer", payload).key,
  attempt.key,
);
checks++;
// Simulate script loading failures without accessing a browser or any live provider.
let appended = [],
  timers = [];
globalThis.window = {};
globalThis.document = {
  createElement: () => ({
    remove() {
      this.removed = true;
    },
  }),
  body: { appendChild: (script) => appended.push(script) },
};
const realSetTimeout = globalThis.setTimeout,
  realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (fn) => {
  timers.push(fn);
  return timers.length;
};
globalThis.clearTimeout = () => {};
try {
  const first = recovery.loadPaymentScript();
  eq(
    recovery.loadPaymentScript(),
    first,
    "Repeated clicks share one script request",
  );
  eq(appended.length, 1);
  const failed = assert.rejects(first, /Unable to load/);
  appended[0].onerror();
  await failed;
  checks++;
  eq(appended[0].removed, true);
  const slow = recovery.loadPaymentScript();
  const timed = assert.rejects(slow, /too long/);
  timers.at(-1)();
  await timed;
  checks++;
  const loaded = recovery.loadPaymentScript();
  window.Razorpay = function () {};
  appended.at(-1).onload();
  await loaded;
  eq(appended.length, 3);
  await recovery.loadPaymentScript();
  eq(appended.length, 3, "Loaded gateway is reused");
} finally {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
}
for (const path of ["/missing-page", "/shop/missing-product"]) {
  const r = await fetch(origin + path);
  eq(r.status, 404, path);
  assert.match(await r.text(), /This page has left the table/);
  checks++;
}
for (const path of [
  "missing-route",
  "auth/missing",
  "admin/shipping/missing",
  "orders/id/extra",
  "invoice/id/extra",
  "constructor",
]) {
  const r = await fetch(origin + "/api/" + path);
  eq(r.status, 404, path);
  eq((await r.json()).error, "Route not found.");
}
for (const [path, method, allow] of [
  ["catalog", "POST", "GET, HEAD"],
  ["health", "DELETE", "GET, HEAD"],
  ["quote", "GET", "POST"],
  ["orders", "PUT", "GET, HEAD, POST"],
]) {
  const r = await fetch(origin + "/api/" + path, { method });
  eq(r.status, 405, path);
  eq(r.headers.get("allow"), allow);
}
eq((await fetch(origin + "/api/catalog", { method: "HEAD" })).status, 200);
const login = await fetch(origin + "/api/auth/demo", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: "{}",
});
const cookie = login.headers.get("set-cookie").split(";")[0];
const headers = {
  Origin: origin,
  "Content-Type": "application/json",
  Cookie: cookie,
};
const req = async (path, body) => {
  const r = await fetch(origin + "/api/" + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};
const address = {
  name: "  Failure test  ",
  phone: "9000000000",
  line1: "12 Sample Street ",
  line2: "",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
};
const checkout = {
  items: [{ variantId: "mango-250", quantity: 1 }],
  address,
  method: "demo",
  idempotency: crypto.randomUUID(),
};
const placed = await req("orders", checkout);
eq(placed.status, 201);
const retry = await req("orders", checkout);
eq(retry.status, 200);
eq(
  retry.body.order.id,
  placed.body.order.id,
  "Whitespace-normalized address still replays same order",
);
eq(
  (
    await req("orders", {
      ...checkout,
      items: [{ variantId: "mango-250", quantity: 2 }],
    })
  ).status,
  409,
);
eq((await req("orders/" + placed.body.order.id, {})).status, 200);
eq(
  (
    await req("quote", {
      items: [{ variantId: "missing-variant", quantity: 1 }],
    })
  ).status,
  400,
);
eq(
  (
    await req("quote", {
      items: [{ variantId: "mango-250", quantity: 1 }],
      coupon: "EXPIRED",
    })
  ).status,
  400,
);
console.log(
  `${checks} store failure assertions passed: corrupt/unavailable storage, checkout reloads and edits, bounded payment script loading, 404/405/HEAD routing, trimmed address retries and stale baskets/coupons.`,
);
