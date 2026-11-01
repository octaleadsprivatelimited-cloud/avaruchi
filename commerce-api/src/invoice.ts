import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type InvoiceAddress = { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
export type InvoiceSeller = { name: string; legalName?: string; gstin?: string; address?: string; email?: string; phone?: string };
export type InvoiceDetails = { seller: InvoiceSeller; billing?: InvoiceAddress; lines: Array<{ variantId: string; pack?: string; hsnCode?: string; taxRate?: number }> };
export type InvoiceInput = { store: InvoiceSeller; order: {
  number: string; createdAt: string; status: string; subtotal: number; tax: number; shipping: number; discount: number; total: number; paymentStatus?: string;
  lines: Array<{ variantId?: string; name: string; sku: string; quantity: number; unitPrice: number; tax: number; pack?: string; hsnCode?: string; taxRate?: number }>;
  snapshot?: { contact?: { name?: string; email?: string; phone?: string }; shipping?: InvoiceAddress; billing?: InvoiceAddress; gstin?: string; paymentMethod?: string;
    discounts?: { coupon: number; onlinePayment: number }; invoiceDetails?: InvoiceDetails;
    notificationBusiness?: { storeName?: string; legalName?: string; businessGstin?: string; businessAddress?: string; supportEmail?: string; supportPhone?: string };
  };
} };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const clean = (value: unknown, max = 200) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100_000_000;
const money = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const addressText = (address: InvoiceAddress = {}) => [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(", "), address.country].filter(Boolean).join("\n");

/** Reuse immutable checkout data for downloads and for the transactional outbox. */
export function invoiceInputFromOrder(order: InvoiceInput["order"], fallbackStore: InvoiceSeller): InvoiceInput {
  const snapshot = order.snapshot || {}, historical = snapshot.notificationBusiness;
  const store = snapshot.invoiceDetails?.seller || (historical ? {
    name: historical.storeName || fallbackStore.name, legalName: historical.legalName, gstin: historical.businessGstin,
    address: historical.businessAddress, email: historical.supportEmail, phone: historical.supportPhone,
  } : { ...fallbackStore, gstin: undefined });
  return { store: { ...store }, order: { ...order, snapshot, lines: order.lines.map(line => {
    const detail = snapshot.invoiceDetails?.lines.find(item => item.variantId === line.variantId);
    return { ...line, tax: Math.round(line.tax * 100) / 100, ...(detail ? { pack: detail.pack, hsnCode: detail.hsnCode, taxRate: detail.taxRate } : {}) };
  }) } };
}

/** Old outbox messages remain deliverable; only complete financial records become PDFs. */
export function invoiceInputFromNotificationPayload(payload: Record<string, unknown>): InvoiceInput | undefined {
  const explicit = object(payload.invoice), explicitOrder = object(explicit.order), explicitStore = object(explicit.store);
  let input: InvoiceInput;
  if (explicitOrder.number && explicitStore.name) input = explicit as InvoiceInput;
  else {
    const charges = object(payload.charges), business = object(payload.business), customer = object(payload.customer);
    if (!Array.isArray(payload.items) || !payload.items.length || !payload.placedAt) return undefined;
    input = { store: { name: clean(payload.storeName) || "Aavaruchi", legalName: clean(business.legalName), gstin: clean(business.gstin), address: clean(business.address, 500), email: clean(business.email, 254), phone: clean(business.phone, 30) }, order: {
      number: clean(payload.orderNumber, 80), createdAt: clean(payload.placedAt, 80), status: "CONFIRMED", paymentStatus: clean(payload.paymentLabel, 100),
      subtotal: charges.subtotal as number, tax: charges.tax as number, shipping: charges.shipping as number, discount: charges.discount as number, total: charges.total as number,
      lines: payload.items.map(value => { const line = object(value); return { name: clean(line.name), sku: clean(line.sku, 100), quantity: line.quantity as number, unitPrice: line.unitPrice as number, tax: line.tax as number, pack: clean(line.pack, 100), hsnCode: clean(line.hsnCode, 8), taxRate: line.taxRate as number }; }),
      snapshot: { contact: { name: clean(customer.name), email: clean(customer.email, 254), phone: clean(customer.phone, 30) }, shipping: { line1: clean(payload.address, 1000) } },
    } };
  }
  const order = input.order;
  if (!clean(order.number, 80) || !Number.isFinite(Date.parse(order.createdAt)) || !Array.isArray(order.lines) || order.lines.length < 1 || order.lines.length > 100 ||
    ![order.subtotal, order.tax, order.shipping, order.discount, order.total].every(finite) || order.lines.some(line => !clean(line.name) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000 || !finite(line.unitPrice) || !finite(line.tax))) return undefined;
  return input;
}

const states: Record<string, string> = {
  "jammu and kashmir": "01", "himachal pradesh": "02", punjab: "03", chandigarh: "04", uttarakhand: "05", haryana: "06", delhi: "07", rajasthan: "08", "uttar pradesh": "09", bihar: "10", sikkim: "11", "arunachal pradesh": "12", nagaland: "13", manipur: "14", mizoram: "15", tripura: "16", meghalaya: "17", assam: "18", "west bengal": "19", jharkhand: "20", odisha: "21", chhattisgarh: "22", "madhya pradesh": "23", gujarat: "24", "dadra and nagar haveli and daman and diu": "26", maharashtra: "27", karnataka: "29", goa: "30", lakshadweep: "31", kerala: "32", "tamil nadu": "33", puducherry: "34", "andaman and nicobar islands": "35", telangana: "36", "andhra pradesh": "37", ladakh: "38",
};
const validGstin = (value = "") => /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(value);
export function invoiceTaxSummary(input: InvoiceInput) {
  const seller = clean(input.store.gstin).toUpperCase(), shipping = input.order.snapshot?.shipping || {};
  const stateName = clean(shipping.state).toLowerCase().replace(/[&]/g, "and").replace(/\s+/g, " ");
  const destination = states[stateName] || (/^\d{2}$/.test(stateName) && Object.values(states).includes(stateName) ? stateName : undefined);
  const origin = validGstin(seller) ? seller.slice(0, 2) : undefined;
  const customerGstin = clean(input.order.snapshot?.gstin).toUpperCase();
  const ambiguousBillTo = validGstin(customerGstin) && customerGstin.slice(0, 2) !== destination;
  const domestic = ["IN", "INDIA"].includes(clean(shipping.country || "IN").toUpperCase());
  const mode = origin && destination && domestic && !ambiguousBillTo ? origin === destination ? "LOCAL" : "INTERSTATE" : "UNSPECIFIED";
  const taxPaise = Math.round(input.order.tax * 100), central = Math.floor(taxPaise / 2) / 100;
  const rows: Array<{ label: string; amount: number }> = mode === "LOCAL" ? [{ label: "CGST", amount: central }, { label: ["04", "26", "31", "35", "38"].includes(origin!) ? "UTGST" : "SGST", amount: (taxPaise - Math.floor(taxPaise / 2)) / 100 }] : [{ label: mode === "INTERSTATE" ? "IGST" : "GST recorded on order", amount: input.order.tax }];
  const groups = new Map<number | null, { rate: number | null; itemValue: number; tax: number }>();
  for (const line of input.order.lines) {
    const itemValue = line.unitPrice * line.quantity;
    const rate = finite(line.taxRate) && line.taxRate! <= 100 ? line.taxRate! : null;
    const group = groups.get(rate) || { rate, itemValue: 0, tax: 0 }; group.itemValue += itemValue; group.tax += line.tax; groups.set(rate, group);
  }
  return { registered: Boolean(origin), mode, placeOfSupply: [shipping.state, destination ? `(${destination})` : ""].filter(Boolean).join(" "), rows, rounding: Math.round((input.order.tax - input.order.lines.reduce((sum, line) => sum + line.tax, 0)) * 100) / 100, groups: [...groups.values()].sort((a, b) => (a.rate ?? -1) - (b.rate ?? -1)) };
}

export async function generateInvoicePdf(raw: InvoiceInput): Promise<Buffer> {
  const input = { ...raw, order: { ...raw.order, lines: raw.order.lines.map(line => ({ ...line, tax: Math.round(line.tax * 100) / 100 })) } }, { order, store } = input;
  const snapshot = order.snapshot || {}, customer = snapshot.contact || {}, tax = invoiceTaxSummary(input);
  const date = new Date(Number.isFinite(Date.parse(order.createdAt)) ? order.createdAt : "2000-01-01T00:00:00.000Z");
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: { Title: `Invoice ${clean(order.number, 80)}`, Author: clean(store.name), CreationDate: date, ModDate: date } });
    const chunks: Buffer[] = []; doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    const left = 42, right = 553, width = 511, bottom = 747, green = "#244c36", ink = "#25352b", muted = "#68736b", rule = "#dde5db", cream = "#faf8f0";
    const put = (text: string, x: number, y: number, w: number, size = 9, bold = false, color = ink, align: "left" | "right" = "left") => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color).text(text, x, y, { width: w, align, lineGap: 2 }); return doc.y; };
    const height = (text: string, w: number, size = 9, bold = false) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).heightOfString(text, { width: w, lineGap: 2 });
    const line = (y: number) => doc.strokeColor(rule).lineWidth(0.6).moveTo(left, y).lineTo(right, y).stroke();
    let y = 42;
    const continuation = () => { doc.addPage(); put(clean(store.name), left, 35, 300, 14, true, green); put(`Invoice ${clean(order.number, 80)}`, 360, 37, 193, 9, false, muted, "right"); line(64); y = 82; };
    const ensure = (space: number) => { if (y + space > bottom) continuation(); };
    doc.rect(0, 0, doc.page.width, 122).fill(green);
    const logoPaths = ["../../../public/brand/avaruchi-logo-icon.png", "../../public/brand/avaruchi-logo-icon.png"].map(path => fileURLToPath(new URL(path, import.meta.url)));
    const logo = logoPaths.find(path => existsSync(path));
    if (logo) doc.image(logo, left, 30, { fit: [62, 62] });
    put(clean(store.name), logo ? 118 : left, 34, 280, 23, true, "#ffffff");
    put("HOMEMADE FLAVOURS. CAREFULLY PREPARED.", logo ? 118 : left, 69, 300, 7, false, "#e1e9d6");
    put(tax.registered && order.tax > 0 ? "TAX INVOICE" : "ORDER INVOICE", 390, 35, 163, 10, true, "#f7e4a8", "right");
    put(clean(order.number, 80), 375, 56, 178, 16, true, "#ffffff", "right");
    put(date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }), 375, 81, 178, 9, false, "#e1e9d6", "right");
    y = 143;
    const seller = [clean(store.legalName || store.name), clean(store.address, 500), ...(store.gstin ? [`GSTIN: ${clean(store.gstin, 30)}`] : []), clean(store.email, 254)].filter(Boolean).join("\n");
    const sellerBottom = put(seller, left, y, 310, 9);
    const paymentStatus = clean(order.paymentStatus || (snapshot.paymentMethod === "cod" ? "Cash on delivery" : "Pending"), 100).replaceAll("_", " ");
    const badge = snapshot.paymentMethod === "cod" || paymentStatus.toUpperCase().includes("CASH") ? "PAYABLE ON DELIVERY" : /PAID|SUCCEEDED|CAPTURED/i.test(paymentStatus) && !/UNPAID|REFUND/i.test(paymentStatus) ? "PAID ONLINE" : paymentStatus.toUpperCase();
    doc.roundedRect(367, y - 2, 186, 35, 5).fill(cream); put(badge, 377, y + 9, 166, 8, true, green, "right");
    put(`Order status: ${clean(order.status).replaceAll("_", " ")}`, 340, y + 46, 213, 8, false, muted, "right");
    y = Math.max(sellerBottom, y + 62) + 20; line(y); y += 17;
    put("BILL TO", left, y, 240, 8, true, green); put("SHIP TO", 310, y, 243, 8, true, green); y += 18;
    const bill = [clean(customer.name) || "Customer", addressText(snapshot.billing || snapshot.invoiceDetails?.billing || snapshot.shipping), clean(customer.email, 254), clean(customer.phone, 30), ...(snapshot.gstin ? [`GSTIN: ${clean(snapshot.gstin, 30)}`] : [])].filter(Boolean).join("\n");
    const ship = [clean(customer.name) || "Customer", addressText(snapshot.shipping)].filter(Boolean).join("\n");
    y = Math.max(put(bill, left, y, 235), put(ship, 310, y, 243)) + 18;
    if (tax.placeOfSupply) { put(`Place of supply: ${tax.placeOfSupply}`, left, y, width, 8, false, muted); y = doc.y + 15; }
    const tableHeader = () => { doc.rect(left, y, width, 26).fill(green); for (const [label, x, w, align] of [["PRODUCT / PACK", 50, 195, "left"], ["QTY", 253, 25, "right"], ["UNIT (INR)", 285, 70, "right"], ["GST %", 362, 37, "right"], ["GST (INR)", 406, 61, "right"], ["TOTAL (INR)", 474, 71, "right"]] as const) put(label, x, y + 9, w, 7, true, "#ffffff", align); y += 34; };
    ensure(100); tableHeader();
    order.lines.slice(0, 100).forEach((item, index) => {
      const name = clean(item.name), details = [clean(item.pack, 100), `SKU: ${clean(item.sku, 100)}`, item.hsnCode ? `HSN: ${clean(item.hsnCode, 8)}` : ""].filter(Boolean).join(" | ");
      const rowHeight = Math.max(46, height(name, 195, 9, true) + height(details, 195, 7) + 18);
      if (y + rowHeight > bottom) { continuation(); tableHeader(); }
      if (index % 2 === 0) doc.rect(left, y - 4, width, rowHeight).fill(cream);
      const nameBottom = put(name, 50, y + 3, 195, 9, true); put(details, 50, nameBottom + 3, 195, 7, false, muted);
      const base = item.unitPrice * item.quantity, rate = finite(item.taxRate) && item.taxRate! <= 100 ? item.taxRate! : undefined;
      put(String(item.quantity), 253, y + 5, 25, 9, false, ink, "right"); put(money(item.unitPrice), 285, y + 5, 70, 9, false, ink, "right"); put(rate === undefined ? "-" : String(rate), 362, y + 5, 37, 8, false, muted, "right"); put(money(item.tax), 406, y + 5, 61, 9, false, ink, "right"); put(money(base + item.tax), 474, y + 5, 71, 9, true, ink, "right");
      y += rowHeight; line(y - 4);
    });
    y += 17; ensure(210);
    const totalRow = (label: string, value: number, strong = false) => { put(label, 323, y, 132, 9, strong, strong ? green : muted); put(`INR ${money(value)}`, 453, y, 100, 9, strong, ink, "right"); y += 21; };
    totalRow("Item subtotal", order.subtotal);
    const discounts = snapshot.discounts;
    if (discounts && discounts.coupon + discounts.onlinePayment === order.discount) { if (discounts.coupon) totalRow("Coupon discount", -discounts.coupon); if (discounts.onlinePayment) totalRow("Online-payment offer", -discounts.onlinePayment); }
    else if (order.discount) totalRow("Discount", -order.discount);
    totalRow("Delivery", order.shipping);
    for (const row of tax.rows) totalRow(row.label, row.amount);
    doc.roundedRect(315, y - 3, 238, 33, 4).fill(cream); y += 6; totalRow("ORDER TOTAL", order.total, true); y += 18;
    ensure(70); put("GST SUMMARY", left, y, width, 8, true, green); y += 20;
    for (const group of tax.groups) {
      ensure(35);
      const rateLabel = group.rate === null ? "GST rate not recorded" : tax.mode === "LOCAL" ? `CGST ${group.rate / 2}% + ${tax.rows[1]!.label} ${group.rate / 2}%` : `${tax.mode === "INTERSTATE" ? "IGST" : "GST"} ${group.rate}%`;
      put(rateLabel, left, y, 300, 8, true); put(`GST INR ${money(group.tax)}`, 370, y, 183, 8, false, ink, "right");
      put(`Item value INR ${money(group.itemValue)}`, left, y + 13, 300, 8, false, muted); y += 33;
    }
    if (tax.rounding) { ensure(22); put("GST rounding", left, y, 200, 8, false, muted); put(`INR ${money(tax.rounding)}`, 370, y, 183, 8, false, ink, "right"); y += 20; }
    const notes = [!tax.registered ? "Seller GST registration details have not been provided. This document records the amounts charged for your order; it is not a GST tax invoice." : "Reverse charge: No. GST amounts reflect the charges saved at checkout.", tax.mode === "UNSPECIFIED" && tax.registered ? "CGST / SGST / IGST allocation is unavailable until the place of supply is confirmed." : "", order.discount ? "Offers are shown separately from the item values and tax recorded on the order." : "", "Please contact the store if any billing details need correction."].filter(Boolean).join("\n");
    y += 10; ensure(height(notes, width, 8) + 25); line(y); y += 12; put(notes, left, y, width, 8, false, muted);
    const pages = doc.bufferedPageRange();
    for (let page = 0; page < pages.count; page++) { doc.switchToPage(page); line(768); put(`Thank you for choosing ${clean(store.name)}.`, left, 780, 380, 8, false, muted); put(`${page + 1} / ${pages.count}`, 480, 780, 73, 8, false, muted, "right"); }
    doc.end();
  });
}
