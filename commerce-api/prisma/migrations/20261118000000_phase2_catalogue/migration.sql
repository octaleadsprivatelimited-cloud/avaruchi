-- Owner-supplied phase2 master, 18 November 2026. Applied ONCE by Prisma.
-- Admin edits after deployment remain authoritative; no recurring catalogue seed.
-- Product/variant IDs, tax settings, media, inventory, reservations and order lines are retained.
-- Non-veg uses merchant-approved column B, 1 kg only. No inferred 500 g non-veg, Pesara, 250 g or 500 g fryum offers.

UPDATE `Product` SET `status` = 'ARCHIVED', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `slug` = 'green-chilli-pickle' AND `deletedAt` IS NULL;
UPDATE `ProductVariant` v JOIN `Product` p ON p.`id` = v.`productId` SET v.`mrp` = v.`price` WHERE p.`slug` = 'green-chilli-pickle' AND p.`deletedAt` IS NULL;

UPDATE `ProductVariant` v
JOIN `Product` p ON p.`id` = v.`productId`
JOIN (
  SELECT 'classic-mango-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 950.00 AS price
  UNION ALL
  SELECT 'classic-mango-pickle' AS slug, 500 AS grams, '500 g' AS title, 475.00 AS price
  UNION ALL
  SELECT 'menti-avakaya' AS slug, 1000 AS grams, '1 kg' AS title, 980.00 AS price
  UNION ALL
  SELECT 'menti-avakaya' AS slug, 500 AS grams, '500 g' AS title, 490.00 AS price
  UNION ALL
  SELECT 'pulihora-avakaya' AS slug, 1000 AS grams, '1 kg' AS title, 1000.00 AS price
  UNION ALL
  SELECT 'pulihora-avakaya' AS slug, 500 AS grams, '500 g' AS title, 500.00 AS price
  UNION ALL
  SELECT 'bellam-avakaya' AS slug, 1000 AS grams, '1 kg' AS title, 950.00 AS price
  UNION ALL
  SELECT 'bellam-avakaya' AS slug, 500 AS grams, '500 g' AS title, 475.00 AS price
  UNION ALL
  SELECT 'red-chilli-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 1000.00 AS price
  UNION ALL
  SELECT 'red-chilli-pickle' AS slug, 500 AS grams, '500 g' AS title, 500.00 AS price
  UNION ALL
  SELECT 'amla-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 950.00 AS price
  UNION ALL
  SELECT 'amla-pickle' AS slug, 500 AS grams, '500 g' AS title, 475.00 AS price
  UNION ALL
  SELECT 'lemon-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 900.00 AS price
  UNION ALL
  SELECT 'lemon-pickle' AS slug, 500 AS grams, '500 g' AS title, 450.00 AS price
  UNION ALL
  SELECT 'tomato-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 900.00 AS price
  UNION ALL
  SELECT 'tomato-pickle' AS slug, 500 AS grams, '500 g' AS title, 450.00 AS price
  UNION ALL
  SELECT 'chintakaya-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 900.00 AS price
  UNION ALL
  SELECT 'chintakaya-pickle' AS slug, 500 AS grams, '500 g' AS title, 450.00 AS price
  UNION ALL
  SELECT 'garlic-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 1000.00 AS price
  UNION ALL
  SELECT 'garlic-pickle' AS slug, 500 AS grams, '500 g' AS title, 500.00 AS price
  UNION ALL
  SELECT 'ginger-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 950.00 AS price
  UNION ALL
  SELECT 'ginger-pickle' AS slug, 500 AS grams, '500 g' AS title, 475.00 AS price
  UNION ALL
  SELECT 'gongura-pickle' AS slug, 1000 AS grams, '1 kg' AS title, 800.00 AS price
  UNION ALL
  SELECT 'gongura-pickle' AS slug, 500 AS grams, '500 g' AS title, 400.00 AS price
  UNION ALL
  SELECT 'mamidillam-avakaya' AS slug, 1000 AS grams, '1 kg' AS title, 1000.00 AS price
  UNION ALL
  SELECT 'mamidillam-avakaya' AS slug, 500 AS grams, '500 g' AS title, 500.00 AS price
  UNION ALL
  SELECT 'palli-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'palli-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'kandi-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'kandi-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'karivepaku-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'karivepaku-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'munagaku-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'munagaku-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'kobbari-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'kobbari-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'nuvvula-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'nuvvula-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'idli-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'idli-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'nalla-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'nalla-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'garlic-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'garlic-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'usiri-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'usiri-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'kakarakaya-karam-podi' AS slug, 1000 AS grams, '1 kg' AS title, 750.00 AS price
  UNION ALL
  SELECT 'kakarakaya-karam-podi' AS slug, 500 AS grams, '500 g' AS title, 375.00 AS price
  UNION ALL
  SELECT 'sambar-podi' AS slug, 1000 AS grams, '1 kg' AS title, 800.00 AS price
  UNION ALL
  SELECT 'sambar-podi' AS slug, 500 AS grams, '500 g' AS title, 400.00 AS price
  UNION ALL
  SELECT 'kura-podi' AS slug, 1000 AS grams, '1 kg' AS title, 700.00 AS price
  UNION ALL
  SELECT 'kura-podi' AS slug, 500 AS grams, '500 g' AS title, 350.00 AS price
  UNION ALL
  SELECT 'gummadi-vadiyalu' AS slug, 1000 AS grams, '1 kg' AS title, 1200.00 AS price
  UNION ALL
  SELECT 'saggubiyyam-vadiyalu' AS slug, 1000 AS grams, '1 kg' AS title, 1100.00 AS price
  UNION ALL
  SELECT 'majjiga-vadiyalu' AS slug, 1000 AS grams, '1 kg' AS title, 1200.00 AS price
) approved ON p.`slug` = approved.slug AND v.`weightGrams` = approved.grams AND LOWER(REPLACE(v.`title`, ' ', '')) = LOWER(REPLACE(approved.title, ' ', ''))
SET v.`price` = approved.price, v.`mrp` = approved.price
WHERE p.`deletedAt` IS NULL;

UPDATE `Product` SET `seoTitle` = CONCAT(`name`, ' | Aavaruchi'), `seoDescription` = LEFT(`description`, 160), `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `deletedAt` IS NULL AND `slug` IN ('classic-mango-pickle', 'menti-avakaya', 'pulihora-avakaya', 'bellam-avakaya', 'red-chilli-pickle', 'amla-pickle', 'lemon-pickle', 'tomato-pickle', 'chintakaya-pickle', 'garlic-pickle', 'ginger-pickle', 'gongura-pickle', 'mamidillam-avakaya', 'palli-karam-podi', 'kandi-karam-podi', 'karivepaku-karam-podi', 'munagaku-karam-podi', 'kobbari-karam-podi', 'nuvvula-karam-podi', 'idli-karam-podi', 'nalla-karam-podi', 'garlic-karam-podi', 'usiri-karam-podi', 'kakarakaya-karam-podi', 'sambar-podi', 'kura-podi', 'gummadi-vadiyalu', 'saggubiyyam-vadiyalu', 'majjiga-vadiyalu');

INSERT INTO `Brand` (`id`, `name`, `slug`) SELECT UUID(), 'Aavaruchi', 'aavaruchi' FROM (SELECT 1) seed LEFT JOIN `Brand` existing ON existing.`name` = 'Aavaruchi' OR existing.`slug` = 'aavaruchi' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Pickles > Traditional pickles', 'pickles-traditional-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Pickles > Traditional pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Powders > Karam podis', 'powders-karam-podis' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Powders > Karam podis' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Non-veg pickles > Chicken pickles', 'non-veg-pickles-chicken-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Non-veg pickles > Chicken pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Non-veg pickles > Fish pickles', 'non-veg-pickles-fish-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Non-veg pickles > Fish pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Non-veg pickles > Prawn pickles', 'non-veg-pickles-prawn-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Non-veg pickles > Prawn pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Non-veg pickles > Mutton pickles', 'non-veg-pickles-mutton-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Non-veg pickles > Mutton pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Category` (`id`, `name`, `slug`) SELECT UUID(), 'Non-veg pickles > Boti pickles', 'non-veg-pickles-boti-pickles' FROM (SELECT 1) seed LEFT JOIN `Category` existing ON existing.`name` = 'Non-veg pickles > Boti pickles' WHERE existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Kakarakaya Pickle (Karela)', 'kakarakaya-pickle', 'Kakarakaya Pickle brings the distinctive bitter-gourd character of karela to the table. Enjoy a small serving alongside warm rice, dal or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Pickles > Traditional pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Kakarakaya Pickle (Karela) | Aavaruchi', 'Kakarakaya Pickle brings the distinctive bitter-gourd character of karela to the table. Enjoy a small serving alongside warm rice, dal or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'kakarakaya-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-KAKARAKAYA-PICKLE-1000', '1 kg', 900.00, 900.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-KAKARAKAYA-PICKLE-1000' WHERE p.`slug` = 'kakarakaya-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-KAKARAKAYA-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-KAKARAKAYA-PICKLE-500', '500 g', 450.00, 450.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-KAKARAKAYA-PICKLE-500' WHERE p.`slug` = 'kakarakaya-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-KAKARAKAYA-PICKLE-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Dry Mango Pickle (Sookha Aam)', 'dry-mango-pickle', 'Dry Mango Pickle offers a dry-mango variation for the pickle shelf. Pair a little with rice, dal or a simple meal for a tangy accompaniment.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Pickles > Traditional pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Dry Mango Pickle (Sookha Aam) | Aavaruchi', 'Dry Mango Pickle offers a dry-mango variation for the pickle shelf. Pair a little with rice, dal or a simple meal for a tangy accompaniment.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'dry-mango-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-DRY-MANGO-PICKLE-1000', '1 kg', 900.00, 900.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-DRY-MANGO-PICKLE-1000' WHERE p.`slug` = 'dry-mango-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-DRY-MANGO-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-DRY-MANGO-PICKLE-500', '500 g', 450.00, 450.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-DRY-MANGO-PICKLE-500' WHERE p.`slug` = 'dry-mango-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-DRY-MANGO-PICKLE-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Ginger Pickle', 'traditional-ginger-pickle', 'Ginger Pickle brings a warming ginger character to rice, idli or dosa. Serve a small spoonful alongside a comforting home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Pickles > Traditional pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Ginger Pickle | Aavaruchi', 'Ginger Pickle brings a warming ginger character to rice, idli or dosa. Serve a small spoonful alongside a comforting home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'traditional-ginger-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-TRADITIONAL-GINGER-PICKLE-1000', '1 kg', 900.00, 900.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-TRADITIONAL-GINGER-PICKLE-1000' WHERE p.`slug` = 'traditional-ginger-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-TRADITIONAL-GINGER-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-TRADITIONAL-GINGER-PICKLE-500', '500 g', 450.00, 450.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-TRADITIONAL-GINGER-PICKLE-500' WHERE p.`slug` = 'traditional-ginger-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-TRADITIONAL-GINGER-PICKLE-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Mixed Veg Pickle', 'mixed-veg-pickle', 'Mixed Veg Pickle brings a mixed-vegetable character to an everyday pickle accompaniment. Serve a little with warm rice, dal or a family meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Pickles > Traditional pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Mixed Veg Pickle | Aavaruchi', 'Mixed Veg Pickle brings a mixed-vegetable character to an everyday pickle accompaniment. Serve a little with warm rice, dal or a family meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'mixed-veg-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MIXED-VEG-PICKLE-1000', '1 kg', 900.00, 900.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MIXED-VEG-PICKLE-1000' WHERE p.`slug` = 'mixed-veg-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MIXED-VEG-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MIXED-VEG-PICKLE-500', '500 g', 450.00, 450.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MIXED-VEG-PICKLE-500' WHERE p.`slug` = 'mixed-veg-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MIXED-VEG-PICKLE-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Mango Ginger Pickle', 'mango-ginger-pickle', 'Mango Ginger Pickle offers the distinctive character of mango ginger as a meal accompaniment. Enjoy a little alongside warm rice, dal or a savoury breakfast.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Pickles > Traditional pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Mango Ginger Pickle | Aavaruchi', 'Mango Ginger Pickle offers the distinctive character of mango ginger as a meal accompaniment. Enjoy a little alongside warm rice, dal or a savoury breakfast.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'mango-ginger-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MANGO-GINGER-PICKLE-1000', '1 kg', 900.00, 900.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MANGO-GINGER-PICKLE-1000' WHERE p.`slug` = 'mango-ginger-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MANGO-GINGER-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MANGO-GINGER-PICKLE-500', '500 g', 450.00, 450.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MANGO-GINGER-PICKLE-500' WHERE p.`slug` = 'mango-ginger-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MANGO-GINGER-PICKLE-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Flax Seed Karam Podi', 'flax-seed-karam-podi', 'Flax Seed Karam Podi brings a flax-seed character to a savoury Telugu-style accompaniment. Serve with warm rice or alongside idli and dosa.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Powders > Karam podis' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Flax Seed Karam Podi | Aavaruchi', 'Flax Seed Karam Podi brings a flax-seed character to a savoury Telugu-style accompaniment. Serve with warm rice or alongside idli and dosa.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'flax-seed-karam-podi' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-FLAX-SEED-KARAM-PODI-1000', '1 kg', 750.00, 750.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-FLAX-SEED-KARAM-PODI-1000' WHERE p.`slug` = 'flax-seed-karam-podi' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-FLAX-SEED-KARAM-PODI-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-FLAX-SEED-KARAM-PODI-500', '500 g', 375.00, 375.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-FLAX-SEED-KARAM-PODI-500' WHERE p.`slug` = 'flax-seed-karam-podi' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-FLAX-SEED-KARAM-PODI-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Kura Karam Podi', 'kura-karam-podi', 'Kura Karam Podi is a savoury selection for vegetable dishes and everyday meals. Follow your pack directions and adjust the amount to suit your recipe.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Powders > Karam podis' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT(), 'Kura Karam Podi | Aavaruchi', 'Kura Karam Podi is a savoury selection for vegetable dishes and everyday meals. Follow your pack directions and adjust the amount to suit your recipe.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'kura-karam-podi' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-KURA-KARAM-PODI-1000', '1 kg', 750.00, 750.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-KURA-KARAM-PODI-1000' WHERE p.`slug` = 'kura-karam-podi' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-KURA-KARAM-PODI-1000'
AND existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-KURA-KARAM-PODI-500', '500 g', 375.00, 375.00, 500, JSON_OBJECT('Pack size', '500 g'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-KURA-KARAM-PODI-500' WHERE p.`slug` = 'kura-karam-podi' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-KURA-KARAM-PODI-500'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Chicken with Bone Pickle', 'chicken-with-bone-pickle', 'Chicken with Bone Pickle is a bone-in chicken selection for the Aavaruchi pickle range. Serve a small portion alongside rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Chicken with Bone Pickle | Aavaruchi', 'Chicken with Bone Pickle is a bone-in chicken selection for the Aavaruchi pickle range. Serve a small portion alongside rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'chicken-with-bone-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-CHICKEN-WITH-BONE-PICKLE-1000', '1 kg', 1190.00, 1190.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-CHICKEN-WITH-BONE-PICKLE-1000' WHERE p.`slug` = 'chicken-with-bone-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-CHICKEN-WITH-BONE-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Chicken Boneless Pickle', 'chicken-boneless-pickle', 'Chicken Boneless Pickle offers a boneless chicken pickle selection for the table. Enjoy a little with warm rice or your everyday meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Chicken Boneless Pickle | Aavaruchi', 'Chicken Boneless Pickle offers a boneless chicken pickle selection for the table. Enjoy a little with warm rice or your everyday meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'chicken-boneless-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-CHICKEN-BONELESS-PICKLE-1000', '1 kg', 1650.00, 1650.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-CHICKEN-BONELESS-PICKLE-1000' WHERE p.`slug` = 'chicken-boneless-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-CHICKEN-BONELESS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Gongura Chicken Pickle', 'gongura-chicken-pickle', 'Gongura Chicken Pickle pairs a chicken pickle selection with the distinctive character of gongura. Serve a small portion alongside warm rice.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Gongura Chicken Pickle | Aavaruchi', 'Gongura Chicken Pickle pairs a chicken pickle selection with the distinctive character of gongura. Serve a small portion alongside warm rice.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'gongura-chicken-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-GONGURA-CHICKEN-PICKLE-1000', '1 kg', 1725.00, 1725.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-GONGURA-CHICKEN-PICKLE-1000' WHERE p.`slug` = 'gongura-chicken-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-GONGURA-CHICKEN-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Chicken Keema Pickle', 'chicken-keema-pickle', 'Chicken Keema Pickle brings a chicken-keema variation to the pickle shelf. Enjoy a small serving alongside rice or a simple family meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Chicken Keema Pickle | Aavaruchi', 'Chicken Keema Pickle brings a chicken-keema variation to the pickle shelf. Enjoy a small serving alongside rice or a simple family meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'chicken-keema-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-CHICKEN-KEEMA-PICKLE-1000', '1 kg', 1650.00, 1650.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-CHICKEN-KEEMA-PICKLE-1000' WHERE p.`slug` = 'chicken-keema-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-CHICKEN-KEEMA-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Desi Chicken with Bone Pickle', 'desi-chicken-bone-pickle', 'Desi Chicken with Bone Pickle is a bone-in desi chicken selection. Serve a little alongside warm rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Desi Chicken with Bone Pickle | Aavaruchi', 'Desi Chicken with Bone Pickle is a bone-in desi chicken selection. Serve a little alongside warm rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'desi-chicken-bone-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-DESI-CHICKEN-BONE-PICKLE-1000', '1 kg', 1800.00, 1800.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-DESI-CHICKEN-BONE-PICKLE-1000' WHERE p.`slug` = 'desi-chicken-bone-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-DESI-CHICKEN-BONE-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Desi Chicken Boneless Pickle', 'desi-chicken-boneless-pickle', 'Desi Chicken Boneless Pickle offers a boneless desi chicken variation for the table. Enjoy a small portion with rice or an everyday meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Chicken pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Desi Chicken Boneless Pickle | Aavaruchi', 'Desi Chicken Boneless Pickle offers a boneless desi chicken variation for the table. Enjoy a small portion with rice or an everyday meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'desi-chicken-boneless-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-DESI-CHICKEN-BONELESS-PICKLE-1000', '1 kg', 2100.00, 2100.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-DESI-CHICKEN-BONELESS-PICKLE-1000' WHERE p.`slug` = 'desi-chicken-boneless-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-DESI-CHICKEN-BONELESS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Apollo Fish Boneless Pickle', 'apollo-fish-boneless-pickle', 'Apollo Fish Boneless Pickle is a boneless fish selection in the Aavaruchi range. Serve a small portion alongside warm rice or a family meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Fish pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Apollo Fish Boneless Pickle | Aavaruchi', 'Apollo Fish Boneless Pickle is a boneless fish selection in the Aavaruchi range. Serve a small portion alongside warm rice or a family meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'apollo-fish-boneless-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-APOLLO-FISH-BONELESS-PICKLE-1000', '1 kg', 1650.00, 1650.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-APOLLO-FISH-BONELESS-PICKLE-1000' WHERE p.`slug` = 'apollo-fish-boneless-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-APOLLO-FISH-BONELESS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Bocchi/Ravva Boneless Pickle', 'bocchi-ravva-boneless-pickle', 'Bocchi/Ravva Boneless Pickle offers a boneless fish variation for the pickle shelf. Enjoy a small serving alongside rice or your everyday meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Fish pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Bocchi/Ravva Boneless Pickle | Aavaruchi', 'Bocchi/Ravva Boneless Pickle offers a boneless fish variation for the pickle shelf. Enjoy a small serving alongside rice or your everyday meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'bocchi-ravva-boneless-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-BOCCHI-RAVVA-BONELESS-PICKLE-1000', '1 kg', 1800.00, 1800.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-BOCCHI-RAVVA-BONELESS-PICKLE-1000' WHERE p.`slug` = 'bocchi-ravva-boneless-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-BOCCHI-RAVVA-BONELESS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Koramenu Fish Pickle', 'koramenu-fish-pickle', 'Koramenu Fish Pickle brings a Koramenu fish selection to the table. Serve a little alongside warm rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Fish pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Koramenu Fish Pickle | Aavaruchi', 'Koramenu Fish Pickle brings a Koramenu fish selection to the table. Serve a little alongside warm rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'koramenu-fish-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-KORAMENU-FISH-PICKLE-1000', '1 kg', 1950.00, 1950.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-KORAMENU-FISH-PICKLE-1000' WHERE p.`slug` = 'koramenu-fish-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-KORAMENU-FISH-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Fresh Prawns Pickle', 'fresh-prawns-pickle', 'Fresh Prawns Pickle is the prawns selection in the Aavaruchi range. Enjoy a small serving alongside warm rice or a simple meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Prawn pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Fresh Prawns Pickle | Aavaruchi', 'Fresh Prawns Pickle is the prawns selection in the Aavaruchi range. Enjoy a small serving alongside warm rice or a simple meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'fresh-prawns-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-FRESH-PRAWNS-PICKLE-1000', '1 kg', 2100.00, 2100.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-FRESH-PRAWNS-PICKLE-1000' WHERE p.`slug` = 'fresh-prawns-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-FRESH-PRAWNS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Gongura Prawns Pickle', 'gongura-prawns-pickle', 'Gongura Prawns Pickle pairs prawns with the distinctive character of gongura. Serve a little alongside rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Prawn pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Gongura Prawns Pickle | Aavaruchi', 'Gongura Prawns Pickle pairs prawns with the distinctive character of gongura. Serve a little alongside rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'gongura-prawns-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-GONGURA-PRAWNS-PICKLE-1000', '1 kg', 2100.00, 2100.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-GONGURA-PRAWNS-PICKLE-1000' WHERE p.`slug` = 'gongura-prawns-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-GONGURA-PRAWNS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Mutton Boneless Pickle', 'mutton-boneless-pickle', 'Mutton Boneless Pickle is a boneless mutton selection for the pickle shelf. Enjoy a small portion with rice or a family meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Mutton pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Mutton Boneless Pickle | Aavaruchi', 'Mutton Boneless Pickle is a boneless mutton selection for the pickle shelf. Enjoy a small portion with rice or a family meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'mutton-boneless-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MUTTON-BONELESS-PICKLE-1000', '1 kg', 2700.00, 2700.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MUTTON-BONELESS-PICKLE-1000' WHERE p.`slug` = 'mutton-boneless-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MUTTON-BONELESS-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Mutton with Bone Pickle', 'mutton-with-bone-pickle', 'Mutton with Bone Pickle offers a bone-in mutton variation for the table. Serve a small portion alongside rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Mutton pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Mutton with Bone Pickle | Aavaruchi', 'Mutton with Bone Pickle offers a bone-in mutton variation for the table. Serve a small portion alongside rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'mutton-with-bone-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-MUTTON-WITH-BONE-PICKLE-1000', '1 kg', 2400.00, 2400.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-MUTTON-WITH-BONE-PICKLE-1000' WHERE p.`slug` = 'mutton-with-bone-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-MUTTON-WITH-BONE-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Gongura Mutton Pickle', 'gongura-mutton-pickle', 'Gongura Mutton Pickle pairs a mutton selection with the distinctive character of gongura. Enjoy a little alongside warm rice.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Mutton pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Gongura Mutton Pickle | Aavaruchi', 'Gongura Mutton Pickle pairs a mutton selection with the distinctive character of gongura. Enjoy a little alongside warm rice.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'gongura-mutton-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-GONGURA-MUTTON-PICKLE-1000', '1 kg', 2700.00, 2700.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-GONGURA-MUTTON-PICKLE-1000' WHERE p.`slug` = 'gongura-mutton-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-GONGURA-MUTTON-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Boti Pickle', 'boti-pickle', 'Boti Pickle is a distinct non-vegetarian selection in the Aavaruchi range. Serve a small portion alongside warm rice or an everyday meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Boti pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Boti Pickle | Aavaruchi', 'Boti Pickle is a distinct non-vegetarian selection in the Aavaruchi range. Serve a small portion alongside warm rice or an everyday meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'boti-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-BOTI-PICKLE-1000', '1 kg', 1800.00, 1800.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-BOTI-PICKLE-1000' WHERE p.`slug` = 'boti-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-BOTI-PICKLE-1000'
AND existing.`id` IS NULL;

INSERT INTO `Product` (`id`, `name`, `slug`, `description`, `status`, `categoryId`, `brandId`, `taxRate`, `specifications`, `seoTitle`, `seoDescription`, `metadata`, `createdAt`, `updatedAt`)
SELECT UUID(), 'Gongura Boti Pickle', 'gongura-boti-pickle', 'Gongura Boti Pickle brings a gongura variation to the Boti pickle selection. Enjoy a little alongside rice or a home-cooked meal.', 'ACTIVE',
  (SELECT `id` FROM `Category` WHERE `name` = 'Non-veg pickles > Boti pickles' ORDER BY `id` LIMIT 1),
  (SELECT `id` FROM `Brand` WHERE `name` = 'Aavaruchi' ORDER BY `id` LIMIT 1),
  0, JSON_OBJECT('Diet type', 'Non-vegetarian'), 'Gongura Boti Pickle | Aavaruchi', 'Gongura Boti Pickle brings a gongura variation to the Boti pickle selection. Enjoy a little alongside rice or a home-cooked meal.', JSON_OBJECT('catalogueImport', 'phase2-master-2026-11-18'), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (SELECT 1) seed LEFT JOIN `Product` existing ON existing.`slug` = 'gongura-boti-pickle' WHERE existing.`id` IS NULL;

INSERT INTO `ProductVariant` (`id`, `productId`, `sku`, `title`, `price`, `mrp`, `weightGrams`, `attributes`, `active`)
SELECT UUID(), p.`id`, 'AVA-GONGURA-BOTI-PICKLE-1000', '1 kg', 1800.00, 1800.00, 1000, JSON_OBJECT('Pack size', '1 kg'), true
FROM `Product` p LEFT JOIN `ProductVariant` existing ON existing.`sku` = 'AVA-GONGURA-BOTI-PICKLE-1000' WHERE p.`slug` = 'gongura-boti-pickle' AND JSON_UNQUOTE(JSON_EXTRACT(p.`metadata`, '$.catalogueImport')) = 'phase2-master-2026-11-18' AND p.`deletedAt` IS NULL
AND existing.`id` IS NULL;

INSERT INTO `Inventory` (`id`, `variantId`, `onHand`, `reserved`, `lowStockAt`, `version`)
SELECT UUID(), v.`id`, 0, 0, 5, 0 FROM `ProductVariant` v LEFT JOIN `Inventory` existing ON existing.`variantId` = v.`id` WHERE v.`sku` = 'AVA-GONGURA-BOTI-PICKLE-1000'
AND existing.`id` IS NULL;

