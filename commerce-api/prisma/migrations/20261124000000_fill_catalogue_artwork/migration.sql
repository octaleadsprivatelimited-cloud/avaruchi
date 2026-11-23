-- Attach an illustration to each Phase 2 listing that still lacks a product image.
INSERT INTO `ProductMedia` (`id`, `productId`, `variantId`, `url`, `alt`, `type`, `position`)
SELECT UUID(), product.`id`, NULL,
  CONCAT('/images/catalog-2026/', product.`slug`, '.webp'),
  LEFT(CONCAT('AI-generated product illustration of Aavaruchi ', product.`name`, ' branded packaging'), 191),
  'IMAGE', 0
FROM `Product` AS product
WHERE product.`deletedAt` IS NULL
  AND product.`status` IN ('ACTIVE', 'DRAFT')
  AND product.`slug` IN (
    'kakarakaya-pickle',
    'dry-mango-pickle',
    'traditional-ginger-pickle',
    'mixed-veg-pickle',
    'mango-ginger-pickle',
    'flax-seed-karam-podi',
    'kura-karam-podi',
    'chicken-with-bone-pickle',
    'chicken-boneless-pickle',
    'gongura-chicken-pickle',
    'chicken-keema-pickle',
    'desi-chicken-bone-pickle',
    'desi-chicken-boneless-pickle',
    'apollo-fish-boneless-pickle',
    'bocchi-ravva-boneless-pickle',
    'koramenu-fish-pickle',
    'fresh-prawns-pickle',
    'gongura-prawns-pickle',
    'mutton-boneless-pickle',
    'mutton-with-bone-pickle',
    'gongura-mutton-pickle',
    'boti-pickle',
    'gongura-boti-pickle'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `ProductMedia` AS media
    LEFT JOIN `ProductVariant` AS variant ON variant.`id` = media.`variantId`
    WHERE media.`productId` = product.`id`
      AND (media.`variantId` IS NULL OR (variant.`productId` = product.`id` AND variant.`active` = TRUE))
      AND media.`type` = 'IMAGE'
      AND LENGTH(TRIM(media.`url`)) > 0
  );
