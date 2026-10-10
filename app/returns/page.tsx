import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Returns and refunds",
  description:
    "Avaruchi order cancellation, damaged items and refund information.",
};
export default function Page() {
  return <StorePage />;
}
