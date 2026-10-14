import type { StorefrontConfig } from "./storefront-config";

export function pageMetadata(path: string, store?: Partial<StorefrontConfig>) {
  const name = store?.storeName || "Avaruchi";
  const titles: Record<string, string> = {
    "/": "The taste of home, in every jar.",
    "/shop": "Pickles",
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
    /^\/(admin|account|cart|checkout|login|track|transaction)(\/|$)/.test(path);
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
    description: `Familiar tang, bold spice and a taste of home. Explore ${name} pickles, find your favourite jar and make a little room at the table.`,
    private: privatePage,
  };
}
