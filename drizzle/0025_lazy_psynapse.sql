ALTER TABLE `operational_revenue_record_versions` MODIFY COLUMN `action` enum('create','correct','void','recreate') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_revenue_records` ADD `isVoided` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_revenue_records` ADD `voidReason` text;--> statement-breakpoint
ALTER TABLE `operational_revenue_records` ADD `voidedByAccountId` int;--> statement-breakpoint
ALTER TABLE `operational_revenue_records` ADD `voidedAt` timestamp;