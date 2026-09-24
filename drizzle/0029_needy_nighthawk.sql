CREATE TABLE `operational_catalog_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`evotorProductId` varchar(128) NOT NULL,
	`evotorCode` varchar(128),
	`canonicalName` varchar(512) NOT NULL,
	`barcodes` json,
	`baseUnit` enum('kg','l','piece','unknown') NOT NULL DEFAULT 'unknown',
	`vatRate` enum('VAT_10','VAT_22') NOT NULL DEFAULT 'VAT_10',
	`evotorCostPrice` decimal(18,2) NOT NULL DEFAULT '0.00',
	`internalCostPrice` decimal(18,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`importedByAccountId` int NOT NULL,
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_catalog_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_catalog_store_evotor_product_uq` UNIQUE(`storeId`,`evotorProductId`)
);
--> statement-breakpoint
ALTER TABLE `price_products` ADD `linkCode` varchar(4);--> statement-breakpoint
ALTER TABLE `price_products` ADD CONSTRAINT `price_products_linkCode_unique` UNIQUE(`linkCode`);