import { afterEach, describe, expect, it, vi } from "vitest";
const checkoutSource = "../../src/lib/online-checkout.ts";
const { OnlineCheckoutError, openOnlineCheckout } = await import(checkoutSource);

afterEach(() => vi.unstubAllGlobals());
const input = { provider: "razorpay", payment: { externalId: "order_fixture", clientToken: "rzp_test_fixture" }, orderNumber: "AVA-FIXTURE", total: 100, storeName: "Fixture store", contact: { name: "Fixture", email: "fixture@example.com", phone: "9876543210" } };

describe("mobile Razorpay checkout callbacks", () => {
  it("classifies popup dismissal so checkout can release unpaid stock", async () => {
    vi.stubGlobal("window", { Razorpay: class {
      constructor(private options: any) {}
      on() {}
      open() { this.options.modal.ondismiss(); }
    } });
    await expect(openOnlineCheckout(input)).rejects.toMatchObject({ type: "CANCELLED" });
  });
  it("closes a failed attempt before the storefront releases its stock", async () => {
    const close = vi.fn();
    vi.stubGlobal("window", { Razorpay: class {
      failed!: (event: any) => void;
      close = close;
      on(_event: string, handler: (event: any) => void) { this.failed = handler; }
      open() { this.failed({ error: { description: "Fixture declined" } }); }
    } });
    await expect(openOnlineCheckout(input)).rejects.toMatchObject({ type: "FAILED", message: "Fixture declined" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("returns a successful proof without classifying it as cancellation", async () => {
    vi.stubGlobal("window", { Razorpay: class {
      constructor(private options: any) {}
      on() {}
      open() { this.options.handler({ razorpay_order_id: "order_fixture", razorpay_payment_id: "pay_fixture", razorpay_signature: "fixture_signature" }); this.options.modal.ondismiss(); }
    } });
    const result = await openOnlineCheckout(input);
    expect(result).toEqual({ paymentId: "pay_fixture", signature: "fixture_signature" });
    expect(new OnlineCheckoutError("Cancelled", "CANCELLED")).toBeInstanceOf(Error);
  });
});
