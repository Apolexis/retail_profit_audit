CREATE TABLE `operational_stock_transfer_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transferId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` decimal(16,3) NOT NULL,
	`unit` enum('kg','l','piece') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_stock_transfer_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_stock_transfer_line_product_uq` UNIQUE(`transferId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `operational_stock_transfers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceStoreId` int NOT NULL,
	`destinationStoreId` int NOT NULL,
	`businessDate` varchar(10) NOT NULL,
	`status` enum('draft','posted') NOT NULL DEFAULT 'draft',
	`note` varchar(512),
	`createdByAccountId` int NOT NULL,
	`postedByAccountId` int,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_stock_transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operational_stock_movements` MODIFY COLUMN `kind` enum('first_count','inventory_adjustment','manual_adjustment','transfer_out','transfer_in') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_stock_movements` ADD `transferId` int;--> statement-breakpoint
ALTER TABLE `operational_stock_movements` ADD `relatedStoreId` int;