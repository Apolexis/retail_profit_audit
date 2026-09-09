CREATE TABLE `audit_plan_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`monthDate` varchar(7) NOT NULL,
	`metricCode` varchar(64) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_plan_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_plan_fact_store_month_metric_uq` UNIQUE(`storeId`,`monthDate`,`metricCode`)
);
