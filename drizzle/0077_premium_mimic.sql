CREATE TABLE `operational_evotor_outbound_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`sourceKey` varchar(191) NOT NULL,
	`reason` enum('catalog_create','catalog_update','catalog_enable','price_update','warehouse_mapping','inventory_close','stock_adjustment','transfer','shipment_receipt') NOT NULL,
	`status` enum('pending','processing','retry','succeeded','failed') NOT NULL DEFAULT 'pending',
	`attemptCount` int NOT NULL DEFAULT 0,
	`lastError` varchar(512),
	`lastAttemptAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_outbound_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_outbound_source_uq` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE INDEX `operational_evotor_outbound_pending_idx` ON `operational_evotor_outbound_jobs` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operational_evotor_outbound_store_product_idx` ON `operational_evotor_outbound_jobs` (`storeId`,`productId`);