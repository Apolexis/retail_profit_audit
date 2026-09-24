ALTER TABLE `operational_request_print_settings` ADD `recommendationFontSize` int DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_request_print_settings` ADD `recommendationTone` enum('muted','dark') DEFAULT 'muted' NOT NULL;
--> statement-breakpoint
/* Materialize only post-reset documents. A direct external UUID wins; a name
   fallback is allowed only for one active catalog name and never becomes a link. */
INSERT INTO `operational_evotor_receipt_stock_movements` (`documentPositionId`, `documentId`, `storeId`, `productId`, `quantityDelta`, `occurredAt`)
SELECT
  p.`id`,
  d.`id`,
  d.`storeId`,
  COALESCE(directLink.`productId`, fallbackProduct.`id`),
  CASE
    WHEN UPPER(d.`documentType`) IN ('SELL', 'SALE', 'RECEIPT') THEN -p.`quantity`
    WHEN UPPER(d.`documentType`) IN ('PAYBACK', 'RETURN', 'SELL_RETURN') THEN p.`quantity`
  END,
  CAST(d.`occurredAt` AS DATETIME)
FROM `operational_evotor_document_positions` p
JOIN `operational_evotor_documents` d ON d.`id` = p.`documentId`
LEFT JOIN `operational_evotor_receipt_stock_movements` movement ON movement.`documentPositionId` = p.`id`
LEFT JOIN `operational_evotor_product_links` directLink
  ON directLink.`storeId` = d.`storeId` AND directLink.`evotorProductId` = p.`evotorProductId`
LEFT JOIN (
  SELECT `canonicalName`
  FROM `operational_catalog_products`
  WHERE `isActive` = 1
  GROUP BY `canonicalName`
  HAVING COUNT(*) = 1
) uniqueName ON uniqueName.`canonicalName` = p.`productName`
LEFT JOIN `operational_catalog_products` fallbackProduct
  ON fallbackProduct.`canonicalName` = uniqueName.`canonicalName` AND fallbackProduct.`isActive` = 1
JOIN `operational_evotor_product_links` baseline
  ON baseline.`storeId` = d.`storeId`
  AND baseline.`productId` = COALESCE(directLink.`productId`, fallbackProduct.`id`)
  AND baseline.`evotorQuantitySource` = 'confirmed_reset'
  AND baseline.`evotorQuantityUpdatedAt` IS NOT NULL
WHERE movement.`id` IS NULL
  AND p.`quantity` IS NOT NULL
  AND d.`occurredAt` IS NOT NULL
  AND UPPER(d.`documentType`) IN ('SELL', 'SALE', 'RECEIPT', 'PAYBACK', 'RETURN', 'SELL_RETURN')
  AND CAST(d.`occurredAt` AS DATETIME) > baseline.`evotorQuantityUpdatedAt`
ON DUPLICATE KEY UPDATE `documentPositionId` = VALUES(`documentPositionId`);
