CREATE TABLE `price_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`normalizedName` varchar(180) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_categories_normalizedName_unique` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
ALTER TABLE `price_products` ADD `categoryId` int;