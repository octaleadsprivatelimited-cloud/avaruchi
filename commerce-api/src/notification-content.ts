type NotificationPayload = Record<string, unknown>;

const text = (value: unknown, fallback: string, maximum: number) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return (normalized || fallback)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, maximum);
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

export function renderEmailNotification(
  template: string,
  payload: NotificationPayload,
  options: { invoiceAttached?: boolean } = {},
) {
  const storeName = text(payload.storeName, "Our store", 100);
  if (template === "email.test") {
    const message = `This is a delivery test from ${storeName}. Your Hostinger backend can send email through Resend. Accepted orders will send a customer confirmation and a separate store alert. This test does not create an order or charge a payment.`;
    return { subject: `${storeName} — order email delivery test`, text: message,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:24px auto;color:#203d25"><div style="background:#3c692f;color:#fff;padding:24px;font-size:26px">${escapeHtml(storeName)}</div><div style="padding:24px;background:#fcfbf6"><h1 style="font-size:22px">Order email delivery test</h1><p style="line-height:1.7">${escapeHtml(message)}</p><p>${escapeHtml(text(payload.legalName, storeName, 160))}</p></div></div>` };
  }
  if (template === "order.confirmed" || template === "order.received") {
    const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const contact = object(payload.customer), business = object(payload.business), charges = object(payload.charges);
    const currency = /^[A-Z]{3}$/.test(String(payload.currency)) ? String(payload.currency) : "INR";
    const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const money = (value: unknown) => `${currency} ${numeric(value).toFixed(2)}`;
    const number = text(payload.orderNumber, "", 80), customerName = text(contact.name, "Customer", 100);
    const legalName = text(business.legalName, storeName, 160);
    const payment = text(payload.paymentLabel, "Payment details are shown on your invoice", 100);
    const address = text(payload.address, "Not provided", 1000);
    const placedAt = text(payload.placedAt, "", 80);
    const parsedDate = new Date(placedAt);
    const date = placedAt && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : placedAt;
    const merchantAlert = template === "order.received";
    const invoiceAttached = !merchantAlert && options.invoiceAttached === true;
    const title = merchantAlert ? "New order received" : "Your order is confirmed";
    const greeting = merchantAlert ? `New order ${number} from ${customerName}. Prepare the items for dispatch.` : `Thank you, ${customerName}. Your order ${number} is confirmed.`;
    const rows: Array<[string, string]> = [
      ["Order ID", number], ["Order reference", text(payload.orderId, "", 80)],
      ...(placedAt ? [["Placed at", placedAt] as [string, string]] : []),
      ["Customer", customerName], ["Email", text(contact.email, "Not provided", 254)],
      ["Phone", text(contact.phone, "Not provided", 30)], ["Delivery address", address], ["Payment", payment],
    ];
    const totals: Array<[string, string]> = [
      ["Subtotal", money(charges.subtotal)],
      ...(numeric(charges.onlinePaymentDiscount) > 0 ? [
        ...(numeric(charges.couponDiscount) > 0 ? [["Coupon discount", `-${money(charges.couponDiscount)}`] as [string, string]] : []),
        ["Online-payment discount", `-${money(charges.onlinePaymentDiscount)}`] as [string, string],
      ] : numeric(charges.discount) > 0 ? [["Discount", `-${money(charges.discount)}`] as [string, string]] : []),
      ["Shipping charges", money(charges.shipping)], ["GST", money(charges.tax)], ["Grand total", money(charges.total)],
    ];
    const businessRows: Array<[string, string]> = [["Business", legalName]];
    for (const [label, key] of [["Business address", "address"], ["GSTIN", "gstin"], ["FSSAI Reg. No.", "fssaiLicense"], ["Support email", "email"], ["Support phone", "phone"]]) {
      if (business[key!]) businessRows.push([label!, text(business[key!], "", 500)]);
    }
    const lines = Array.isArray(payload.items) ? payload.items.slice(0, 100).map(object) : [];
    const items = lines.map(line => {
      const name = text(line.name, "Item", 200), sku = text(line.sku, "", 100), pack = text(line.pack, "", 120);
      const quantity = numeric(line.quantity), unitPrice = numeric(line.unitPrice);
      return { name, sku, pack, quantity, unitPrice, total: unitPrice * quantity };
    });
    const details = (label: string, value: string) => `<p style="margin:0 0 5px;color:#6c735f;font-size:11px;line-height:1.5;text-transform:uppercase;letter-spacing:1px">${escapeHtml(label)}</p><p style="margin:0;color:#263c26;font-size:14px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(value)}</p>`;
    const section = (content: string) => `<tr><td style="padding:24px 28px;border-top:1px solid #e2e6d9">${content}</td></tr>`;
    const attachmentNote = invoiceAttached ? "Your PDF invoice is attached to this email. It includes the recorded order totals and GST details." : "";
    const supportEmail = text(business.email, "", 254);
    const support = supportEmail ? `Questions about your order? Reply to this email or contact ${supportEmail}.` : "Questions about your order? Reply to this email and our team will help.";
    return {
      subject: merchantAlert ? `New order ${number} — ${storeName}` : `Order ${number} confirmed — ${storeName}`,
      text: [greeting, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", "Items", ...items.map(item => `${item.name}${item.pack ? ` · ${item.pack}` : ""} (${item.sku}) — ${item.quantity} × ${money(item.unitPrice)} = ${money(item.total)}`), "", ...totals.map(([label, value]) => `${label}: ${value}`), ...(attachmentNote ? ["", attachmentNote] : []), "", ...businessRows.map(([label, value]) => `${label}: ${value}`), "", support].join("\n"),
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:0;background:#f4f1e8;color:#263c26;font-family:Arial,Helvetica,sans-serif"><div style="display:none;font-size:1px;color:#f4f1e8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(greeting)}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f1e8;width:100%;border-collapse:collapse"><tr><td align="center" style="padding:24px 12px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;border:1px solid #dfe5d5;border-radius:16px;border-spacing:0;overflow:hidden;background:#fffef9"><tr><td style="padding:28px;background:#355b2c;color:#ffffff"><p style="margin:0 0 7px;font-size:11px;line-height:1.5;letter-spacing:2px;text-transform:uppercase;color:#e3ebd9">A little taste of home</p><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.2;font-weight:bold;color:#ffffff;overflow-wrap:anywhere">${escapeHtml(storeName)}</p></td></tr><tr><td style="padding:28px"><p style="margin:0 0 12px;font-size:11px;line-height:1.5;letter-spacing:1.5px;text-transform:uppercase;color:#7f6037">${merchantAlert ? "Store order alert" : "Thank you for shopping with us"}</p><h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#263c26">${title}</h1><p style="margin:0;font-size:15px;line-height:1.75;color:#526147">${escapeHtml(greeting)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;width:100%;border:1px solid #dfe5d5;border-radius:8px;background:#f3f6ed"><tr><td style="padding:16px">${details("Order", number)}${date ? `<p style="margin:7px 0 0;font-size:12px;line-height:1.5;color:#6c735f">${escapeHtml(date)}</p>` : ""}</td><td align="right" style="padding:16px;font-size:13px;line-height:1.65;color:#355b2c;max-width:240px;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(payment)}</td></tr></table></td></tr>${section(`<h2 style="margin:0 0 16px;font-size:17px;line-height:1.5;color:#263c26">Your selection</h2><table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><thead><tr><th align="left" scope="col" style="padding:0 10px 12px 0;border-bottom:1px solid #dfe5d5;color:#6c735f;font-size:11px;line-height:1.5">PRODUCT</th><th align="center" scope="col" style="padding:0 8px 12px;border-bottom:1px solid #dfe5d5;color:#6c735f;font-size:11px;line-height:1.5">QTY</th><th align="right" scope="col" style="padding:0 0 12px 8px;border-bottom:1px solid #dfe5d5;color:#6c735f;font-size:11px;line-height:1.5">AMOUNT</th></tr></thead><tbody>${items.map(item => `<tr><td style="padding:16px 10px 16px 0;border-bottom:1px solid #eceee5;vertical-align:top;overflow-wrap:anywhere;word-break:break-word"><p style="margin:0;font-size:14px;line-height:1.6;font-weight:bold;color:#263c26">${escapeHtml(item.name)}</p>${item.pack ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#6c735f">${escapeHtml(item.pack)}</p>` : ""}<p style="margin:4px 0 0;font-size:11px;line-height:1.5;color:#6c735f">${escapeHtml(item.sku)}</p><p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#6c735f">${money(item.unitPrice)} each</p></td><td align="center" style="padding:16px 8px;border-bottom:1px solid #eceee5;vertical-align:top;font-size:14px;line-height:1.6">${item.quantity}</td><td align="right" style="padding:16px 0 16px 8px;border-bottom:1px solid #eceee5;vertical-align:top;font-size:13px;line-height:1.6;white-space:nowrap">${money(item.total)}</td></tr>`).join("")}</tbody></table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-collapse:collapse">${totals.map(([label, value], index) => `<tr><td style="padding:${index === totals.length - 1 ? "16px 0 0" : "7px 0"};font-size:${index === totals.length - 1 ? "17" : "13"}px;line-height:1.5;${index === totals.length - 1 ? "border-top:1px solid #dfe5d5;font-weight:bold;color:#263c26" : "color:#6c735f"}">${escapeHtml(label)}</td><td align="right" style="padding:${index === totals.length - 1 ? "16px 0 0" : "7px 0"};font-size:${index === totals.length - 1 ? "17" : "13"}px;line-height:1.5;${index === totals.length - 1 ? "border-top:1px solid #dfe5d5;font-weight:bold;color:#263c26" : "color:#526147"}">${escapeHtml(value)}</td></tr>`).join("")}</table>`)}${section(`<h2 style="margin:0 0 12px;font-size:17px;line-height:1.5;color:#263c26">Delivery details</h2>${details(customerName, address)}<p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#6c735f;overflow-wrap:anywhere">${escapeHtml([text(contact.email, "", 254), text(contact.phone, "", 30)].filter(Boolean).join(" · "))}</p>`)}${invoiceAttached ? section(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#edf3e6;border:1px solid #d6e2cb;border-radius:8px"><tr><td style="padding:18px"><p style="margin:0 0 6px;font-size:15px;line-height:1.5;font-weight:bold;color:#355b2c">Your invoice is attached</p><p style="margin:0;font-size:13px;line-height:1.7;color:#526147">${escapeHtml(attachmentNote)}</p></td></tr></table>`) : ""}${section(`<p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#526147">${escapeHtml(support)}</p><p style="margin:0;font-size:12px;line-height:1.7;font-weight:bold;color:#355b2c">${escapeHtml(legalName)}</p>${businessRows.slice(1).map(([label, value]) => `<p style="margin:5px 0 0;font-size:11px;line-height:1.7;color:#6c735f;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(label)}: ${escapeHtml(value)}</p>`).join("")}<p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#79816e">Order reference: ${escapeHtml(text(payload.orderId, number, 80))}</p>`)}</table><p style="margin:18px 0 0;font-size:11px;line-height:1.7;color:#77816b">Prepared with care. Shared with love.</p></td></tr></table></body></html>`,
    };
  }
  if (template === "account.registered") {
    const name = text(payload.name, "there", 100),
      body = `Welcome ${name}. Your ${storeName} account has been created successfully.`;
    return {
      subject: `Welcome to ${storeName}`,
      text: body,
      html: `<p>${escapeHtml(body)}</p>`,
    };
  }
  const body = text(
    payload.message,
    `Your ${storeName} account has a new update.`,
    5000,
  );
  return {
    subject: text(template.replaceAll(".", " "), "Account update", 200),
    text: body,
    html: `<p>${escapeHtml(body)}</p>`,
  };
}

export function renderSmsNotification(
  template: string,
  payload: NotificationPayload,
) {
  if (template === "auth.mobile_otp") {
    const code = String(payload.code || "");
    if (!/^\d{6}$/.test(code))
      throw new Error("Mobile OTP notification has an invalid code");
    const requestedExpiry = Number(payload.expiresInMinutes),
      expiresInMinutes =
        Number.isInteger(requestedExpiry) &&
        requestedExpiry >= 1 &&
        requestedExpiry <= 30
          ? requestedExpiry
          : 5,
      storeName = text(payload.storeName, "our store", 60);
    return `${code} is your ${storeName} verification code. It expires in ${expiresInMinutes} minutes. Do not share it.`;
  }
  const body = text(payload.message, "", 1000);
  if (!body) throw new Error("SMS notification has no message");
  return body;
}
