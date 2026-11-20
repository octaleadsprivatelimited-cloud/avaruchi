import { afterEach, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/commerce-api", () => ({ commerceApi: request }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); request.mockReset(); });

it("refreshes the catalogue without reporting failure when cross-tab storage is blocked", async () => {
  vi.stubGlobal("window", {});
  const write = vi.fn(() => { throw new Error("Storage is unavailable"); });
  vi.stubGlobal("localStorage", { setItem: write });
  request.mockResolvedValue([{ id: "updated-product", name: "Updated product", slug: "updated-product", category: "Pickles", status: "ACTIVE", variants: [] }]);
  const source = "../../src/lib/store-products.ts";
  const { notifyStoreCatalogChanged, getStoreProductsSnapshot } = await import(source);
  expect(() => notifyStoreCatalogChanged()).not.toThrow();
  await vi.waitFor(() => expect(getStoreProductsSnapshot()[0]?.id).toBe("updated-product"));
  expect(request).toHaveBeenCalledWith("/api/v1/products");
  expect(write).toHaveBeenCalledOnce();
});

it("continues broadcasting catalogue changes when browser storage is available", async () => {
  vi.stubGlobal("window", {});
  const write = vi.fn();
  vi.stubGlobal("localStorage", { setItem: write });
  request.mockResolvedValue([]);
  const source = "../../src/lib/store-products.ts";
  const { notifyStoreCatalogChanged } = await import(source);
  notifyStoreCatalogChanged();
  expect(write).toHaveBeenCalledWith("avaruchi_commerce_catalog_changed_at", expect.stringMatching(/^\d+$/));
});
