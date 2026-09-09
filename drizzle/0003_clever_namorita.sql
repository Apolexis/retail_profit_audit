CREATE TABLE `audit_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int,
	`severity` enum('critical','warning','info') NOT NULL DEFAULT 'info',
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_store_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`storeId` int NOT NULL,
	`accessLevel` enum('view','edit') NOT NULL DEFAULT 'view',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_store_access_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_store_access_account_store_uq` UNIQUE(`accountId`,`storeId`)
);
