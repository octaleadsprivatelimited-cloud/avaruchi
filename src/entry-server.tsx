import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import App from "./App";
import { mapProduct, type StoreProduct } from "./lib/store-products";
import {
  defaultStorefrontConfig,
  type StorefrontConfig,
} from "./lib/storefront-config";
import { pageMetadata } from "./lib/page-metadata";
import { productSeo, storeOrigin } from "./lib/seo";

const publicPages = new Set([
  "/",
  "/shop",
  "/cart",
  "/checkout",
  "/login",
  "/track",
  "/account",
  "/contact",
  "/privacy",
  "/terms",
  "/shipping",
  "/returns",
  "/shipping-returns",
  "/journal",
  "/our-story",
  "/wishlist",
]);
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function renderStorefront(input: {
  url: string;
  origin: string;
  storefront?: StorefrontConfig | null;
  products?: StoreProduct[];
}) {
  const url = new URL(input.url, input.origin);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const products = (input.products || []).map(mapProduct);
  const storefront = { ...defaultStorefrontConfig, ...input.storefront };
  const productId = path.match(/^\/(?:product|shop)\/([^/]+)$/)?.[1];
  const product = productId
    ? products.find(
        (product) =>
          product.id === decodeURIComponent(productId) ||
          product.slug === decodeURIComponent(productId),
      )
    : undefined;
  const known =
    publicPages.has(path) ||
    /^\/(admin|transaction)(\/|$)/.test(path) ||
    Boolean(product);
  const bootstrap = { storefront, products };
  const metadata = pageMetadata(path, storefront);
  const productHead = product ? productSeo(product) : null;
  const title =
    productHead?.meta.find((meta) => "title" in meta)?.title || metadata.title;
  const canonical = new URL(path, input.origin).href;
  const head =
    `<title>${escape(title)}</title><meta name="description" content="${escape(metadata.description)}"/><meta name="robots" content="${metadata.private || !known ? "noindex, nofollow" : "index, follow"}"/><link rel="canonical" href="${escape(canonical)}"/><meta property="og:url" content="${escape(canonical)}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:site_name" content="${escape(storefront.storeName)}"/>` +
    (productHead?.scripts
      .map(
        (script) =>
            `<script type="application/ld+json">${script.children.replaceAll(storeOrigin, input.origin)}</script>`,
      )
      .join("") || "");
  const html = renderToString(
    <StaticRouter location={`${path}${url.search}${url.hash}`}>
      <App bootstrap={bootstrap} />
    </StaticRouter>,
  );
  return { html, head, bootstrap, status: known ? 200 : 404 };
}
