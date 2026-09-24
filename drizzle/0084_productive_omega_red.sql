CREATE TABLE `operational_evotor_push_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` varchar(128) NOT NULL,
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_push_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_push_settings_applicationId_unique` UNIQUE(`applicationId`)
);
