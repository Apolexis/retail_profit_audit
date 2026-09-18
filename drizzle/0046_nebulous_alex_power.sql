-- Preserve every current weight item while replacing the internal legacy code `kg`
-- with documented Evotor code `fraction`. User-facing labels remain «кг».
ALTER TABLE `operational_catalog_products`
  MODIFY COLUMN `baseUnit` enum('kg','fraction','l','piece','unknown') NOT NULL DEFAULT 'unknown';
UPDATE `operational_catalog_products`
  SET `baseUnit` = 'fraction'
  WHERE `baseUnit` = 'kg';
ALTER TABLE `operational_catalog_products`
  MODIFY COLUMN `baseUnit` enum('fraction','l','piece','unknown') NOT NULL DEFAULT 'unknown';
