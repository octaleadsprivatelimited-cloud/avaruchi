export type GatewayPayment = { externalId: string; clientToken?: string; environment?: "TEST" | "LIVE" };
export type PaymentProof = { paymentId?: string; signature?: string };
type CheckoutInput = { provider: string; payment: GatewayPayment; orderNumber: string; total: number; storeName: string; contact: { name: string; email: string; phone: string } };
type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: "payment.failed", handler: (event: { error?: { description?: string } }) => void): void };
type PaymentWindow = Window & {
  Cashfree?: (options: { mode: "production" | "sandbox" }) => { checkout(options: { paymentSessionId: string; redirectTarget: string }): Promise<{ error?: { message?: string } }> };
  Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
};
const scripts = new Map<string, Promise<void>>();
function loadScript(url: string) {
  if (!scripts.has(url)) scripts.set(url, new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url; script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); scripts.delete(url); reject(new Error("The payment window took too long to load. Please retry.")); }, 20000);
    script.onload = () => { window.clearTimeout(timeout); resolve(); };
    script.onerror = () => { window.clearTimeout(timeout); script.remove(); scripts.delete(url); reject(new Error("The payment window could not be loaded. Check your connection and retry.")); };
    document.head.appendChild(script);
  }));
  return scripts.get(url)!;
}
export async function openOnlineCheckout(input: CheckoutInput): Promise<PaymentProof> {
  if (!input.payment.clientToken) throw new Error("Payment session is unavailable. Please retry.");
  const gatewayWindow = window as PaymentWindow;
  if (input.provider === "cashfree") {
    if (!gatewayWindow.Cashfree) await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
    if (!gatewayWindow.Cashfree) throw new Error("Cashfree checkout could not be loaded.");
    const result = await gatewayWindow.Cashfree({ mode: input.payment.environment === "LIVE" ? "production" : "sandbox" }).checkout({ paymentSessionId: input.payment.clientToken, redirectTarget: "_modal" });
    if (result?.error) throw new Error(result.error.message || "Payment was not completed. You can retry safely.");
    return {};
  }
  if (input.provider !== "razorpay") throw new Error("The selected payment provider is unavailable.");
  if (!gatewayWindow.Razorpay) await loadScript("https://checkout.razorpay.com/v1/checkout.js");
  const Razorpay = gatewayWindow.Razorpay;
  if (!Razorpay) throw new Error("Razorpay checkout could not be loaded.");
  return new Promise<PaymentProof>((resolve, reject) => {
    const gateway = new Razorpay({
      key: input.payment.clientToken, order_id: input.payment.externalId,
      amount: Math.round(input.total * 100), currency: "INR", name: input.storeName,
      description: `Order ${input.orderNumber}`,
      prefill: { name: input.contact.name, email: input.contact.email, contact: input.contact.phone },
      handler: (result: RazorpayResult) => {
        if (result.razorpay_order_id !== input.payment.externalId || !result.razorpay_payment_id || !result.razorpay_signature) {
          reject(new Error("The payment response did not match this order. Check payment status before retrying.")); return;
        }
        resolve({ paymentId: result.razorpay_payment_id, signature: result.razorpay_signature });
      },
      modal: { ondismiss: () => reject(new Error("Payment was cancelled. Your saved order can be retried safely.")) },
      theme: { color: "#173f2b" },
    });
    gateway.on("payment.failed", event => reject(new Error(event.error?.description || "Payment was not completed. Your saved order can be retried safely.")));
    gateway.open();
  });
}
