CREATE TABLE `operational_catalog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`normalizedName` varchar(560) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByAccountId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_catalog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_catalog_category_name_uq` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
ALTER TABLE `operational_catalog_products` ADD `catalogCategoryId` int;--> statement-breakpoint
ALTER TABLE `operational_print_category_group_members` ADD `catalogCategoryId` int;--> statement-breakpoint
ALTER TABLE `operational_store_request_lines` ADD `catalogCategoryId` int;
--> statement-breakpoint
/* Additive legacy backfill: source names and historical snapshots remain intact. */
INSERT IGNORE INTO `operational_catalog_categories` (`name`, `normalizedName`, `isActive`, `createdByAccountId`)
SELECT DISTINCT TRIM(`evotorCategoryName`), LOWER(TRIM(`evotorCategoryName`)), true, NULL
FROM `operational_catalog_products`
WHERE `evotorCategoryName` IS NOT NULL AND TRIM(`evotorCategoryName`) <> '';
--> statement-breakpoint
INSERT IGNORE INTO `operational_catalog_categories` (`name`, `normalizedName`, `isActive`, `createdByAccountId`)
SELECT DISTINCT TRIM(`catalogCategory`), LOWER(TRIM(`catalogCategory`)), true, NULL
FROM `operational_print_category_group_members`
WHERE `memberType` = 'catalog_category' AND `catalogCategory` IS NOT NULL AND TRIM(`catalogCategory`) <> '';
--> statement-breakpoint
UPDATE `operational_catalog_products` p
INNER JOIN `operational_catalog_categories` c ON c.`normalizedName` = LOWER(TRIM(p.`evotorCategoryName`))
SET p.`catalogCategoryId` = c.`id`
WHERE p.`catalogCategoryId` IS NULL AND p.`evotorCategoryName` IS NOT NULL AND TRIM(p.`evotorCategoryName`) <> '';
--> statement-breakpoint
UPDATE `operational_print_category_group_members` m
INNER JOIN `operational_catalog_categories` c ON c.`normalizedName` = LOWER(TRIM(m.`catalogCategory`))
SET m.`catalogCategoryId` = c.`id`
WHERE m.`catalogCategoryId` IS NULL AND m.`memberType` = 'catalog_category' AND m.`catalogCategory` IS NOT NULL AND TRIM(m.`catalogCategory`) <> '';
--> statement-breakpoint
UPDATE `operational_store_request_lines` l
INNER JOIN `operational_catalog_categories` c ON c.`normalizedName` = LOWER(TRIM(l.`categoryName`))
SET l.`catalogCategoryId` = c.`id`
WHERE l.`catalogCategoryId` IS NULL AND l.`categoryName` IS NOT NULL AND TRIM(l.`categoryName`) <> '';
