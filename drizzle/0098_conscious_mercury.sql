CREATE TABLE `operational_evotor_revenue_plan_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`monthDate` varchar(7) NOT NULL,
	`milestonePercent` int NOT NULL,
	`planAmount` decimal(18,2) NOT NULL,
	`actualAmount` decimal(18,2) NOT NULL,
	`notifiedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operational_evotor_revenue_plan_milestones_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_evotor_revenue_plan_milestone_uq` UNIQUE(`storeId`,`monthDate`,`milestonePercent`)
);
--> statement-breakpoint
ALTER TABLE `audit_plan_facts` ADD `rewardText` varchar(280);