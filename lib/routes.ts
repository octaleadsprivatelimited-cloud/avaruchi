export const paths: Record<string, string> = {
  home: "/",
  shop: "/shop",
  story: "/our-story",
  journal: "/journal",
  account: "/account",
  wishlist: "/wishlist",
  checkout: "/checkout",
  admin: "/admin",
  terms: "/terms",
  privacy: "/privacy",
  shipping: "/shipping",
  returns: "/returns",
  contact: "/contact",
};
export const pagePath = (view: string) => paths[view] || "/";
export function pageView(path: string) {
  if (/^\/shop\/[^/]+\/?$/.test(path)) return "product";
  return (
    Object.entries(paths).find(
      ([, url]) =>
        url === path.replace(/\/$/, "") || (url === "/" && path === "/"),
    )?.[0] || "unknown"
  );
}
