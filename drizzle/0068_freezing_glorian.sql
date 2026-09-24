CREATE TABLE `operational_onec_shipment_receipt_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`shipmentLineId` int NOT NULL,
	`productId` int NOT NULL,
	`expectedQuantity` decimal(16,3) NOT NULL,
	`actualQuantity` decimal(16,3),
	`unit` enum('kg','l','piece') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_shipment_receipt_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_receipt_line_shipment_line_uq` UNIQUE(`shipmentLineId`)
);
--> statement-breakpoint
CREATE TABLE `operational_onec_shipment_receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`storeId` int NOT NULL,
	`status` enum('awaiting_store','reported','confirmed') NOT NULL DEFAULT 'awaiting_store',
	`storeNote` varchar(512),
	`reportedByAccountId` int,
	`reportedAt` timestamp,
	`confirmedByAccountId` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_onec_shipment_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_shipment_receipt_shipment_uq` UNIQUE(`shipmentId`)
);
--> statement-breakpoint
ALTER TABLE `operational_stock_movements` MODIFY COLUMN `kind` enum('first_count','inventory_adjustment','manual_adjustment','transfer_out','transfer_in','shipment_receipt') NOT NULL;--> statement-breakpoint
CREATE INDEX `operational_onec_receipt_line_receipt_idx` ON `operational_onec_shipment_receipt_lines` (`receiptId`);--> statement-breakpoint
CREATE INDEX `operational_onec_shipment_receipt_store_idx` ON `operational_onec_shipment_receipts` (`storeId`,`status`);