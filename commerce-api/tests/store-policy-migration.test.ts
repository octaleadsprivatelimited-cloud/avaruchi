import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";

it.skipIf(process.env.RUN_DB_TESTS !== "1")("applies the policy revision without losing other saved store settings", async () => {
  const persistence = new PrismaPersistence();
  const key = `storefront:policy-fixture-${crypto.randomUUID()}`;
  try {
    const before = { storeName: "Avaruchi", supportPhone: "0000000000", supportEmail: "old@example.com", logoUrl: "/uploads/existing-logo.webp", fssaiLicense: "12345678901234", codEnabled: false, primaryDomain: "aavaruchi.in", onlinePaymentDiscountEnabled: true, onlinePaymentDiscountValue: 7, deliveryCharge: 59, freeShippingThreshold: 999 };
    await persistence.db.setting.create({ data: { key, value: before } });
    const migration = await readFile(new URL("../prisma/migrations/20261016000000_aavaruchi_store_policy/migration.sql", import.meta.url), "utf8");
    const update = migration.slice(0, migration.indexOf("\nUPDATE `Category`"))
      .replace("`key` LIKE 'storefront:%'", "`key` = ?");
    await persistence.db.$executeRawUnsafe(update, key);
    const saved = (await persistence.db.setting.findUniqueOrThrow({ where: { key } })).value;
    expect(saved).toMatchObject({ storeName: "Aavaruchi", supportPhone: "", supportEmail: "contact@aavaruchi.in", manualDeliveryEnabled: true, deliveryCharge: 0, freeShippingThreshold: 0, deliveryMinDays: 4, deliveryMaxDays: 5, deliveryEstimateBasis: "ORDER", logoUrl: before.logoUrl, fssaiLicense: before.fssaiLicense, codEnabled: false, onlinePaymentDiscountEnabled: true, onlinePaymentDiscountValue: 7 });
  } finally {
    await persistence.db.setting.deleteMany({ where: { key } });
    await persistence.disconnect();
  }
});
