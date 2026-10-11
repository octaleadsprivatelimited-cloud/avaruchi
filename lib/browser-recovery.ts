import type { CartItem } from "./catalog";

// Browser storage may be disabled, full, or left with an older/corrupted value.
export function readStored(storage: Storage, key: string): any {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function writeStored(storage: Storage, key: string, value: any) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    /* The server account remains the source of truth. */
  }
}
export function safeBasket(value: any) {
  const saved = value && typeof value === "object" ? value : {};
  const seen = new Set<string>();
  const cart: CartItem[] = (Array.isArray(saved.cart) ? saved.cart : [])
    .filter((x: any) => {
      if (
        !x ||
        typeof x.variantId !== "string" ||
        seen.has(x.variantId) ||
        !Number.isInteger(x.quantity) ||
        x.quantity < 1 ||
        x.quantity > 10
      )
        return false;
      seen.add(x.variantId);
      return true;
    })
    .slice(0, 12)
    .map((x: any) => ({ variantId: x.variantId, quantity: x.quantity }));
  const wishlist = (Array.isArray(saved.wishlist) ? saved.wishlist : [])
    .filter((x: any) => typeof x === "string")
    .slice(0, 50);
  const address = Object.fromEntries(
    ["name", "phone", "line1", "line2", "city", "state", "pincode"].map(
      (key) => [
        key,
        typeof saved.address?.[key] === "string" ? saved.address[key] : "",
      ],
    ),
  );
  return { cart, wishlist, address };
}
export function checkoutAttempt(previous: any, userId: string, payload: any) {
  const fingerprint = JSON.stringify(payload);
  if (
    previous?.userId === userId &&
    previous.fingerprint === fingerprint &&
    typeof previous.key === "string" &&
    /^[A-Za-z0-9_-]{8,100}$/.test(previous.key)
  )
    return previous;
  if (previous?.userId === userId && previous.submitted)
    throw new Error(
      "A previous checkout may already exist. Review your orders before changing this checkout.",
    );
  return { userId, fingerprint, key: crypto.randomUUID(), submitted: false };
}

let paymentScript: Promise<void> | null = null;
export function loadPaymentScript() {
  if (typeof (window as any).Razorpay === "function") return Promise.resolve();
  if (paymentScript) return paymentScript;
  paymentScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Payments took too long to load. Check your orders before retrying.",
          ),
        ),
      12000,
    );
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) {
        script.remove();
        paymentScript = null;
        reject(error);
      } else resolve();
    };
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () =>
      finish(
        typeof (window as any).Razorpay === "function"
          ? undefined
          : new Error("Payments are unavailable. Retry from your orders."),
      );
    script.onerror = () =>
      finish(new Error("Unable to load payments. Retry from your orders."));
    document.body.appendChild(script);
  });
  return paymentScript;
}
