CREATE TABLE `operational_onec_inbound_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`credentialKey` varchar(64) NOT NULL,
	`encryptedToken` varchar(4096) NOT NULL,
	`initializationVector` varchar(64) NOT NULL,
	`authenticationTag` varchar(64) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`updatedByAccountId` int NOT NULL,
	`lastAcceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_inbound_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_inbound_credential_key_uq` UNIQUE(`credentialKey`)
);
