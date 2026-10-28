import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";

it.skipIf(process.env.RUN_DB_TESTS !== "1")("corrects existing catalogue copy while preserving prices, stock, images and custom descriptions", async () => {
  const persistence = new PrismaPersistence();
  const fixture = crypto.randomUUID();
  const rollback = new Error("ROLL_BACK_COPY_FIXTURE");
  try {
    await persistence.db.$transaction(async (tx) => {
      const settingsKey = `storefront:copy-${fixture}`;
      await tx.setting.create({ data: { key: settingsKey, value: { heroImageUrl: "/uploads/keep.webp", heroImageAlt: "Avaruchi pickle collection", deliveryCharge: 0, fssaiLicense: "23625031002378" } } });
      const integration = await tx.integrationConfig.create({ data: { id: fixture, kind: "EMAIL", provider: `fixture-${fixture}`, encryptedCredentials: Buffer.from("local-test-placeholder"), publicConfig: { fromName: "Avaruchi", fromEmail: "orders@example.test" } } });
      const brand = await tx.brand.create({ data: { name: "Avaruchi", slug: `brand-${fixture}` } });
      const category = await tx.category.create({ data: { name: "Pickles", slug: `pickles-${fixture}` } });
      const product = await tx.product.create({ data: {
        name: "Tomato Pickle", slug: `tomato-${fixture}`, categoryId: category.id, brandId: brand.id,
        description: "Tomato Pickle from the Avaruchi veg pickle collection. Enjoy a little alongside rice, dal or your everyday meals. Choose the pack size that suits your table.",
        seoTitle: "Tomato Pickle | Avaruchi", status: "ACTIVE", taxRate: 0,
        variants: { create: { sku: `TOMATO-${fixture}`, title: "500 g", price: 450, mrp: 450, weightGrams: 500, attributes: { "Pack size": "500 g" }, inventory: { create: { onHand: 13, reserved: 2 } } } },
        media: { create: { url: "/images/retained.webp", alt: "AI-generated product illustration of Avaruchi Tomato Pickle" } },
      } });
      const custom = await tx.product.create({ data: {
        name: "Bellam Avakaya", slug: `bellam-${fixture}`, categoryId: category.id, brandId: brand.id,
        description: "Owner-edited description, retained exactly.",
      } });
      const migration = await readFile(new URL("../prisma/migrations/20261029000000_catalog_brand_copy/migration.sql", import.meta.url), "utf8");
      for (const statement of migration.split(/;\s*(?:\n|$)/).filter(value => value.trim())) {
        // Scope the original predicates to this transaction's fixtures so the
        // test does not lock or change another concurrently running fixture.
        const scoped = (column: string) => statement.replace(/WHERE ([\s\S]*)$/, `WHERE ${column} = ? AND ($1)`);
        if (statement.includes("WHERE `slug` = 'tomato-pickle'"))
          await tx.$executeRawUnsafe(statement.replace("WHERE `slug` = 'tomato-pickle'", "WHERE `slug` = ?"), product.slug);
        else if (statement.includes("WHERE `slug` = 'bellam-avakaya'"))
          await tx.$executeRawUnsafe(statement.replace("WHERE `slug` = 'bellam-avakaya'", "WHERE `slug` = ?"), custom.slug);
        else if (statement.includes("WHERE `slug`")) continue;
        else if (statement.includes("UPDATE `Brand`")) await tx.$executeRawUnsafe(scoped("`id`"), brand.id);
        else if (statement.includes("UPDATE `ProductMedia`")) await tx.$executeRawUnsafe(scoped("`productId`"), product.id);
        else if (statement.includes("UPDATE `Product`")) {
          await tx.$executeRawUnsafe(scoped("`id`"), product.id);
          await tx.$executeRawUnsafe(scoped("`id`"), custom.id);
        }
        else if (statement.includes("UPDATE `IntegrationConfig`")) await tx.$executeRawUnsafe(scoped("`id`"), integration.id);
        else if (statement.includes("UPDATE `Setting`")) await tx.$executeRawUnsafe(scoped("`key`"), settingsKey);
      }
      const saved = await tx.product.findUniqueOrThrow({ where: { id: product.id }, include: { brand: true, variants: { include: { inventory: true } }, media: true } });
      expect(saved.brand?.name).toBe("Aavaruchi");
      expect(saved.description).toBe("Tomato Pickle is a tangy accompaniment for rice, dosa or idli. Its familiar tomato flavour makes it an easy addition to everyday home-cooked meals.");
      expect(saved.seoTitle).toBe("Tomato Pickle | Aavaruchi");
      expect(saved.media[0]).toMatchObject({ url: "/images/retained.webp", alt: "AI-generated product illustration of Aavaruchi Tomato Pickle" });
      expect(Number(saved.variants[0]!.price)).toBe(450);
      expect(Number(saved.variants[0]!.mrp)).toBe(450);
      expect(saved.variants[0]).toMatchObject({ title: "500 g", weightGrams: 500, inventory: { onHand: 13, reserved: 2 } });
      expect((await tx.product.findUniqueOrThrow({ where: { id: custom.id } })).description).toBe(custom.description);
      expect((await tx.setting.findUniqueOrThrow({ where: { key: settingsKey } })).value).toEqual({ heroImageUrl: "/uploads/keep.webp", heroImageAlt: "Aavaruchi pickle collection", deliveryCharge: 0, fssaiLicense: "23625031002378" });
      expect((await tx.integrationConfig.findUniqueOrThrow({ where: { id: integration.id } })).publicConfig).toEqual({ fromName: "Aavaruchi", fromEmail: "orders@example.test" });
      throw rollback;
    }, { timeout: 20000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await persistence.disconnect();
  }
});
