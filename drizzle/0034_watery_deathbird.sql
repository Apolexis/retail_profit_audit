CREATE TABLE `operational_evotor_document_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`evotorProductId` varchar(128),
	`productName` varchar(512),
	`quantity` decimal(16,3),
	`initialQuantity` decimal(16,3),
	`unit` varchar(64),
	`settlementMethod` varchar(64),
	`resultSum` decimal(18,2),
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_evotor_document_positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_document_position_uq` UNIQUE(`documentId`,`evotorProductId`,`productName`)
);
--> statement-breakpoint
CREATE TABLE `operational_evotor_document_syncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`cursor` varchar(512),
	`documentsRead` int NOT NULL DEFAULT 0,
	`positionsRead` int NOT NULL DEFAULT 0,
	`startedByAccountId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`failureMessage` varchar(512),
	CONSTRAINT `operational_evotor_document_syncs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operational_evotor_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`syncId` int NOT NULL,
	`evotorDocumentId` varchar(128) NOT NULL,
	`documentType` varchar(64) NOT NULL,
	`occurredAt` varchar(64),
	`total` decimal(18,2),
	`importedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_evotor_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_document_uq` UNIQUE(`storeId`,`evotorDocumentId`)
);
