import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Contact Avaruchi",
  description:
    "Contact Avaruchi by Lakshmis Tapasi Treats in Ramanthapur, Hyderabad. Call or WhatsApp 9932433243 for order and product assistance.",
};
export default function Page() {
  return <StorePage />;
}
