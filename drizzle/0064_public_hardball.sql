ALTER TABLE `operational_store_requests` ADD `isHidden` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_store_requests` ADD `hiddenByAccountId` int;--> statement-breakpoint
ALTER TABLE `operational_store_requests` ADD `hiddenAt` timestamp;