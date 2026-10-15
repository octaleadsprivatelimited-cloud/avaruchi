import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig({
  NODE_ENV: "development",
  DATABASE_URL: "mysql://unused:unused@localhost/avaruchi",
  USE_DATABASE: "false",
  JWT_SECRET: "a".repeat(64),
  JWT_REFRESH_SECRET: "b".repeat(64),
  INTEGRATION_ENCRYPTION_KEY: "c".repeat(64),
});

afterEach(() => vi.unstubAllEnvs());

describe("fresh Avaruchi project", () => {
  it("starts empty with Avaruchi branding and disconnected authentication and tracking", async () => {
    vi.stubEnv("SEED_CATALOG", "false");
    const { app, store } = await createApp({ config, persistence: null });
    for (const records of [store.users, store.products, store.orders, store.coupons, store.integrations]) {
      expect(records.size).toBe(0);
    }
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing test address");
      const read = async (path: string) => {
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
        expect(response.status).toBe(200);
        return (await response.json()).data;
      };
      const providers = await read("/api/v1/auth/providers");
      expect(providers.google.enabled).toBe(false);
      expect(providers.firebase.enabled).toBe(false);
      expect(await read("/api/v1/storefront/analytics")).toEqual({});
      expect(await read("/api/v1/products")).toEqual([]);
      expect(await read("/api/v1/storefront/config")).toMatchObject({
        storeName: "Avaruchi", analyticsPromptEnabled: false,
        legalName: "LAKSHMI'S TAPASI TREATS", supportEmail: "", supportPhone: "9932433243", primaryDomain: "",
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("keeps sample catalog code available through an explicit opt-in", async () => {
    vi.stubEnv("SEED_CATALOG", "true");
    const { store } = await createApp({ config, persistence: null });
    expect(store.products.size).toBe(8);
    expect(store.coupons.has("WELCOME10")).toBe(true);
    expect(store.users.size).toBe(0);
    expect(store.integrations.size).toBe(0);
  });
});
