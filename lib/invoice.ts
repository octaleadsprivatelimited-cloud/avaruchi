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
    for (const word of String(s).split(/\s+/)) {
      if ((line + " " + word).length > length && line) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    return lines.slice(0, max);
  };
  const cmds: string[] = ["0.949 0.929 0.886 rg 0 0 595 842 re f"];
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
  text("avaruchi", 45, 787, 34, "F2");
  text("THE PICKLE COMPANY", 46, 768, 8, "F3");
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
  text("avaruchi.com", 45, 745, 10);
  wrap(
    business.address || "Business address awaiting configuration",
    48,
    2,
  ).forEach((s, i) => text(s, 45, 729 - i * 13, 9));
  if (business.gst) text("GSTIN: " + business.gst, 45, 695, 9);
  line(679);
  if (data.demo)
    text(
      "DEMONSTRATION INVOICE. NO PAYMENT COLLECTED.",
      45,
      662,
      8,
      "F3",
      "0.60 0.22 0.14",
    );
  else
    text("Thank you for making room for Avaruchi at your table.", 45, 662, 9);
  text("BILLED TO / DELIVERY ADDRESS", 45, 636, 8, "F3");
  text(data.address.name, 45, 619, 12, "F3");
  wrap(
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
    3,
  ).forEach((s, i) => text(s, 45, 601 - i * 13, 9));
  text("Mobile: " + data.address.phone, 45, 548, 9);
  cmds.push("0.89 0.87 0.81 rg 45 505 505 26 re f");
  text("ITEM / JAR SIZE", 54, 515, 8, "F3");
  text("QTY", 340, 515, 8, "F3");
  text("UNIT PRICE", 391, 515, 8, "F3");
  text("AMOUNT", 475, 515, 8, "F3");
  let y = 487;
  for (const item of data.items) {
    text(
      item.name + " / " + (item.weight === 1000 ? "1 kg" : item.weight + " g"),
      54,
      y,
      10,
    );
    text(String(item.quantity), 345, y, 10);
    text(amount(item.price), 389, y, 9);
    text(amount(item.price * item.quantity), 474, y, 9);
    line(y - 10);
    y -= 26;
  }
  y -= 17;
  for (const [label, value] of [
    ["Subtotal", data.subtotal],
    ["Discount", data.discount],
    ["Delivery", data.shipping],
  ] as [string, number][]) {
    text(label, 365, y, 9);
    text(amount(value), 474, y, 9);
    y -= 18;
  }
  line(y + 7);
  y -= 15;
  text("TOTAL", 365, y, 11, "F3");
  text(amount(order.total), 459, y, 14, "F3");
  text("Order status: " + order.status, 45, y, 9);
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
  text("1 / 1", 526, 40, 8);
  const content = cmds.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
  ];
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
