CREATE TABLE `audit_local_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_local_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_local_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
