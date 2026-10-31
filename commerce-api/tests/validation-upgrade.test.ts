import { expect, it } from "vitest";
import { integrationSchema, mobileOtpRequestSchema, mobileOtpVerifySchema, productSchema } from "../src/schemas.js";

it("preserves required phone/code errors and Indian phone normalization", () => {
  const phone = mobileOtpRequestSchema.safeParse({});
  expect(phone.success).toBe(false);
  if (!phone.success) expect(phone.error.flatten().fieldErrors.mobile).toEqual(["Mobile number is required"]);
  const code = mobileOtpVerifySchema.safeParse({ mobile: "9876543210" });
  expect(code.success).toBe(false);
  if (!code.success) expect(code.error.flatten().fieldErrors.code).toEqual(["Verification code is required"]);
  expect(mobileOtpRequestSchema.parse({ mobile: "9876543210" }).mobile).toBe("+919876543210");
  expect(mobileOtpRequestSchema.safeParse({ mobile: "1234567890" }).success).toBe(false);
});

it("keeps dynamic product attributes, specification defaults and integration field limits", () => {
  const input = {
    name: "Mango pickle", slug: "mango-pickle", description: "Traditional mango pickle",
    category: "Pickles", taxRate: 0,
    variants: [{ sku: "AVA-MANGO-500", title: "500 g", price: 475, mrp: 475, stock: 0, weightGrams: 500, attributes: { "Jar size": "500 g" } }],
  };
  const parsed = productSchema.parse(input);
  expect(parsed).toMatchObject({ status: "DRAFT", specifications: {}, variants: [{ active: true, reserved: 0, attributes: { "Jar size": "500 g" } }] });
  expect(productSchema.safeParse({ ...input, variants: [{ ...input.variants[0], mrp: 474 }] }).success).toBe(false);
  const integration = { kind: "PAYMENT", provider: "razorpay", enabled: false, priority: 1, environment: "TEST", credentials: { keyId: "test-only" }, publicConfig: { nested: { enabled: true }, retryCount: 2 } };
  expect(integrationSchema.parse(integration)).toEqual(integration);
  expect(integrationSchema.safeParse({ ...integration, credentials: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, "test"])) }).success).toBe(false);
  expect(integrationSchema.safeParse({ ...integration, credentials: { keyId: 123 } }).success).toBe(false);
});
