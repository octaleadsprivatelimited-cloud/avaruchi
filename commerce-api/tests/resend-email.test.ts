import type { Server } from "node:http";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { CommerceStore } from "../src/store.js";
import { signAccessToken } from "../src/security.js";
import { EmailConfigurationError, sendResendEmail } from "../src/resend-email.js";

const email = { credentials: { apiKey: "private-resend-key" }, publicConfig: { fromEmail: "orders@store.test", fromName: 'Avaruchi\r\n"Store"', replyTo: "support@store.test" }, destination: "owner@store.test", content: { subject: "Delivery test", html: "<p>Test</p>", text: "Test" }, idempotencyKey: "unique-notification" };
describe("Resend server sender", () => {
  it("uses the configured reply-to and stable idempotency key without injecting headers", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ id: "message-1" }), { status: 200 }));
    expect(await sendResendEmail({ ...email, request })).toBe("message-1");
    const [, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ "idempotency-key": "unique-notification" });
    expect(JSON.parse(String(init.body))).toMatchObject({ from: '"Avaruchi Store" <orders@store.test>', reply_to: "support@store.test", to: "owner@store.test" });
  });
  it("does not send with an invalid sender, reply-to or recipient", async () => {
    const request = vi.fn();
    for (const override of [{ publicConfig: { fromEmail: "bad" } }, { publicConfig: { ...email.publicConfig, replyTo: "bad\r\nBcc: secret@store.test" } }, { destination: "bad\r\nBcc: secret@store.test" }])
      await expect(sendResendEmail({ ...email, ...override, request })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("reports rejected authorization without returning provider payloads or secrets", async () => {
    await expect(sendResendEmail({ ...email, request: async () => new Response(JSON.stringify({ message: "private-resend-key" }), { status: 403 }) })).rejects.toBeInstanceOf(EmailConfigurationError);
    await expect(sendResendEmail({ ...email, request: async () => new Response("{}", { status: 200 }) })).rejects.toThrow("message ID");
  });
});

describe("administrator email delivery check", () => {
  let server: Server, base: string, store: CommerceStore;
  const sent: Array<Record<string, unknown>> = [];
  const config = { NODE_ENV: "test", PORT: 4010, DATABASE_URL: "mysql://test:test@localhost/test", USE_DATABASE: false, JWT_SECRET: "access-secret-".repeat(4), JWT_REFRESH_SECRET: "refresh-secret-".repeat(4), INTEGRATION_ENCRYPTION_KEY: "encryption-key-".repeat(4), CORS_ORIGINS: "http://localhost:5180", TRUST_PROXY: "", UPLOAD_DIR: "/tmp/avaruchi-resend-test", PUBLIC_UPLOAD_BASE_URL: "https://store.test/uploads" } as AppConfig;
  const tokenFor = (role = "ADMIN") => {
    const accountEmail = role === "ADMIN" ? "avaruchi.admin.fixture@gmail.com" : `${crypto.randomUUID()}@store.test`;
    const user = store.findUser(accountEmail) || store.createUser({ email: accountEmail, name: "Administrator", role, permissions: role === "ADMIN" ? ["*"] : [] });
    return { email: user.email, token: signAccessToken({ sub: user.id, role: user.role, permissions: user.permissions }, config.JWT_SECRET) };
  };
  const request = async (path: string, token: string, method = "POST", body?: unknown) => {
    const response = await fetch(`${base}/api/v1/admin/integrations${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    store = new CommerceStore();
    const { app } = await createApp({ config, store, providerRequest: async (_url, init) => { sent.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ id: "resend-test-message" }), { status: 200 }); } });
    server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No test port"); base = `http://127.0.0.1:${address.port}`;
    const admin = tokenFor();
    expect((await request("", admin.token, "PUT", { kind: "EMAIL", provider: "resend", environment: "TEST", enabled: true, priority: 1, credentials: email.credentials, publicConfig: email.publicConfig })).status).toBe(200);
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });
  it("requires settings access and never exposes the sender key", async () => {
    expect((await request("/EMAIL%3Aresend%3ATEST/test-email", "invalid")).status).toBe(401);
    expect((await request("/EMAIL%3Aresend%3ATEST/test-email", tokenFor("CUSTOMER").token)).status).toBe(403);
    expect(sent).toHaveLength(0);
  });
  it("sends only to the authenticated administrator and labels the test without creating orders", async () => {
    const admin = tokenFor(); const ordersBefore = store.orders.size;
    const response = await request("/EMAIL%3Aresend%3ATEST/test-email", admin.token, "POST", { destination: "attacker@other.test" });
    expect(response.status).toBe(200); expect(response.body.data).toMatchObject({ destination: admin.email, providerMessageId: "resend-test-message", integration: { connected: true, lastTest: { outcome: "CONNECTED", message: expect.stringContaining("Confirm receipt") } } });
    expect(sent.at(-1)).toMatchObject({ to: admin.email, subject: "Aavaruchi — order email delivery test", reply_to: "support@store.test" });
    expect(String(sent.at(-1)?.text)).toContain("does not create an order"); expect(store.orders.size).toBe(ordersBefore);
    expect(JSON.stringify(response.body)).not.toContain("private-resend-key");
  });
});
