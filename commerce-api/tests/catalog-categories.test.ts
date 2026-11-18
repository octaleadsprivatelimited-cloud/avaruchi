import { expect, it } from "vitest";
const source = "../../src/lib/catalog-categories.ts";
const { catalogCategoryTree, matchesCategory } = await import(source);

it("merges legacy pickle collections without losing products or nested categories", () => {
  const products = ["Veg pickles", "All pickles", "Pickles", "Veg pickles > Avakaya", "All pickles > Avakaya", "Powders", "Non-veg pickles"].map(category => ({ category }));
  const tree = catalogCategoryTree(products);
  expect(tree.map((item: { name: string }) => item.name)).toEqual(["Pickles", "Non-veg pickles", "Powders"]);
  expect(tree[0]).toMatchObject({ path: "Pickles", count: 5, children: [{ name: "Avakaya", path: "Pickles > Avakaya", count: 2 }] });
  for (const selected of ["Pickles", "Veg pickles", "All pickles"]) expect(products.filter(product => matchesCategory(product, selected))).toHaveLength(5);
  expect(products.filter(product => matchesCategory(product, "Pickles > Avakaya"))).toHaveLength(2);
  expect(matchesCategory({ category: "Non-veg pickles" }, "Pickles")).toBe(false);
});

it("orders non-veg pickles separately and filters their nested categories without including vegetarian pickles", () => {
  const products = ["Fryums > Vadiyalu", "Powders > Karam podis", "Non-veg pickles > Seafood", "Pickles > Avakaya", "Non-veg pickles > Chicken", "Non-veg pickles > Chicken"].map(category => ({ category }));
  const tree = catalogCategoryTree(products);
  expect(tree.map((item: { name: string }) => item.name)).toEqual(["Pickles", "Non-veg pickles", "Powders", "Fryums"]);
  expect(tree[1]).toMatchObject({ path: "Non-veg pickles", count: 3, children: [
    { name: "Seafood", path: "Non-veg pickles > Seafood", count: 1 },
    { name: "Chicken", path: "Non-veg pickles > Chicken", count: 2 },
  ] });
  expect(products.filter(product => matchesCategory(product, "Pickles"))).toHaveLength(1);
  expect(products.filter(product => matchesCategory(product, "Non-veg pickles"))).toHaveLength(3);
  expect(products.filter(product => matchesCategory(product, "Non-veg pickles > Chicken"))).toHaveLength(2);
  expect(matchesCategory({ category: "Pickles > Avakaya" }, "Non-veg pickles")).toBe(false);
});
