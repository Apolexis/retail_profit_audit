CREATE TABLE `operational_evotor_catalog_lane_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`laneKind` enum('evotor_catalog_current_1','evotor_catalog_current_2','evotor_catalog_current_3','evotor_catalog_current_4') NOT NULL,
	`storeId` int NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`productsRead` int NOT NULL DEFAULT 0,
	`failureMessage` varchar(512),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `operational_evotor_catalog_lane_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `operational_evotor_catalog_lane_store_started_idx` ON `operational_evotor_catalog_lane_attempts` (`laneKind`,`storeId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `operational_evotor_catalog_lane_status_idx` ON `operational_evotor_catalog_lane_attempts` (`status`,`startedAt`);