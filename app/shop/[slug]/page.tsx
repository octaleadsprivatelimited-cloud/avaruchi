import { StorePage } from "@/app/storefront";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sampleProducts } from "@/lib/catalog";
export function generateStaticParams() {
  return sampleProducts.map((p) => ({ slug: p.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = sampleProducts.find((p) => p.id === slug);
  return {
    title: p ? p.name + " pickle" : "Pickle not found",
    description: p?.description,
  };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!sampleProducts.some((p) => p.id === slug)) notFound();
  return <StorePage />;
}
