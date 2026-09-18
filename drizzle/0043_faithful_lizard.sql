CREATE TABLE `operational_scheduled_sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('evotor_catalog','evotor_documents') NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastStartedAt` timestamp,
	`lastCompletedAt` timestamp,
	`lastError` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_scheduled_sync_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_scheduled_sync_jobs_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`),
	CONSTRAINT `operational_scheduled_sync_kind_uq` UNIQUE(`kind`)
);
