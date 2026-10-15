import { expect, it } from "vitest";
// Browser helpers are transformed by Vitest, outside the API's compilation root.
const searchSource = "../../src/lib/product-search.ts";
const { matchesProductSearch } = await import(searchSource);

const mango = { name: "Mango Avakaya", category: "Veg pickles > Avakaya", description: "Traditional Telugu pickle" };
it("finds products by name, category or ingredient regardless of case and word order", () => {
  expect(matchesProductSearch(mango, "  AVAKAYA mango  ")).toBe(true);
  expect(matchesProductSearch(mango, "veg pickle")).toBe(true);
  expect(matchesProductSearch(mango, "telugu")).toBe(true);
  expect(matchesProductSearch(mango, "mango tomato")).toBe(false);
});
it("handles empty searches and products without descriptions", () => {
  expect(matchesProductSearch(mango, "   ")).toBe(true);
  expect(matchesProductSearch({ name: "Minapa Vadiyalu", category: "Fryums" }, "MINAPA")).toBe(true);
  expect(matchesProductSearch({ name: "Minapa Vadiyalu", category: "Fryums" }, "undefined")).toBe(false);
});
