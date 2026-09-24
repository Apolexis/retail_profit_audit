ALTER TABLE `operational_evotor_documents` ADD `cashTenderedAmount` decimal(18,2);--> statement-breakpoint
ALTER TABLE `operational_evotor_documents` ADD `cashChangeAmount` decimal(18,2);--> statement-breakpoint
-- Historical raw V2 payloads are intentionally not retained. For the unambiguous
-- cash-only sale pattern, the previously stored cash value is tendered cash and
-- its positive reconciliation delta is exactly the omitted aggregate change.
UPDATE `operational_evotor_documents`
SET `cashTenderedAmount` = `cashAmount`,
    `cashChangeAmount` = `cashAmount` - `total`,
    `cashAmount` = `total`,
    `paymentCaptureStatus` = 'complete',
    `paymentReconciliationDelta` = 0
WHERE `documentType` = 'SELL'
  AND `paymentCaptureStatus` = 'unreconciled'
  AND `cashlessAmount` = 0
  AND `otherPaymentAmount` = 0
  AND `unknownPaymentAmount` = 0
  AND `cashAmount` > `total`
  AND ABS((`cashAmount` - `paymentReconciliationDelta`) - `total`) < 0.01;--> statement-breakpoint
-- For legacy receipts that were already reconciled, zero change is explicit;
-- unavailable and other unreconciled payment arrays remain unknown, not zero.
UPDATE `operational_evotor_documents`
SET `cashTenderedAmount` = `cashAmount`,
    `cashChangeAmount` = 0
WHERE `cashTenderedAmount` IS NULL
  AND `cashChangeAmount` IS NULL
  AND `paymentCaptureStatus` = 'complete'
  AND `cashAmount` IS NOT NULL;
