import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Our story",
  description:
    "The Avaruchi idea: bold pickle flavours inspired by the everyday Andhra table.",
};
export default function Page() {
  return <StorePage />;
}
