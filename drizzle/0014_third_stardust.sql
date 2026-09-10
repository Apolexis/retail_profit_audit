CREATE TABLE `audit_import_credential_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingsKey` varchar(32) NOT NULL,
	`openPasswordCiphertext` text,
	`unprotectPasswordCiphertext` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_import_credential_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_import_credential_settings_settingsKey_unique` UNIQUE(`settingsKey`)
);
