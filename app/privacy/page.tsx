import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Avaruchi handles account, delivery and order information.",
};
export default function Page() {
  return <StorePage />;
}
