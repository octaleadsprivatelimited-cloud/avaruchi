import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Shipping policy",
  description: "Avaruchi delivery charges, shipping and tracking information.",
};
export default function Page() {
  return <StorePage />;
}
