ALTER TABLE `operational_evotor_outbound_jobs` MODIFY COLUMN `status` enum('pending','processing','submitted','retry','succeeded','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `operational_evotor_outbound_jobs` ADD `externalBulkId` varchar(128);--> statement-breakpoint
ALTER TABLE `operational_evotor_outbound_jobs` ADD `bulkSubmittedAt` timestamp;