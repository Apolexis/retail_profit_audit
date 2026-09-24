CREATE TABLE `audit_import_materialization_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingsKey` varchar(32) NOT NULL,
	`metricCodes` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_import_materialization_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_import_materialization_settings_settingsKey_unique` UNIQUE(`settingsKey`)
);
