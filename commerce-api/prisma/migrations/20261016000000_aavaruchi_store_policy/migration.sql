-- Owner-approved policy revision. Prisma records this once; future admin edits
-- remain authoritative. Only public storefront settings and category labels change.
UPDATE `Setting`
SET `value` = JSON_SET(`value`,
  '$.storeName', 'Aavaruchi',
  '$.supportEmail', 'contact@aavaruchi.in',
  '$.supportPhone', '',
  '$.announcement', '',
  '$.manualDeliveryEnabled', JSON_EXTRACT('true', '$'),
  '$.deliveryCharge', 0,
  '$.freeShippingThreshold', 0,
  '$.deliveryMinDays', 4,
  '$.deliveryMaxDays', 5,
  '$.deliveryEstimateBasis', 'ORDER',
  '$.seoTitle', 'Aavaruchi | Homemade Pickles, Podis & Pachadis',
  '$.seoDescription', 'Homemade pickles, podis and pachadis, prepared in small batches in Hyderabad with traditional family recipes. Free delivery across India.'),
  `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` LIKE 'storefront:%' AND `encrypted` = false;

UPDATE `Category` SET `name` = 'Pickles'
WHERE LOWER(TRIM(`name`)) IN ('veg pickles', 'all pickles');
