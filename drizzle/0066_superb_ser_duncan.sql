ALTER TABLE `operational_onec_shipment_lines` ADD `expirationDate` varchar(10);--> statement-breakpoint
ALTER TABLE `operational_onec_warehouse_snapshots` ADD `expirationDate` varchar(10);--> statement-breakpoint
CREATE INDEX `operational_onec_shipment_line_expiry_idx` ON `operational_onec_shipment_lines` (`expirationDate`);--> statement-breakpoint
CREATE INDEX `operational_onec_snapshot_expiry_idx` ON `operational_onec_warehouse_snapshots` (`expirationDate`);