CREATE TABLE `price_link_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkCode` varchar(4) NOT NULL,
	`canonicalName` varchar(255) NOT NULL,
	`normalizedName` varchar(512) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_link_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_link_groups_linkCode_unique` UNIQUE(`linkCode`),
	CONSTRAINT `price_link_groups_normalizedName_unique` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
ALTER TABLE `price_products` DROP INDEX `price_products_normalizedSignature_unique`;
--> statement-breakpoint
ALTER TABLE `price_products` ADD `linkGroupId` int;
--> statement-breakpoint
-- Existing product codes remain unchanged. Every historic product first receives its own comparison group,
-- so price offers, import rows and aliases keep exactly the same product target and no price fact is rewritten.
INSERT INTO `price_link_groups` (`linkCode`, `canonicalName`, `normalizedName`, `isActive`, `createdAt`, `updatedAt`)
SELECT COALESCE(`linkCode`, CONCAT('Z', LPAD(`id`, 3, '0'))), `canonicalName`, `normalizedSignature`, `isActive`, `createdAt`, `updatedAt`
FROM `price_products`;
--> statement-breakpoint
UPDATE `price_products` AS `product`
INNER JOIN `price_link_groups` AS `link_group` ON `link_group`.`normalizedName` = `product`.`normalizedSignature`
SET `product`.`linkGroupId` = `link_group`.`id`;
--> statement-breakpoint
ALTER TABLE `price_products` MODIFY `linkGroupId` int NOT NULL;
