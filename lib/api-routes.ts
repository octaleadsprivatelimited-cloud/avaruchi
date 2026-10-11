const routes: Record<string, string[]> = {
  health: ["GET"],
  catalog: ["GET"],
  session: ["GET"],
  "auth/demo": ["POST"],
  "auth/logout": ["POST"],
  "auth/google": ["GET"],
  "auth/google/callback": ["GET"],
  quote: ["POST"],
  saved: ["POST"],
  orders: ["GET", "POST"],
  returns: ["GET", "POST"],
  "payments/verify": ["POST"],
  webhook: ["POST"],
  "delivery-events": ["POST"],
  "jobs/invoices": ["POST"],
  admin: ["GET"],
  "admin/order": ["POST"],
  "admin/shipment": ["POST"],
  "admin/return": ["POST"],
  "admin/stock": ["POST"],
  "admin/coupon": ["POST"],
  "admin/product": ["POST"],
  "admin/email": ["POST"],
  "admin/payment/reconcile": ["POST"],
  "admin/invoice-queue": ["POST"],
  "admin/refund/process": ["POST"],
  "admin/refund/sync": ["POST"],
  ...Object.fromEntries(
    ["create", "awb", "pickup", "sync", "reconcile"].map((action) => [
      "admin/shipping/" + action,
      ["POST"],
    ]),
  ),
};
export function routeMethods(path: string) {
  if (Object.hasOwn(routes, path)) return routes[path];
  if (/^(?:invoice|admin\/invoice)\/[^/]+$/.test(path)) return ["GET"];
  if (/^orders\/[^/]+$/.test(path)) return ["POST"];
  return null;
}
