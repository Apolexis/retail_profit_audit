CREATE TABLE `operational_revenue_print_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zebraMode` enum('none','rows','columns') NOT NULL DEFAULT 'none',
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_revenue_print_settings_id` PRIMARY KEY(`id`)
);
