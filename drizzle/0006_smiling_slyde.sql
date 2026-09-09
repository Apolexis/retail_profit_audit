CREATE TABLE `audit_executive_report_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`cronExpression` varchar(64) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_executive_report_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_executive_report_schedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `audit_executive_report_schedules_schedule_cron_task_uid_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE TABLE `audit_weekly_executive_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodStart` varchar(10) NOT NULL,
	`periodEnd` varchar(10) NOT NULL,
	`snapshotMonth` varchar(7),
	`summary` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_weekly_executive_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_weekly_executive_report_period_uq` UNIQUE(`periodStart`,`periodEnd`)
);
