CREATE TABLE `operational_store_request_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`productId` int NOT NULL,
	`catalogNumber` int NOT NULL,
	`productName` varchar(512) NOT NULL,
	`categoryName` varchar(512),
	`requestedQuantity` decimal(16,3) NOT NULL,
	`unit` enum('kg','l','piece') NOT NULL,
	`note` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_store_request_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_store_request_line_product_uq` UNIQUE(`requestId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `operational_store_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` int NOT NULL,
	`storeId` int NOT NULL,
	`storeName` varchar(128) NOT NULL,
	`businessDate` varchar(10) NOT NULL,
	`status` enum('draft','closed') NOT NULL DEFAULT 'draft',
	`draftStoreKey` varchar(64),
	`note` text,
	`createdByAccountId` int NOT NULL,
	`closedByAccountId` int,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_store_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_store_requests_requestNumber_unique` UNIQUE(`requestNumber`),
	CONSTRAINT `operational_store_requests_draftStoreKey_unique` UNIQUE(`draftStoreKey`)
);
--> statement-breakpoint
ALTER TABLE `operational_print_category_groups` ADD `printMode` enum('per_store','grouped_stores') DEFAULT 'per_store' NOT NULL;