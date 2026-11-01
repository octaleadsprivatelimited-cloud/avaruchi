import { describe, expect, it } from "vitest";
import {
  renderEmailNotification,
  renderSmsNotification,
} from "../src/notification-content.js";

describe("authentication notification content", () => {
  it("renders a branded welcome email and escapes customer-controlled text", () => {
    const content = renderEmailNotification("account.registered", {
      name: '<Admin & "Owner">',
      storeName: "Example <Store>",
    });
    expect(content.subject).toBe("Welcome to Example <Store>");
    expect(content.text).toContain('Welcome <Admin & "Owner">');
    expect(content.html).toContain(
      "Welcome &lt;Admin &amp; &quot;Owner&quot;&gt;",
    );
    expect(content.html).toContain("Example &lt;Store&gt;");
    expect(content.html).not.toContain("<Admin");
  });

  it("renders a useful branded OTP SMS without accepting malformed codes", () => {
    expect(
      renderSmsNotification("auth.mobile_otp", {
        code: "123456",
        expiresInMinutes: 5,
        storeName: "Customer Store",
      }),
    ).toBe(
      "123456 is your Customer Store verification code. It expires in 5 minutes. Do not share it.",
    );
    expect(() =>
      renderSmsNotification("auth.mobile_otp", {
        code: "12<script>",
        expiresInMinutes: 5,
      }),
    ).toThrow("invalid code");
  });
});

describe("order confirmation email", () => {
  it("includes order, delivery, business, item and complete charges with escaped HTML", () => {
    const content = renderEmailNotification("order.confirmed", {
      storeName: "Avaruchi", orderId: "internal-order-id", orderNumber: "RU-2026-42", currency: "INR",
      customer: { name: '<Buyer & "Family">', email: "buyer@example.com", phone: "+919876543210" },
      address: "12 Main Road, Hyderabad, Telangana, 500081, IN", paymentLabel: "Cash on delivery — payable on delivery",
      business: { legalName: "Avaruchi Foods", address: "Business Road", gstin: "TEST-GST", email: "support@example.com", phone: "+919999999999" },
      items: [{ name: "Sesame Oil <Pure>", sku: "AVA-SESAME-500", quantity: 2, unitPrice: 100 }],
      charges: { subtotal: 200, discount: 20, shipping: 40, tax: 10, total: 230 },
    });
    for (const value of ["RU-2026-42", "internal-order-id", "+919876543210", "500081", "Avaruchi Foods", "Business Road", "TEST-GST", "support@example.com", "AVA-SESAME-500", "INR 200.00", "-INR 20.00", "INR 40.00", "INR 10.00", "INR 230.00", "payable on delivery"]) expect(content.text).toContain(value);
    expect(content.html).toContain("&lt;Buyer &amp; &quot;Family&quot;&gt;");
    expect(content.html).toContain("Sesame Oil &lt;Pure&gt;");
    expect(content.html).not.toContain("<Buyer");
  });
});

it("renders a fluid branded order layout and only promises a PDF when one is attached", () => {
  const payload = {
    storeName: "Aavaruchi", orderNumber: "AVA-000042", placedAt: "2026-11-01T04:30:00.000Z",
    customer: { name: "Meera <Family>", email: "meera@example.com" },
    paymentLabel: "Cash on delivery — payable on delivery", address: "Hyderabad, Telangana",
    items: [{ name: "Mango Avakaya", sku: "AVA-MANGO-500", pack: "500 g", quantity: 2, unitPrice: 475 }],
    charges: { subtotal: 950, discount: 0, shipping: 0, tax: 0, total: 950 },
  };
  const without = renderEmailNotification("order.confirmed", payload);
  expect(without.html).toContain('max-width:640px');
  expect(without.html).toContain('width="100%"');
  expect(without.html).toContain("background:#355b2c");
  expect(without.html).toContain("Meera &lt;Family&gt;");
  expect(without.html).toContain("500 g");
  expect(without.html).toContain("01 Nov 2026");
  expect(without.html).not.toContain("Your invoice is attached");
  const attached = renderEmailNotification("order.confirmed", payload, { invoiceAttached: true });
  expect(attached.html).toContain("Your invoice is attached");
  expect(attached.text).toContain("Your PDF invoice is attached");
  expect(attached.text).toContain("payable on delivery");
  expect(attached.text).not.toContain("Paid online");
  const merchant = renderEmailNotification("order.received", payload, { invoiceAttached: true });
  expect(merchant.html).not.toContain("Your invoice is attached");
});

it("shows coupon and online-payment discounts separately without changing the total", () => {
  const content = renderEmailNotification("order.confirmed", {
    charges: { subtotal: 1000, discount: 150, couponDiscount: 100, onlinePaymentDiscount: 50, shipping: 0, tax: 50, total: 900 },
    business: { legalName: '<script>alert("x")</script>' },
  });
  expect(content.text).toContain("Coupon discount: -INR 100.00");
  expect(content.text).toContain("Online-payment discount: -INR 50.00");
  expect(content.text).toContain("Grand total: INR 900.00");
  expect(content.html).not.toContain("<script>");
});
