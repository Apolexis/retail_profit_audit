ALTER TABLE `operational_evotor_documents` ADD `cashAmount` decimal(18,2);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `cashlessAmount` decimal(18,2);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `otherPaymentAmount` decimal(18,2);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `unknownPaymentAmount` decimal(18,2);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `paymentCaptureStatus` enum('unavailable','complete','unreconciled','malformed') DEFAULT 'unavailable' NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `paymentReconciliationDelta` decimal(18,2);