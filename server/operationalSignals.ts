import { and, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { auditNotifications, metrics, operationalEvotorDocumentSyncs, operationalEvotorDocuments, operationalEvotorProductLinks, operationalRevenueRecords, operationalStoreMappings, operationalStoreRequests, periods, stores } from "../drizzle/schema";
import { getDb } from "./db";
import { listOperationalExcessStockCoverage } from "./inventoryRegistry";
import { evaluateCurrentEvotorRevenuePlanMilestones } from "./monthlyRevenuePlan";
import { listOperationalExpiryFindings } from "./onecImport";
import { createDataFreshnessSignalNotificationsBatch, createExpirySignalNotifications, createOperationalSignalNotifications, createReturnSignalNotifications, createStockCoverSignalNotifications, createWarehouseExpirySignalNotifications, resolveOperationalSignalNotifications, sendDataFreshnessMobileDigest } from "./notifications";

/**
 * Small, idempotent operational control layer. It intentionally reads only the
 * operational registers and sends no data to Evotor. Signals are addressed to
 * administrators, authorized analysts and the seller assigned to the store;
 * they contain no financial facts, import details or printing permissions.
 */
const moscowNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const take = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";
  return { businessDate: `${take("year")}-${take("month")}-${take("day")}`, minutes: Number(take("hour")) * 60 + Number(take("minute")) };
};

async function signalOnce(input: { storeId: number; key: string; severity: "warning" | "critical"; title: string; message: string }) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db.select({ id: auditNotifications.id }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key), isNull(auditNotifications.resolvedAt))).limit(1);
  if (existing) return false;
  const result = await createOperationalSignalNotifications({
    storeIds: [input.storeId], severity: input.severity, title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

async function returnSignalOnce(input: { storeId: number; key: string; severity: "warning" | "critical"; title: string; message: string }) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db.select({ id: auditNotifications.id }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key), isNull(auditNotifications.resolvedAt))).limit(1);
  if (existing) return false;
  const result = await createReturnSignalNotifications({
    storeIds: [input.storeId], severity: input.severity, title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

async function stockCoverSignalOnce(input: { storeId: number; key: string; title: string; message: string }) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db.select({ id: auditNotifications.id }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key), isNull(auditNotifications.resolvedAt))).limit(1);
  if (existing) return false;
  const result = await createStockCoverSignalNotifications({
    storeIds: [input.storeId], severity: "warning", title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

const RECEIPT_FRESHNESS_MINUTES = 10;
const STOCK_SNAPSHOT_FRESHNESS_MINUTES = 20;
const minutesSince = (value: Date | null | undefined, now: Date) => value ? Math.max(0, Math.floor((now.getTime() - value.getTime()) / 60_000)) : null;
const freshnessSeverity = (ageMinutes: number | null, thresholdMinutes: number) => ageMinutes === null
  ? "critical" as const
  : ageMinutes <= thresholdMinutes ? null : ageMinutes <= thresholdMinutes * 2 ? "warning" as const : "critical" as const;
export const __operationalSignalTestUtils = { freshnessSeverity };

/**
 * A quiet shop is not an error: receipt freshness is based on successful current-day
 * polling, not on the timestamp of the last sale. A stock signal requires a real
 * existing snapshot and never creates a warning merely because a new store is empty.
 */
async function evaluateEvotorFreshnessSignals(input: { now: Date; businessDate: string; storeIds: number[]; storesById: Map<number, string> }) {
  const db = await getDb();
  if (!db || !input.storeIds.length) return { receiptFreshness: 0, stockFreshness: 0 };
  const [currentDaySyncs, stockSnapshots] = await Promise.all([
    db.select({ storeId: operationalEvotorDocumentSyncs.storeId, completedAt: operationalEvotorDocumentSyncs.completedAt, startedAt: operationalEvotorDocumentSyncs.startedAt })
      .from(operationalEvotorDocumentSyncs)
      .where(and(
        inArray(operationalEvotorDocumentSyncs.storeId, input.storeIds),
        eq(operationalEvotorDocumentSyncs.syncMode, "current_day"),
        eq(operationalEvotorDocumentSyncs.status, "completed"),
        eq(operationalEvotorDocumentSyncs.requestedTo, input.businessDate),
      )).orderBy(operationalEvotorDocumentSyncs.storeId, operationalEvotorDocumentSyncs.completedAt).limit(5_000),
    db.select({ storeId: operationalEvotorProductLinks.storeId, snapshotAt: sql<Date | null>`max(${operationalEvotorProductLinks.evotorQuantityUpdatedAt})` })
      .from(operationalEvotorProductLinks)
      .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, operationalEvotorProductLinks.storeId))
      .where(and(
        inArray(operationalEvotorProductLinks.storeId, input.storeIds),
        isNotNull(operationalEvotorProductLinks.evotorQuantitySnapshot),
      )).groupBy(operationalEvotorProductLinks.storeId),
  ]);
  const currentDayCompletionByStore = new Map<number, Date>();
  for (const sync of currentDaySyncs) {
    const completedAt = sync.completedAt ?? sync.startedAt;
    const previous = currentDayCompletionByStore.get(sync.storeId);
    if (!previous || completedAt > previous) currentDayCompletionByStore.set(sync.storeId, completedAt);
  }
  const snapshotByStore = new Map(stockSnapshots.map(row => [row.storeId, row.snapshotAt]));
  // A live lane may cover all 33 mappings. Build its candidates in memory, then
  // use one existence query, one recipient lookup and one insert rather than
  // serially waiting on every store's individual signal path.
  const candidates: Array<{storeId:number; severity:"warning"|"critical"; title:string; message:string; entityId:string}> = [];
  const resolveKeys: string[] = [];
  for (const storeId of input.storeIds) {
    const storeName = input.storesById.get(storeId) ?? "Магазин";
    const receiptKey = `evotor_receipt_freshness:${storeId}:${input.businessDate}`;
    const receiptAge = minutesSince(currentDayCompletionByStore.get(storeId), input.now);
    const receiptSeverity = freshnessSeverity(receiptAge, RECEIPT_FRESHNESS_MINUTES);
    if (receiptSeverity) {
      const duration = receiptAge === null ? "нет завершенного обхода текущего дня" : `последний завершенный обход был ${receiptAge} мин. назад`;
      candidates.push({
        storeId, entityId: receiptKey, severity: receiptSeverity,
        title: "Чеки Эвотор требуют проверки",
        message: `${storeName}: ${duration}. Продажи не оцениваются как нулевые; проверьте постоянный обмен чеков Эвотор.`,
      });
    } else {
      resolveKeys.push(receiptKey);
    }
    const stockKey = `evotor_stock_freshness:${storeId}:${input.businessDate}`;
    const stockAge = minutesSince(snapshotByStore.get(storeId), input.now);
    const stockSeverity = freshnessSeverity(stockAge, STOCK_SNAPSHOT_FRESHNESS_MINUTES);
    if (stockAge !== null && stockSeverity) {
      candidates.push({
        storeId, entityId: stockKey, severity: stockSeverity,
        title: "Остатки Эвотор требуют обновления",
        message: `${storeName}: подтвержденный снимок физического остатка обновлялся ${stockAge} мин. назад. Проверьте постоянный обмен каталога и остатков Эвотор.`,
      });
    } else if (stockAge !== null) {
      resolveKeys.push(stockKey);
    }
  }
  await resolveOperationalSignalNotifications(resolveKeys);
  const candidateKeys = candidates.map(candidate => candidate.entityId);
  const existing = candidateKeys.length ? await db.select({ entityId: auditNotifications.entityId }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), inArray(auditNotifications.entityId, candidateKeys), isNull(auditNotifications.resolvedAt))) : [];
  const existingKeys = new Set(existing.map(row => row.entityId));
  const missing = candidates.filter(candidate => !existingKeys.has(candidate.entityId));
  const delivered = await createDataFreshnessSignalNotificationsBatch(missing);
  const receiptFreshness = missing.filter(candidate => candidate.entityId.startsWith("evotor_receipt_freshness:")).length;
  const stockFreshness = missing.filter(candidate => candidate.entityId.startsWith("evotor_stock_freshness:")).length;
  const newFreshnessSignals = receiptFreshness + stockFreshness;
  // Store-specific in-app alerts remain separate and auditable. Only the optional
  // mobile delivery is coalesced, so a slow subscription cannot serially delay a
  // current-day lane once per affected shop. A store-specific recipient set is
  // already computed by the batch write, so no per-store access query follows.
  if (newFreshnessSignals && delivered.accountIds.length) await sendDataFreshnessMobileDigest({ accountIds: delivered.accountIds, businessDate: input.businessDate });
  return { receiptFreshness, stockFreshness };
}

/** Return documents are discrete events. The notification is idempotent and only links
 * to a saved read-only document; no sale, receipt or stock balance is altered. */
async function evaluateEvotorReturnSignals(input: { businessDate: string; storeIds: number[]; storesById: Map<number, string> }) {
  const db = await getDb();
  if (!db || !input.storeIds.length) return 0;
  const returns = await db.select({ id: operationalEvotorDocuments.id, storeId: operationalEvotorDocuments.storeId, receiptNumber: operationalEvotorDocuments.receiptNumber, total: operationalEvotorDocuments.total })
    .from(operationalEvotorDocuments)
    .where(and(
      inArray(operationalEvotorDocuments.storeId, input.storeIds),
      inArray(operationalEvotorDocuments.documentType, ["PAYBACK", "RETURN", "SELL_RETURN"]),
      isNotNull(operationalEvotorDocuments.occurredAt),
      gte(operationalEvotorDocuments.occurredAt, `${input.businessDate}T00:00:00`),
      lte(operationalEvotorDocuments.occurredAt, `${input.businessDate}T23:59:59.999`),
    )).orderBy(operationalEvotorDocuments.id).limit(1_000);
  let created = 0;
  for (const document of returns) {
    const total = document.total === null ? "сумма не передана" : `${Number(document.total).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
    const receipt = document.receiptNumber ? `Чек №${document.receiptNumber}` : "Документ возврата";
    if (await returnSignalOnce({
      storeId: document.storeId,
      key: `evotor_return:${document.id}`,
      severity: "warning",
      title: "Возврат Эвотор требует просмотра",
      message: `${input.storesById.get(document.storeId) ?? "Магазин"}: ${receipt} на ${total}. Откройте состав возврата.`,
    })) created += 1;
  }
  return created;
}

/**
 * Current-day polling and the authenticated V2 receiver both use this narrow,
 * idempotent evaluator. It creates return notifications and checks the
 * explicitly configured Evotor-sales plan milestones without reading P&L.
 */
export async function evaluateCurrentDayEvotorReturnSignals() {
  const { businessDate } = moscowNow();
  const db = await getDb();
  if (!db) return { businessDate, returns: 0, revenuePlanMilestones: 0 };
  const visibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false));
  if (!visibleStores.length) return { businessDate, returns: 0, revenuePlanMilestones: 0 };
  const mappedRows = await db.select({ storeId: operationalStoreMappings.storeId }).from(operationalStoreMappings)
    .where(inArray(operationalStoreMappings.storeId, visibleStores.map(store => store.id)));
  const storeIds = Array.from(new Set(mappedRows.map(row => row.storeId)));
  return {
    businessDate,
    returns: await evaluateEvotorReturnSignals({
      businessDate,
      storeIds,
      storesById: new Map(visibleStores.map(store => [store.id, store.name])),
    }),
    revenuePlanMilestones: (await evaluateCurrentEvotorRevenuePlanMilestones()).created,
  };
}

/**
 * One current-day lane owns freshness once per minute. Unlike the full
 * operational sweep, it intentionally excludes late-day coverage, request,
 * legacy P&L plan-fact and revenue-registry controls: those keep their
 * explicit Moscow cut-offs on the archival callback. Evotor plan milestones
 * are a bounded receipt-derived operational event and are evaluated here.
 */
export async function evaluateCurrentDayEvotorFreshnessAndReturnSignals() {
  const { businessDate } = moscowNow();
  const db = await getDb();
  if (!db) return { businessDate, receiptFreshness: 0, stockFreshness: 0, returns: 0, revenuePlanMilestones: 0 };
  const visibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false));
  if (!visibleStores.length) return { businessDate, receiptFreshness: 0, stockFreshness: 0, returns: 0, revenuePlanMilestones: 0 };
  const mappedRows = await db.select({ storeId: operationalStoreMappings.storeId }).from(operationalStoreMappings)
    .where(inArray(operationalStoreMappings.storeId, visibleStores.map(store => store.id)));
  const storeIds = Array.from(new Set(mappedRows.map(row => row.storeId)));
  const storesById = new Map(visibleStores.map(store => [store.id, store.name]));
  const freshness = await evaluateEvotorFreshnessSignals({ now: new Date(), businessDate, storeIds, storesById });
  const returns = await evaluateEvotorReturnSignals({ businessDate, storeIds, storesById });
  const revenuePlanMilestones = (await evaluateCurrentEvotorRevenuePlanMilestones()).created;
  return { businessDate, ...freshness, returns, revenuePlanMilestones };
}

type ExpiryStage = "soon" | "today" | "expired";
const expiryStage = (daysUntilExpiration: number): ExpiryStage => daysUntilExpiration < 0 ? "expired" : daysUntilExpiration === 0 ? "today" : "soon";
const expirySeverity = (stage: ExpiryStage) => stage === "expired" ? "critical" as const : "warning" as const;
const expiryPhrase = (daysUntilExpiration: number) => daysUntilExpiration < 0
  ? `срок истек ${Math.abs(daysUntilExpiration)} дн. назад`
  : daysUntilExpiration === 0 ? "срок годности сегодня" : `осталось ${daysUntilExpiration} дн.`;

async function expirySignalOnce(input: { storeId: number; key: string; stage: ExpiryStage; title: string; message: string }) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db.select({ id: auditNotifications.id }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key), isNull(auditNotifications.resolvedAt))).limit(1);
  if (existing) return false;
  const result = await createExpirySignalNotifications({
    storeIds: [input.storeId], severity: expirySeverity(input.stage), title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

async function warehouseExpirySignalOnce(input: { key: string; stage: ExpiryStage; title: string; message: string }) {
  const db = await getDb();
  if (!db) return false;
  const [existing] = await db.select({ id: auditNotifications.id }).from(auditNotifications)
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key), isNull(auditNotifications.resolvedAt))).limit(1);
  if (existing) return false;
  const result = await createWarehouseExpirySignalNotifications({
    severity: expirySeverity(input.stage), title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

/** At 09:05 MSK group explicit 1С lots by shop/warehouse and expiry date; absence stays unknown. */
async function evaluateExpirySignals(businessDate: string) {
  const { shipmentFindings, warehouseFindings } = await listOperationalExpiryFindings({ businessDate, lookbackDays: 14, alertDays: 7 });
  const groupedShipments = new Map<string, typeof shipmentFindings>();
  for (const finding of shipmentFindings) {
    const stage = expiryStage(finding.daysUntilExpiration);
    const key = `${finding.storeId}:${finding.expirationDate}:${stage}`;
    groupedShipments.set(key, [...(groupedShipments.get(key) ?? []), finding]);
  }
  let shops = 0;
  for (const [groupKey, findings] of Array.from(groupedShipments.entries())) {
    const sample = findings[0]!;
    const stage = expiryStage(sample.daysUntilExpiration);
    const base = `expiry_shipment:${sample.storeId}:${sample.expirationDate}`;
    await resolveOperationalSignalNotifications((["soon", "today", "expired"] as ExpiryStage[]).filter(candidate => candidate !== stage).map(candidate => `${base}:${candidate}`));
    const products = findings.slice(0, 3).map(finding => finding.productName ?? "Позиция из накладной").join("; ");
    const tail = findings.length > 3 ? ` и еще ${findings.length - 3}` : "";
    if (await expirySignalOnce({
      storeId: sample.storeId, key: `${base}:${stage}`, stage,
      title: stage === "expired" ? "Просроченная партия в магазине" : "Контроль срока годности",
      message: `${sample.storeName}: ${findings.length} поз. из накладных 1С — ${expiryPhrase(sample.daysUntilExpiration)} (${sample.expirationDate}). ${products}${tail}.`,
    })) shops += 1;
  }
  const groupedWarehouses = new Map<string, typeof warehouseFindings>();
  for (const finding of warehouseFindings) {
    const stage = expiryStage(finding.daysUntilExpiration);
    const key = `${finding.warehouseCode}:${finding.expirationDate}:${stage}`;
    groupedWarehouses.set(key, [...(groupedWarehouses.get(key) ?? []), finding]);
  }
  let warehouses = 0;
  for (const [, findings] of Array.from(groupedWarehouses.entries())) {
    const sample = findings[0]!;
    const stage = expiryStage(sample.daysUntilExpiration);
    const base = `expiry_warehouse:${sample.warehouseCode}:${sample.expirationDate}`;
    await resolveOperationalSignalNotifications((["soon", "today", "expired"] as ExpiryStage[]).filter(candidate => candidate !== stage).map(candidate => `${base}:${candidate}`));
    const products = findings.slice(0, 3).map(finding => finding.productName ?? "Позиция из среза").join("; ");
    const tail = findings.length > 3 ? ` и еще ${findings.length - 3}` : "";
    if (await warehouseExpirySignalOnce({
      key: `${base}:${stage}`, stage,
      title: stage === "expired" ? `Просроченная партия на складе ${sample.warehouseCode}` : `Контроль срока годности · ${sample.warehouseCode}`,
      message: `${sample.warehouseCode}: ${findings.length} поз. в последнем срезе 1С — ${expiryPhrase(sample.daysUntilExpiration)} (${sample.expirationDate}). ${products}${tail}.`,
    })) warehouses += 1;
  }
  return { shops, warehouses };
}

/** Runs inside the existing platform-managed one-minute documents callback. */
export async function evaluateOperationalStoreSignals() {
  const { businessDate, minutes } = moscowNow();
  const expiry = minutes === 9 * 60 + 5 ? await evaluateExpirySignals(businessDate) : { shops: 0, warehouses: 0 };
  const db = await getDb();
  if (!db) return { businessDate, expiry, receiptFreshness: 0, stockFreshness: 0, returns: 0, requests: 0, revenue: 0, stockCoverage: 0 };
  const visibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false));
  if (!visibleStores.length) return { businessDate, expiry, receiptFreshness: 0, stockFreshness: 0, returns: 0, requests: 0, revenue: 0, stockCoverage: 0 };
  const storeIds = visibleStores.map(store => store.id);
  const mappedRows = await db.select({ storeId: operationalStoreMappings.storeId }).from(operationalStoreMappings)
    .where(inArray(operationalStoreMappings.storeId, storeIds));
  const mappedStoreIds = Array.from(new Set(mappedRows.map(row => row.storeId)));
  const freshness = await evaluateEvotorFreshnessSignals({
    now: new Date(), businessDate, storeIds: mappedStoreIds,
    storesById: new Map(visibleStores.map(store => [store.id, store.name])),
  });
  const returns = await evaluateEvotorReturnSignals({ businessDate, storeIds: mappedStoreIds, storesById: new Map(visibleStores.map(store => [store.id, store.name])) });
  // Do not generate late-day operational deadline events before the agreed Moscow cut-offs.
  if (minutes < 20 * 60 + 5) return { businessDate, expiry, ...freshness, returns, requests: 0, revenue: 0, stockCoverage: 0 };
  const requests = await db.select({ storeId: operationalStoreRequests.storeId }).from(operationalStoreRequests)
    .where(and(eq(operationalStoreRequests.businessDate, businessDate), inArray(operationalStoreRequests.storeId, storeIds)));
  const requested = new Set(requests.map(row => row.storeId));
  await resolveOperationalSignalNotifications(Array.from(requested, storeId => `request_missing:${storeId}:${businessDate}`));
  let requestSignals = 0;
  for (const store of visibleStores) {
    if (requested.has(store.id)) continue;
    if (await signalOnce({ storeId: store.id, key: `request_missing:${store.id}:${businessDate}`, severity: "warning", title: "Заявка магазина не создана", message: `${store.name}: к 20:05 по Москве заявка на ${businessDate} не создана.` })) requestSignals += 1;
  }
  const coverageFindings = await listOperationalExcessStockCoverage({ storeIds, businessDate });
  const findingsByStore = new Map<number, typeof coverageFindings>();
  for (const finding of coverageFindings) findingsByStore.set(finding.storeId, [...(findingsByStore.get(finding.storeId) ?? []), finding]);
  let stockCoverageSignals = 0;
  for (const store of visibleStores) {
    const findings = findingsByStore.get(store.id) ?? [];
    const key = `overstock_cover:${store.id}:${businessDate}`;
    if (!findings.length) {
      await resolveOperationalSignalNotifications([key]);
      continue;
    }
    const samples = findings.slice(0, 3).map(finding => `${finding.productName} — ${finding.coverageDays} дн.`).join("; ");
    if (await stockCoverSignalOnce({
      storeId: store.id,
      key,
      title: "Избыточный запас магазина",
      message: `${store.name}: ${findings.length} поз. выше согласованного покрытия. ${samples} Проверьте «Остатки».`,
    })) stockCoverageSignals += 1;
  }
  if (minutes < 21 * 60 + 5) return { businessDate, expiry, ...freshness, returns, requests: requestSignals, revenue: 0, stockCoverage: stockCoverageSignals };
  const revenue = await db.select({ storeId: operationalRevenueRecords.storeId }).from(operationalRevenueRecords)
    .where(and(eq(operationalRevenueRecords.businessDate, businessDate), eq(operationalRevenueRecords.isVoided, false), inArray(operationalRevenueRecords.storeId, storeIds)));
  const submitted = new Set(revenue.map(row => row.storeId));
  await resolveOperationalSignalNotifications(Array.from(submitted, storeId => `revenue_missing:${storeId}:${businessDate}`));
  let revenueSignals = 0;
  for (const store of visibleStores) {
    if (submitted.has(store.id)) continue;
    if (await signalOnce({ storeId: store.id, key: `revenue_missing:${store.id}:${businessDate}`, severity: "critical", title: "Выручка магазина не передана", message: `${store.name}: к 21:05 по Москве реестр выручки за ${businessDate} не передан.` })) revenueSignals += 1;
  }
  return { businessDate, expiry, ...freshness, returns, requests: requestSignals, revenue: revenueSignals, stockCoverage: stockCoverageSignals };
}
