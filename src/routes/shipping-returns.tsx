import { createFileRoute } from "@tanstack/react-router";
import { InformationPage } from "@/components/store/InformationPage";
import { pageSeo } from "@/lib/seo";
export const Route = createFileRoute("/shipping-returns")({
  component: () => <InformationPage kind="shipping" />,
  head: () => pageSeo("/shipping-returns", "Shipping, Returns and Refund Policy | Avaruchi", "Avaruchi does not offer change-of-mind returns or refunds. Read delivery information and how to report product or payment problems."),
});
