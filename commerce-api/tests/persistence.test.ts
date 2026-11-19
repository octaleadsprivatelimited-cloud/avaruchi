import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";
import { CommerceStore } from "../src/store.js";
import { orderAlertId, orderConfirmationId } from "../src/order-confirmation.js";

const enabled = process.env.RUN_DB_TESTS === "1";
describe.skipIf(!enabled)("MySQL persistence", () => {
  const persistence = new PrismaPersistence();
  const store = new CommerceStore();
  const fixture = crypto.randomUUID(), productId = crypto.randomUUID(),
    categoryId = crypto.randomUUID(), brandId = crypto.randomUUID(), variantId = crypto.randomUUID();
  const orderIds: string[] = [];

  beforeAll(async () => {
    await persistence.connect();
    await persistence.db.product.create({ data: {
      id: productId, name: "Reservation concurrency fixture", slug: `reservation-${fixture}`,
      description: "Isolated final-unit reservation test product", status: "ACTIVE", taxRate: 0,
      category: { create: { id: categoryId, name: "Reservation fixture", slug: `reservation-category-${fixture}` } },
      brand: { create: { id: brandId, name: "Reservation fixture", slug: `reservation-brand-${fixture}` } },
      variants: { create: { id: variantId, sku: `RESERVE-${fixture}`, title: "1 kg", price: 100, mrp: 100,
        weightGrams: 1000, attributes: {}, inventory: { create: { onHand: 1, reserved: 0 } } } },
    } });
    await persistence.hydrate(store);
  });

  afterAll(async () => {
    try {
      await persistence.db.notification.deleteMany({ where: { id: { in: orderIds.flatMap(id => [orderConfirmationId(id), orderAlertId(id)]) } } });
      await persistence.db.order.deleteMany({ where: { id: { in: orderIds } } });
      await persistence.db.inventoryMovement.deleteMany({ where: { inventory: { variantId } } });
      await persistence.db.product.deleteMany({ where: { id: productId } });
      await persistence.db.category.deleteMany({ where: { id: categoryId } });
      await persistence.db.brand.deleteMany({ where: { id: brandId } });
    } finally { await persistence.disconnect(); }
  });

  it("allows only one reservation for the final unit", async () => {
    const { product, variant } = store.getVariant(variantId);
    const makeOrder = (suffix: string) => {
      const order = store.createOrder({
        status: "PAYMENT_PENDING",
        lines: [
          {
            variantId,
            name: product.name,
            sku: variant.sku,
            quantity: 1,
            unitPrice: variant.price,
            tax: (variant.price * product.taxRate) / 100,
          },
        ],
        subtotal: variant.price,
        discount: 0,
        tax: (variant.price * product.taxRate) / 100,
        shipping: 0,
        total: variant.price * (1 + product.taxRate / 100),
        idempotencyKey: `db-concurrency-${fixture}-${suffix}`,
      });
      order.number = `RESERVE-${fixture}-${suffix}`;
      orderIds.push(order.id);
      return order;
    };
    const results = await Promise.allSettled([
      persistence.saveOrderAndReservations(makeOrder("a"), "500081", "cod"),
      persistence.saveOrderAndReservations(makeOrder("b"), "500081", "cod"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const inventory = await persistence.db.inventory.findUniqueOrThrow({
      where: { variantId },
    });
    expect(inventory.reserved).toBe(1);
  });
});
