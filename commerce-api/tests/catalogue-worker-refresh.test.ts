import crypto from "node:crypto";
import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { AppError } from "../src/errors.js";
import { PrismaPersistence } from "../src/persistence.js";
import { SecretVault } from "../src/security.js";
import { CommerceStore, seedStore, type StoredProduct } from "../src/store.js";

const config: AppConfig = {
  NODE_ENV: "test", PORT: 0, DATABASE_URL: "mysql://unused", USE_DATABASE: false,
  JWT_SECRET: "test-access-secret-that-is-at-least-32-chars", JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars",
  INTEGRATION_ENCRYPTION_KEY: "test-encryption-key-that-is-at-least-32-chars", CORS_ORIGINS: "http://localhost:5180", TRUST_PROXY: "",
  UPLOAD_DIR: "uploads", PUBLIC_UPLOAD_BASE_URL: "http://localhost:4010/uploads",
};
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
function checkout(variantId: string) { return { lines: [{ variantId, quantity: 1 }], postalCode: "500081", paymentProvider: "razorpay", contact: { name: "Refresh buyer", email: "refresh@example.com", phone: "9876543210" }, shippingAddress: { line1: "Fixture street", city: "Hyderabad", state: "Telangana", country: "IN" } }; }

async function fixture() {
  const store = new CommerceStore(); let catalog: StoredProduct[] = [];
  let nextRead: ReturnType<typeof deferred> | undefined;
  const providerStarted = deferred(), releaseProvider = deferred();
  const publications: boolean[] = [];
  const persistence = {
    connect: vi.fn(async () => {}), hydrate: vi.fn(async () => { seedStore(store); catalog = structuredClone(store.listProducts()); }),
    getSetting: vi.fn(async () => null),
    refreshCatalog: vi.fn(async (_store: CommerceStore, canPublish: () => boolean) => {
      const snapshot = structuredClone(catalog), wait = nextRead; nextRead = undefined;
      if (wait) await wait.promise;
      const publish = canPublish(); publications.push(publish);
      if (publish) store.products = new Map(snapshot.map(product => [product.id, product]));
      return publish;
    }),
    readCartItems: vi.fn(async () => [{ variantId: catalog[0]!.variants[0]!.id, quantity: 1 }]),
    saveOrderAndReservations: vi.fn(async () => { throw new AppError(409, "CHECKOUT_PRICE_CHANGED", "Changed in another worker"); }),
  };
  const result = await createApp({ config, store, persistence: persistence as unknown as PrismaPersistence, providerRequest: vi.fn(async () => { providerStarted.resolve(); await releaseProvider.promise; return new Response(JSON.stringify({ id: "gateway-refresh-fixture" })); }) as typeof fetch });
  store.integrations.set("refresh-provider", { id: "refresh-provider", kind: "PAYMENT", provider: "razorpay", enabled: true, priority: 1, environment: "TEST", publicConfig: {}, encryptedCredentials: new SecretVault(config.INTEGRATION_ENCRYPTION_KEY).encrypt({ keyId: "rzp_test_fixture", keySecret: "fixture-only-secret" }), updatedAt: new Date().toISOString() });
  const server = result.app.listen(0); servers.push(server); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  return { ...result, persistence, catalog, publications, providerStarted, releaseProvider, request, holdNextRead: () => { nextRead = deferred(); return nextRead; } };
}

it("reloads current prices, availability, search results and cart data after another worker changes the catalogue", async () => {
  const f = await fixture(), product = f.catalog[0]!, variant = product.variants[0]!;
  for (const pack of product.variants) { pack.price = 432; pack.mrp = 432; } product.taxRate = 0;
  expect((await f.request(`/api/v1/products/${product.id}`)).body.data.variants[0].price).toBe(432);
  expect((await f.request(`/api/v1/search/suggestions?q=${encodeURIComponent(product.name)}`)).body.data.find((item: any) => item.id === product.id)?.price).toBe(432);
  expect((await f.request("/api/v1/cart")).body.data[0].variant.price).toBe(432);
  const quote = await f.request("/api/v1/checkout/quote", { lines: [{ variantId: variant.id, quantity: 1 }], postalCode: "500081", paymentProvider: "cod" });
  expect(quote.status).toBe(200); expect(quote.body.data.subtotal).toBe(432);
  product.status = "ARCHIVED";
  expect((await f.request(`/api/v1/products/${product.id}`)).status).toBe(404);
  expect((await f.request("/api/v1/products")).body.data.some((item: any) => item.id === product.id)).toBe(false);
  expect((await f.request("/api/v1/cart")).body.data).toEqual([]);
  expect((await f.request("/api/v1/checkout/quote", { lines: [{ variantId: variant.id, quantity: 1 }], postalCode: "500081", paymentProvider: "cod" })).status).toBe(409);
});

it("does not replace pending local reservations with a catalogue read that finishes during checkout", async () => {
  const f = await fixture(), variantId = f.catalog[0]!.variants[0]!.id;
  const wait = f.holdNextRead(), refresh = f.refreshCatalog();
  const checkoutRequest = f.request("/api/v1/checkout", checkout(variantId));
  try {
    await f.providerStarted.promise;
    const reservedVariant = f.store.getVariant(variantId).variant;
    expect(reservedVariant.reserved).toBe(1);
    wait.resolve(); await refresh;
    expect(f.publications.at(-1)).toBe(false);
    expect(f.store.getVariant(variantId).variant).toBe(reservedVariant);
    const reads = f.persistence.refreshCatalog.mock.calls.length;
    await f.request("/api/v1/products");
    expect(f.persistence.refreshCatalog).toHaveBeenCalledTimes(reads);
    expect(reservedVariant.reserved).toBe(1);
  } finally { wait.resolve(); f.releaseProvider.resolve(); }
  expect((await checkoutRequest).status).toBe(409);
  expect(f.store.getVariant(variantId).variant.reserved).toBe(0);
  f.catalog[0]!.variants[0]!.price = 654;
  expect((await f.request(`/api/v1/products/${f.catalog[0]!.id}`)).body.data.variants[0].price).toBe(654);
  expect(f.publications.at(-1)).toBe(true);
});

it("rejects an old in-flight catalogue snapshot even after its overlapping checkout has fully rolled back", async () => {
  const f = await fixture(), variantId = f.catalog[0]!.variants[0]!.id;
  const wait = f.holdNextRead(), refresh = f.refreshCatalog();
  const checkoutRequest = f.request("/api/v1/checkout", checkout(variantId));
  await f.providerStarted.promise;
  f.releaseProvider.resolve();
  expect((await checkoutRequest).status).toBe(409);
  wait.resolve(); await refresh;
  expect(f.publications.at(-1)).toBe(false);
  expect(f.store.getVariant(variantId).variant.reserved).toBe(0);
});

it("refreshes only catalogue data and publishes a complete map atomically, excluding removed products", async () => {
  const store = new CommerceStore(); seedStore(store);
  const user = store.createUser({ name: "Existing customer", email: "existing@example.com", role: "CUSTOMER", permissions: [] });
  const source = store.listProducts()[0]!, now = new Date();
  const rows = [{ ...source, taxRate: String(source.taxRate), category: { name: source.category }, brand: { name: source.brand }, createdAt: now, updatedAt: now, variants: source.variants.map(variant => ({ ...variant, price: "777.00", mrp: "777.00", inventory: { onHand: 9, reserved: 2 } })) }];
  const query = vi.fn(async () => rows);
  const persistence = new PrismaPersistence({ product: { findMany: query } } as unknown as PrismaClient);
  const original = store.products;
  expect(await persistence.refreshCatalog(store, () => false)).toBe(false);
  expect(store.products).toBe(original);
  expect(await persistence.refreshCatalog(store)).toBe(true);
  expect(store.products).not.toBe(original); expect(store.products.size).toBe(1);
  expect(store.getVariant(source.variants[0]!.id).variant).toMatchObject({ price: 777, stock: 9, reserved: 2 });
  expect(store.users.get(user.id)).toBe(user);
  expect(query).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null }, include: { category: true, brand: true, variants: { include: { inventory: true } }, media: { orderBy: { position: "asc" } } } }));
});
