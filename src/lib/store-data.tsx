import { createContext, useContext } from "react";
import type { Product } from "@/data/commerce";
import type { StorefrontConfig } from "./storefront-config";

export type StoreBootstrap = {
  storefront?: StorefrontConfig | null;
  products: Product[];
};
export const StoreDataContext = createContext<Product[]>([]);
export const useInitialCatalog = () => useContext(StoreDataContext);
