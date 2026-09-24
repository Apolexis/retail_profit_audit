CREATE TABLE `operational_onec_warehouse_group_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`warehouseCode` varchar(32) NOT NULL,
	`printGroupId` int NOT NULL,
	`mappedByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_warehouse_group_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_warehouse_group_uq` UNIQUE(`warehouseCode`)
);
