import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { defaultStorefrontConfig } from "./storefront-config.js";
import { invoiceInputFromOrder, type InvoiceInput } from "./invoice.js";
const object = (value: unknown): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function orderConfirmationId(orderId: string) {
  const hash = crypto.createHash("sha256").update(`order-confirmation:${orderId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
export function orderAlertId(orderId: string) {
  const hash = crypto.createHash("sha256").update(`merchant-order-alert:${orderId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
/** Transactional outbox: one confirmation per accepted order, including payment retries. */
export async function queueOrderConfirmation(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !["CONFIRMED", "PAID"].includes(order.status)) return;
  const snapshot = object(order.addressSnapshot), contact = object(snapshot.contact), shipping = object(snapshot.shipping);
  const destination = typeof contact.email === "string" ? contact.email.trim() : "";
  if (!destination) return;
  const fallback = { ...defaultStorefrontConfig, ...object(snapshot.notificationBusiness) };
  const invoice = invoiceInputFromOrder({
    number: order.number, createdAt: order.createdAt.toISOString(), status: order.status,
    subtotal: Number(order.subtotal), tax: Number(order.tax), shipping: Number(order.shipping),
    discount: Number(order.discount), total: Number(order.total),
    paymentStatus: snapshot.paymentMethod === "cod" ? "Pending" : "Paid",
    lines: order.items.map(item => ({ variantId: item.variantId, name: item.name, sku: item.sku, quantity: item.quantity, unitPrice: Number(item.unitPrice), tax: Number(item.tax) })),
    snapshot: snapshot as InvoiceInput["order"]["snapshot"],
  }, { name: String(fallback.storeName), legalName: String(fallback.legalName || fallback.storeName), gstin: String(fallback.businessGstin || ""), address: String(fallback.businessAddress || ""), email: String(fallback.supportEmail || ""), phone: String(fallback.supportPhone || ""), fssaiLicense: String(fallback.fssaiLicense || "") });
  const business = { storeName: invoice.store.name, legalName: invoice.store.legalName || invoice.store.name, businessAddress: invoice.store.address || "", businessGstin: invoice.store.gstin || "", supportEmail: invoice.store.email || "", supportPhone: invoice.store.phone || "", fssaiLicense: invoice.store.fssaiLicense || "" };
  const invoicePayload = JSON.parse(JSON.stringify(invoice)) as Prisma.InputJsonValue;
  await tx.notification.upsert({
    where: { id: orderConfirmationId(orderId) }, update: {},
    create: {
      id: orderConfirmationId(orderId), userId: order.userId, channel: "EMAIL", template: "order.confirmed", destination, status: "QUEUED",
      payload: {
        orderId: order.id, orderNumber: order.number, placedAt: order.createdAt.toISOString(), storeName: business.storeName, currency: order.currency,
        customer: { name: String(contact.name || ""), email: destination, phone: String(contact.phone || "") },
        address: [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.postalCode, shipping.country].filter(Boolean).join(", "),
        paymentLabel: snapshot.paymentMethod === "cod" ? "Cash on delivery — payable on delivery" : "Paid online",
        items: invoice.order.lines.map(item => ({ name: item.name, sku: item.sku, pack: item.pack || "", quantity: item.quantity, unitPrice: item.unitPrice, tax: item.tax })),
        invoice: invoicePayload,
        charges: { subtotal: Number(order.subtotal), discount: Number(order.discount), couponDiscount: object(snapshot.discounts).coupon ?? Number(order.discount), onlinePaymentDiscount: object(snapshot.discounts).onlinePayment ?? 0, shipping: Number(order.shipping), tax: Number(order.tax), total: Number(order.total) },
        business: { legalName: business.legalName || business.storeName, address: business.businessAddress, gstin: business.businessGstin, email: business.supportEmail, phone: business.supportPhone, fssaiLicense: business.fssaiLicense },
      },
    },
  });
  const merchantEmail = (process.env.STORE_ORDER_ALERT_EMAIL || process.env.STORE_ADMIN_EMAIL || "").trim().toLowerCase();
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(merchantEmail)) {
    const confirmation = await tx.notification.findUnique({ where: { id: orderConfirmationId(orderId) } });
    if (confirmation) {
      // Customer delivery envelopes contain their recipient and PDF. A later
      // merchant alert must build and freeze its own independent envelope.
      const merchantPayload = { ...object(confirmation.payload) };
      delete merchantPayload._emailDelivery;
      await tx.notification.upsert({
        where: { id: orderAlertId(orderId) }, update: {},
        create: { id: orderAlertId(orderId), channel: "EMAIL", template: "order.received", destination: merchantEmail, status: "QUEUED", payload: merchantPayload as Prisma.InputJsonValue },
      });
    }
  }
}
