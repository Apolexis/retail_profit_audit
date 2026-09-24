CREATE TABLE `operational_evotor_product_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`evotorProductId` varchar(128) NOT NULL,
	`productId` int NOT NULL,
	`linkedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_product_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_product_link_uq` UNIQUE(`storeId`,`evotorProductId`)
);
--> statement-breakpoint
CREATE TABLE `operational_price_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`normalizedName` varchar(160) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_price_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_price_type_name_uq` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
CREATE TABLE `operational_product_sale_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`priceTypeId` int NOT NULL,
	`salePrice` decimal(18,2) NOT NULL,
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_product_sale_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_product_sale_price_uq` UNIQUE(`productId`,`priceTypeId`)
);
--> statement-breakpoint
CREATE TABLE `operational_store_price_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`priceTypeId` int NOT NULL,
	`assignedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_store_price_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_store_price_type_store_uq` UNIQUE(`storeId`)
);
--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD `markingCategory` enum('none','supplement','seafood_caviar','seafood_canned','alcohol','beer_marked','beer_non_alcoholic','soft_drinks','water','dairy') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD `manualBarcodes` text;--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD `isVisibleInRequests` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD `isEvotorExportEnabled` boolean DEFAULT false NOT NULL;

--> statement-breakpoint
INSERT INTO `operational_price_types` (`name`, `normalizedName`, `isDefault`, `isActive`)
SELECT 'Розничная', 'розничная', true, true
WHERE NOT EXISTS (
  SELECT 1 FROM `operational_price_types` WHERE `normalizedName` = 'розничная'
);
--> statement-breakpoint
INSERT INTO `operational_store_price_types` (`storeId`, `priceTypeId`, `assignedByAccountId`)
SELECT s.`id`, pt.`id`, (
  SELECT a.`id` FROM `audit_local_accounts` a WHERE a.`role` = 'admin' AND a.`isActive` = true ORDER BY a.`id` ASC LIMIT 1
)
FROM `audit_stores` s
INNER JOIN `operational_price_types` pt ON pt.`normalizedName` = 'розничная'
WHERE NOT EXISTS (
  SELECT 1 FROM `operational_store_price_types` assignment WHERE assignment.`storeId` = s.`id`
);
--> statement-breakpoint
INSERT INTO `operational_evotor_product_links` (`storeId`, `evotorProductId`, `productId`, `linkedByAccountId`)
SELECT p.`storeId`, p.`evotorProductId`, p.`id`, p.`importedByAccountId`
FROM `operational_catalog_products` p
WHERE NOT EXISTS (
  SELECT 1
  FROM `operational_evotor_product_links` link_row
  WHERE link_row.`storeId` = p.`storeId` AND link_row.`evotorProductId` = p.`evotorProductId`
);
