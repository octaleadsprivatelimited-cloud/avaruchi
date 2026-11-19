import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";
import { CommerceStore } from "../src/store.js";
import { couponBenefit } from "../src/coupon-policy.js";

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("persisted product coupons", () => {
  it("retains selected products across reloads and rejects a changed rule before reserving inventory", async () => {
    const p = new PrismaPersistence(), fixture = crypto.randomUUID(), code = `SCOPE-${fixture.slice(0, 20)}`;
    const productId = crypto.randomUUID(), categoryId = crypto.randomUUID(),
      brandId = crypto.randomUUID(), variantId = crypto.randomUUID();
    let orderId = "";
    try {
      await p.db.product.create({ data: {
        id: productId, name: "Coupon scope fixture", slug: `coupon-${fixture}`,
        description: "Isolated selected-product coupon test product", status: "ACTIVE", taxRate: 0,
        category: { create: { id: categoryId, name: "Coupon fixture", slug: `coupon-category-${fixture}` } },
        brand: { create: { id: brandId, name: "Coupon fixture", slug: `coupon-brand-${fixture}` } },
        variants: { create: { id: variantId, sku: `COUPON-${fixture}`, title: "1 kg", price: 100, mrp: 100,
          weightGrams: 1000, attributes: {}, inventory: { create: { onHand: 10, reserved: 0 } } } },
      } });
      const store = new CommerceStore(); await p.hydrate(store);
      const { product, variant } = store.getVariant(variantId);
      const coupon = { code, type: "PERCENTAGE" as const, value: 10, minimumSpend: 0, startsAt: Date.now() - 60000, endsAt: Date.now() + 86400000, enabled: true, used: 0, perUserLimit: 1, appliesTo: "SELECTED_PRODUCTS" as const, productIds: [product.id] };
      await p.saveCoupon({ ...coupon, maximumDiscount: 5, usageLimit: 10 });
      await p.saveCoupon(coupon);
      expect(await p.db.coupon.findUnique({ where: { code } })).toMatchObject({ maximumDiscount: null, usageLimit: null });
      const reloaded = new CommerceStore(); await p.hydrate(reloaded);
      expect(reloaded.coupons.get(code)).toMatchObject({ appliesTo: "SELECTED_PRODUCTS", productIds: [product.id] });
      const discount = couponBenefit(reloaded.coupons.get(code), [{ productId: product.id, unitPrice: variant.price, quantity: 1 }]).discount;
      const order = store.createOrder({ status: "PAYMENT_PENDING", lines: [{ variantId: variant.id, name: product.name, sku: variant.sku, quantity: 1, unitPrice: variant.price, tax: 0 }], subtotal: variant.price, discount, tax: 0, shipping: 0, total: variant.price - discount, idempotencyKey: `coupon-scope:${crypto.randomUUID()}` });
      order.number = `COUPON-${fixture}`;
      orderId = order.id;
      await p.saveCoupon({ ...coupon, value: 20 });
      await expect(p.saveOrderAndReservations(order, "500081", "cod", code)).rejects.toMatchObject({ code: "CHECKOUT_PRICE_CHANGED" });
      await p.saveCoupon({ ...coupon, type: "FIXED_AMOUNT", value: 0 });
      const shippingOrder = { ...order, discount: 0, invoiceSnapshot: { discounts: { coupon: 0, couponFreeShipping: true, onlinePayment: 0 } } };
      await expect(p.saveOrderAndReservations(shippingOrder, "500081", "cod", code)).rejects.toMatchObject({ code: "CHECKOUT_PRICE_CHANGED" });
      expect(await p.db.order.findUnique({ where: { id: order.id } })).toBeNull();
      await p.saveCoupon({ ...coupon, appliesTo: "ALL_PRODUCTS" });
      const all = new CommerceStore(); await p.hydrate(all);
      expect(all.coupons.get(code)).toMatchObject({ appliesTo: "ALL_PRODUCTS", productIds: [] });
    } finally {
      try {
        if (orderId) await p.db.order.deleteMany({ where: { id: orderId } });
        await p.db.coupon.deleteMany({ where: { code } });
        await p.db.inventoryMovement.deleteMany({ where: { inventory: { variantId } } });
        await p.db.product.deleteMany({ where: { id: productId } });
        await p.db.category.deleteMany({ where: { id: categoryId } });
        await p.db.brand.deleteMany({ where: { id: brandId } });
      } finally { await p.disconnect(); }
    }
  });
});
