CREATE TABLE `audit_change_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(128) NOT NULL,
	`beforeState` json,
	`afterState` json,
	`rollbackOf` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_change_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_local_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('admin','analyst','viewer') NOT NULL DEFAULT 'viewer',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastLoginAt` timestamp,
	CONSTRAINT `audit_local_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_local_accounts_username_unique` UNIQUE(`username`)
);
