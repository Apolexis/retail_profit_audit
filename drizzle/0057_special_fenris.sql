CREATE TABLE `operational_evotor_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialKey` varchar(64) NOT NULL,
	`encryptedToken` varchar(4096) NOT NULL,
	`initializationVector` varchar(64) NOT NULL,
	`authenticationTag` varchar(64) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_credential_key_uq` UNIQUE(`credentialKey`)
);
--> statement-breakpoint
CREATE TABLE `operational_request_print_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zebraMode` enum('none','rows','columns') NOT NULL DEFAULT 'none',
	`updatedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_request_print_settings_id` PRIMARY KEY(`id`)
);
