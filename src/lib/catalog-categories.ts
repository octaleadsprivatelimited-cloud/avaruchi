export function catalogCategories(products: ReadonlyArray<{ category: string }>) {
  const categories = new Map<string, string>([["all pickles", "All pickles"]]);
  for (const product of products) {
    const category = product.category.trim();
    if (category && !["all", "all pickles"].includes(category.toLowerCase()))
      categories.set(category.toLowerCase(), category);
  }
  return [...categories.values()];
}
