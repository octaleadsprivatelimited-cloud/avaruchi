import crypto from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { CommerceStore, type StoredProduct } from "../src/store.js";
import { signAccessToken } from "../src/security.js";
import type { AppConfig } from "../src/config.js";
import { comboCartLines, normalizeCombo, resolveCombo, type ComboPackage } from "../src/combo-packages.js";
import { PrismaPersistence } from "../src/persistence.js";

const product = (name: string, price: number, stock = 10): StoredProduct => ({
  id: crypto.randomUUID(), name, slug: name.toLowerCase().replaceAll(" ", "-"), description: `${name} product description`, category: "Pickles", brand: "Aavaruchi", status: "ACTIVE", taxRate: 0, specifications: {},
  variants: [{ id: crypto.randomUUID(), sku: `COMBO-${crypto.randomUUID()}`, title: "500 g", active: true, price, mrp: price, stock, reserved: 0, attributes: { "Pack size": "500 g" }, weightGrams: 500 }],
  media: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const inputOf = (combo: ComboPackage) => ({ name: combo.name, description: combo.description, couponCode: combo.couponCode, status: combo.status, components: combo.components });
const definition = (products: StoredProduct[], status: ComboPackage["status"] = "ACTIVE"): ComboPackage => ({ id: crypto.randomUUID(), name: "Family flavours", description: "Two familiar flavours", couponCode: "", status, components: products.map(item => ({ variantId: item.variants[0]!.id, quantity: 1 })), updatedAt: new Date().toISOString() });

it("normalizes repeated component packs while requiring two different real products", () => {
  const products = [product("Mango", 475), product("Gongura", 400)];
  const combo = definition(products);
  const normalized = normalizeCombo({ ...combo, components: [...combo.components, combo.components[0]!] }, products);
  expect(normalized.components[0]?.quantity).toBe(2);
  expect(() => normalizeCombo({ ...combo, components: [combo.components[0]!, combo.components[0]!] }, products)).toThrow("at least two different products");
  expect(() => normalizeCombo({ ...combo, components: [{ variantId: crypto.randomUUID(), quantity: 1 }, combo.components[1]!] }, products)).toThrow("existing");
  expect(() => normalizeCombo({ ...combo, components: [{ ...combo.components[0]!, quantity: 20 }, combo.components[0]!, combo.components[1]!] }, products)).toThrow("at most 20");
  products[0]!.specifications["Catalog purpose"] = "Sample";
  expect(() => normalizeCombo(combo, products)).toThrow("existing");
  expect(() => normalizeCombo({ ...combo, status: "ARCHIVED" }, products)).toThrow("existing");
  expect(normalizeCombo({ ...combo, status: "ARCHIVED" }, products, true).status).toBe("ARCHIVED");
});

it("calculates current prices, tax and limiting stock without a separate inventory pool", () => {
  const products = [product("Mango", 475, 8), product("Gongura", 400, 3)];
  const combo = definition(products);
  combo.components[0]!.quantity = 2;
  products[0]!.taxRate = 5;
  expect(resolveCombo(combo, products)).toMatchObject({ total: 1397.5, available: 3 });
  products[1]!.variants[0]!.reserved = 2;
  products[0]!.variants[0]!.price = 500;
  expect(resolveCombo(combo, products)).toMatchObject({ total: 1450, available: 1 });
  products[1]!.status = "ARCHIVED";
  expect(resolveCombo(combo, products).issues).not.toEqual([]);
  expect(resolveCombo(combo, products).available).toBe(0);
});

it("validates the entire final cart including shared components and quantity limits", () => {
  const products = [product("Mango", 475, 3), product("Gongura", 400)];
  const combo = definition(products);
  const baseline = [{ variantId: products[0]!.variants[0]!.id, quantity: 2 }];
  expect(comboCartLines(combo, baseline, products)).toHaveLength(2);
  expect(comboCartLines(combo, baseline, products)).toEqual(comboCartLines(combo, baseline, products));
  expect(() => comboCartLines(combo, [{ ...baseline[0]!, quantity: 3 }], products)).toThrow("Not enough stock");
  products[0]!.variants[0]!.stock = 50;
  expect(() => comboCartLines(combo, [{ ...baseline[0]!, quantity: 20 }], products)).toThrow("at most 20");
  expect(() => comboCartLines({ ...combo, status: "DRAFT" }, [], products)).toThrow("no longer available");
});

describe("combo API", () => {
  let server: Server, base: string, store: CommerceStore, token: string;
  let products: StoredProduct[];
  const config: AppConfig = {
    NODE_ENV: "test", PORT: 4010, USE_DATABASE: false, DATABASE_URL: "mysql://test:test@localhost/test",
    JWT_SECRET: "test-access-secret-that-is-at-least-32-chars", JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars", INTEGRATION_ENCRYPTION_KEY: "test-encryption-key-that-is-at-least-32-chars",
    CORS_ORIGINS: "http://localhost:5180", TRUST_PROXY: "", UPLOAD_DIR: "uploads", PUBLIC_UPLOAD_BASE_URL: "http://localhost:4010/uploads",
  };
  const request = async (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json(), token: res.headers.get("x-cart-token") };
  };
  const save = async (input: unknown) => request("/api/v1/admin/combos", "POST", input, { authorization: `Bearer ${token}` });
  beforeAll(async () => {
    store = new CommerceStore();
    const created = await createApp({ config, store });
    const admin = store.createUser({ name: "Admin", email: "avaruchi.admin.fixture@gmail.com", role: "ADMIN", permissions: ["*"] });
    token = signAccessToken({ sub: admin.id, role: admin.role, permissions: admin.permissions }, config.JWT_SECRET);
    products = [product("Combo mango", 475), product("Combo gongura", 400)];
    products.forEach(item => store.products.set(item.id, item));
    server = created.app.listen(0);
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No port");
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

  it("protects admin package/catalog writes and rejects client supplied prices", async () => {
    const input = inputOf(definition(products));
    expect((await request("/api/v1/admin/combos", "POST", input)).status).toBe(401);
    const user = store.createUser({ name: "Customer", email: "combo.customer@example.com", role: "CUSTOMER", permissions: [] });
    const customerToken = signAccessToken({ sub: user.id, role: user.role, permissions: [] }, config.JWT_SECRET);
    expect((await request("/api/v1/admin/combos", "POST", input, { authorization: `Bearer ${customerToken}` })).status).toBe(403);
    expect((await save({ ...input, total: 1 })).status).toBe(400);
    expect((await save({ ...input, components: [{ variantId: crypto.randomUUID(), quantity: 1 }, input.components[0]] })).status).toBe(422);
  });

  it("hides draft/archived combos and invalid references while retaining editable definitions", async () => {
    const draft = await save(inputOf(definition(products, "DRAFT")));
    expect(draft.status).toBe(201);
    expect((await request("/api/v1/combos")).body.data).not.toContainEqual(expect.objectContaining({ id: draft.body.data.id }));
    const changed = await request(`/api/v1/admin/combos/${draft.body.data.id}`, "PUT", { ...inputOf(draft.body.data), status: "ACTIVE" }, { authorization: `Bearer ${token}` });
    expect(changed.status).toBe(200);
    expect((await request("/api/v1/combos")).body.data).toContainEqual(expect.objectContaining({ id: draft.body.data.id, total: 875 }));
    products[0]!.status = "DRAFT";
    expect((await request("/api/v1/combos")).body.data).not.toContainEqual(expect.objectContaining({ id: draft.body.data.id }));
    expect((await request("/api/v1/admin/combos", "GET", undefined, { authorization: `Bearer ${token}` })).body.data).toContainEqual(expect.objectContaining({ id: draft.body.data.id, components: expect.any(Array) }));
    products[0]!.status = "ACTIVE";
    expect((await request(`/api/v1/admin/combos/${draft.body.data.id}`, "PUT", { ...inputOf(draft.body.data), status: "ARCHIVED" }, { authorization: `Bearer ${token}` })).status).toBe(200);
  });

  it("adds all packs together, preserves baseline items, rejects shortages without partial mutation, and repeats PUT safely", async () => {
    const saved = await save(inputOf(definition(products)));
    const comboId = saved.body.data.id;
    const guestToken = crypto.randomUUID();
    const headers = { "x-cart-token": guestToken };
    const baseline = [{ variantId: products[0]!.variants[0]!.id, quantity: 2 }];
    expect((await request("/api/v1/cart/items", "PUT", baseline[0], headers)).status).toBe(200);
    const first = await request(`/api/v1/cart/combos/${comboId}`, "PUT", { lines: baseline }, headers);
    expect(first.status).toBe(200);
    expect(first.body.data.lines).toContainEqual({ productId: products[0]!.id, variantId: baseline[0]!.variantId, quantity: 3 });
    expect((await request(`/api/v1/cart/combos/${comboId}`, "PUT", { lines: baseline }, headers)).body.data.lines).toEqual(first.body.data.lines);
    products[1]!.variants[0]!.reserved = 10;
    const failed = await request(`/api/v1/cart/combos/${comboId}`, "PUT", { lines: [] }, headers);
    expect(failed.status).toBe(409);
    expect([...store.carts.get(`guest:${guestToken}`)!]).toEqual(first.body.data.lines.map((item: { variantId: string; quantity: number }) => [item.variantId, item.quantity]));
    products[1]!.variants[0]!.reserved = 0;
    expect(store.orders.size).toBe(0); // Adding a package cannot bypass normal checkout.
    expect(products[0]!.variants[0]!.stock).toBe(10);
  });

  it("rejects omitted or concurrently changed server cart items instead of replacing them", async () => {
    const saved = await save(inputOf(definition(products)));
    const guestToken = crypto.randomUUID(), headers = { "x-cart-token": guestToken };
    const variantId = products[0]!.variants[0]!.id;
    await request("/api/v1/cart/items", "PUT", { variantId, quantity: 3 }, headers);
    const missing = await request(`/api/v1/cart/combos/${saved.body.data.id}`, "PUT", { lines: [] }, headers);
    expect(missing.status).toBe(409);
    expect(missing.body.error.code).toBe("CART_CHANGED");
    expect([...store.carts.get(`guest:${guestToken}`)!]).toEqual([[variantId, 3]]);
    const stale = await request(`/api/v1/cart/combos/${saved.body.data.id}`, "PUT", { lines: [{ variantId, quantity: 1 }] }, headers);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CART_CHANGED");
    expect([...store.carts.get(`guest:${guestToken}`)!]).toEqual([[variantId, 3]]);
  });

  it("archives an existing package after a component is unpublished without accepting replacement invalid links", async () => {
    const saved = await save(inputOf(definition(products)));
    const input = inputOf(saved.body.data);
    const originalComponents = input.components;
    products[0]!.variants[0]!.active = false;
    try {
      const archived = await request(`/api/v1/admin/combos/${saved.body.data.id}`, "PUT", { ...input, status: "ARCHIVED", components: [{ variantId: crypto.randomUUID(), quantity: 1 }, { variantId: crypto.randomUUID(), quantity: 1 }] }, { authorization: `Bearer ${token}` });
      expect(archived.status).toBe(200);
      expect(archived.body.data).toMatchObject({ status: "ARCHIVED", components: originalComponents });
      expect((await request("/api/v1/combos")).body.data).not.toContainEqual(expect.objectContaining({ id: saved.body.data.id }));
      expect((await save({ ...input, status: "ARCHIVED" })).status).toBe(422);
    } finally { products[0]!.variants[0]!.active = true; }
  });

  it("only advertises an existing eligible current coupon and reflects changed prices", async () => {
    const couponCode = "COMBO10";
    store.coupons.set(couponCode, { code: couponCode, type: "PERCENTAGE", value: 10, minimumSpend: 100, enabled: true, startsAt: Date.now() - 10000, endsAt: Date.now() + 100000, perUserLimit: 1, used: 0 });
    const saved = await save({ ...inputOf(definition(products)), couponCode });
    expect(saved.body.data.preview.couponOffer).toMatchObject({ code: couponCode, discount: 87.5 });
    products[0]!.variants[0]!.price = 500;
    const current = (await request("/api/v1/combos")).body.data.find((item: { id: string }) => item.id === saved.body.data.id);
    expect(current.total).toBe(900);
    store.coupons.get(couponCode)!.endsAt = Date.now() - 1;
    const expired = (await request("/api/v1/combos")).body.data.find((item: { id: string }) => item.id === saved.body.data.id);
    expect(expired.couponOffer).toBeNull();
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("combo MySQL storage", () => {
  const persistence = new PrismaPersistence();
  const settingsKey = `combos:test-${crypto.randomUUID()}`;
  const token = crypto.randomUUID(), owner = `guest:${token}`;
  let variants: string[] = [];
  beforeAll(async () => { await persistence.connect(); variants = (await persistence.db.productVariant.findMany({ take: 2 })).map(item => item.id); });
  afterAll(async () => {
    await persistence.db.setting.deleteMany({ where: { key: settingsKey } });
    await persistence.db.cart.deleteMany({ where: { guestToken: token } });
    await persistence.disconnect();
  });
  it("restores definitions through settings and atomically rolls back a failed full-cart write", async () => {
    const combo = definition([product("Mango", 475), product("Gongura", 400)]);
    await persistence.saveSetting(settingsKey, [combo]);
    const reloaded = await persistence.getSetting<ComboPackage[]>(settingsKey);
    expect(reloaded).toEqual([combo]);
    const baseline = [{ variantId: variants[0]!, quantity: 2 }];
    await persistence.replaceCartItems(owner, baseline, []);
    await expect(persistence.replaceCartItems(owner, [{ variantId: variants[1]!, quantity: 1 }, { variantId: crypto.randomUUID(), quantity: 1 }], baseline)).rejects.toThrow();
    const cart = await persistence.db.cart.findUniqueOrThrow({ where: { guestToken: token }, include: { items: true } });
    expect(cart.items.map(item => ({ variantId: item.variantId, quantity: item.quantity }))).toEqual([{ variantId: variants[0], quantity: 2 }]);
  });

  it("rejects stale baselines and serializes ordinary writes with package updates", async () => {
    const baseline = [{ variantId: variants[0]!, quantity: 2 }];
    const next = [...baseline, { variantId: variants[1]!, quantity: 1 }];
    await expect(persistence.replaceCartItems(owner, next, [])).rejects.toMatchObject({ code: "CART_CHANGED" });
    await persistence.replaceCartItems(owner, next, baseline);
    await persistence.replaceCartItems(owner, next, baseline); // exact repeated PUT is a replay
    await persistence.saveCartItem(owner, variants[0]!, 3);
    await expect(persistence.replaceCartItems(owner, [{ variantId: variants[0]!, quantity: 4 }, { variantId: variants[1]!, quantity: 2 }], next)).rejects.toMatchObject({ code: "CART_CHANGED" });
    expect(await persistence.readCartItems(owner)).toEqual(expect.arrayContaining([{ variantId: variants[0], quantity: 3 }, { variantId: variants[1], quantity: 1 }]));
    const current = [{ variantId: variants[0]!, quantity: 3 }, { variantId: variants[1]!, quantity: 1 }];
    const competing = await Promise.allSettled([
      persistence.replaceCartItems(owner, [{ variantId: variants[0]!, quantity: 4 }, { variantId: variants[1]!, quantity: 1 }], current),
      persistence.replaceCartItems(owner, [{ variantId: variants[0]!, quantity: 3 }, { variantId: variants[1]!, quantity: 2 }], current),
    ]);
    expect(competing.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "CART_CHANGED" } });
  });
});
