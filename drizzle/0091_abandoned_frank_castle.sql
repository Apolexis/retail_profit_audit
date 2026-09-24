CREATE TABLE `operational_evotor_receipt_stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentPositionId` int NOT NULL,
	`documentId` int NOT NULL,
	`storeId` int NOT NULL,
	`productId` int NOT NULL,
	`quantityDelta` decimal(16,3) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_evotor_receipt_stock_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_receipt_stock_position_uq` UNIQUE(`documentPositionId`)
);
--> statement-breakpoint
CREATE INDEX `operational_evotor_receipt_stock_lookup_idx` ON `operational_evotor_receipt_stock_movements` (`storeId`,`productId`,`occurredAt`);