CREATE TABLE `audit_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`sourceYear` int NOT NULL,
	`status` enum('preview','completed','failed') NOT NULL DEFAULT 'preview',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodId` int NOT NULL,
	`metricCode` varchar(64) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_metric_period_code_uq` UNIQUE(`periodId`,`metricCode`)
);
--> statement-breakpoint
CREATE TABLE `audit_periods` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`importId` int,
	`monthDate` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_periods_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_period_store_month_uq` UNIQUE(`storeId`,`monthDate`)
);
--> statement-breakpoint
CREATE TABLE `audit_stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`isHidden` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_stores_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
