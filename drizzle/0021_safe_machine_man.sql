ALTER TABLE `price_product_characteristics` MODIFY COLUMN `kind` enum('variant','size','place_contents') NOT NULL;--> statement-breakpoint
ALTER TABLE `price_product_characteristics` MODIFY `kind` enum('variant','size','place_contents') NOT NULL;--> statement-breakpoint
ALTER TABLE `price_import_rows` ADD `manufacturedOn` varchar(10);--> statement-breakpoint
ALTER TABLE `price_import_rows` ADD `shelfLifeMonths` int;--> statement-breakpoint
ALTER TABLE `price_import_rows` ADD `expiresOn` varchar(10);--> statement-breakpoint
ALTER TABLE `price_products` ADD `placeContentsCharacteristicId` int;--> statement-breakpoint
ALTER TABLE `price_products` ADD `placeContents` varchar(160);
