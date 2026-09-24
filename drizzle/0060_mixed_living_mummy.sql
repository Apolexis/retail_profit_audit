CREATE TABLE `operational_onec_import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceSystem` varchar(128) NOT NULL,
	`entity` enum('inventory_snapshots','store_shipments') NOT NULL,
	`batchId` varchar(191) NOT NULL,
	`schemaVersion` varchar(32) NOT NULL,
	`generatedAt` varchar(64) NOT NULL,
	`asOf` varchar(64),
	`status` enum('applied','quarantined','mixed') NOT NULL,
	`totalRecords` int NOT NULL,
	`acceptedRecords` int NOT NULL,
	`quarantinedRecords` int NOT NULL,
	`createdByAccountId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_onec_import_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_batch_uq` UNIQUE(`sourceSystem`,`entity`,`batchId`)
);
--> statement-breakpoint
CREATE TABLE `operational_onec_shipment_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipmentId` int NOT NULL,
	`sourceLineId` varchar(191) NOT NULL,
	`productId` int,
	`productSourceId` varchar(191) NOT NULL,
	`quantity` decimal(16,3) NOT NULL,
	`unit` enum('kg','l','piece') NOT NULL,
	`mappingState` enum('mapped','quarantined') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_onec_shipment_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_shipment_line_uq` UNIQUE(`shipmentId`,`sourceLineId`)
);
--> statement-breakpoint
CREATE TABLE `operational_onec_store_shipments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchImportId` int NOT NULL,
	`shipmentId` varchar(191) NOT NULL,
	`revisionId` varchar(191) NOT NULL,
	`sourceRecordId` varchar(191) NOT NULL,
	`businessDate` varchar(10) NOT NULL,
	`originWarehouseCode` varchar(32) NOT NULL,
	`destinationStoreId` int,
	`documentNumber` varchar(128),
	`sourceStatus` enum('posted','cancelled','corrected') NOT NULL,
	`mappingState` enum('unmapped','mapped','quarantined') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_onec_store_shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_shipment_revision_uq` UNIQUE(`shipmentId`,`revisionId`)
);
--> statement-breakpoint
CREATE TABLE `operational_onec_warehouse_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchImportId` int NOT NULL,
	`sourceRecordId` varchar(191) NOT NULL,
	`warehouseCode` varchar(32) NOT NULL,
	`productId` int,
	`productSourceId` varchar(191) NOT NULL,
	`quantityOnHand` decimal(16,3) NOT NULL,
	`quantityAvailable` decimal(16,3),
	`businessDate` varchar(10) NOT NULL,
	`asOf` varchar(64) NOT NULL,
	`mappingState` enum('mapped','quarantined') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_onec_warehouse_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_snapshot_record_uq` UNIQUE(`batchImportId`,`sourceRecordId`)
);
--> statement-breakpoint
CREATE INDEX `operational_onec_batch_entity_idx` ON `operational_onec_import_batches` (`entity`,`createdAt`);--> statement-breakpoint
CREATE INDEX `operational_onec_shipment_date_idx` ON `operational_onec_store_shipments` (`businessDate`,`mappingState`);--> statement-breakpoint
CREATE INDEX `operational_onec_snapshot_warehouse_idx` ON `operational_onec_warehouse_snapshots` (`warehouseCode`,`businessDate`);