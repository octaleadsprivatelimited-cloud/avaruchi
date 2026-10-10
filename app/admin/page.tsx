import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Store administration",
  description: "Manage Avaruchi orders, inventory, products and coupons.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StorePage />;
}
