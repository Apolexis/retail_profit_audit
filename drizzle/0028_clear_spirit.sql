CREATE TABLE `operational_inventories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`businessDate` varchar(10) NOT NULL,
	`status` enum('draft','closed') NOT NULL DEFAULT 'draft',
	`createdByAccountId` int NOT NULL,
	`closedByAccountId` int,
	`closedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_inventories_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_inventory_store_date_uq` UNIQUE(`storeId`,`businessDate`)
);
--> statement-breakpoint
CREATE TABLE `operational_inventory_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryId` int NOT NULL,
	`productId` int NOT NULL,
	`countedQuantity` decimal(16,3) NOT NULL,
	`unit` enum('kg','l','piece') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_inventory_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_inventory_line_product_uq` UNIQUE(`inventoryId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `operational_stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`inventoryId` int NOT NULL,
	`kind` enum('first_count','inventory_adjustment') NOT NULL,
	`previousQuantity` decimal(16,3) NOT NULL,
	`countedQuantity` decimal(16,3) NOT NULL,
	`quantityDelta` decimal(16,3) NOT NULL,
	`unit` enum('kg','l','piece') NOT NULL,
	`createdByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_stock_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_stock_movement_inventory_product_uq` UNIQUE(`inventoryId`,`productId`)
);
--> statement-breakpoint
ALTER TABLE `audit_local_accounts` MODIFY COLUMN `role` enum('admin','analyst','seller','manager') NOT NULL DEFAULT 'analyst';