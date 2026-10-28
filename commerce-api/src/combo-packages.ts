import { z } from "zod";
import { AppError } from "./errors.js";
import type { StoredProduct } from "./store.js";
import { isSampleProduct, merchantPrice } from "./catalog-discovery.js";

const componentSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
}).strict();

export const comboPackageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  couponCode: z.string().trim().toUpperCase().regex(/^(?:[A-Z0-9_-]{3,40})?$/).default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  components: z.array(componentSchema).min(2).max(10),
}).strict();

export type ComboPackageInput = z.infer<typeof comboPackageSchema>;
export type ComboPackage = ComboPackageInput & { id: string; updatedAt: string };
export const comboPackagesSchema = z.array(comboPackageSchema.extend({
  id: z.string().uuid(), updatedAt: z.string().datetime(),
})).max(100);
export const comboCartSchema = z.object({
  // Absolute snapshot makes repeated PUTs idempotent. No prices are accepted.
  lines: z.array(componentSchema).max(100),
}).strict();

export function normalizeCombo(input: ComboPackageInput, products: StoredProduct[], allowUnavailableArchive = false) {
  const quantities = new Map<string, number>();
  for (const item of input.components)
    quantities.set(item.variantId, (quantities.get(item.variantId) || 0) + item.quantity);
  if ([...quantities.values()].some(quantity => quantity > 20))
    throw new AppError(422, "COMBO_QUANTITY_INVALID", "A combo can include at most 20 of each pack");
  if (input.status === "ARCHIVED" && allowUnavailableArchive)
    return { ...input, components: [...quantities].map(([variantId, quantity]) => ({ variantId, quantity })) };
  const productIds = new Set<string>();
  for (const variantId of quantities.keys()) {
    const product = products.find(item => item.variants.some(variant => variant.id === variantId && variant.active));
    if (!product || product.status === "ARCHIVED" || isSampleProduct(product))
      throw new AppError(422, "COMBO_COMPONENT_INVALID", "Choose existing, non-archived product packs for this combo");
    if (input.status === "ACTIVE" && product.status !== "ACTIVE")
      throw new AppError(422, "COMBO_COMPONENT_UNPUBLISHED", "Publish every included product before publishing this combo");
    productIds.add(product.id);
  }
  if (productIds.size < 2)
    throw new AppError(422, "COMBO_PRODUCTS_REQUIRED", "Choose packs from at least two different products");
  return { ...input, components: [...quantities].map(([variantId, quantity]) => ({ variantId, quantity })) };
}

export function resolveCombo(combo: ComboPackage, products: StoredProduct[]) {
  const issues: string[] = [];
  let subtotal = 0, tax = 0;
  const components = combo.components.flatMap(component => {
    const product = products.find(item => item.variants.some(variant => variant.id === component.variantId));
    const variant = product?.variants.find(item => item.id === component.variantId);
    if (!product || !variant || !variant.active || product.status !== "ACTIVE" || isSampleProduct(product)) {
      issues.push("An included product or pack is no longer published");
      return [];
    }
    const image = product.media.filter(item => item.type === "IMAGE" && (!item.variantId || item.variantId === variant.id)).sort((a, b) => a.position - b.position)[0];
    subtotal += variant.price * component.quantity;
    tax += variant.price * component.quantity * product.taxRate / 100;
    return [{
      productId: product.id, slug: product.slug, name: product.name,
      variantId: variant.id, pack: variant.title, quantity: component.quantity,
      unitPrice: merchantPrice(variant.price, product.taxRate),
      available: Math.max(0, variant.stock - variant.reserved),
      image: image?.url, imageAlt: image?.alt || product.name,
    }];
  });
  const quantityAvailable = issues.length || !components.length ? 0 : Math.min(...components.map(item => Math.floor(item.available / item.quantity)));
  return {
    id: combo.id, name: combo.name, description: combo.description, status: combo.status,
    updatedAt: combo.updatedAt, components,
    total: Math.round((subtotal + Math.round(tax * 100) / 100) * 100) / 100,
    currency: "INR", available: quantityAvailable, issues: [...new Set(issues)],
  };
}

export function comboCartLines(combo: ComboPackage, baseline: Array<{ variantId: string; quantity: number }>, products: StoredProduct[]) {
  const resolved = resolveCombo(combo, products);
  if (combo.status !== "ACTIVE" || resolved.issues.length)
    throw new AppError(409, "COMBO_UNAVAILABLE", "This combo is no longer available");
  const totals = new Map<string, number>();
  for (const line of [...baseline, ...combo.components])
    totals.set(line.variantId, (totals.get(line.variantId) || 0) + line.quantity);
  if (totals.size > 100) throw new AppError(422, "CART_LIMIT", "Your cart can include at most 100 different packs");
  return [...totals].map(([variantId, quantity]) => {
    const product = products.find(item => item.variants.some(variant => variant.id === variantId && variant.active));
    const variant = product?.variants.find(item => item.id === variantId);
    if (!product || !variant || product.status !== "ACTIVE")
      throw new AppError(409, "PRODUCT_UNAVAILABLE", "An item in your cart is no longer available");
    if (quantity > 20) throw new AppError(409, "CART_QUANTITY_LIMIT", `Your cart can include at most 20 of ${product.name} (${variant.title})`);
    if (variant.stock - variant.reserved < quantity)
      throw new AppError(409, "INSUFFICIENT_STOCK", `Not enough stock for ${product.name} (${variant.title}). Your cart has not changed.`);
    return { productId: product.id, variantId, quantity };
  });
}

/** Compare complete cart snapshots; a retry of the same absolute PUT is safe. */
export function assertComboCartBaseline(
  current: Array<{ variantId: string; quantity: number }>,
  expected: Array<{ variantId: string; quantity: number }>,
  final: Array<{ variantId: string; quantity: number }>,
) {
  const canonical = (lines: Array<{ variantId: string; quantity: number }>) => {
    const quantities = new Map<string, number>();
    for (const line of lines) quantities.set(line.variantId, (quantities.get(line.variantId) || 0) + line.quantity);
    return JSON.stringify([...quantities].sort(([a], [b]) => a.localeCompare(b)));
  };
  const actual = canonical(current);
  if (actual === canonical(final)) return { replayed: true };
  if (actual !== canonical(expected))
    throw new AppError(409, "CART_CHANGED", "Your bag changed in another window. Refresh and review your bag before adding this combo. No items were replaced.");
  return { replayed: false };
}
