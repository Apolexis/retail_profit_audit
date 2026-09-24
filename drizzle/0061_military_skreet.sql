CREATE TABLE `operational_onec_product_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceSystem` varchar(128) NOT NULL,
	`sourceProductId` varchar(191) NOT NULL,
	`productId` int NOT NULL,
	`mappedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_product_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_product_link_source_uq` UNIQUE(`sourceSystem`,`sourceProductId`)
);
--> statement-breakpoint
CREATE TABLE `operational_onec_store_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceSystem` varchar(128) NOT NULL,
	`destinationReference` varchar(191) NOT NULL,
	`storeId` int NOT NULL,
	`mappedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_store_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_store_link_source_uq` UNIQUE(`sourceSystem`,`destinationReference`)
);
