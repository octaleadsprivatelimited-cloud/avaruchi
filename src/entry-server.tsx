import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import App from "./App";
import { mapProduct, type StoreProduct } from "./lib/store-products";
import {
  defaultStorefrontConfig,
  type StorefrontConfig,
} from "./lib/storefront-config";
import { storefrontMetadata } from "./lib/page-metadata";
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
  const bootstrap = { storefront, products };
  const metadata = storefrontMetadata(path, products, storefront, input.origin);
  const head =
    `<title>${escape(metadata.title)}</title><meta name="description" content="${escape(metadata.description)}"/><meta name="robots" content="${metadata.robots}"/><link rel="canonical" href="${escape(metadata.canonical)}"/><meta property="og:url" content="${escape(metadata.canonical)}"/><meta property="og:title" content="${escape(metadata.title)}"/><meta property="og:description" content="${escape(metadata.description)}"/><meta property="og:site_name" content="${escape(storefront.storeName)}"/>${metadata.image ? `<meta property="og:image" content="${escape(metadata.image)}"/>` : ""}` +
    metadata.scripts.map(script => `<script data-storefront-schema type="application/ld+json">${script}</script>`).join("");
  const html = renderToString(
    <StaticRouter location={`${path}${url.search}${url.hash}`}>
      <App bootstrap={bootstrap} />
    </StaticRouter>,
  );
  return { html, head, bootstrap, status: metadata.known ? 200 : 404 };
}
