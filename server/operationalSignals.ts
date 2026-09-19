import { and, eq, inArray } from "drizzle-orm";
import { auditNotifications, operationalRevenueRecords, operationalStoreRequests, stores } from "../drizzle/schema";
import { getDb } from "./db";
import { createStoreEventNotifications } from "./notifications";

/**
 * Small, idempotent operational control layer. It intentionally reads only the
 * operational registers and sends no data to Evotor. Signals are addressed to
 * administrators and authorized analysts, never to sellers or managers.
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
    .where(and(eq(auditNotifications.entityType, "operational_signal"), eq(auditNotifications.entityId, input.key))).limit(1);
  if (existing) return false;
  const result = await createStoreEventNotifications({
    storeIds: [input.storeId], severity: input.severity, title: input.title, message: input.message,
    entityType: "operational_signal", entityId: input.key,
  });
  return result.created > 0;
}

/** Runs inside the existing platform-managed one-minute documents callback. */
export async function evaluateOperationalStoreSignals() {
  const { businessDate, minutes } = moscowNow();
  // Do not generate late-day control events before the agreed Moscow cut-offs.
  if (minutes < 20 * 60 + 5) return { businessDate, requests: 0, revenue: 0 };
  const db = await getDb();
  if (!db) return { businessDate, requests: 0, revenue: 0 };
  const visibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false));
  if (!visibleStores.length) return { businessDate, requests: 0, revenue: 0 };
  const storeIds = visibleStores.map(store => store.id);
  const requests = await db.select({ storeId: operationalStoreRequests.storeId }).from(operationalStoreRequests)
    .where(and(eq(operationalStoreRequests.businessDate, businessDate), inArray(operationalStoreRequests.storeId, storeIds)));
  const requested = new Set(requests.map(row => row.storeId));
  let requestSignals = 0;
  for (const store of visibleStores) {
    if (requested.has(store.id)) continue;
    if (await signalOnce({ storeId: store.id, key: `request_missing:${store.id}:${businessDate}`, severity: "warning", title: "Заявка магазина не создана", message: `${store.name}: к 20:05 по Москве заявка на ${businessDate} не создана.` })) requestSignals += 1;
  }
  if (minutes < 21 * 60 + 5) return { businessDate, requests: requestSignals, revenue: 0 };
  const revenue = await db.select({ storeId: operationalRevenueRecords.storeId }).from(operationalRevenueRecords)
    .where(and(eq(operationalRevenueRecords.businessDate, businessDate), eq(operationalRevenueRecords.isVoided, false), inArray(operationalRevenueRecords.storeId, storeIds)));
  const submitted = new Set(revenue.map(row => row.storeId));
  let revenueSignals = 0;
  for (const store of visibleStores) {
    if (submitted.has(store.id)) continue;
    if (await signalOnce({ storeId: store.id, key: `revenue_missing:${store.id}:${businessDate}`, severity: "critical", title: "Выручка магазина не передана", message: `${store.name}: к 21:05 по Москве реестр выручки за ${businessDate} не передан.` })) revenueSignals += 1;
  }
  return { businessDate, requests: requestSignals, revenue: revenueSignals };
}
