import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the Avaruchi store and placing orders.",
};
export default function Page() {
  return <StorePage />;
}
