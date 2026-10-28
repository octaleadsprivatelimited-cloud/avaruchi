import { useCallback, useEffect, useMemo, useState } from "react";
import { type Product } from "@/data/commerce";
import {
  getStoreProductsSnapshot,
  useStoreProducts,
} from "@/lib/store-products";
import { commerceApi } from "@/lib/commerce-api";
import { trackCommerceEvent } from "@/lib/analytics";
import { commerceAmount, productAnalyticsItem } from "@/lib/commerce-analytics";
import type { ComboCartResponse } from "@/lib/combo-packages";
import { CartSynchronization, type SyncedCartEntry } from "@/lib/cart-synchronization";

export type CartEntry = {
  productId: string;
  variantId?: string;
  quantity: number;
  /** Retained only while migrating carts saved before canonical variant IDs. */
  variant?: Record<string, string>;
};

export const commerceCartStorageKey = "avaruchi-cart-v1";
const key = commerceCartStorageKey;
const read = (): CartEntry[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const countEntries = (entries: CartEntry[]) =>
  entries.reduce((sum, entry) => sum + entry.quantity, 0);

const writeLocalCart = (entries: SyncedCartEntry[]) => {
  localStorage.setItem(key, JSON.stringify(entries));
  window.dispatchEvent(new Event("avaruchi-commerce-cart"));
};
const cartSynchronization = new CartSynchronization({
  read,
  write: writeLocalCart,
  remote: () => commerceApi("/api/v1/cart"),
  put: (variantId, quantity) => commerceApi("/api/v1/cart/items", { method: "PUT", body: JSON.stringify({ variantId, quantity }) }),
  changed: () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("avaruchi-commerce-cart-state")); },
});

export function useCommerceCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(countEntries(read()));
    const hydrate = () => { void cartSynchronization.hydrate().catch(() => undefined); };
    const authenticate = () => { void cartSynchronization.hydrate(true).catch(() => undefined); };
    sync(); hydrate();
    window.addEventListener("avaruchi-commerce-cart", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("avaruchi-commerce-auth", authenticate);
    return () => {
      window.removeEventListener("avaruchi-commerce-cart", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("avaruchi-commerce-auth", authenticate);
    };
  }, []);
  return count;
}
const sameOptions = (
  left: Record<string, string>,
  right: Record<string, string>,
) => {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([name, value]) => right[name] === value)
  );
};

const unavailableProduct = (productId: string): Product => ({
  id: productId,
  name: "Unavailable item",
  category: "Saved item",
  price: 0,
  mrp: 0,

  badge: "Unavailable",
  tone: "#d8d8d2",
  glyph: "—",
  variants: [],
});

export function useCommerceCart() {
  const products = useStoreProducts();
  const [items, setItems] = useState<CartEntry[]>([]);
  const [syncState, setSyncState] = useState(() => cartSynchronization.snapshot());
  const save = useCallback((next: CartEntry[], sync = true) => {
    if (!cartSynchronization.canMutate()) return;
    const previous = read();
    setItems(next);
    writeLocalCart(next);
    if (sync) void cartSynchronization.sync(next, previous).catch(() => undefined);
  }, []);

  useEffect(() => {
    const sync = () => setItems(read());
    const state = () => setSyncState(cartSynchronization.snapshot());
    const hydrate = () => { void cartSynchronization.hydrate().catch(() => undefined); };
    const authenticate = () => { void cartSynchronization.hydrate(true).catch(() => undefined); };
    sync(); state(); hydrate();
    window.addEventListener("avaruchi-commerce-cart", sync);
    window.addEventListener("avaruchi-commerce-cart-state", state);
    window.addEventListener("storage", sync);
    window.addEventListener("avaruchi-commerce-auth", authenticate);
    return () => {
      window.removeEventListener("avaruchi-commerce-cart", sync);
      window.removeEventListener("avaruchi-commerce-cart-state", state);
      window.removeEventListener("storage", sync);
      window.removeEventListener("avaruchi-commerce-auth", authenticate);
    };
  }, []);

  useEffect(() => {
    const current = read();
    let changed = false;
    const migrated = current.map((entry) => {
      if (entry.variantId || !entry.variant) return entry;
      const product = products.find((item) => item.id === entry.productId);
      const variant = product?.variants?.find((candidate) =>
        sameOptions(candidate.options, entry.variant || {}),
      );
      if (!variant) return entry;
      changed = true;
      return {
        productId: entry.productId,
        variantId: variant.id,
        variant: variant.options,
        quantity: entry.quantity,
      };
    });
    if (changed) save(migrated);
  }, [products, save]);

  const lines = useMemo(
    () =>
      items
        .map((entry, index) => {
          const catalogProduct = products.find(
            (item) => item.id === entry.productId,
          );
          const product = catalogProduct || unavailableProduct(entry.productId);
          const selectedVariant =
            product.variants?.find((variant) => variant.id === entry.variantId) ||
            product.variants?.find((variant) =>
              sameOptions(variant.options, entry.variant || {}),
            );
          return {
            entry,
            index,
            product,
            variant: selectedVariant,
            unitPrice: selectedVariant?.price ?? product.price,
            available: selectedVariant?.stock ?? 0,
            unresolved: !catalogProduct || !selectedVariant,
            missingProduct: !catalogProduct,
          };
        }),
    [items, products],
  );

  const add = (productId: string, variantId: string, quantity = 1) => {
    if (!cartSynchronization.canMutate() || !Number.isInteger(quantity) || quantity < 1) return false;
    const product = getStoreProductsSnapshot().find(
      (item) => item.id === productId,
    );
    const variant = product?.variants?.find((item) => item.id === variantId);
    if (!product || !variant || variant.stock < 1) return false;
    const current = read();
    const index = current.findIndex(
      (entry) =>
        entry.productId === productId && entry.variantId === variantId,
    );
    const next = [...current];
    if (index >= 0) {
      const existing = next[index]!;
      next[index] = {
        ...existing,
        variant: variant.options,
        quantity: Math.min(20, variant.stock, existing.quantity + quantity),
      };
    } else {
      next.push({
        productId,
        variantId,
        variant: variant.options,
        quantity: Math.min(20, variant.stock, Math.max(1, quantity)),
      });
    }
    const acceptedQuantity = next.find((entry) => entry.variantId === variantId)!.quantity - (index >= 0 ? current[index]!.quantity : 0);
    if (acceptedQuantity <= 0) return false;
    save(next);
    const item = productAnalyticsItem(product, variant, acceptedQuantity);
    if (item) trackCommerceEvent("add_to_cart", { items: [item], currency: "INR", value: commerceAmount(item.price * item.quantity) });
    return true;
  };

  const update = (index: number, quantity: number) => {
    if (!cartSynchronization.canMutate() || !Number.isInteger(quantity)) return;
    const current = read();
    const previous = current[index];
    if (!previous) return;
    const line = lines.find((candidate) => candidate.index === index);
    const safeQuantity = line
      ? Math.min(20, Math.max(0, line.available), quantity)
      : quantity;
    save(
      safeQuantity < 1
        ? current.filter((_, itemIndex) => itemIndex !== index)
        : current.map((entry, itemIndex) =>
            itemIndex === index
              ? { ...entry, quantity: safeQuantity }
              : entry,
          ),
    );
    const delta = Math.max(0, safeQuantity) - previous.quantity;
    const item = line?.variant && productAnalyticsItem(line.product, line.variant, Math.abs(delta));
    if (item && delta !== 0) trackCommerceEvent(delta > 0 ? "add_to_cart" : "remove_from_cart", {
      items: [item], currency: "INR", value: commerceAmount(item.price * item.quantity),
    });
  };
  const clear = () => save([]);
  const addCombo = async (comboId: string) => {
    const result = await cartSynchronization.addCombo(current => commerceApi<ComboCartResponse>(`/api/v1/cart/combos/${encodeURIComponent(comboId)}`, {
      method: "PUT",
      body: JSON.stringify({ lines: current.map(item => ({ variantId: item.variantId, quantity: item.quantity })) }),
    }));
    if (result.combo.couponOffer) sessionStorage.setItem("avaruchi_commerce_coupon", result.combo.couponOffer.code);
    const catalog = getStoreProductsSnapshot();
    const analyticsItems = result.combo.components.flatMap(component => {
      const product = catalog.find(item => item.id === component.productId);
      const variant = product?.variants?.find(item => item.id === component.variantId);
      const item = product && variant && productAnalyticsItem(product, variant, component.quantity);
      return item ? [item] : [];
    });
    if (analyticsItems.length) trackCommerceEvent("add_to_cart", { items: analyticsItems, currency: "INR", value: commerceAmount(analyticsItems.reduce((sum, item) => sum + item.price * item.quantity, 0)) });
    return result;
  };
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.entry.quantity,
    0,
  );

  return {
    items,
    lines,
    count: countEntries(items),
    subtotal,
    add,
    addCombo,
    hydrated: syncState.hydrated,
    busy: syncState.busy,
    syncError: syncState.error,
    retryHydration: () => cartSynchronization.hydrate(true),
    update,
    clear,
  };
}
