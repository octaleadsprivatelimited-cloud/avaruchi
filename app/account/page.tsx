import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your account",
  description:
    "Your Avaruchi orders, delivery updates, saved address and invoice downloads.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StorePage />;
}
