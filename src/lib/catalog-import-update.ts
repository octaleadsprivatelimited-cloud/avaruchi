import type { CatalogImportProduct } from "./catalog-csv";

type ExistingImportProduct = {
  specifications: Record<string, string>;
  hsnCode?: string;
  seoTitle?: string;
  seoDescription?: string;
  variants: Array<{ id: string; sku: string; title: string; inventory: { onHand: number; reserved: number } }>;
};

/** Retain variant identity and inventory when a reviewed CSV replaces the offered sizes. */
export function catalogImportUpdate(product: CatalogImportProduct, existing: ExistingImportProduct) {
  const used = new Set<string>();
  return {
    ...product,
    specifications: { ...existing.specifications, ...product.specifications },
    hsnCode: existing.hsnCode,
    seoTitle: existing.seoTitle,
    seoDescription: existing.seoDescription,
    variants: product.variants.map(variant => {
      const current = existing.variants.find(item => !used.has(item.id) && item.sku.toLowerCase() === variant.sku.toLowerCase())
        || existing.variants.find(item => !used.has(item.id) && item.title.toLowerCase().replace(/\s/g, "") === variant.title.toLowerCase().replace(/\s/g, ""));
      if (!current) return variant;
      used.add(current.id);
      return { ...variant, id: current.id, sku: current.sku, stock: current.inventory.onHand, reserved: current.inventory.reserved };
    }),
  };
}

export type { ExistingImportProduct };
