CREATE TABLE `audit_push_subscriptions` (
		`id` int AUTO_INCREMENT NOT NULL,
		`accountId` int NOT NULL,
		`endpoint` text NOT NULL,
		`endpointHash` varchar(64) NOT NULL,
		`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_push_subscriptions_id` PRIMARY KEY(`id`),
		CONSTRAINT `audit_push_subscription_endpoint_hash_uq` UNIQUE(`endpointHash`)
);
