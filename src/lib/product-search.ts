export function matchesProductSearch(product: { name: string; category: string; description?: string }, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = `${product.name} ${product.category} ${product.description || ""}`.toLocaleLowerCase();
  return terms.every(term => text.includes(term));
}
