import { expect, it } from "vitest";
const source = "../../src/lib/catalog-categories.ts";
const { catalogCategoryTree, matchesCategory } = await import(source);

it("merges legacy pickle collections without losing products or nested categories", () => {
  const products = ["Veg pickles", "All pickles", "Pickles", "Veg pickles > Avakaya", "All pickles > Avakaya", "Powders", "Non-veg pickles"].map(category => ({ category }));
  const tree = catalogCategoryTree(products);
  expect(tree.map((item: { name: string }) => item.name)).toEqual(["Pickles", "Powders", "Non-veg pickles"]);
  expect(tree[0]).toMatchObject({ path: "Pickles", count: 5, children: [{ name: "Avakaya", path: "Pickles > Avakaya", count: 2 }] });
  for (const selected of ["Pickles", "Veg pickles", "All pickles"]) expect(products.filter(product => matchesCategory(product, selected))).toHaveLength(5);
  expect(products.filter(product => matchesCategory(product, "Pickles > Avakaya"))).toHaveLength(2);
  expect(matchesCategory({ category: "Non-veg pickles" }, "Pickles")).toBe(false);
});
