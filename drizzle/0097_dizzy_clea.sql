CREATE TABLE `operational_onec_purchase_costs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchImportId` int NOT NULL,
	`sourceRecordId` varchar(191) NOT NULL,
	`productId` int,
	`productSourceId` varchar(191) NOT NULL,
	`productName` varchar(512),
	`unit` enum('kg','l','piece') NOT NULL,
	`purchasePrice` decimal(18,2) NOT NULL,
	`effectiveDate` varchar(10) NOT NULL,
	`warehouseCode` varchar(32),
	`basis` varchar(512),
	`mappingState` enum('mapped','quarantined') NOT NULL,
	`appliedToCatalogAt` timestamp,
	`appliedToCatalogByAccountId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_onec_purchase_costs_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_onec_purchase_cost_record_uq` UNIQUE(`batchImportId`,`sourceRecordId`)
);
--> statement-breakpoint
ALTER TABLE `operational_onec_import_batches` MODIFY COLUMN `entity` enum('inventory_snapshots','store_shipments','purchase_costs') NOT NULL;--> statement-breakpoint
CREATE INDEX `operational_onec_purchase_cost_product_idx` ON `operational_onec_purchase_costs` (`productId`,`effectiveDate`);--> statement-breakpoint
CREATE INDEX `operational_onec_purchase_cost_warehouse_idx` ON `operational_onec_purchase_costs` (`warehouseCode`,`effectiveDate`);