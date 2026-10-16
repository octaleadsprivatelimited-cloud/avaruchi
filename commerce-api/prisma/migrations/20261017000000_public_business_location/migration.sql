-- Replace the public business address once; customer delivery addresses and
-- historical order records remain unchanged.
UPDATE `Setting`
SET `value` = JSON_SET(`value`, '$.businessAddress', 'Hyderabad, Telangana, India'),
    `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `key` LIKE 'storefront:%' AND `encrypted` = false;
