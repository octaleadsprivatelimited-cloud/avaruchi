import { expect, it } from "vitest";
const source = "../../src/lib/catalog-diet.ts";
const { matchesDiet, normalizeDietFilter, productDiet } = await import(source);

it("separates the approved vegetarian and non-vegetarian category branches", () => {
  const vegetarian = ["Pickles > Avakaya", "Veg pickles > Traditional pickles", "All pickles", "Powders > Karam podis", "Fryums > Vadiyalu"];
  for (const category of vegetarian) {
    expect(productDiet({ category })).toBe("veg");
    expect(matchesDiet({ category }, "non-veg")).toBe(false);
  }
  const nonVeg = { category: "Non-veg pickles > Chicken pickles" };
  expect(matchesDiet(nonVeg, "non-veg")).toBe(true);
  expect(matchesDiet(nonVeg, "veg")).toBe(false);
});

it("honours explicit admin classification before the category and normalizes its spelling", () => {
  expect(productDiet({ category: "Pickles", specifications: { "Diet type": "Non-vegetarian" } })).toBe("non-veg");
  expect(productDiet({ category: "Custom", specifications: { diet_type: " Non Veg " } })).toBe("non-veg");
  expect(productDiet({ category: "Custom", specifications: { "Diet-type": "nonveg" } })).toBe("non-veg");
  expect(productDiet({ category: "Custom", specifications: { "Diet type": "Vegetarian" } })).toBe("veg");
  expect(productDiet({ category: "Custom", specifications: { "Diet type": "Veg" } })).toBe("veg");
});

it("keeps unknown or unclassified products in All without assuming that they are vegetarian", () => {
  for (const product of [{ category: "Custom foods" }, { category: "Pickles", specifications: { "Diet type": "Awaiting confirmation" } }]) {
    expect(productDiet(product)).toBeUndefined();
    expect(matchesDiet(product, "all")).toBe(true);
    expect(matchesDiet(product, "veg")).toBe(false);
    expect(matchesDiet(product, "non-veg")).toBe(false);
  }
});

it("normalizes shareable diet filters and ignores unsupported query values", () => {
  expect(normalizeDietFilter("veg")).toBe("veg");
  expect(normalizeDietFilter("NON-VEG")).toBe("non-veg");
  for (const value of [undefined, null, "", "all", "pescatarian", "nonveg", "<script>"]) expect(normalizeDietFilter(value)).toBe("all");
});
