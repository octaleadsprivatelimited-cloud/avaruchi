import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { orderAlertId, orderConfirmationId, queueOrderConfirmation } from "../src/order-confirmation.js";
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("transactional order email outbox", () => {
  it("queues COD exactly once with immutable business details and never queues pending payment", async () => {
    const db = new PrismaClient(), id = crypto.randomUUID();
    vi.stubEnv("STORE_ORDER_ALERT_EMAIL", "owner@example.com");
    try {
      await db.order.create({ data: { id, number: `MAIL-${id}`, status: "PAYMENT_PENDING", subtotal: 100, discount: 0, shipping: 20, tax: 5, total: 125, idempotencyKey: `mail-test:${id}`, addressSnapshot: { contact: { name: "Buyer", email: "order-test@example.com", phone: "+919876543210" }, shipping: { line1: "Main Road", postalCode: "500081" }, paymentMethod: "cod", notificationBusiness: { storeName: "Later admin name", legalName: "Later business", businessAddress: "Later address", businessGstin: "LATERGST" }, invoiceDetails: { seller: { name: "Test Store", legalName: "Test Business", address: "Seller Road", gstin: "TESTGST" }, lines: [] } } } });
      await db.$transaction(tx => queueOrderConfirmation(tx, id));
      expect(await db.notification.count({ where: { id: orderConfirmationId(id) } })).toBe(0);
      expect(await db.notification.count({ where: { id: orderAlertId(id) } })).toBe(0);
      await db.order.update({ where: { id }, data: { status: "CONFIRMED" } });
      await db.$transaction(tx => queueOrderConfirmation(tx, id));
      await db.$transaction(tx => queueOrderConfirmation(tx, id));
      const notifications = await db.notification.findMany({ where: { id: orderConfirmationId(id) } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({ channel: "EMAIL", status: "QUEUED", destination: "order-test@example.com", template: "order.confirmed" });
      expect(notifications[0]?.payload).toMatchObject({ business: { legalName: "Test Business", address: "Seller Road", gstin: "TESTGST" }, paymentLabel: "Cash on delivery — payable on delivery", charges: { total: 125 } });
      expect(notifications[0]?.payload).toMatchObject({ invoice: {
        store: { name: "Test Store", legalName: "Test Business", address: "Seller Road" },
        order: { number: `MAIL-${id}`, total: 125, paymentStatus: "Pending", snapshot: { contact: { email: "order-test@example.com" } } },
      } });
      await db.order.update({ where: { id }, data: { addressSnapshot: { contact: { email: "other@example.com" }, notificationBusiness: { legalName: "Changed seller" } } } });
      await db.$transaction(tx => queueOrderConfirmation(tx, id));
      expect((await db.notification.findUniqueOrThrow({ where: { id: orderConfirmationId(id) } })).payload).toEqual(notifications[0]?.payload);
      const alerts = await db.notification.findMany({ where: { id: orderAlertId(id) } });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ destination: "owner@example.com", status: "QUEUED", template: "order.received", payload: notifications[0]?.payload });
      await db.notification.update({ where: { id: orderConfirmationId(id) }, data: { payload: { ...(notifications[0]!.payload as Prisma.InputJsonObject), _emailDelivery: { version: 1, template: "order.confirmed", body: "customer-only-frozen-body" } } } });
      await db.notification.deleteMany({ where: { id: orderAlertId(id) } });
      await db.$transaction(tx => queueOrderConfirmation(tx, id));
      const lateAlert = await db.notification.findUniqueOrThrow({ where: { id: orderAlertId(id) } });
      expect(lateAlert.payload).toEqual(notifications[0]?.payload);
      expect(lateAlert.payload).not.toHaveProperty("_emailDelivery");
    } finally { vi.unstubAllEnvs(); await db.notification.deleteMany({ where: { id: { in: [orderConfirmationId(id), orderAlertId(id)] } } }); await db.order.deleteMany({ where: { id } }); await db.$disconnect(); }
  });
});
