CREATE TABLE `operational_store_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`evotorStoreName` varchar(255) NOT NULL,
	`evotorAddress` varchar(512) NOT NULL,
	`evotorTerminalUuid` varchar(128),
	`configuredByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_store_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_store_mappings_storeId_unique` UNIQUE(`storeId`)
);
