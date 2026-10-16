type CategorizedProduct = { category: string };
export type CatalogCategory = { name: string; path: string; count: number; children: CatalogCategory[] };
export const ALL_PRODUCTS = "All products";

/** Legacy pickle labels share one public category; nested admin categories are preserved. */
export function categoryParts(category: string) {
  const parts = category.split(">").map(part => part.trim()).filter(Boolean);
  if (parts[0] && ["veg pickles", "all pickles", "pickles"].includes(parts[0].toLowerCase())) parts[0] = "Pickles";
  return parts;
}

export function matchesCategory(product: CategorizedProduct, category: string) {
  const selected = categoryParts(category).join(" > ").toLowerCase();
  if (!selected || ["all", "all products"].includes(selected)) return true;
  const path = categoryParts(product.category).join(" > ").toLowerCase();
  return path === selected || path.startsWith(`${selected} > `);
}

export function catalogCategoryTree(products: ReadonlyArray<CategorizedProduct>) {
  const roots: CatalogCategory[] = [];
  for (const product of products) {
    let siblings = roots;
    const parts = categoryParts(product.category);
    for (let index = 0; index < parts.length; index++) {
      const name = parts[index]!;
      if (["all", "all products"].includes(name.toLowerCase())) continue;
      const path = parts.slice(0, index + 1).join(" > ");
      let entry = siblings.find(item => item.path.toLowerCase() === path.toLowerCase());
      if (!entry) { entry = { name, path, count: 0, children: [] }; siblings.push(entry); }
      entry.count++;
      siblings = entry.children;
    }
  }
  const order = ["pickles", "powders", "fryums"];
  roots.sort((a, b) => (order.indexOf(a.name.toLowerCase()) + 1 || 100) - (order.indexOf(b.name.toLowerCase()) + 1 || 100) || a.name.localeCompare(b.name));
  return roots;
}

export function catalogCategories(products: ReadonlyArray<CategorizedProduct>) {
  return [ALL_PRODUCTS, ...catalogCategoryTree(products).map(category => category.path)];
}
