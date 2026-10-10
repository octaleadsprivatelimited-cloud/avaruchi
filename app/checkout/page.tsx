import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Confirm your delivery address, payment choice and Avaruchi order.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StorePage />;
}
