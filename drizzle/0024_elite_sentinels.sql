CREATE TABLE `operational_revenue_record_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`revenueRecordId` int NOT NULL,
	`version` int NOT NULL,
	`action` enum('create','correct') NOT NULL,
	`changedByAccountId` int NOT NULL,
	`correctionReason` text,
	`state` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_revenue_record_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_revenue_version_uq` UNIQUE(`revenueRecordId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `operational_revenue_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`businessDate` varchar(10) NOT NULL,
	`createdByAccountId` int NOT NULL,
	`currentVersion` int NOT NULL DEFAULT 1,
	`cash` decimal(18,2) NOT NULL,
	`cashless` decimal(18,2) NOT NULL,
	`cashExpenses` decimal(18,2) NOT NULL,
	`householdCash` decimal(18,2) NOT NULL,
	`cleaningCash` decimal(18,2) NOT NULL,
	`salaryCash` decimal(18,2) NOT NULL,
	`serviceCash` decimal(18,2) NOT NULL,
	`extraPaymentCash` decimal(18,2) NOT NULL,
	`bonusCash` decimal(18,2) NOT NULL,
	`vacationCash` decimal(18,2) NOT NULL,
	`utilitiesCash` decimal(18,2) NOT NULL,
	`deliveryCash` decimal(18,2) NOT NULL,
	`expenseComments` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_revenue_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_revenue_store_date_uq` UNIQUE(`storeId`,`businessDate`)
);
--> statement-breakpoint
ALTER TABLE `audit_local_accounts` MODIFY COLUMN `role` enum('admin','analyst','seller') NOT NULL DEFAULT 'analyst';