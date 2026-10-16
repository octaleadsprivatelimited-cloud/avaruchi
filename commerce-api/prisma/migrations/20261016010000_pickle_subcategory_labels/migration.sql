-- Preserve category IDs, product assignments and nested category names.
UPDATE `Category` SET `name` = CONCAT('Pickles', SUBSTRING(`name`, 12))
WHERE LOWER(`name`) LIKE 'veg pickles > %' OR LOWER(`name`) LIKE 'all pickles > %';
