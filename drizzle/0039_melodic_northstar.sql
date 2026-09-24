CREATE TABLE `operational_print_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`normalizedName` varchar(160) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_print_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_print_group_name_uq` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
CREATE TABLE `operational_warehouse_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`printGroupId` int,
	`createdByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_warehouse_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_warehouse_store_uq` UNIQUE(`storeId`)
);
