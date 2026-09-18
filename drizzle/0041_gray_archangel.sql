CREATE TABLE `operational_print_category_group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`memberType` enum('catalog_category','category_group') NOT NULL,
	`catalogCategory` varchar(512),
	`childGroupId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_print_category_group_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_print_category_member_uq` UNIQUE(`groupId`,`memberType`,`catalogCategory`,`childGroupId`)
);
--> statement-breakpoint
CREATE TABLE `operational_print_category_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`normalizedName` varchar(160) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_print_category_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_print_category_group_name_uq` UNIQUE(`normalizedName`)
);
