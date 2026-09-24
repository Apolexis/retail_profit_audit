CREATE TABLE `operational_evotor_webhook_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evotorUserId` varchar(96) NOT NULL,
	`tokenFingerprint` varchar(64) NOT NULL,
	`lastAuthorizedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_webhook_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_webhook_user_uq` UNIQUE(`evotorUserId`),
	CONSTRAINT `operational_evotor_webhook_user_token_uq` UNIQUE(`tokenFingerprint`)
);
