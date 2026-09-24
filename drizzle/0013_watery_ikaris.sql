CREATE TABLE `audit_local_passkey_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptHash` varchar(128) NOT NULL,
	`accountId` int NOT NULL,
	`ceremony` enum('registration','authentication') NOT NULL,
	`challenge` varchar(512) NOT NULL,
	`origin` varchar(512) NOT NULL,
	`rpId` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_local_passkey_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_local_passkey_challenges_attemptHash_unique` UNIQUE(`attemptHash`)
);
--> statement-breakpoint
CREATE TABLE `audit_local_passkeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`credentialId` varchar(512) NOT NULL,
	`publicKey` text NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`transports` json,
	`deviceType` varchar(32) NOT NULL,
	`backedUp` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `audit_local_passkeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_local_passkeys_credentialId_unique` UNIQUE(`credentialId`)
);
