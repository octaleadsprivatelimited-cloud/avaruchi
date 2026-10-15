import type { StorefrontConfig } from "./storefront-config";
import type { Product } from "../data/commerce";
import { productPath } from "./product-url";
import { productSeo, storeOrigin } from "./seo";

const publicRoutes = new Set(["/", "/shop", "/cart", "/checkout", "/login", "/track", "/account", "/contact", "/privacy", "/terms", "/shipping", "/returns", "/shipping-returns", "/journal", "/our-story", "/wishlist"]);

export function pageMetadata(path: string, store?: Partial<StorefrontConfig>) {
  const name = store?.storeName || "Avaruchi";
  const titles: Record<string, string> = {
    "/": "The taste of home, in every jar.",
    "/shop": "Pickles, powders & fryums",
    "/wishlist": "Your saved flavours",
    "/our-story": "Our story",
    "/journal": "Pairing notes",
    "/cart": "Your bag",
    "/checkout": "Checkout",
    "/login": "Sign in with Google",
    "/account": "My account",
    "/track": "Track your order",
    "/privacy": "Privacy policy",
    "/terms": "Terms of Service",
    "/contact": "Contact us",
    "/shipping": "Shipping policy",
    "/returns": "Returns & refunds",
    "/shipping-returns": "Shipping, returns & refunds",
  };
  const privatePage =
    /^\/(admin|account|cart|checkout|login|track|transaction|wishlist)(\/|$)/.test(path);
  const title =
    titles[path] ||
    (path.startsWith("/admin")
      ? "Commerce admin"
      : path.startsWith("/transaction/")
        ? "Transaction details"
        : /\/(product|shop)\//.test(path)
          ? "Find your flavour"
          : "Page not found");
  return {
    title: `${title} | ${name}`,
    description: `Familiar tang, bold spice and a taste of home. Explore ${name} pickles, powders and fryums for your everyday table.`,
    private: privatePage,
  };
}

/** Shared by SSR and client navigation so indexing metadata cannot drift. */
export function storefrontMetadata(pathname: string, products: Product[], store: Partial<StorefrontConfig>, origin: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const encodedKey = path.match(/^\/(?:product|shop)\/([^/]+)$/)?.[1];
  let key: string | undefined;
  try { key = encodedKey && decodeURIComponent(encodedKey); } catch { /* Malformed shared URLs render a normal 404. */ }
  const product = key ? products.find(item => item.id === key || item.slug === key) : undefined;
  const known = publicRoutes.has(path) || /^\/(admin|transaction)(\/|$)/.test(path) || Boolean(product);
  const base = pageMetadata(path, store);
  const productHead = product ? productSeo(product) : undefined;
  const productDescription = productHead?.meta.find(meta => "name" in meta && meta.name === "description");
  const productRobots = productHead?.meta.find(meta => "name" in meta && meta.name === "robots");
  const canonicalPath = product ? productPath(product) : ["/shipping", "/returns"].includes(path) ? "/shipping-returns" : path;
  const description = (productDescription && "content" in productDescription ? productDescription.content : undefined) || (path === "/" ? store.seoDescription : undefined) || base.description;
  return {
    known,
    title: !known ? `Page not found | ${store.storeName || "Avaruchi"}` : productHead?.meta.find(meta => "title" in meta)?.title || (path === "/" && store.seoTitle ? store.seoTitle : base.title),
    description,
    robots: base.private || !known ? "noindex, nofollow" : (productRobots && "content" in productRobots ? productRobots.content : undefined) || "index, follow",
    canonical: new URL(canonicalPath, origin).href,
    image: product?.image ? new URL(product.image, origin).href : undefined,
    scripts: (productHead?.scripts || []).map(script => script.children.replaceAll(storeOrigin, origin)),
  };
}
