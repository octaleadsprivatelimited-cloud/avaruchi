import { categoryParts } from "./catalog-categories";

export type DietFilter = "all" | "veg" | "non-veg";
type DietProduct = { category: string; specifications?: Record<string, string> };
const normalized = (value: string) => value.trim().toLowerCase().replace(/[\s_\-–—]+/g, "");

export function normalizeDietFilter(value?: string | null): DietFilter {
  const filter = value?.trim().toLowerCase();
  return filter === "veg" || filter === "non-veg" ? filter : "all";
}

/** Explicit admin classification wins; unfamiliar products are never assumed vegetarian. */
export function productDiet(product: DietProduct): Exclude<DietFilter, "all"> | undefined {
  const explicit = Object.entries(product.specifications || {}).find(([key]) => normalized(key) === "diettype")?.[1]?.trim();
  if (explicit) {
    const value = normalized(explicit);
    if (["veg", "vegetarian", "vegan"].includes(value)) return "veg";
    if (["nonveg", "nonvegetarian"].includes(value)) return "non-veg";
    return undefined;
  }
  const root = normalized(categoryParts(product.category)[0] || "");
  if (root === "nonvegpickles") return "non-veg";
  if (["pickles", "powders", "fryums"].includes(root)) return "veg";
  return undefined;
}

export function matchesDiet(product: DietProduct, filter: DietFilter) {
  return filter === "all" || productDiet(product) === filter;
}
