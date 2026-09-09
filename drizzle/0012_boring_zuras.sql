CREATE TABLE `audit_alert_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ruleKey` varchar(64) NOT NULL,
	`metricCode` varchar(64) NOT NULL,
	`comparison` enum('gte','lte') NOT NULL,
	`threshold` decimal(18,2) NOT NULL,
	`severity` enum('critical','warning') NOT NULL DEFAULT 'warning',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_alert_thresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_alert_thresholds_ruleKey_unique` UNIQUE(`ruleKey`)
);
