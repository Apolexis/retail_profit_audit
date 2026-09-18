ALTER TABLE `operational_catalog_products` MODIFY COLUMN `importedByAccountId` int;--> statement-breakpoint
ALTER TABLE `operational_evotor_document_syncs` MODIFY COLUMN `startedByAccountId` int;--> statement-breakpoint
ALTER TABLE `operational_evotor_product_links` MODIFY COLUMN `linkedByAccountId` int;