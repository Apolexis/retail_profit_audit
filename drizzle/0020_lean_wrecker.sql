CREATE TABLE `price_product_characteristics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('variant','size') NOT NULL,
	`value` varchar(160) NOT NULL,
	`normalizedValue` varchar(180) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_product_characteristics_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_product_characteristic_uq` UNIQUE(`kind`,`normalizedValue`)
);
--> statement-breakpoint
ALTER TABLE `price_import_rows` ADD `manufacturer` varchar(255);--> statement-breakpoint
ALTER TABLE `price_import_rows` ADD `placeContents` varchar(255);--> statement-breakpoint
ALTER TABLE `price_offer_prices` ADD `market` enum('unknown','spb','moscow') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `price_products` ADD `variantCharacteristicId` int;--> statement-breakpoint
ALTER TABLE `price_products` ADD `sizeCharacteristicId` int;