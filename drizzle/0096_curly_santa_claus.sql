CREATE TABLE `operational_evotor_cloud_user_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evotorUserId` varchar(96) NOT NULL,
	`encryptedToken` varchar(4096) NOT NULL,
	`initializationVector` varchar(64) NOT NULL,
	`authenticationTag` varchar(64) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_evotor_cloud_user_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_cloud_user_token_uq` UNIQUE(`evotorUserId`)
);
