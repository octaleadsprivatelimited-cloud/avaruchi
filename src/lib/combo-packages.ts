export type ComboComponent = {
  productId: string; slug: string; name: string; variantId: string;
  pack: string; quantity: number; unitPrice: number; available: number;
  image?: string; imageAlt: string;
};
export type ComboPackage = {
  id: string; name: string; description: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  updatedAt: string; components: ComboComponent[]; total: number; currency: string;
  available: number; issues: string[];
  couponOffer: { code: string; discount: number; minimumSpend: number; expiresAt: string; freeShipping: boolean } | null;
};
export type ComboCartResponse = {
  lines: Array<{ productId: string; variantId: string; quantity: number }>;
  combo: ComboPackage;
};
