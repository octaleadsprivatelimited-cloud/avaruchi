import { createContext, useContext, type ReactNode } from "react";
import { useCommerceCart } from "./commerce-cart";
import { useCommerceWishlist } from "./commerce-wishlist";

type StoreCommerce = {
  cart: ReturnType<typeof useCommerceCart>;
  wishlist: ReturnType<typeof useCommerceWishlist>;
};
const StoreCommerceContext = createContext<StoreCommerce | null>(null);

export function StoreCommerceProvider({ children }: { children: ReactNode }) {
  const cart = useCommerceCart();
  const wishlist = useCommerceWishlist();
  return (
    <StoreCommerceContext.Provider value={{ cart, wishlist }}>
      {children}
    </StoreCommerceContext.Provider>
  );
}

export function useStoreCommerce() {
  const value = useContext(StoreCommerceContext);
  if (!value)
    throw new Error("Store commerce must be used inside the storefront.");
  return value;
}
