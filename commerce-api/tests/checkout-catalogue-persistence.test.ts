import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";
import { CommerceStore } from "../src/store.js";
import { orderAlertId, orderConfirmationId, queueOrderConfirmation } from "../src/order-confirmation.js";

async function fixture(price = 100, taxRate = 5) {
  const p = new PrismaPersistence(), store = new CommerceStore(), key = crypto.randomUUID();
  const productId = crypto.randomUUID(), categoryId = crypto.randomUUID(), brandId = crypto.randomUUID(), variantId = crypto.randomUUID();
  const orderIds: string[] = [], userIds: string[] = [], notificationIds: string[] = [], webhookIds: string[] = [];
  const cleanup = async () => {
    try {
      await p.db.notification.deleteMany({ where: { id: { in: [...notificationIds, ...orderIds.flatMap(id => [orderConfirmationId(id), orderAlertId(id)])] } } });
      await p.db.webhookEvent.deleteMany({ where: { provider: "razorpay", externalId: { in: webhookIds } } });
      await p.db.paymentTransaction.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
      await p.db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await p.db.order.deleteMany({ where: { id: { in: orderIds } } });
      await p.db.auditLog.deleteMany({ where: { resourceId: { in: [...orderIds, ...userIds, productId] } } });
      await p.db.user.deleteMany({ where: { id: { in: userIds } } });
      await p.db.inventoryMovement.deleteMany({ where: { inventory: { variant: { productId } } } });
      await p.db.product.deleteMany({ where: { id: productId } });
      await p.db.category.deleteMany({ where: { id: categoryId } });
      await p.db.brand.deleteMany({ where: { id: brandId } });
    } finally { await p.disconnect(); }
  };
  try {
    await p.db.product.create({ data: {
      id: productId, name: "Checkout catalogue fixture", slug: `checkout-guard-${key}`,
      description: "A transaction-owned catalogue fixture", status: "ACTIVE", taxRate,
      category: { create: { id: categoryId, name: `Catalogue guard ${key}`, slug: `catalogue-guard-${key}` } },
      brand: { create: { id: brandId, name: `Guard ${key}`, slug: `guard-${key}` } },
      variants: { create: { id: variantId, sku: `GUARD-${key}`, title: "500 g", price, mrp: price,
        weightGrams: 500, attributes: { "Pack size": "500 g" }, inventory: { create: { onHand: 10, reserved: 0, version: 3 } } } },
    } });
    await p.hydrate(store);
  } catch (error) { await cleanup(); throw error; }
  const { product, variant } = store.getVariant(variantId);
  const makeOrder = (options: { snapshot?: boolean; quantity?: number; roundedLineTax?: boolean } = {}) => {
    const quantity = options.quantity || 1, rawTax = variant.price * quantity * product.taxRate / 100;
    const tax = Math.round(rawTax * 100) / 100;
    const order = store.createOrder({
      status: "PAYMENT_PENDING", subtotal: variant.price * quantity, tax, discount: 0, shipping: 0, total: Math.round((variant.price * quantity + tax) * 100) / 100,
      lines: [{ variantId, name: product.name, sku: variant.sku, quantity, unitPrice: variant.price, tax: options.roundedLineTax ? tax : rawTax }],
      idempotencyKey: `catalogue-guard:${crypto.randomUUID()}`,
      ...(options.snapshot === false ? {} : { invoiceSnapshot: { invoiceDetails: {
        seller: { name: "Guard fixture store" }, lines: [{ variantId, pack: variant.title, taxRate: product.taxRate }],
      } } }),
    });
    order.number = `GUARD-${key}-${orderIds.length}`;
    orderIds.push(order.id);
    return order;
  };
  return { p, store, key, productId, variantId, product, variant, orderIds, userIds, notificationIds, webhookIds, makeOrder, cleanup };
}

async function paymentFixture() {
  const f = await fixture();
  try {
    const order = f.makeOrder();
    await f.p.saveOrderAndReservations(order, {}, "razorpay", undefined, `gateway-order-${f.key}`);
    const payment = await f.p.db.payment.findFirstOrThrow({ where: { orderId: order.id } });
    const capture = (from = "PAYMENT_PENDING") => {
      const eventId = `capture-${crypto.randomUUID()}`;
      f.webhookIds.push(eventId);
      return {
        provider: "razorpay", eventId, payloadHash: "a".repeat(64), orderId: order.id, from, to: "PAID",
        paymentId: payment.id, paymentStatus: "CAPTURED" as const, externalPaymentId: `pay-${f.key}`,
        paymentAmount: Number(payment.amount), paymentCurrency: "INR",
      };
    };
    return { ...f, order, payment, capture };
  } catch (error) { await f.cleanup(); throw error; }
}

describe.skipIf(process.env.RUN_DB_TESTS !== "1")("checkout uses current durable catalogue", () => {
  it.each(["price", "tax", "archived", "inactive", "deleted", "missing"] as const)("rejects a stale %s quote without changing stock or persisting an order", async change => {
    const f = await fixture();
    try {
      const order = f.makeOrder();
      const inventory = await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } });
      if (change === "price") await f.p.db.productVariant.update({ where: { id: f.variantId }, data: { price: 125, mrp: 125 } });
      if (change === "tax") await f.p.db.product.update({ where: { id: f.productId }, data: { taxRate: 18 } });
      if (change === "archived") await f.p.db.product.update({ where: { id: f.productId }, data: { status: "ARCHIVED" } });
      if (change === "inactive") await f.p.db.productVariant.update({ where: { id: f.variantId }, data: { active: false } });
      if (change === "deleted") await f.p.db.product.update({ where: { id: f.productId }, data: { deletedAt: new Date() } });
      if (change === "missing") await f.p.db.productVariant.delete({ where: { id: f.variantId } });
      await expect(f.p.saveOrderAndReservations(order, {}, "razorpay")).rejects.toMatchObject({
        status: 409, code: change === "price" || change === "tax" ? "CHECKOUT_PRICE_CHANGED" : "PRODUCT_UNAVAILABLE",
      });
      if (change !== "missing") expect(await f.p.db.inventory.findUnique({ where: { variantId: f.variantId } })).toEqual(inventory);
      expect(await f.p.db.order.count({ where: { id: order.id } })).toBe(0);
      expect(await f.p.db.payment.count({ where: { orderId: order.id } })).toBe(0);
      expect(await f.p.db.notification.count({ where: { id: { in: [orderAlertId(order.id), orderConfirmationId(order.id)] } } })).toBe(0);
    } finally { await f.cleanup(); }
  });

  it("rejects tax-rate changes even when both amounts round to zero", async () => {
    const f = await fixture(0.01, 5);
    try {
      const order = f.makeOrder();
      await f.p.db.product.update({ where: { id: f.productId }, data: { taxRate: 18 } });
      await expect(f.p.saveOrderAndReservations(order, {}, "razorpay")).rejects.toMatchObject({ code: "CHECKOUT_PRICE_CHANGED" });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 10, reserved: 0, version: 3 });
    } finally { await f.cleanup(); }
  });

  it("checks legacy line tax amounts when no quote-rate snapshot is present", async () => {
    const f = await fixture();
    try {
      const order = f.makeOrder({ snapshot: false });
      await f.p.db.product.update({ where: { id: f.productId }, data: { taxRate: 18 } });
      await expect(f.p.saveOrderAndReservations(order, {}, "razorpay")).rejects.toMatchObject({ code: "CHECKOUT_PRICE_CHANGED" });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 10, reserved: 0, version: 3 });
    } finally { await f.cleanup(); }
  });

  it.each([false, true])("accepts an unchanged fractional-tax quote with rounded line=%s and no legacy rate snapshot", async roundedLineTax => {
    const f = await fixture(0.29, 5);
    try {
      const order = f.makeOrder({ snapshot: false, quantity: 3, roundedLineTax });
      await f.p.saveOrderAndReservations(order, {}, "razorpay");
      const saved = await f.p.db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, payments: true } });
      expect(Number(saved.total)).toBe(order.total);
      expect(Number(saved.items[0]!.unitPrice)).toBe(0.29);
      expect(Number(saved.items[0]!.tax)).toBe(Math.round(order.lines[0]!.tax * 100) / 100);
      expect(saved.payments).toHaveLength(1);
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 10, reserved: 3, version: 4 });
    } finally { await f.cleanup(); }
  });

  it("retains newer reservation/adjustment balances while saving a stale catalogue edit", async () => {
    const f = await fixture();
    try {
      await f.p.db.inventory.update({ where: { variantId: f.variantId }, data: { onHand: 7, reserved: 3, version: 12 } });
      f.product.description = "Merchant updated the product description";
      f.variant.price = 125; f.variant.mrp = 125;
      await f.p.saveProduct(f.product);
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 7, reserved: 3, version: 12 });
      expect((await f.p.db.product.findUniqueOrThrow({ where: { id: f.productId } })).description).toBe(f.product.description);
      expect(Number((await f.p.db.productVariant.findUniqueOrThrow({ where: { id: f.variantId } })).price)).toBe(125);
      const addedId = crypto.randomUUID();
      f.product.variants.push({ ...f.variant, id: addedId, sku: `NEW-${f.key}`, title: "1 kg", weightGrams: 1000, stock: 4, reserved: 0 });
      await f.p.saveProduct(f.product);
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: addedId } })).toMatchObject({ onHand: 4, reserved: 0, version: 0 });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 7, reserved: 3, version: 12 });
    } finally { await f.cleanup(); }
  });

  it("deletes customer and merchant outbox copies on account erasure while retaining anonymized financial orders", async () => {
    const f = await fixture();
    vi.stubEnv("STORE_ORDER_ALERT_EMAIL", `merchant-${f.key}@example.com`);
    try {
      const customer = await f.p.db.user.create({ data: { email: `customer-${f.key}@example.com`, name: "Private buyer", role: "CUSTOMER" } });
      f.userIds.push(customer.id);
      const order = f.makeOrder();
      const snapshot = { contact: { name: "Private buyer", email: customer.email, phone: "+919876543210" }, shipping: { line1: "Private fixture address", city: "Hyderabad" }, paymentMethod: "cod" };
      await f.p.db.order.create({ data: {
        id: order.id, number: order.number, userId: customer.id, status: "CONFIRMED", subtotal: order.subtotal, tax: order.tax,
        discount: 0, shipping: 0, total: order.total, idempotencyKey: order.idempotencyKey, addressSnapshot: snapshot,
        items: { create: [{ variantId: f.variantId, name: f.product.name, sku: f.variant.sku, attributes: {}, quantity: 1, unitPrice: f.variant.price, tax: order.tax }] },
      } });
      await f.p.db.$transaction(tx => queueOrderConfirmation(tx, order.id));
      const ids = [orderConfirmationId(order.id), orderAlertId(order.id)];
      const queued = await f.p.db.notification.findMany({ where: { id: { in: ids } } });
      expect(queued).toHaveLength(2);
      expect(queued.find(item => item.template === "order.received")?.userId).toBeNull();
      for (const item of queued) await f.p.db.notification.update({ where: { id: item.id }, data: { payload: {
        ...(item.payload as Record<string, string>), _emailDelivery: { version: 1, template: item.template, body: JSON.stringify({ to: item.destination, html: "Private fixture address", attachments: [{ content: "private-pdf-fixture" }] }) },
      } } });
      const unrelated = await f.p.db.notification.create({ data: {
        channel: "EMAIL", template: "order.received", destination: `merchant-${f.key}@example.com`, payload: { customer: "Unrelated customer" },
      } });
      f.notificationIds.push(unrelated.id);
      await expect(f.p.deleteCustomerAccount(customer.id)).resolves.toMatchObject({ deleted: true, retainedOrders: 1 });
      expect(await f.p.db.notification.count({ where: { id: { in: ids } } })).toBe(0);
      expect((await f.p.db.notification.findUniqueOrThrow({ where: { id: unrelated.id } })).payload).toEqual({ customer: "Unrelated customer" });
      const retained = await f.p.db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      expect(retained.userId).toBeNull();
      expect(retained.addressSnapshot).toMatchObject({ redacted: true, retentionReason: "financial_and_fulfilment_record" });
      expect(Number(retained.total)).toBe(order.total);
      expect(retained.items).toHaveLength(1);
      expect(JSON.stringify(retained.addressSnapshot)).not.toMatch(/Private buyer|Private fixture address|customer-/);
    } finally { vi.unstubAllEnvs(); await f.cleanup(); }
  });

  it.each(["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] as const)("retains advanced fulfilment and stock when a stale capture sees a durable %s payment", async status => {
    const f = await paymentFixture();
    try {
      await f.p.db.payment.update({ where: { id: f.payment.id }, data: { status, gatewayTransactionId: `pay-${f.key}` } });
      await f.p.db.order.update({ where: { id: f.order.id }, data: { status: "SHIPPED" } });
      await f.p.db.inventory.update({ where: { variantId: f.variantId }, data: { onHand: 9, reserved: 2, version: 8 } });
      const before = await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } });
      const event = f.capture();
      await expect(f.p.processWebhook(event)).resolves.toEqual({ duplicate: true });
      await expect(f.p.processWebhook(event)).resolves.toEqual({ duplicate: true });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toEqual(before);
      expect((await f.p.db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("SHIPPED");
      expect((await f.p.db.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).status).toBe(status);
      expect(await f.p.db.paymentTransaction.count({ where: { paymentId: f.payment.id } })).toBe(0);
      expect(await f.p.db.orderHistory.count({ where: { orderId: f.order.id, toStatus: "PAID" } })).toBe(0);
      expect(await f.p.db.webhookEvent.count({ where: { provider: "razorpay", externalId: event.eventId } })).toBe(1);
    } finally { await f.cleanup(); }
  });

  it.each(["amount", "currency", "reference"] as const)("validates a repeated capture's durable %s before treating it as a duplicate", async mismatch => {
    const f = await paymentFixture();
    try {
      await f.p.db.payment.update({ where: { id: f.payment.id }, data: { status: "CAPTURED", gatewayTransactionId: `pay-${f.key}` } });
      await f.p.db.order.update({ where: { id: f.order.id }, data: { status: "SHIPPED" } });
      const event = f.capture(), before = await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } });
      if (mismatch === "amount") event.paymentAmount += 1;
      if (mismatch === "currency") event.paymentCurrency = "USD";
      if (mismatch === "reference") event.externalPaymentId = `other-pay-${f.key}`;
      await expect(f.p.processWebhook(event)).rejects.toMatchObject({
        status: 422, code: mismatch === "reference" ? "PAYMENT_RESOURCE_MISMATCH" : "PAYMENT_VALUE_MISMATCH",
      });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toEqual(before);
      expect((await f.p.db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("SHIPPED");
      expect(await f.p.db.paymentTransaction.count({ where: { paymentId: f.payment.id } })).toBe(0);
      expect(await f.p.db.webhookEvent.count({ where: { provider: "razorpay", externalId: event.eventId } })).toBe(0);
    } finally { await f.cleanup(); }
  });

  it("completes missing payment bookkeeping for an already-paid order without recommitting stock", async () => {
    const f = await paymentFixture();
    try {
      await f.p.db.order.update({ where: { id: f.order.id }, data: { status: "PAID", addressSnapshot: { contact: { email: `buyer-${f.key}@example.com` }, paymentMethod: "razorpay" } } });
      await f.p.db.inventory.update({ where: { variantId: f.variantId }, data: { onHand: 9, reserved: 0, version: 8 } });
      const before = await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } });
      await expect(f.p.processWebhook(f.capture("PAID"))).resolves.toEqual({ duplicate: false });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toEqual(before);
      expect(await f.p.db.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).toMatchObject({ status: "CAPTURED", gatewayTransactionId: `pay-${f.key}`, verifiedAt: expect.any(Date) });
      expect(await f.p.db.paymentTransaction.count({ where: { paymentId: f.payment.id } })).toBe(1);
      expect(await f.p.db.orderHistory.count({ where: { orderId: f.order.id, toStatus: "PAID" } })).toBe(0);
      expect(await f.p.db.notification.count({ where: { id: orderConfirmationId(f.order.id) } })).toBe(1);
      await expect(f.p.processWebhook(f.capture("PAID"))).resolves.toEqual({ duplicate: true });
      expect(await f.p.db.paymentTransaction.count({ where: { paymentId: f.payment.id } })).toBe(1);
    } finally { await f.cleanup(); }
  });

  it("reacquires only the failed order's released unit and preserves another reservation on late capture", async () => {
    const f = await paymentFixture();
    try {
      await f.p.db.order.update({ where: { id: f.order.id }, data: { status: "FAILED" } });
      await f.p.db.payment.update({ where: { id: f.payment.id }, data: { status: "FAILED" } });
      await f.p.db.inventory.update({ where: { variantId: f.variantId }, data: { onHand: 10, reserved: 2, version: 8 } });
      await expect(f.p.processWebhook(f.capture())).resolves.toEqual({ duplicate: false });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 9, reserved: 2, version: 10 });
      expect((await f.p.db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("PAID");
      await expect(f.p.processWebhook(f.capture())).resolves.toEqual({ duplicate: true });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 9, reserved: 2, version: 10 });
    } finally { await f.cleanup(); }
  });

  it("does not reset advanced fulfilment when a nonterminal payment has inconsistent order state", async () => {
    const f = await paymentFixture();
    try {
      await f.p.db.order.update({ where: { id: f.order.id }, data: { status: "SHIPPED" } });
      const before = await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } });
      await expect(f.p.processWebhook(f.capture("SHIPPED"))).rejects.toMatchObject({ status: 409, code: "STALE_ORDER_STATE" });
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toEqual(before);
      expect((await f.p.db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("SHIPPED");
      expect((await f.p.db.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).status).toBe("CREATED");
    } finally { await f.cleanup(); }
  });

  it("serializes different capture receipts against the same payment and commits inventory once", async () => {
    const f = await paymentFixture();
    try {
      await f.p.db.inventory.update({ where: { variantId: f.variantId }, data: { reserved: 3, version: 8 } });
      const results = await Promise.all([f.p.processWebhook(f.capture()), f.p.processWebhook(f.capture())]);
      expect(results.filter(result => !result.duplicate)).toHaveLength(1);
      expect(results.filter(result => result.duplicate)).toHaveLength(1);
      expect(await f.p.db.inventory.findUniqueOrThrow({ where: { variantId: f.variantId } })).toMatchObject({ onHand: 9, reserved: 2, version: 9 });
      expect(await f.p.db.paymentTransaction.count({ where: { paymentId: f.payment.id } })).toBe(1);
      expect(await f.p.db.orderHistory.count({ where: { orderId: f.order.id, toStatus: "PAID" } })).toBe(1);
    } finally { await f.cleanup(); }
  });
});
