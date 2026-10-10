import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Contact Avaruchi",
  description:
    "Contact the Avaruchi pickle company for order and product assistance.",
};
export default function Page() {
  return <StorePage />;
}
