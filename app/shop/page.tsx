import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Shop all pickles",
  description:
    "Explore mango, gongura, tomato and more. Choose your jar size and build your Avaruchi basket.",
};
export default function Page() {
  return <StorePage />;
}
