import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Saved flavours",
  description: "Keep your favourite Avaruchi pickles together.",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StorePage />;
}
