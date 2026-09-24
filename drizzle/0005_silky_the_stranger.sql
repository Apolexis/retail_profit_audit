ALTER TABLE `audit_periods` DROP INDEX `audit_period_store_month_uq`;--> statement-breakpoint
ALTER TABLE `audit_periods` ADD `entryDate` varchar(10) DEFAULT '1970-01-01';--> statement-breakpoint
UPDATE `audit_periods` SET `entryDate` = CONCAT(`monthDate`, '-01');--> statement-breakpoint
ALTER TABLE `audit_periods` MODIFY COLUMN `entryDate` varchar(10) NOT NULL DEFAULT '1970-01-01';--> statement-breakpoint
ALTER TABLE `audit_periods` ADD CONSTRAINT `audit_period_store_entry_uq` UNIQUE(`storeId`,`entryDate`);
