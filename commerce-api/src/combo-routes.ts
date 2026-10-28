import crypto from "node:crypto";
import type express from "express";
import type { CommerceStore } from "./store.js";
import type { PrismaPersistence } from "./persistence.js";
import { validate } from "./validate.js";
import { AppError } from "./errors.js";
import { couponBenefit } from "./coupon-policy.js";
import { isSampleProduct } from "./catalog-discovery.js";
import { assertComboCartBaseline, comboCartLines, comboCartSchema, comboPackageSchema, comboPackagesSchema, normalizeCombo, resolveCombo, type ComboPackage } from "./combo-packages.js";

type Dependencies = {
  app: express.Express;
  store: CommerceStore;
  persistence: PrismaPersistence | null;
  auth: express.RequestHandler;
  optionalAuth: express.RequestHandler;
  authorize: (permission: string) => express.RequestHandler;
  hostname: (req: express.Request) => string;
  cartKey: (req: express.Request, res: express.Response) => string;
};

export function registerComboRoutes({ app, store, persistence, auth, optionalAuth, authorize, hostname, cartKey }: Dependencies) {
  const development = new Map<string, ComboPackage[]>();
  const key = (req: express.Request) => `combos:${hostname(req)}`;
  const read = async (req: express.Request) => comboPackagesSchema.parse(
    persistence ? await persistence.getSetting(key(req)) || [] : development.get(key(req)) || [],
  );
  // Serialize each settings write so two editors cannot lose another package.
  let writes = Promise.resolve();
  const write = async (req: express.Request, change: (items: ComboPackage[]) => ComboPackage[]) => {
    const operation = writes.then(async () => {
      const next = change(await read(req));
      comboPackagesSchema.parse(next);
      if (persistence) await persistence.saveSetting(key(req), next);
      else development.set(key(req), next);
      store.auditLogs.unshift({ id: crypto.randomUUID(), action: "combos.updated", resource: "Setting", resourceId: key(req), actorId: req.principal!.sub, createdAt: new Date().toISOString() });
      return next;
    });
    writes = operation.then(() => undefined, () => undefined);
    return operation;
  };
  const dto = (combo: ComboPackage) => {
    const result = resolveCombo(combo, store.listProducts());
    let couponOffer: { code: string; discount: number; minimumSpend: number; expiresAt: string; freeShipping: boolean } | null = null;
    if (combo.couponCode && !result.issues.length) {
      const coupon = store.coupons.get(combo.couponCode);
      try {
        const benefit = couponBenefit(coupon, combo.components.map(item => {
          const { product, variant } = store.getVariant(item.variantId);
          return { productId: product.id, unitPrice: variant.price, quantity: item.quantity };
        }));
        couponOffer = { code: coupon!.code, discount: benefit.discount, minimumSpend: coupon!.minimumSpend, expiresAt: new Date(coupon!.endsAt).toISOString(), freeShipping: benefit.freeShipping };
      } catch { /* Expired/ineligible offers are not advertised. Checkout revalidates customer eligibility. */ }
    }
    return { ...result, couponOffer };
  };
  const respond = (res: express.Response, data: unknown, status = 200) => res.status(status).json({ success: true, data, message: "Success" });

  app.get("/api/v1/combos", async (req, res) => respond(res, (await read(req)).filter(item => item.status === "ACTIVE").map(dto).filter(item => !item.issues.length)));
  app.get("/api/v1/admin/combos", auth, authorize("products:read"), async (req, res) => respond(res, (await read(req)).map(item => ({ ...item, preview: dto(item) }))));
  app.get("/api/v1/admin/combos/catalog", auth, authorize("products:read"), (_req, res) => respond(res, store.listProducts().filter(product => product.status !== "ARCHIVED" && !isSampleProduct(product)).map(product => ({
    id: product.id, name: product.name, status: product.status, taxRate: product.taxRate,
    variants: product.variants.filter(variant => variant.active).map(variant => ({ id: variant.id, title: variant.title, price: variant.price, available: Math.max(0, variant.stock - variant.reserved) })),
  }))));
  app.get("/api/v1/admin/combos/coupons", auth, authorize("products:read"), (_req, res) => respond(res, [...store.coupons.values()].map(coupon => ({ code: coupon.code, enabled: coupon.enabled, startsAt: coupon.startsAt, endsAt: coupon.endsAt }))));
  const input = (req: express.Request, existing?: ComboPackage) => {
    const requested = comboPackageSchema.parse(req.body);
    const archiving = requested.status === "ARCHIVED" && Boolean(existing);
    // Archiving an existing package preserves its stored composition even if a
    // pack has since disappeared. It cannot create or replace invalid links.
    const value = archiving ? { ...requested, components: existing!.components, couponCode: existing!.couponCode } : requested;
    const parsed = normalizeCombo(value, store.listProducts(), archiving);
    if (!archiving && parsed.couponCode && !store.coupons.has(parsed.couponCode)) throw new AppError(422, "COMBO_COUPON_INVALID", "Choose an existing coupon or leave the offer code empty");
    return parsed;
  };
  app.post("/api/v1/admin/combos", auth, authorize("products:create"), validate(comboPackageSchema), async (req, res) => {
    const combo = { ...input(req), id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
    await write(req, items => [...items, combo]);
    return respond(res, { ...combo, preview: dto(combo) }, 201);
  });
  app.put("/api/v1/admin/combos/:id", auth, authorize("products:update"), validate(comboPackageSchema), async (req, res) => {
    const items = await write(req, current => {
      const existing = current.find(item => item.id === req.params.id);
      if (!existing) throw new AppError(404, "COMBO_NOT_FOUND", "Combo package not found");
      const parsed = input(req, existing);
      return current.map(item => item.id === req.params.id ? { ...parsed, id: item.id, updatedAt: new Date().toISOString() } : item);
    });
    const combo = items.find(item => item.id === req.params.id)!;
    return respond(res, { ...combo, preview: dto(combo) });
  });
  app.put("/api/v1/cart/combos/:id", optionalAuth, validate(comboCartSchema), async (req, res) => {
    const combo = (await read(req)).find(item => item.id === req.params.id && item.status === "ACTIVE");
    if (!combo) throw new AppError(404, "COMBO_NOT_FOUND", "This combo package is not available");
    const lines = comboCartLines(combo, req.body.lines, store.listProducts());
    const owner = cartKey(req, res);
    // Persist the whole cart in one transaction before updating the in-memory
    // cart. A failed component or database operation cannot add half a combo.
    if (persistence) await persistence.replaceCartItems(owner, lines, req.body.lines);
    else assertComboCartBaseline([...(store.carts.get(owner) || [])].map(([variantId, quantity]) => ({ variantId, quantity })), req.body.lines, lines);
    store.carts.set(owner, new Map(lines.map(item => [item.variantId, item.quantity])));
    return respond(res, { lines, combo: dto(combo) });
  });
}
