import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import webpush from "web-push";
import { auditNotifications, auditPushSubscriptions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getAlertRecipients, getDataFreshnessSignalRecipients, getDataFreshnessSignalRecipientsByStore, getExpirySignalRecipients, getOperationalSignalRecipients, getReturnSignalRecipients, getWarehouseExpirySignalRecipients } from "./accessControl";
import { getDb } from "./db";

export type NotificationSeverity = "critical" | "warning" | "info";
export type BrowserPushSubscription = { endpoint:string; keys:{p256dh:string;auth:string} };
const endpointHash=(endpoint:string)=>createHash("sha256").update(endpoint).digest("hex");
const pushConfigured=()=>Boolean(ENV.webPushPublicKey&&ENV.webPushPrivateKey&&ENV.webPushSubject);
/** A mobile endpoint must never hold a current-day Evotor callback open indefinitely. */
const PUSH_SOCKET_TIMEOUT_MS = 8_000;
const entityUrl=(entityType?:string,entityId?:string)=>entityType==="import"?"/import":entityType==="price"?"/price-control":entityType==="weekly_report"?"/reports":entityType==="metric"?"/manage":entityType==="store"?"/stores":entityType==="operational_signal"&&entityId?.startsWith("request_missing:")?"/requests":entityType==="operational_signal"&&entityId?.match(/^evotor_return:(\d+)$/)?`/evotor-sales/receipts?receipt=${entityId.split(":")[1]}`:entityType==="operational_signal"&&(entityId?.startsWith("overstock_cover:")||entityId?.startsWith("evotor_stock_freshness:"))?"/stock-control":entityType==="operational_signal"&&entityId?.startsWith("evotor_receipt_freshness:")?"/evotor-sales/receipts":entityType==="operational_signal"&&entityId?.startsWith("evotor_freshness_digest:")?"/notifications":entityType==="operational_signal"&&entityId?.startsWith("expiry_")?"/notifications":entityType==="operational_signal"?"/revenue":"/notifications";
export const shouldSendMobilePush=(input:{severity:NotificationSeverity;entityType?:string})=>input.severity==="critical"||input.entityType==="weekly_report"||input.entityType==="threshold"||input.entityType==="admin_broadcast";

export function evaluateMetricAlert(metricCode: string, previousAmount: number, nextAmount: number) {
  const delta = nextAmount - previousAmount;
  const relativeChange = previousAmount === 0 ? (nextAmount === 0 ? 0 : Infinity) : Math.abs(delta / previousAmount);
  if (metricCode === "net_profit" && nextAmount < 0) return { severity: "critical" as const, reason: "чистая прибыль стала отрицательной", delta, relativeChange };
  const threshold = metricCode === "revenue" ? 100000 : metricCode === "net_profit" ? 50000 : metricCode === "writeoff_frozen" ? 25000 : Infinity;
  if (Math.abs(delta) >= threshold && relativeChange >= 0.25) return { severity: metricCode === "writeoff_frozen" ? "critical" as const : "warning" as const, reason: "изменение превысило 25% и абсолютный порог контроля", delta, relativeChange };
  return null;
}

export async function getPushStatus(accountId:number){const db=await getDb();const rows=db?await db.select({id:auditPushSubscriptions.id}).from(auditPushSubscriptions).where(eq(auditPushSubscriptions.accountId,accountId)).limit(1):[];return {configured:pushConfigured(),enabled:rows.length>0,publicKey:pushConfigured()?ENV.webPushPublicKey:null};}
export async function savePushSubscription(accountId:number,subscription:BrowserPushSubscription){if(!pushConfigured())throw new Error("Телефонные уведомления еще не настроены в системе");if(!subscription.endpoint||!subscription.keys?.p256dh||!subscription.keys?.auth)throw new Error("Браузер не передал корректную подписку");const db=await getDb();if(!db)throw new Error("База данных недоступна");const hash=endpointHash(subscription.endpoint);await db.insert(auditPushSubscriptions).values({accountId,endpoint:subscription.endpoint,endpointHash:hash,p256dh:subscription.keys.p256dh,auth:subscription.keys.auth}).onDuplicateKeyUpdate({set:{accountId,p256dh:subscription.keys.p256dh,auth:subscription.keys.auth}});return {enabled:true};}
export async function removePushSubscription(accountId:number,endpoint?:string){const db=await getDb();if(!db)throw new Error("База данных недоступна");if(endpoint)await db.delete(auditPushSubscriptions).where(eq(auditPushSubscriptions.endpointHash,endpointHash(endpoint)));else await db.delete(auditPushSubscriptions).where(eq(auditPushSubscriptions.accountId,accountId));return {enabled:false};}

async function sendMobilePush(input:{accountIds:number[];severity:NotificationSeverity;title:string;message:string;entityType?:string;entityId?:string}){if(!pushConfigured()||!shouldSendMobilePush(input)||!input.accountIds.length)return {sent:0};const db=await getDb();if(!db)return {sent:0};webpush.setVapidDetails(ENV.webPushSubject,ENV.webPushPublicKey,ENV.webPushPrivateKey);const subscriptions=await db.select().from(auditPushSubscriptions).where(inArray(auditPushSubscriptions.accountId,input.accountIds));const icon="/manus-storage/retail-audit-pwa-192_b20e7f41.png";const payload=JSON.stringify({title:input.title,body:input.message,icon,badge:icon,data:{url:entityUrl(input.entityType,input.entityId),entityId:input.entityId??null}});const results=await Promise.allSettled(subscriptions.map(subscription=>webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload,{TTL:60,timeout:PUSH_SOCKET_TIMEOUT_MS})));const stale=subscriptions.filter((_,index)=>{const result=results[index];if(result?.status!=="rejected")return false;const status=(result.reason as {statusCode?:number}).statusCode;return status===404||status===410});if(stale.length)await db.delete(auditPushSubscriptions).where(inArray(auditPushSubscriptions.id,stale.map(row=>row.id)));return {sent:results.filter(row=>row.status==="fulfilled").length};}

export async function createNotifications(input: { accountIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string; sendMobilePush?: boolean }) {
  const db = await getDb();
  if (!db || !input.accountIds.length) return { created: 0 };
  const { sendMobilePush: shouldSendMobilePush = true, ...notification } = input;
  await db.insert(auditNotifications).values(notification.accountIds.map(accountId => ({ ...notification, accountId, entityType: notification.entityType ?? null, entityId: notification.entityId ?? null })));
  const push=shouldSendMobilePush ? await sendMobilePush(notification) : {sent:0};
  return { created: input.accountIds.length, pushSent:push.sent };
}
export async function createStoreEventNotifications(input: { storeIds?: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string }) {return createNotifications({ ...input, accountIds: await getAlertRecipients(input.storeIds) });}
/** Store sellers receive only operational deadline signals for their assigned store. */
export async function createOperationalSignalNotifications(input: { storeIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string }) {return createNotifications({ ...input, accountIds: await getOperationalSignalRecipients(input.storeIds) });}
/** Return links are permitted only to recipients of this exact non-financial event. */
export async function createReturnSignalNotifications(input: { storeIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string }) {return createNotifications({ ...input, accountIds: await getReturnSignalRecipients(input.storeIds) });}
/** Stock-cover control is reviewed by the administrative operating contour, never broadcast to sellers. */
export async function createStockCoverSignalNotifications(input: { storeIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string }) {return createStoreEventNotifications(input);}
/** Data freshness belongs to the assigned store and operating managers, not to a generic broadcast. */
export async function createDataFreshnessSignalNotifications(input: { storeIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string; sendMobilePush?: boolean }) {return createNotifications({ ...input, accountIds: await getDataFreshnessSignalRecipients(input.storeIds) });}
export type DataFreshnessSignalInput = { storeId:number; severity:NotificationSeverity; title:string; message:string; entityId:string };
/** Persists all missing store signals in one insert; the caller decides whether one digest push is warranted. */
export async function createDataFreshnessSignalNotificationsBatch(items:DataFreshnessSignalInput[]) {
  const db = await getDb();
  if (!db || !items.length) return {created:0, accountIds:[] as number[]};
  const recipientsByStore = await getDataFreshnessSignalRecipientsByStore(items.map(item => item.storeId));
  const accountIds = new Set<number>();
  const rows = items.flatMap(item => (recipientsByStore.get(item.storeId) ?? []).map(accountId => {
    accountIds.add(accountId);
    return { accountId, severity:item.severity, title:item.title, message:item.message, entityType:"operational_signal" as const, entityId:item.entityId };
  }));
  if (rows.length) await db.insert(auditNotifications).values(rows);
  return {created:rows.length, accountIds:Array.from(accountIds)};
}
/** The current-day sweep may create many store-specific in-app signals at once; one generic mobile digest keeps that callback bounded. */
export async function sendDataFreshnessMobileDigest(input:{accountIds:number[]; businessDate:string}) {return sendMobilePush({accountIds:input.accountIds,severity:"critical",title:"Эвотор: требуется проверка данных",message:"Есть новые сигналы свежести. Откройте уведомления для своего магазина.",entityType:"operational_signal",entityId:`evotor_freshness_digest:${input.businessDate}`});}
/** An expiring lot is actionable both by the shop and the responsible managers. */
export async function createExpirySignalNotifications(input: { storeIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string }) {return createNotifications({ ...input, accountIds: await getExpirySignalRecipients(input.storeIds) });}
/** Main warehouse expiry is reviewed by operational management without an invented shop destination. */
export async function createWarehouseExpirySignalNotifications(input: { severity: NotificationSeverity; title: string; message: string; entityType: "operational_signal"; entityId: string }) {return createNotifications({ ...input, accountIds: await getWarehouseExpirySignalRecipients() });}
/** Resolves, without deleting, previously issued operational deadline alerts. */
export async function resolveOperationalSignalNotifications(entityIds: string[]) {
  const db = await getDb();
  const uniqueIds = Array.from(new Set(entityIds));
  if (!db || !uniqueIds.length) return { resolved: 0 };
  const result = await db.update(auditNotifications).set({ isRead: true, resolvedAt: new Date() })
    .where(and(eq(auditNotifications.entityType, "operational_signal"), inArray(auditNotifications.entityId, uniqueIds), isNull(auditNotifications.resolvedAt)));
  return { resolved: Number(result[0]?.affectedRows ?? 0) };
}
export async function getNotificationSummary(accountId: number) {
  const db = await getDb();
  if (!db) return { unread: 0 };
  const [row] = await db.select({ unread: count() }).from(auditNotifications).where(and(eq(auditNotifications.accountId, accountId), eq(auditNotifications.isRead, false)));
  return { unread: Number(row?.unread ?? 0) };
}

export async function listMyNotifications(accountId: number, input: { limit?: number; cursor?: number } = {}) {
  const db = await getDb();
  if (!db) return { items: [], nextCursor: null as number | null };
  const limit = Math.min(Math.max(input.limit ?? 50, 10), 100);
  const conditions = input.cursor ? and(eq(auditNotifications.accountId, accountId), lt(auditNotifications.id, input.cursor)) : eq(auditNotifications.accountId, accountId);
  const rows = await db.select().from(auditNotifications).where(conditions).orderBy(desc(auditNotifications.id)).limit(limit + 1);
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null };
}
/** A non-admin may open a detailed import alert only when that exact alert was delivered to the account. */
export async function hasNotificationEntityAccess(accountId:number,entityType:string,entityId:string){const db=await getDb();if(!db)return false;const [row]=await db.select({id:auditNotifications.id}).from(auditNotifications).where(and(eq(auditNotifications.accountId,accountId),eq(auditNotifications.entityType,entityType),eq(auditNotifications.entityId,entityId))).limit(1);return Boolean(row);}
export async function markNotificationRead(accountId: number, notificationId: number) {const db = await getDb();if (!db) throw new Error("База данных недоступна");const [notification] = await db.select().from(auditNotifications).where(eq(auditNotifications.id, notificationId)).limit(1);if (!notification || notification.accountId !== accountId) throw new Error("Уведомление не найдено");await db.update(auditNotifications).set({ isRead: true }).where(eq(auditNotifications.id, notificationId));return { success: true };}
export async function markAllNotificationsRead(accountId: number) {const db = await getDb();if (!db) throw new Error("База данных недоступна");await db.update(auditNotifications).set({ isRead: true }).where(and(eq(auditNotifications.accountId, accountId), eq(auditNotifications.isRead, false)));return { success: true };}
