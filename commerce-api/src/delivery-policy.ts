export type DeliveryPolicy = {
  freeShippingThreshold: number;
  manualDeliveryEnabled: boolean;
  deliveryCharge: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  deliveryEstimateBasis?: "ORDER" | "DISPATCH";
  settingsLoaded?: boolean;
};

const rupees = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
export const freeDeliveryQualifies = (policy: DeliveryPolicy, subtotal: number) => policy.freeShippingThreshold === 0 || (policy.manualDeliveryEnabled && policy.deliveryCharge === 0) || subtotal >= policy.freeShippingThreshold;
export const deliveryEstimate = (policy: DeliveryPolicy) => `${policy.deliveryMinDays === policy.deliveryMaxDays ? policy.deliveryMaxDays : `${policy.deliveryMinDays}–${policy.deliveryMaxDays}`} ${policy.deliveryEstimateBasis === "ORDER" ? "days from placing your order" : "business days"}`;
export const deliveryRateEstimate = (rate: { etaDays: number; etaMinDays?: number; etaBasis?: "ORDER" | "DISPATCH" }) => {
  const range = rate.etaMinDays && rate.etaMinDays !== rate.etaDays ? `${rate.etaMinDays}–${rate.etaDays}` : rate.etaDays;
  return `${range} ${rate.etaBasis === "ORDER" ? `${rate.etaDays === 1 ? "day" : "days"} from placing your order` : `business ${rate.etaDays === 1 ? "day" : "days"} after dispatch`}`;
};
export function deliveryAnnouncement(policy: DeliveryPolicy) {
  if (policy.settingsLoaded === false) return "Delivery details at checkout";
  if (policy.freeShippingThreshold === 0 || (policy.manualDeliveryEnabled && policy.deliveryCharge === 0)) return "Free delivery on every order";
  const free = `Free delivery on ${rupees(policy.freeShippingThreshold)}+ item subtotal`;
  return policy.manualDeliveryEnabled ? `${rupees(policy.deliveryCharge)} delivery · ${free}` : free;
}
/** Delivery prices have one source: the delivery settings, never custom copy. */
export const additionalAnnouncement = (value: string) => /\b(?:free\s+(?:delivery|shipping)|(?:delivery|shipping)\s+(?:fee|charges?))\b/i.test(value) ? "" : value;
