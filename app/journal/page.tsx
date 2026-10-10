import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "At the table",
  description:
    "Simple pairings for warm rice, dosa, paratha and your favourite Avaruchi pickle.",
};
export default function Page() {
  return <StorePage />;
}
