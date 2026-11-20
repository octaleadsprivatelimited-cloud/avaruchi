import crypto from "node:crypto";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { SINGLE_ADMIN_EMAIL } from "../src/auth-policy.js";
import type { AppConfig } from "../src/config.js";
import type { PrismaPersistence } from "../src/persistence.js";
import { SecretVault, signAccessToken } from "../src/security.js";
import { CommerceStore, seedStore, type StoredOrder, type StoredUser } from "../src/store.js";

const config: AppConfig = {
  NODE_ENV: "test", PORT: 0, DATABASE_URL: "mysql://unused", USE_DATABASE: false,
  JWT_SECRET: "test-access-secret-that-is-at-least-32-chars", JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars",
  INTEGRATION_ENCRYPTION_KEY: "test-encryption-key-that-is-at-least-32-chars", CORS_ORIGINS: "http://localhost:5180", TRUST_PROXY: "",
  UPLOAD_DIR: "uploads", PUBLIC_UPLOAD_BASE_URL: "http://localhost:4010/uploads",
};
const signingSecret = "isolated-worker-webhook-fixture";
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });

async function fixture(provider = "razorpay") {
  const store = new CommerceStore(), durable = new Map<string, StoredOrder>();
  const users = new Map<string, StoredUser>();
  const persistence = {
    connect: vi.fn(async () => {}), hydrate: vi.fn(async () => seedStore(store)), getSetting: vi.fn(async () => null),
    findAuthUser: vi.fn(async ({ id }: { id: string }) => users.get(id)),
    getCustomerAccountState: vi.fn(async (id: string) => ({ exists: users.has(id), customer: users.has(id), disabled: false, authVersion: 0, user: users.get(id) })),
    refreshOrder: vi.fn(async (_store: CommerceStore, id: string) => {
      const current = durable.get(id);
      if (current) store.orders.set(id, structuredClone(current)); else store.orders.delete(id);
      return current || null;
    }),
    resolvePaymentWebhook: vi.fn(async () => ({ orderId: "durable-order", paymentId: "durable-payment", amount: 100, currency: "INR" })),
    resolveShipmentWebhook: vi.fn(async () => ({ orderId: "durable-order", shipmentId: "durable-shipment" })),
    processWebhook: vi.fn(async (input: { orderId?: string; to?: string; paymentStatus?: string }) => {
      if (input.orderId && input.to) {
        const order = durable.get(input.orderId)!;
        if (input.paymentStatus === "CAPTURED" && ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.payment?.status || "")) return { duplicate: true };
        order.status = input.to;
        if (input.paymentStatus) order.payment!.status = input.paymentStatus;
      }
      return { duplicate: false };
    }),
    completeRefund: vi.fn(async () => {}), failRefund: vi.fn(async () => {}),
    db: { refund: { findUnique: vi.fn(async () => ({ id: "durable-refund", externalId: "gateway-refund", amount: 10, status: "PENDING", payment: { orderId: "durable-order", externalId: "gateway-order", provider: "cashfree" } })) } },
  };
  const { app } = await createApp({ config, store, persistence: persistence as unknown as PrismaPersistence });
  const owner = store.createUser({ name: "Owner", email: "worker-owner@example.com", role: "CUSTOMER", permissions: [] });
  const other = store.createUser({ name: "Other", email: "worker-other@example.com", role: "CUSTOMER", permissions: [] });
  const admin = store.createUser({ name: "Admin", email: SINGLE_ADMIN_EMAIL, role: "ADMIN", permissions: ["*"] });
  for (const user of [owner, other, admin]) users.set(user.id, user);
  const product = store.listProducts()[0]!, variant = product.variants[0]!;
  const order: StoredOrder = { id: "durable-order", number: "AVA-WORKER", userId: owner.id, status: "PAYMENT_PENDING", lines: [{ variantId: variant.id, name: product.name, sku: variant.sku, quantity: 1, unitPrice: 100, tax: 0 }], subtotal: 100, tax: 0, shipping: 0, discount: 0, total: 100, idempotencyKey: "worker-order", history: [], createdAt: new Date().toISOString(), payment: { provider, externalId: "gateway-order", amount: 100, currency: "INR", status: "PENDING" } };
  durable.set(order.id, order);
  store.integrations.set("worker-provider", { id: "worker-provider", kind: provider === "shiprocket" ? "SHIPPING" : "PAYMENT", provider, enabled: true, priority: 1, environment: "TEST", publicConfig: {}, encryptedCredentials: new SecretVault(config.INTEGRATION_ENCRYPTION_KEY).encrypt({ webhookSecret: signingSecret, clientSecret: signingSecret }), updatedAt: new Date().toISOString() });
  const server = app.listen(0); servers.push(server); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const webhook = async (body: unknown, valid = true) => {
    const raw = JSON.stringify(body), timestamp = String(Date.now());
    const hmac = crypto.createHmac("sha256", signingSecret);
    const signature = provider === "cashfree" ? hmac.update(timestamp).update(raw).digest("base64") : hmac.update(raw).digest("hex");
    const response = await fetch(`${base}/webhooks/${provider}`, { method: "POST", headers: { "content-type": "application/json", "x-webhook-signature": valid ? signature : "invalid", "x-webhook-timestamp": timestamp }, body: raw });
    return { status: response.status, body: await response.json() as any };
  };
  const invoice = async (user?: StoredUser) => {
    const token = user && signAccessToken({ sub: user.id, role: user.role, permissions: user.permissions, authVersion: 0 }, config.JWT_SECRET);
    const response = await fetch(`${base}/api/v1/orders/${order.id}/invoice`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.status, headers: response.headers, body: await response.arrayBuffer() };
  };
  return { store, durable, order, owner, other, admin, persistence, webhook, invoice };
}
const capture = (notes?: unknown, amount = 10000) => ({ id: crypto.randomUUID(), event: "payment.captured", payload: { payment: { entity: { id: "gateway-payment", order_id: "gateway-order", amount, currency: "INR", notes } } } });

describe("verified webhooks on cold and stale workers", () => {
  it.each(["cold", "stale"])('processes a bound capture using the durable order on a %s worker', async cache => {
    const f = await fixture();
    if (cache === "stale") f.store.orders.set(f.order.id, { ...structuredClone(f.order), status: "DELIVERED" });
    const response = await f.webhook(capture());
    expect(response.status).toBe(202);
    expect(f.persistence.processWebhook).toHaveBeenCalledWith(expect.objectContaining({ orderId: f.order.id, from: "PAYMENT_PENDING", to: "PAID", paymentId: "durable-payment", paymentStatus: "CAPTURED" }));
    expect(f.store.orders.get(f.order.id)).toMatchObject({ status: "PAID", payment: { status: "CAPTURED" } });
  });
  it.each(["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"])("acknowledges a settled capture without rolling %s backwards", async status => {
    const f = await fixture(); f.order.status = status; f.order.payment!.status = status === "REFUNDED" ? "REFUNDED" : "CAPTURED";
    f.store.orders.set(f.order.id, { ...structuredClone(f.order), status: "PAYMENT_PENDING", payment: { ...f.order.payment, status: "PENDING" } });
    const response = await f.webhook(capture());
    expect(response.status).toBe(200); expect(response.body.data.duplicate).toBe(true);
    expect(f.order.status).toBe(status);
    expect(f.persistence.processWebhook).toHaveBeenCalledWith(expect.objectContaining({ orderId: f.order.id, paymentId: "durable-payment", paymentStatus: "CAPTURED", paymentCurrency: "INR" }));
    expect(f.store.orders.get(f.order.id)?.status).toBe(status);
  });
  it("does not load or change orders before signature, resource and amount validation", async () => {
    const f = await fixture();
    expect((await f.webhook(capture(), false)).status).toBe(401);
    expect((await f.webhook(capture({ internalOrderId: "different-order" }))).status).toBe(422);
    expect((await f.webhook(capture(undefined, 1))).status).toBe(422);
    expect(f.persistence.refreshOrder).not.toHaveBeenCalled(); expect(f.persistence.processWebhook).not.toHaveBeenCalled();
  });
  it("processes a bound shipment after loading its order on a cold worker", async () => {
    const f = await fixture("shiprocket"); f.order.status = "SHIPPED";
    expect((await f.webhook({ id: crypto.randomUUID(), event: "shipment.out_for_delivery", awb: "fixture-awb" })).status).toBe(202);
    expect(f.persistence.processWebhook).toHaveBeenCalledWith(expect.objectContaining({ orderId: f.order.id, from: "SHIPPED", to: "OUT_FOR_DELIVERY", shipmentId: "durable-shipment" }));
  });
  it("resolves a signed Cashfree refund on a cold worker", async () => {
    const f = await fixture("cashfree"); f.order.status = "PAID";
    const response = await f.webhook({ type: "REFUND_STATUS_WEBHOOK", data: { refund: { refund_id: "gateway-refund", order_id: "gateway-order", refund_status: "SUCCESS", refund_amount: 10 } } });
    expect(response.status).toBe(200); expect(f.persistence.refreshOrder).toHaveBeenCalledWith(f.store, f.order.id);
    expect(f.persistence.completeRefund).toHaveBeenCalledWith("durable-refund", "gateway-refund");
  });
});

describe("durable invoice authorization", () => {
  it("serves owners, the wildcard admin and explicit readers while denying other customers and anonymous requests", async () => {
    const f = await fixture();
    expect((await f.invoice()).status).toBe(401);
    expect(f.persistence.refreshOrder).not.toHaveBeenCalled();
    expect((await f.invoice(f.other)).status).toBe(404);
    for (const user of [f.owner, f.admin]) {
      f.store.orders.delete(f.order.id);
      const response = await f.invoice(user);
      expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("application/pdf");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(Buffer.from(response.body).subarray(0, 4).toString()).toBe("%PDF");
    }
    f.admin.permissions = ["orders:read"];
    expect((await f.invoice(f.admin)).status).toBe(200);
    f.admin.permissions = [];
    expect((await f.invoice(f.admin)).status).toBe(404);
    f.durable.delete(f.order.id);
    expect((await f.invoice(f.owner)).status).toBe(404);
    expect(f.store.orders.has(f.order.id)).toBe(false);
  });
});
