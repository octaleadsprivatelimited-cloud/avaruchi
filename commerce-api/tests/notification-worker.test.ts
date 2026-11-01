import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../src/config.js";
import { SecretVault } from "../src/security.js";
import { processNotificationBatch } from "../src/notification-worker.js";
const config = { NODE_ENV: "test", INTEGRATION_ENCRYPTION_KEY: "x".repeat(32) } as AppConfig;
function fixture(configured = true, firstAttemptAt?: Date, template = "order.confirmed", payload: Record<string, unknown> = { orderNumber: "RU-1" }) {
  const notification = { id: "notification-1", template, channel: "EMAIL", destination: "buyer@example.com", payload, attempts: 0, firstAttemptAt };
  const update = vi.fn(async (_args: { data: Record<string, unknown> }) => ({}));
  const query = vi.fn(async (_sql: TemplateStringsArray) => [{ id: notification.id }]);
  const tx = { $queryRaw: query, notification: { updateMany: vi.fn(async () => ({ count: 1 })), findMany: vi.fn(async () => [notification]) } };
  const encrypted = Buffer.from(new SecretVault(config.INTEGRATION_ENCRYPTION_KEY).encrypt({ apiKey: "test-secret" }), "base64");
  const publicConfig = { fromEmail: "orders@example.com", fromName: "Store" };
  const db = { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx), notification: { update }, integrationConfig: { findFirst: vi.fn(async () => configured ? { encryptedCredentials: encrypted, publicConfig } : null) } };
  return { db: db as unknown as PrismaClient, update, query, publicConfig };
}
describe("notification delivery", () => {
  it("delivers merchant alerts through the same durable outbox", async () => {
    const f = fixture(true, undefined, "order.received");
    const request = vi.fn(async () => new Response(JSON.stringify({ id: "merchant-message" }), { status: 200 }));
    expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ sent: 1 });
    expect(f.query.mock.calls[0]?.[0].join(" ")).toContain("'order.received'");
    const [, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ subject: "New order RU-1 — Our store" });
  });
  it("claims MySQL rows and sends a stable Resend idempotency key before marking SENT", async () => {
    const f = fixture(); const request = vi.fn(async () => new Response(JSON.stringify({ id: "resend-id" }), { status: 200 }));
    expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ processed: 1, sent: 1 });
    expect(f.query.mock.calls[0]?.[0].join(" ")).toContain("`Notification`");
    const call = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://api.resend.com/emails");
    expect(call[1].headers).toMatchObject({ "idempotency-key": "notification-1" });
    expect(JSON.parse(String(call[1].body))).toMatchObject({ to: "buyer@example.com", subject: expect.stringContaining("RU-1") });
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SENT", providerMessageId: "resend-id" }) }));
  });
  it("defers missing credentials without exhausting attempts or pretending mail was sent", async () => {
    const f = fixture(false); const request = vi.fn();
    expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ sent: 0, deferred: 1 });
    expect(request).not.toHaveBeenCalled();
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED", attempts: 0 }) }));
  });
  it("does not resend an uncertain delivery after the provider idempotency window", async () => {
    const f = fixture(true, new Date(Date.now() - 24 * 60 * 60_000)); const request = vi.fn();
    expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ sent: 0, failed: 1 });
    expect(request).not.toHaveBeenCalled();
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", error: expect.stringContaining("safe idempotency window") }) }));
  });
  it.each([new Response("{}", { status: 500 }), new Response("{}", { status: 200 })])("retries provider failure or missing acknowledgment without marking SENT", async response => {
    const f = fixture();
    expect(await processNotificationBatch({ ...f, config, request: async () => response })).toMatchObject({ sent: 0, retried: 1 });
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED", attempts: 1 }) }));
  });
});


const invoicePayload = {
  orderId: "fixture-order", orderNumber: "AVA-000042", storeName: "Aavaruchi", placedAt: "2026-11-01T04:30:00.000Z", currency: "INR",
  customer: { name: "Meera", email: "buyer@example.com", phone: "+919876543210" }, address: "Hyderabad, Telangana, 500013, IN", paymentLabel: "Paid online",
  charges: { subtotal: 100, tax: 5, shipping: 0, discount: 0, total: 105 },
  items: [{ name: "Mango Avakaya", sku: "MANGO-500", pack: "500 g", quantity: 1, unitPrice: 100, tax: 5 }],
  invoice: {
    store: { name: "Aavaruchi", legalName: "Aavaruchi Foods", address: "Hyderabad, Telangana, India", email: "contact@example.com" },
    order: {
      number: "AVA-000042", createdAt: "2026-11-01T04:30:00.000Z", status: "PAID", paymentStatus: "Paid", subtotal: 100, tax: 5, shipping: 0, discount: 0, total: 105,
      lines: [{ name: "Mango Avakaya", sku: "MANGO-500", pack: "500 g", quantity: 1, unitPrice: 100, tax: 5, taxRate: 5 }],
      snapshot: { contact: { name: "Meera", email: "buyer@example.com" }, shipping: { line1: "Main Road", city: "Hyderabad", state: "Telangana", postalCode: "500013", country: "IN" } },
    },
  },
};

it("attaches a real PDF only to customer confirmations and keeps retry content identical", async () => {
  const bodies: string[] = [];
  const request = vi.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response(bodies.length === 1 ? "{}" : JSON.stringify({ id: "invoice-delivered" }), { status: bodies.length === 1 ? 500 : 200 });
  });
  const first = fixture(true, undefined, "order.confirmed", invoicePayload);
  expect(await processNotificationBatch({ ...first, config, request })).toMatchObject({ sent: 0, retried: 1 });
  const frozenWrite = first.update.mock.calls.find(([args]) => Boolean((args as { data?: { payload?: unknown } }).data?.payload))?.[0] as unknown as { data: { payload: Record<string, unknown>; firstAttemptAt: Date } };
  expect(frozenWrite.data.payload._emailDelivery).toMatchObject({ version: 1, template: "order.confirmed", body: expect.any(String) });
  const changedPayload = { ...frozenWrite.data.payload, storeName: "A different brand", orderNumber: "changed-order", customer: { name: "Changed customer" }, invoice: { invalid: true } };
  const second = fixture(true, frozenWrite.data.firstAttemptAt, "order.confirmed", changedPayload);
  second.publicConfig.fromEmail = "new-sender@example.com";
  second.publicConfig.fromName = "Changed sender";
  expect(await processNotificationBatch({ ...second, config, request })).toMatchObject({ sent: 1 });
  expect(bodies[0]).toBe(bodies[1]);
  const body = JSON.parse(bodies[0]!);
  expect(body.attachments).toHaveLength(1);
  expect(body.attachments[0]).toMatchObject({ filename: "invoice-AVA-000042.pdf", content_type: "application/pdf" });
  expect(Buffer.from(body.attachments[0].content, "base64").subarray(0, 5).toString()).toBe("%PDF-");
  expect(body.html).toContain("Your invoice is attached");
  expect(body.text).toContain("Your PDF invoice is attached");

  const merchantRequest = vi.fn(async () => new Response(JSON.stringify({ id: "merchant-only" }), { status: 200 }));
  expect(await processNotificationBatch({ ...fixture(true, undefined, "order.received", invoicePayload), config, request: merchantRequest })).toMatchObject({ sent: 1 });
  const [, init] = merchantRequest.mock.calls[0] as unknown as [string, RequestInit];
  const merchant = JSON.parse(String(init.body));
  expect(merchant.attachments).toBeUndefined();
  expect(merchant.html).not.toContain("Your invoice is attached");
});

it("delivers incomplete legacy queued confirmations without promising a missing PDF", async () => {
  const request = vi.fn(async () => new Response(JSON.stringify({ id: "legacy-message" }), { status: 200 }));
  expect(await processNotificationBatch({ ...fixture(), config, request })).toMatchObject({ sent: 1 });
  const [, init] = request.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(String(init.body));
  expect(body.attachments).toBeUndefined();
  expect(body.text).not.toContain("Your PDF invoice is attached");
});


it.each([
  { template: "order.confirmed", hash: "300d3d381625d2ffa0f666a98c6d7d9c2d17c8946439fc74be794c57b4cc8d9d" },
  { template: "order.received", hash: "1aece89f12a145ac8aacedc30f881e5fccf5a6d99fe792fcfd97fa94b0ab9e54" },
])("retries pre-release attempted $template with the exact old body and no PDF", async ({ template, hash }) => {
  const f = fixture(true, new Date(), template);
  const request = vi.fn(async () => new Response(JSON.stringify({ id: "old-delivery" }), { status: 200 }));
  expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ sent: 1 });
  const [, init] = request.mock.calls[0] as unknown as [string, RequestInit];
  // Golden provider JSON from the pre-invoice release.
  expect(createHash("sha256").update(String(init.body)).digest("hex")).toBe(hash);
  expect(JSON.parse(String(init.body)).attachments).toBeUndefined();
  expect(String(init.body)).not.toContain("Your invoice is attached");
  const frozen = f.update.mock.calls.find(([args]) => args.data.payload)?.[0];
  expect(frozen?.data.firstAttemptAt).toEqual(expect.any(Date));
  expect(frozen?.data.payload).toMatchObject({ _emailDelivery: { version: 1, template, body: String(init.body) } });
});

it("defers uncertain invoice attempts with missing snapshots rather than generating a different resend", async () => {
  const f = fixture(true, new Date(), "order.confirmed", invoicePayload), request = vi.fn();
  expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ deferred: 1, sent: 0 });
  expect(request).not.toHaveBeenCalled();
  expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempts: 0, error: expect.stringContaining("snapshot is missing") }) }));
});

it("rejects corrupted or redirected server delivery snapshots without sending private data", async () => {
  for (const frozen of [
    { version: 1, template: "order.received", body: "{}" },
    { version: 1, template: "order.confirmed", body: "invalid JSON" },
    { version: 1, template: "order.confirmed", body: JSON.stringify({ from: "orders@example.com", to: "other@example.com", subject: "Original", html: "<p>Original</p>", text: "Original" }) },
  ]) {
    const f = fixture(true, new Date(), "order.confirmed", { ...invoicePayload, _emailDelivery: frozen }), request = vi.fn();
    expect(await processNotificationBatch({ ...f, config, request })).toMatchObject({ deferred: 1 });
    expect(request).not.toHaveBeenCalled();
    expect(JSON.stringify(f.update.mock.calls)).not.toContain("other@example.com");
  }
});
