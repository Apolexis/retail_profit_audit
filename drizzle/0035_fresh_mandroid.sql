ALTER TABLE `operational_stock_movements` MODIFY COLUMN `inventoryId` int;--> statement-breakpoint
ALTER TABLE `operational_stock_movements` MODIFY COLUMN `kind` enum('first_count','inventory_adjustment','manual_adjustment') NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_stock_movements` ADD `adjustmentReason` varchar(512);