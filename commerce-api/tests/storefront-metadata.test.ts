import { describe, expect, it } from "vitest";

const metadataModule = "../../src/lib/page-metadata.ts";
const { storefrontMetadata } = await import(metadataModule);
const origin = "https://aavaruchi.in";
const store = { storeName: "Avaruchi", seoTitle: "Avaruchi Pickles", seoDescription: "Pickles from LAKSHMI'S TAPASI TREATS." };
const product = { id: "p-1", slug: "tomato-pickle", name: "Tomato Pickle", category: "All pickles", price: 199, mrp: 199, tone: "", glyph: "", description: "Tangy tomato pickle.", image: "/images/tomato.png", variants: [] };

describe("storefront route metadata", () => {
  it("uses published home SEO settings and includes the editorial routes", () => {
    expect(storefrontMetadata("/", [], store, origin)).toMatchObject({ title: store.seoTitle, description: store.seoDescription, known: true, canonical: `${origin}/` });
    for (const path of ["/our-story", "/journal"]) expect(storefrontMetadata(path, [], store, origin)).toMatchObject({ known: true, robots: "index, follow" });
  });
  it("keeps all private pages and unknown routes out of search", () => {
    for (const path of ["/wishlist", "/account", "/admin/products", "/cart", "/checkout", "/login", "/track", "/transaction/AVA123"]) expect(storefrontMetadata(path, [], store, origin).robots).toBe("noindex, nofollow");
    expect(storefrontMetadata("/missing", [], store, origin)).toMatchObject({ known: false, title: "Page not found | Avaruchi", robots: "noindex, nofollow" });
  });
  it("uses one product canonical and matching metadata for slug, ID and legacy shop links", () => {
    for (const path of ["/product/tomato-pickle", "/product/p-1", "/shop/tomato-pickle"]) {
      const metadata = storefrontMetadata(path, [product], store, origin);
      expect(metadata).toMatchObject({ known: true, title: "Tomato Pickle | Buy Online | Aavaruchi", description: product.description, canonical: `${origin}/product/tomato-pickle`, image: `${origin}/images/tomato.png` });
      expect(metadata.scripts.join("")).toContain("Shop pickles");
      expect(metadata.scripts.join("")).not.toContain("localhost");
    }
  });
  it("renders malformed encoded product links as missing instead of throwing", () => {
    for (const path of ["/product/%E0%A4%A", "/product/%", "/product/missing"]) expect(storefrontMetadata(path, [product], store, origin)).toMatchObject({ known: false, robots: "noindex, nofollow" });
  });
  it("canonicalizes duplicate policies and honors sample noindex metadata", () => {
    for (const path of ["/shipping", "/returns"]) expect(storefrontMetadata(path, [], store, origin).canonical).toBe(`${origin}/shipping-returns`);
    expect(storefrontMetadata("/product/tomato-pickle", [{ ...product, specifications: { "Catalog purpose": "Sample" } }], store, origin)).toMatchObject({ robots: "noindex, follow", scripts: [] });
  });
});
