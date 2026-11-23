-- Retire this listing while retaining its stock, reservations and order history.
UPDATE `Product`
SET `status` = 'ARCHIVED', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `slug` = 'minapa-vadiyalu' AND `deletedAt` IS NULL AND `status` <> 'ARCHIVED';
