import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { PrismaPersistence } from "../src/persistence.js";

type MasterProduct = {
  slug: string; name: string; category: string; description: string; newProduct: boolean; dietType?: string;
  prices: Array<{ weightGrams: number; title: string; price: number }>;
};
const master = JSON.parse(await readFile(new URL("../../docs/catalogue-phase2-master.json", import.meta.url), "utf8")) as { products: MasterProduct[] };
const migration = await readFile(new URL("../prisma/migrations/20261118000000_phase2_catalogue/migration.sql", import.meta.url), "utf8");
const archiveMinapa = await readFile(new URL("../prisma/migrations/20261123000000_archive_minapa_vadiyalu/migration.sql", import.meta.url), "utf8");
const artworkMigration = await readFile(new URL("../prisma/migrations/20261124000000_fill_catalogue_artwork/migration.sql", import.meta.url), "utf8");
const newProducts = master.products.filter(product => product.newProduct);

it("bundles a WebP for every product named in the artwork migration", async () => {
  const artworkSlugs = [...artworkMigration.matchAll(/^    '([a-z0-9-]+)'/gm)].map(match => match[1]);
  expect(artworkSlugs.sort()).toEqual(newProducts.map(product => product.slug).sort());
  await Promise.all(newProducts.map(async product => {
    const image = await readFile(new URL(`../../public/images/catalog-2026/${product.slug}.webp`, import.meta.url));
    expect(image.toString("ascii", 8, 12), product.slug).toBe("WEBP");
  }));
});

it("records only the unambiguous owner-approved packs and does not infer missing offers", () => {
  expect(master.products).toHaveLength(52);
  expect(new Set(master.products.map(product => product.slug)).size).toBe(52);
  expect(master.products.reduce((sum, product) => sum + product.prices.length, 0)).toBe(85);
  expect(master.products.filter(product => product.newProduct)).toHaveLength(23);
  expect(master.products.find(product => product.slug === "classic-mango-pickle")?.prices).toEqual([
    { weightGrams: 1000, title: "1 kg", price: 950 }, { weightGrams: 500, title: "500 g", price: 475 },
  ]);
  expect(master.products.find(product => product.slug === "ginger-pickle")?.prices[0]?.price).toBe(950);
  expect(master.products.find(product => product.slug === "traditional-ginger-pickle")?.prices[0]?.price).toBe(900);
  expect(master.products.find(product => product.slug === "kura-podi")?.prices[0]?.price).toBe(700);
  expect(master.products.find(product => product.slug === "kura-karam-podi")?.prices[0]?.price).toBe(750);
  expect(master.products.filter(product => product.slug === "kakarakaya-karam-podi")).toHaveLength(1);
  const nonVeg = master.products.filter(product => product.dietType === "Non-vegetarian");
  expect(nonVeg).toHaveLength(16);
  expect(nonVeg.every(product => product.prices.length === 1 && product.prices[0]?.weightGrams === 1000)).toBe(true);
  expect(nonVeg.find(product => product.slug === "chicken-with-bone-pickle")?.prices[0]?.price).toBe(1190);
  expect(nonVeg.find(product => product.slug === "gongura-mutton-pickle")?.prices[0]?.price).toBe(2700);
  expect(master.products.filter(product => /pesara|green-chilli|minapa/.test(product.slug))).toEqual([]);
});

it.skipIf(process.env.RUN_DB_TESTS !== "1")("applies reviewed prices and catalogue retirements without changing existing inventory, images, tax or identity", async () => {
  const persistence = new PrismaPersistence();
  const fixture = crypto.randomUUID();
  const rollback = new Error("ROLL_BACK_PHASE2_FIXTURE");
  const slug = (value: string) => `${value}-${fixture}`;
  // Rewrite literal identifiers to transaction-local fixtures. No production or
  // concurrently running test product is touched by this migration exercise.
  const identities = new Set<string>(["green-chilli-pickle", "Aavaruchi", "aavaruchi", ...master.products.map(product => product.slug), ...master.products.map(product => product.category)]);
  for (const product of master.products.filter(product => product.newProduct)) {
    identities.add(product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    for (const pack of product.prices) identities.add(`AVA-${product.slug.toUpperCase()}-${pack.weightGrams}`);
  }
  const scopedMigration = migration.replace(/'((?:[^']|'')*)'/g, (quoted, value: string) => identities.has(value) ? `'${slug(value)}'` : quoted);
  const statements = scopedMigration.split(/;\s*(?:\n|$)/).filter(value => value.trim());
  try {
    await persistence.db.$transaction(async tx => {
      const brand = await tx.brand.create({ data: { name: slug("Aavaruchi"), slug: slug("aavaruchi") } });
      const categories = new Map<string, string>();
      for (const name of new Set(master.products.map(product => product.category))) {
        const category = await tx.category.create({ data: { name: slug(name), slug: slug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) } });
        categories.set(name, category.id);
      }
      const existingVariantIds = new Map<string, string>();
      for (const product of master.products.filter(product => !product.newProduct)) {
        const created = await tx.product.create({ data: {
          name: product.name, slug: slug(product.slug), description: product.description,
          categoryId: categories.get(product.category)!, brandId: brand.id, status: "ACTIVE", taxRate: 0,
          seoTitle: "Previous title", seoDescription: "Previous generic description",
          variants: { create: product.prices.map(pack => ({
            sku: slug(`FIX-${product.slug}-${pack.weightGrams}`), title: pack.title, weightGrams: pack.weightGrams,
            price: 111, mrp: 199, attributes: { "Pack size": pack.title },
            inventory: { create: { onHand: 13, reserved: 2, version: 4 } },
          })) }, media: { create: { url: "/uploads/retained.webp", alt: "Saved merchant image" } },
        }, include: { variants: true } });
        for (const variant of created.variants) existingVariantIds.set(`${product.slug}:${variant.weightGrams}`, variant.id);
      }
      const categoryId = [...categories.values()][0]!;
      const green = await tx.product.create({ data: {
        name: "Green Chilli Pickle", slug: slug("green-chilli-pickle"), description: "Unapproved test offer", categoryId, status: "ACTIVE", taxRate: 18,
        variants: { create: { sku: slug("GREEN-250"), title: "250 g", weightGrams: 250, price: 1, mrp: 168.64, attributes: {}, inventory: { create: { onHand: 39, reserved: 1 } } } },
      }, include: { variants: true } });
      const minapa = await tx.product.create({ data: {
        name: "Minapa Vadiyalu", slug: slug("minapa-vadiyalu"), description: "Preserve confirmed stock", categoryId, status: "ACTIVE", taxRate: 0,
        variants: { create: { sku: slug("MINAPA-1000"), title: "1 kg", weightGrams: 1000, price: 1200, mrp: 1200, attributes: {}, inventory: { create: { onHand: 100, reserved: 2, version: 4 } } } },
      }, include: { variants: true } });
      // An unlisted pack on an approved product is not repriced or retired.
      const mango = await tx.product.findUniqueOrThrow({ where: { slug: slug("classic-mango-pickle") } });
      const unlisted = await tx.productVariant.create({ data: { productId: mango.id, sku: slug("MANGO-250"), title: "250 g", weightGrams: 250, price: 234, mrp: 250, attributes: {}, inventory: { create: { onHand: 8 } } } });
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const include = { variants: { include: { inventory: true } }, media: true, brand: true } as const;
      for (const product of master.products) {
        const saved = await tx.product.findUniqueOrThrow({ where: { slug: slug(product.slug) }, include });
        expect(saved.status).toBe("ACTIVE");
        if (product.dietType) expect(saved.specifications).toEqual({ "Diet type": "Non-vegetarian" });
        expect(Number(saved.taxRate)).toBe(0);
        expect(saved.seoTitle).toBe(`${product.name} | Aavaruchi`);
        expect(saved.seoDescription).toBe(product.description.slice(0, 160));
        for (const pack of product.prices) {
          const variant = saved.variants.find(item => item.weightGrams === pack.weightGrams)!;
          expect(Number(variant.price)).toBe(pack.price);
          expect(Number(variant.mrp)).toBe(pack.price);
          if (product.newProduct) expect(variant.inventory).toMatchObject({ onHand: 0, reserved: 0, version: 0 });
          else {
            expect(variant.id).toBe(existingVariantIds.get(`${product.slug}:${pack.weightGrams}`));
            expect(variant.inventory).toMatchObject({ onHand: 13, reserved: 2, version: 4 });
          }
        }
        expect(saved.media).toHaveLength(product.newProduct ? 0 : 1);
        if (!product.newProduct) expect(saved.media[0]?.url).toBe("/uploads/retained.webp");
      }
      const archived = await tx.product.findUniqueOrThrow({ where: { id: green.id }, include });
      expect(archived.status).toBe("ARCHIVED");
      expect(Number(archived.taxRate)).toBe(18);
      expect(archived.variants[0]?.id).toBe(green.variants[0]?.id);
      expect(Number(archived.variants[0]?.price)).toBe(1);
      expect(Number(archived.variants[0]?.mrp)).toBe(1);
      expect(archived.variants[0]?.inventory).toMatchObject({ onHand: 39, reserved: 1 });
      expect(await tx.productVariant.findUniqueOrThrow({ where: { id: unlisted.id } })).toMatchObject({ active: true, title: "250 g" });
      expect(Number((await tx.productVariant.findUniqueOrThrow({ where: { id: unlisted.id } })).price)).toBe(234);
      const kept = await tx.product.findUniqueOrThrow({ where: { id: minapa.id }, include });
      expect(kept.status).toBe("ACTIVE");
      expect(Number(kept.variants[0]?.price)).toBe(1200);
      expect(kept.variants[0]?.inventory).toMatchObject({ onHand: 100, reserved: 2, version: 4 });
      const scopedArchive = archiveMinapa.replace("'minapa-vadiyalu'", `'${slug("minapa-vadiyalu")}'`);
      expect(await tx.$executeRawUnsafe(scopedArchive)).toBe(1);
      const retired = await tx.product.findUniqueOrThrow({ where: { id: minapa.id }, include });
      expect(retired).toMatchObject({ status: "ARCHIVED", deletedAt: null, variants: kept.variants });
      expect(await tx.$executeRawUnsafe(scopedArchive)).toBe(0);
      // Insertion statements tolerate recovery/replay without duplicating rows.
      // Prisma records the entire migration once; update statements do not run
      // again on later deploys and are deliberately not a recurring price sync.
      for (const statement of statements.filter(statement => /\bINSERT INTO\b/.test(statement))) await tx.$executeRawUnsafe(statement);
      expect(await tx.product.count({ where: { slug: { in: master.products.filter(product => product.newProduct).map(product => slug(product.slug)) } } })).toBe(23);
      const added = await tx.product.findUniqueOrThrow({ where: { slug: slug("flax-seed-karam-podi") }, include });
      expect(added.variants).toHaveLength(2);
      await tx.productVariant.update({ where: { id: added.variants[0]!.id }, data: { price: 777, mrp: 777 } });
      expect(Number((await tx.productVariant.findUniqueOrThrow({ where: { id: added.variants[0]!.id } })).price)).toBe(777);

      const merchantUpload = await tx.product.findUniqueOrThrow({ where: { slug: slug("kakarakaya-pickle") } });
      await tx.productMedia.createMany({ data: [
        { productId: merchantUpload.id, url: "/uploads/merchant-karela.webp", alt: "Merchant product photo" },
        { productId: added.id, variantId: added.variants[0]!.id, url: "/uploads/merchant-flax.webp", alt: "Merchant pack photo" },
      ] });
      const scopedArtwork = artworkMigration.replace(/'([a-z0-9-]+)'/g, (quoted, value: string) =>
        identities.has(value) ? `'${slug(value)}'` : quoted);
      expect(await tx.$executeRawUnsafe(scopedArtwork)).toBe(21);
      expect(await tx.$executeRawUnsafe(scopedArtwork)).toBe(0);
      const withArtwork = await tx.product.findMany({
        where: { slug: { in: master.products.map(product => slug(product.slug)) } },
        select: { slug: true, media: true },
      });
      const mediaBySlug = new Map(withArtwork.map(product => [product.slug, product.media]));
      for (const product of master.products) {
        const media = mediaBySlug.get(slug(product.slug))!;
        expect(media, product.name).toHaveLength(1);
        if (!product.newProduct) {
          expect(media[0]!.url).toBe("/uploads/retained.webp");
        } else if (product.slug === "kakarakaya-pickle") {
          expect(media[0]!.url).toBe("/uploads/merchant-karela.webp");
        } else if (product.slug === "flax-seed-karam-podi") {
          expect(media[0]).toMatchObject({ url: "/uploads/merchant-flax.webp", variantId: added.variants[0]!.id });
        } else {
          expect(media[0]).toMatchObject({
            url: `/images/catalog-2026/${slug(product.slug)}.webp`,
            alt: `AI-generated product illustration of Aavaruchi ${product.name} branded packaging`,
            type: "IMAGE",
            variantId: null,
          });
        }
      }
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await persistence.disconnect(); }
});
