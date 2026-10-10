import assert from "node:assert/strict";
import { administratorSession } from "./fixtures.mjs";
const origin = process.env.TEST_ORIGIN || "http://localhost:5173";
async function request(path, data, session = "", extra = {}) {
  const response = await fetch(origin + "/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      ...(data === undefined
        ? {}
        : { "Content-Type": "application/json", Origin: origin }),
      ...(session ? { Cookie: session } : {}),
      ...extra,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : new Uint8Array(await response.arrayBuffer());
  return { status: response.status, data: result, response };
}
async function stock(id, value, price) {
  const v = (await request("catalog")).data.products.flatMap(p => p.variants).find(v => v.id === id);
  const result = await request("admin/stock", { id, stock: value, price, expectedStock: v.stock, expectedPrice: v.price }, administrator);
  assert.equal(result.status, 200);
}
async function updateOrder(id, status, tracking) {
  const o = (await request("admin", undefined, administrator)).data.orders.find(o => o.id === id);
  return request("admin/order", { id, status, tracking, expectedStatus: o.status, expectedTracking: o.tracking || "" }, administrator);
}
async function login() {
  const r = await request("auth/demo", {});
  assert.equal(r.status, 200);
  return r.response.headers.get("set-cookie").split(";")[0];
}
const customer = await login(),
  other = await login();
const administrator = await administratorSession();
const products = (await request("catalog")).data.products;
assert.equal(products.length, 8);
assert.equal(products[0].id, "mango");
assert.deepEqual(
  products[0].variants.map((v) => v.weight),
  [250, 500, 1000],
);
assert.equal(products.flatMap((p) => p.variants).length, 24);
assert.equal((await request("orders")).status, 401);
assert.equal(
  (
    await request(
      "quote",
      { items: [{ variantId: "mango-250", quantity: 1 }] },
      "",
      { Origin: "https://untrusted.invalid" },
    )
  ).status,
  403,
);
assert.equal(
  (
    await request("quote", {
      items: [{ variantId: "mango-250", quantity: 1 }],
      coupon: "PICKLE10",
    })
  ).status,
  400,
);
const address = {
  name: "Integration Test",
  phone: "9000000000",
  line1: "12 Sample Street",
  line2: "",
  city: "Hyderabad",
  state: "Telangana",
  pincode: "500001",
};
const checkout = {
  items: [
    { variantId: "mango-500", quantity: 1 },
    { variantId: "gongura-250", quantity: 1 },
  ],
  coupon: "PICKLE10",
  address,
  method: "demo",
  idempotency: crypto.randomUUID(),
};
const quoted = await request("quote", checkout, customer);
assert.equal(quoted.data.total, 57020);
assert.equal(quoted.data.discount, 5680);
const stockBefore = products
  .find((p) => p.id === "mango")
  .variants.find((v) => v.id === "mango-500").stock;
const placed = await request("orders", checkout, customer);
assert.equal(placed.status, 201);
assert.equal(placed.data.order.total, 57020);
assert.ok(placed.data.order.invoice_id);
const duplicate = await request("orders", checkout, customer);
assert.equal(duplicate.data.order.id, placed.data.order.id);
let catalog = (await request("catalog")).data.products;
assert.equal(
  catalog
    .find((p) => p.id === "mango")
    .variants.find((v) => v.id === "mango-500").stock,
  stockBefore - 1,
);
const pdf = await request(
  "invoice/" + placed.data.order.id,
  undefined,
  customer,
);
assert.equal(pdf.status, 200);
assert.equal(new TextDecoder().decode(pdf.data.slice(0, 8)), "%PDF-1.4");
assert.equal(
  (await request("invoice/" + placed.data.order.id, undefined, other)).status,
  404,
);
assert.equal(
  (await request("orders/" + placed.data.order.id, {}, other)).status,
  404,
);
assert.equal(
  (await request("orders/" + placed.data.order.id, {}, customer)).status,
  200,
);
assert.equal(
  (await request("orders/" + placed.data.order.id, {}, customer)).status,
  400,
);
catalog = (await request("catalog")).data.products;
assert.equal(
  catalog
    .find((p) => p.id === "mango")
    .variants.find((v) => v.id === "mango-500").stock,
  stockBefore,
);
await stock("amla-250", 1, 19900);
const competing = {
  items: [{ variantId: "amla-250", quantity: 1 }],
  address,
  method: "demo",
};
const results = await Promise.all([
  request(
    "orders",
    { ...competing, idempotency: crypto.randomUUID() },
    customer,
  ),
  request("orders", { ...competing, idempotency: crypto.randomUUID() }, other),
]);
assert.equal(results.filter((r) => r.status === 201).length, 1);
const winning = results.find((r) => r.status === 201);
assert.equal(
  (await request("catalog")).data.products
    .find((p) => p.id === "amla")
    .variants.find((v) => v.id === "amla-250").stock,
  0,
);
const winner = results[0].status === 201 ? customer : other;
await request("orders/" + winning.data.order.id, {}, winner);
await stock("amla-250", 40, 19900);
const tracking = await request(
  "orders",
  { ...competing, idempotency: crypto.randomUUID() },
  customer,
);
assert.equal(
  (
    await updateOrder(tracking.data.order.id, "shipped", "DEMO123")
  ).status,
  400,
);
assert.equal(
  (
    await updateOrder(tracking.data.order.id, "packed", "")
  ).status,
  200,
);
assert.equal(
  (
    await updateOrder(tracking.data.order.id, "shipped", "DEMO123")
  ).status,
  200,
);
assert.equal(
  (await request("orders/" + tracking.data.order.id, {}, customer)).status,
  400,
);
assert.equal(
  (
    await updateOrder(tracking.data.order.id, "delivered", "DEMO123")
  ).status,
  200,
);
await stock("amla-250", 40, 19900);
assert.equal(
  (
    await request(
      "payments/verify",
      { orderId: placed.data.order.id, razorpay_order_id: "fake" },
      customer,
    )
  ).status,
  400,
);
console.log(
  "PASS: catalog, variants, origin checks, coupons, exact totals, checkout, idempotency, invoice PDF, account isolation, cancellation, stock restoration, concurrent inventory, tracking transitions and payment rejection.",
);

// MySQL transaction and upsert behavior differs from the original preview database.
const lastStock = (await request("catalog")).data.products
  .find((p) => p.id === "garlic")
  .variants.find((v) => v.id === "garlic-250").stock;
const sameCheckout = {
  items: [{ variantId: "garlic-250", quantity: 1 }],
  address,
  method: "demo",
  idempotency: crypto.randomUUID(),
};
const simultaneous = await Promise.all([
  request("orders", sameCheckout, customer),
  request("orders", sameCheckout, customer),
]);
const firstSuccess = simultaneous.find((r) => r.status === 201);
assert.ok(firstSuccess);
assert.ok(simultaneous.every((r) => [200, 201, 409].includes(r.status)));
assert.equal(
  (await request("catalog")).data.products
    .find((p) => p.id === "garlic")
    .variants.find((v) => v.id === "garlic-250").stock,
  lastStock - 1,
);
await Promise.all([
  request("orders/" + firstSuccess.data.order.id, {}, customer),
  request("orders/" + firstSuccess.data.order.id, {}, customer),
]);
assert.equal(
  (await request("catalog")).data.products
    .find((p) => p.id === "garlic")
    .variants.find((v) => v.id === "garlic-250").stock,
  lastStock,
);
await request(
  "saved",
  {
    cart: [{ variantId: "lemon-250", quantity: 1 }],
    wishlist: ["lemon"],
    address,
  },
  customer,
);
await request(
  "saved",
  {
    cart: [{ variantId: "lemon-500", quantity: 2 }],
    wishlist: ["gongura"],
    address,
  },
  customer,
);
const saved = (await request("session", undefined, customer)).data.saved;
assert.deepEqual(saved.cart, [{ variantId: "lemon-500", quantity: 2 }]);
assert.deepEqual(saved.wishlist, ["gongura"]);
assert.equal(
  (
    await request(
      "admin/coupon",
      { code: "PICKLE10", percent: 10, minimum: 49900, active: true },
      administrator,
    )
  ).status,
  200,
);
const missingGoogle = await fetch(origin + "/api/auth/google", {
  redirect: "manual",
});
assert.equal(missingGoogle.status, 302);
assert.ok(
  missingGoogle.headers.get("location").includes("/account?auth=unavailable"),
);
assert.equal(
  (await request("auth/google/callback?state=invalid&code=invalid")).status,
  401,
);
for (const [path, title] of [
  ["/", "Avaruchi"],
  ["/shop", "Shop all pickles"],
  ["/shop/mango", "Classic Mango pickle"],
  ["/our-story", "Our story"],
  ["/journal", "At the table"],
  ["/checkout", "Checkout"],
  ["/account", "Your account"],
  ["/wishlist", "Saved flavours"],
  ["/admin", "Store administration"],
  ["/terms", "Terms of Service"],
  ["/privacy", "Privacy policy"],
  ["/shipping", "Shipping policy"],
  ["/returns", "Returns and refunds"],
  ["/contact", "Contact Avaruchi"],
]) {
  const page = await fetch(origin + path);
  assert.equal(page.status, 200, path);
  const html = await page.text();
  assert.ok(html.includes("<title>") && html.includes(title), path);
  if (path === "/shop/mango")
    assert.match(html, /<h1[^>]*>Classic Mango<\/h1>/);
}
assert.equal((await fetch(origin + "/shop/not-a-pickle")).status, 404);
assert.equal((await fetch(origin + "/missing-page")).status, 404);
console.log(
  "PASS: simultaneous idempotency and cancellation, MySQL upserts, OAuth rejection, multipage SSR metadata, product content and 404 routes.",
);
