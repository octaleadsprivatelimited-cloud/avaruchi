import { BRAND } from "./brand";
import { invoiceLogo } from "./invoice-logo";
// Compact, dependency-free A4 PDF renderer for the store server.
export function invoicePdf(
  order: any,
  invoice: any,
  business: any,
): Uint8Array {
  const data =
    typeof order.data === "string" ? JSON.parse(order.data) : order.data;
  const amount = (n: number) => "Rs " + (n / 100).toFixed(2);
  const number =
    "AVR-" +
    new Date(invoice.created).getUTCFullYear() +
    "-" +
    String(invoice.id).padStart(6, "0");
  const safe = (s: string) =>
    String(s)
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/([\\()])/g, "\\$1");
  const wrap = (s: string, length = 78, max = 4) => {
    const lines: string[] = [];
    let line = "";
    for (const word of String(s)
      .split(/\s+/)
      .flatMap(
        (word) => word.match(new RegExp(".{1," + length + "}", "g")) || [],
      )) {
      if ((line + " " + word).length > length && line) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines.slice(0, max);
  };
  const pages: string[][] = [];
  let cmds: string[] = [];
  const startPage = () => {
    cmds = ["0.949 0.929 0.886 rg 0 0 595 842 re f"];
    pages.push(cmds);
  };
  startPage();
  const text = (
    s: string,
    x: number,
    y: number,
    size = 10,
    font = "F1",
    color = "0.15 0.28 0.21",
  ) =>
    cmds.push(
      color +
        " rg BT /" +
        font +
        " " +
        size +
        " Tf 1 0 0 1 " +
        x +
        " " +
        y +
        " Tm (" +
        safe(s) +
        ") Tj ET",
    );
  const line = (y: number) =>
    cmds.push("0.71 0.74 0.67 RG 0.5 w 45 " + y + " m 550 " + y + " l S");
  cmds.push("q 80 0 0 80 45 742 cm /Logo Do Q");
  text("Avaruchi", 140, 787, 30, "F2");
  text(business.name || BRAND.legalName, 140, 768, 9, "F3");
  text("Established " + BRAND.established, 140, 751, 8);
  text("avaruchi.com", 140, 735, 9);
  text("ORDER INVOICE", 365, 793, 9, "F3");
  text(number, 365, 773, 11, "F3");
  text("Order: " + order.id, 365, 751, 9);
  text(
    "Issued: " +
      new Date(invoice.created).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
    365,
    735,
    9,
  );
  text("Payment: " + order.payment, 365, 719, 9);
  const merchantLines = wrap(business.address || BRAND.address, 48, 20);
  merchantLines.forEach((s, i) => text(s, 45, 714 - i * 13, 9));
  const phoneY = 714 - merchantLines.length * 13;
  text("Phone / WhatsApp: " + (business.phone || BRAND.phone), 45, phoneY, 9);
  const merchantBottom = phoneY;
  if (business.gst) text("GSTIN: " + business.gst, 45, merchantBottom - 18, 9);
  const headerRule = Math.min(679, merchantBottom - (business.gst ? 32 : 18));
  line(headerRule);
  if (data.demo)
    text(
      "DEMONSTRATION INVOICE. NO PAYMENT COLLECTED.",
      45,
      headerRule - 17,
      8,
      "F3",
      "0.60 0.22 0.14",
    );
  else
    text(
      "Thank you for making room for Avaruchi at your table.",
      45,
      headerRule - 17,
      9,
    );
  text("BILLED TO / DELIVERY ADDRESS", 45, headerRule - 43, 8, "F3");
  let addressY = headerRule - 60;
  const customerLines = wrap(data.address.name, 75, 5);
  customerLines.forEach((s, i) => text(s, 45, addressY - i * 14, 11, "F3"));
  addressY -= customerLines.length * 14 + 4;
  const addressLines = wrap(
    [
      data.address.line1,
      data.address.line2,
      data.address.city,
      data.address.state,
      data.address.pincode,
    ]
      .filter(Boolean)
      .join(", "),
    85,
    20,
  );
  addressLines.forEach((s, i) => text(s, 45, addressY - i * 13, 9));
  addressY -= addressLines.length * 13 + 10;
  text("Mobile: " + data.address.phone, 45, addressY, 9);
  const tableHeading = (top: number) => {
    cmds.push("0.89 0.87 0.81 rg 45 " + (top - 26) + " 505 26 re f");
    text("ITEM / JAR SIZE", 54, top - 16, 8, "F3");
    text("QTY", 340, top - 16, 8, "F3");
    text("UNIT PRICE", 389, top - 16, 8, "F3");
    text("AMOUNT", 481, top - 16, 8, "F3");
    return top - 44;
  };
  const continuation = () => {
    startPage();
    cmds.push("q 52 0 0 52 45 760 cm /Logo Do Q");
    text("Avaruchi", 110, 787, 30, "F2");
    text(business.name || BRAND.legalName, 110, 769, 9, "F3");
    text("ORDER INVOICE / " + number, 45, 740, 10, "F3");
    text("Order: " + order.id, 45, 724, 9);
    return tableHeading(708);
  };
  const rightAmount = (value: number, right: number, at: number, size = 9) => {
    const valueText = amount(value);
    // Helvetica digits, decimal points and spaces fit within this conservative width.
    text(valueText, right - valueText.length * size * 0.56, at, size);
  };
  let y = tableHeading(Math.min(531, addressY - 18));
  for (const item of data.items) {
    const names = wrap(
      item.name + " / " + (item.weight === 1000 ? "1 kg" : item.weight + " g"),
      44,
      20,
    );
    const height = Math.max(26, names.length * 13 + 12);
    if (y - height < 130) y = continuation();
    names.forEach((name, i) => text(name, 54, y - i * 13, 9));
    text(String(item.quantity), 345, y, 9);
    rightAmount(item.price, 461, y);
    rightAmount(item.price * item.quantity, 548, y);
    line(y - height + 10);
    y -= height;
  }
  if (y - 125 < 110) {
    y = continuation();
    text("ORDER TOTALS", 54, y, 10, "F3");
    y -= 25;
  }
  y -= 17;
  for (const [label, value] of [
    ["Subtotal", data.subtotal],
    ["Discount", data.discount],
    ["Delivery", data.shipping],
  ] as [string, number][]) {
    text(label, 365, y, 9);
    rightAmount(value, 548, y);
    y -= 18;
  }
  line(y + 7);
  y -= 15;
  text("TOTAL", 365, y, 11, "F3");
  rightAmount(order.total, 548, y, 13);
  text("Order status: " + order.status, 45, y, 9);
  const logoObjectId = 6 + pages.length * 2;
  pages.forEach((page, index) => {
    cmds = page;
    line(91);
    text(
      data.demo
        ? "Preview only. No shipment is scheduled."
        : "Keep this invoice with your order records.",
      45,
      72,
      9,
    );
    text("Generated automatically on order confirmation.", 45, 55, 8);
    text(
      business.gst
        ? "This is an order invoice."
        : "Order invoice. GST registration has not been configured.",
      45,
      40,
      8,
    );
    text(index + 1 + " / " + pages.length, 526, 40, 8);
  });
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [" +
      pages.map((_, i) => 6 + i * 2 + " 0 R").join(" ") +
      "] /Count " +
      pages.length +
      " >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  pages.forEach((page, index) => {
    const content = page.join("\n");
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << /Logo " +
        logoObjectId +
        " 0 R >> >> /Contents " +
        (7 + index * 2) +
        " 0 R >>",
    );
    objects.push(
      "<< /Length " +
        content.length +
        " >>\nstream\n" +
        content +
        "\nendstream",
    );
  });
  const logoStream = invoiceLogo.data + ">";
  objects.push(
    "<< /Type /XObject /Subtype /Image /Width " +
      invoiceLogo.width +
      " /Height " +
      invoiceLogo.height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Interpolate true /Filter [/ASCIIHexDecode /FlateDecode] /DecodeParms [null << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns " +
      invoiceLogo.width +
      " >>] /Length " +
      logoStream.length +
      " >>\nstream\n" +
      logoStream +
      "\nendstream",
  );
  let out = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const start = out.length;
  out +=
    "xref\n0 " +
    (objects.length + 1) +
    "\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    start +
    "\n%%EOF";
  return new TextEncoder().encode(out);
}
