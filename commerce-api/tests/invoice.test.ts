import { expect, it } from "vitest";
import { generateInvoicePdf, invoiceInputFromNotificationPayload, invoiceInputFromOrder, invoiceTaxSummary, type InvoiceInput } from "../src/invoice.js";

export const invoiceFixture = (): InvoiceInput => {
  const seller = { name: "Aavaruchi", legalName: "LAKSHMI'S TAPASI TREATS", gstin: "36ABCDE1234F1Z5", address: "Hyderabad, Telangana, India", email: "contact@aavaruchi.in" };
  return { store: seller, order: { number: "AVA-EXAMPLE-001", createdAt: "2026-11-01T06:00:00.000Z", status: "PAID", paymentStatus: "CAPTURED", subtotal: 1000, tax: 50, shipping: 0, discount: 0, total: 1050,
    lines: [{ variantId: "sample-variant", name: "Mango Avakaya", sku: "DEMO-MANGO-500", quantity: 2, unitPrice: 500, tax: 50 }], snapshot: {
      contact: { name: "Sample Customer", email: "customer@example.com", phone: "+919000000000" },
      shipping: { line1: "Example delivery address", city: "Hyderabad", state: "Telangana", postalCode: "500013", country: "IN" },
      billing: { line1: "Example billing address", city: "Hyderabad", state: "Telangana", postalCode: "500013", country: "IN" },
      invoiceDetails: { seller, lines: [{ variantId: "sample-variant", pack: "500 g", hsnCode: "2001", taxRate: 5 }] },
    } } };
};
it("keeps the seller, approved pack details and GST captured when checkout occurred", () => {
  const input = invoiceFixture(); const invoice = invoiceInputFromOrder(input.order, { name: "New name", gstin: "29ABCDE1234F1Z5" });
  expect(invoice.store.name).toBe("Aavaruchi"); expect(invoice.store.gstin).toBe("36ABCDE1234F1Z5");
  expect(invoice.order.lines[0]).toMatchObject({ pack: "500 g", hsnCode: "2001", taxRate: 5 });
  delete input.order.snapshot!.invoiceDetails;
  expect(invoiceInputFromOrder(input.order, input.store).store.gstin).toBeUndefined();
});
it("splits saved GST for known local/interstate supplies without changing totals or inventing allocation", () => {
  const input = invoiceInputFromOrder(invoiceFixture().order, invoiceFixture().store);
  expect(invoiceTaxSummary(input)).toMatchObject({ mode: "LOCAL", rows: [{ label: "CGST", amount: 25 }, { label: "SGST", amount: 25 }] });
  input.order.snapshot!.shipping!.state = "Karnataka";
  expect(invoiceTaxSummary(input)).toMatchObject({ mode: "INTERSTATE", rows: [{ label: "IGST", amount: 50 }] });
  input.order.snapshot!.shipping!.state = "Unknown";
  expect(invoiceTaxSummary(input).mode).toBe("UNSPECIFIED");
  input.store.gstin = "";
  expect(invoiceTaxSummary(input).registered).toBe(false);
  expect(input.order.total).toBe(1050);
});
it("attaches only complete invoice payloads and preserves deterministic PDF bytes across retries", async () => {
  const input = invoiceFixture();
  expect(invoiceInputFromNotificationPayload({ invoice: input })).toEqual(input);
  expect(invoiceInputFromNotificationPayload({ invoice: { ...input, order: { ...input.order, total: NaN } } })).toBeUndefined();
  expect(invoiceInputFromNotificationPayload({ orderNumber: "Legacy incomplete" })).toBeUndefined();
  const first = await generateInvoicePdf(input), second = await generateInvoicePdf(input);
  expect(first.subarray(0, 5).toString()).toBe("%PDF-"); expect(first.length).toBeGreaterThan(3000); expect(second.equals(first)).toBe(true);
  expect(first.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
});
it("paginates long product names and repeats content without blank footer pages", async () => {
  const input = invoiceFixture(); input.order.lines = Array.from({ length: 35 }, (_, i) => ({ ...input.order.lines[0]!, name: `Mango Avakaya ${i + 1} - Traditional family recipe with a carefully selected pack for your pantry and a long description` }));
  const pdf = await generateInvoicePdf(input);
  const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length || 0;
  expect(pages).toBeGreaterThan(2); expect(pages).toBeLessThan(9);
});
