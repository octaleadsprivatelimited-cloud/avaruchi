-- Switch the previous live hero to the new default and retain the uploaded file.
UPDATE `Setting`
SET `value` = JSON_SET(`value`, '$.heroImageUrl', '', '$.heroImageAlt', ''),
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` IN ('storefront:aavaruchi.in', 'storefront:www.aavaruchi.in', 'storefront:localhost')
  AND `encrypted` = false
  AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.heroImageUrl')) =
    'https://aavaruchi.in/uploads/brand-ae35dab4-3a44-451e-bd90-d61ec36bd5b0.png';
