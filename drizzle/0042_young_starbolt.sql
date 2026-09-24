ALTER TABLE `operational_catalog_products` ADD `catalogNumber` int;
--> statement-breakpoint
SET @catalog_number := 0;
--> statement-breakpoint
UPDATE `operational_catalog_products` SET `catalogNumber` = (@catalog_number := @catalog_number + 1) ORDER BY `id`;
--> statement-breakpoint
ALTER TABLE `operational_catalog_products` MODIFY `catalogNumber` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD CONSTRAINT `operational_catalog_products_catalogNumber_unique` UNIQUE(`catalogNumber`);
