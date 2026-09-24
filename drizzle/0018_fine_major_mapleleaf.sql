CREATE TABLE `price_import_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` int NOT NULL,
	`sourceSheet` varchar(128),
	`sourceRowNumber` int NOT NULL,
	`sourceSku` varchar(128),
	`rawName` text NOT NULL,
	`normalizedName` varchar(512) NOT NULL,
	`rawCategory` varchar(180),
	`rawPackaging` varchar(255),
	`rawAvailability` varchar(128),
	`rawPayload` json,
	`productId` int,
	`mappingStatus` enum('linked','suggested','unmapped','ignored') NOT NULL DEFAULT 'unmapped',
	`matchedBy` enum('supplier_alias','signature','manual','new_product','none') NOT NULL DEFAULT 'none',
	`matchConfidence` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_import_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_import_row_source_uq` UNIQUE(`importId`,`sourceSheet`,`sourceRowNumber`)
);
--> statement-breakpoint
CREATE TABLE `price_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`sourceDate` varchar(10),
	`sourceType` enum('xls','xlsx','pdf','docx') NOT NULL,
	`status` enum('completed','failed') NOT NULL DEFAULT 'completed',
	`rowCount` int NOT NULL DEFAULT 0,
	`importedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_offer_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importRowId` int NOT NULL,
	`priceMode` enum('standard','cash','cashless_no_vat','cashless_vat','spb','moscow','special','threshold') NOT NULL DEFAULT 'standard',
	`priceAmount` decimal(18,2) NOT NULL,
	`priceBasis` enum('kg','l','piece','package','unknown') NOT NULL DEFAULT 'unknown',
	`normalizedPrice` decimal(18,2),
	`normalizedUnit` enum('kg','l','piece','unknown') NOT NULL DEFAULT 'unknown',
	`minimumQuantityKg` decimal(12,2),
	`includesVat` boolean,
	`sourcePriceText` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_offer_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`internalCode` varchar(64) NOT NULL,
	`canonicalName` varchar(255) NOT NULL,
	`normalizedSignature` varchar(512) NOT NULL,
	`category` varchar(160),
	`variant` varchar(255),
	`sizeText` varchar(120),
	`baseUnit` enum('kg','l','piece','unknown') NOT NULL DEFAULT 'unknown',
	`defaultWeightGrams` decimal(12,2),
	`defaultVolumeMl` decimal(12,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_products_internalCode_unique` UNIQUE(`internalCode`),
	CONSTRAINT `price_products_normalizedSignature_unique` UNIQUE(`normalizedSignature`)
);
--> statement-breakpoint
CREATE TABLE `price_supplier_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`productId` int NOT NULL,
	`normalizedName` varchar(512) NOT NULL,
	`sourceSku` varchar(128),
	`packagingSignature` varchar(255),
	`isConfirmed` boolean NOT NULL DEFAULT true,
	`createdByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_supplier_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_supplier_alias_uq` UNIQUE(`supplierId`,`normalizedName`,`packagingSignature`)
);
--> statement-breakpoint
CREATE TABLE `price_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`normalizedName` varchar(180) NOT NULL,
	`contactNote` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_suppliers_normalizedName_unique` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
ALTER TABLE `audit_local_accounts` ADD `priceAccessLevel` enum('none','view','upload','edit') DEFAULT 'none' NOT NULL;