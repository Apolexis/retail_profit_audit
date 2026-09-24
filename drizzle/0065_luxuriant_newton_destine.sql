ALTER TABLE `operational_evotor_documents` ADD `receiptNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `discountAmount` decimal(18,2);--> statement-breakpoint
CREATE INDEX `operational_evotor_receipt_number_idx` ON `operational_evotor_documents` (`storeId`,`receiptNumber`);