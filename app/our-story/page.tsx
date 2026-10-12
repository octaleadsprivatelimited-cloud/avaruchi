import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Our story",
  description:
    "Avaruchi by Lakshmis Tapasi Treats, established in 2026 in Ramanthapur, Hyderabad. ప్రతి ముద్దలో తెలుగు సంప్రదాయం.",
};
export default function Page() {
  return <StorePage />;
}
