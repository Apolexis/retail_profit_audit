ALTER TABLE `operational_store_request_lines` MODIFY COLUMN `productId` int;--> statement-breakpoint
ALTER TABLE `operational_store_request_lines` ADD `manualProductName` varchar(512);