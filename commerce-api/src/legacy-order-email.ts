import type { EmailContent } from "./resend-email.js";

const text = (value: unknown, fallback: string, maximum: number) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").slice(0, maximum);
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

/** Exact pre-invoice template for emails already attempted before this release. */
export function renderLegacyOrderEmail(template: "order.confirmed" | "order.received", payload: Record<string, unknown>): EmailContent {
  const storeName = text(payload.storeName, "Our store", 100);
    const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const contact = object(payload.customer), business = object(payload.business), charges = object(payload.charges);
    const currency = /^[A-Z]{3}$/.test(String(payload.currency)) ? String(payload.currency) : "INR";
    const money = (value: unknown) => `${currency} ${(Number.isFinite(Number(value)) ? Number(value) : 0).toFixed(2)}`;
    const number = text(payload.orderNumber, "", 80), customerName = text(contact.name, "Customer", 100);
    const rows: Array<[string, string]> = [
      ["Order ID", number], ["Order reference", text(payload.orderId, "", 80)],
      ...(payload.placedAt ? [["Placed at", text(payload.placedAt, "", 80)] as [string, string]] : []),
      ["Customer", customerName], ["Email", text(contact.email, "Not provided", 254)],
      ["Phone", text(contact.phone, "Not provided", 30)], ["Delivery address", text(payload.address, "Not provided", 1000)],
      ["Payment", text(payload.paymentLabel, "", 100)],
      ["Subtotal", money(charges.subtotal)],
      ...(Number(charges.onlinePaymentDiscount) > 0 ? [["Coupon discount", `-${money(charges.couponDiscount)}`], ["Online-payment discount", `-${money(charges.onlinePaymentDiscount)}`]] as Array<[string, string]> : [["Discount", `-${money(charges.discount)}`]] as Array<[string, string]>),
      ["Shipping charges", money(charges.shipping)], ["Tax", money(charges.tax)], ["Grand total", money(charges.total)],
      ["Business", text(business.legalName, storeName, 160)],
    ];
    for (const [label, key] of [["Business address", "address"], ["GSTIN", "gstin"], ["Support email", "email"], ["Support phone", "phone"]]) {
      if (business[key!]) rows.push([label!, text(business[key!], "", 500)]);
    }
    const lines = Array.isArray(payload.items) ? payload.items.slice(0, 100).map(object) : [];
    const items = lines.map(line => `${text(line.name, "Item", 200)} (${text(line.sku, "", 100)}) — ${Number(line.quantity) || 0} × ${money(line.unitPrice)} = ${money((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}`);
    const merchantAlert = template === "order.received";
    const greeting = merchantAlert ? `New order ${number} from ${customerName}. Prepare the items for dispatch.` : `Thank you, ${customerName}. Your order ${number} is confirmed.`;
    return {
      subject: merchantAlert ? `New order ${number} — ${storeName}` : `Order ${number} confirmed — ${storeName}`,
      text: [greeting, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", "Items", ...items].join("\n"),
      html: `<h1>${merchantAlert ? "New order received" : "Order confirmed"}</h1><p>${escapeHtml(greeting)}</p><table role="presentation">${rows.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</table><h2>Items</h2><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`,
    };

}
