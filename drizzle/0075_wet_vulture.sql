ALTER TABLE `operational_stock_transfers` ADD `transferNumber` int;--> statement-breakpoint
UPDATE `operational_stock_transfers` AS `target`
INNER JOIN (
  SELECT `id`, ROW_NUMBER() OVER (ORDER BY `id`) AS `transferNumber`
  FROM `operational_stock_transfers`
) AS `sequence` ON `target`.`id` = `sequence`.`id`
SET `target`.`transferNumber` = `sequence`.`transferNumber`;--> statement-breakpoint
ALTER TABLE `operational_stock_transfers` MODIFY `transferNumber` int NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_stock_transfers` ADD CONSTRAINT `operational_stock_transfers_transferNumber_unique` UNIQUE(`transferNumber`);
