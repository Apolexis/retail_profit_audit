ALTER TABLE `operational_stock_transfers` MODIFY COLUMN `status` enum('draft','posted','reversed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `operational_stock_transfers` ADD `reversalOfTransferId` int;--> statement-breakpoint
ALTER TABLE `operational_stock_transfers` ADD CONSTRAINT `operational_stock_transfers_reversalOfTransferId_unique` UNIQUE(`reversalOfTransferId`);