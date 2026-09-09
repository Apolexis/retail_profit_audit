import { createHash } from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { auditNotifications, auditPushSubscriptions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getAlertRecipients } from "./accessControl";
import { getDb } from "./db";

export type NotificationSeverity = "critical" | "warning" | "info";
export type BrowserPushSubscription = { endpoint:string; keys:{p256dh:string;auth:string} };
const endpointHash=(endpoint:string)=>createHash("sha256").update(endpoint).digest("hex");
const pushConfigured=()=>Boolean(ENV.webPushPublicKey&&ENV.webPushPrivateKey&&ENV.webPushSubject);
const entityUrl=(entityType?:string)=>entityType==="import"?"/import":entityType==="weekly_report"?"/reports":entityType==="metric"?"/manage":entityType==="store"?"/stores":"/notifications";
export const shouldSendMobilePush=(input:{severity:NotificationSeverity;entityType?:string})=>input.severity==="critical"||input.entityType==="weekly_report"||input.entityType==="threshold";

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

async function sendMobilePush(input:{accountIds:number[];severity:NotificationSeverity;title:string;message:string;entityType?:string;entityId?:string}){if(!pushConfigured()||!shouldSendMobilePush(input)||!input.accountIds.length)return {sent:0};const db=await getDb();if(!db)return {sent:0};webpush.setVapidDetails(ENV.webPushSubject,ENV.webPushPublicKey,ENV.webPushPrivateKey);const subscriptions=await db.select().from(auditPushSubscriptions).where(inArray(auditPushSubscriptions.accountId,input.accountIds));const icon="/manus-storage/retail-audit-pwa-192_b20e7f41.png";const payload=JSON.stringify({title:input.title,body:input.message,icon,badge:icon,data:{url:entityUrl(input.entityType),entityId:input.entityId??null}});const results=await Promise.allSettled(subscriptions.map(subscription=>webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload)));const stale=subscriptions.filter((_,index)=>{const result=results[index];if(result?.status!=="rejected")return false;const status=(result.reason as {statusCode?:number}).statusCode;return status===404||status===410});if(stale.length)await db.delete(auditPushSubscriptions).where(inArray(auditPushSubscriptions.id,stale.map(row=>row.id)));return {sent:results.filter(row=>row.status==="fulfilled").length};}

export async function createNotifications(input: { accountIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string }) {
  const db = await getDb();
  if (!db || !input.accountIds.length) return { created: 0 };
  await db.insert(auditNotifications).values(input.accountIds.map(accountId => ({ ...input, accountId, entityType: input.entityType ?? null, entityId: input.entityId ?? null })));
  const push=await sendMobilePush(input);
  return { created: input.accountIds.length, pushSent:push.sent };
}
export async function createStoreEventNotifications(input: { storeIds?: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string }) {return createNotifications({ ...input, accountIds: await getAlertRecipients(input.storeIds) });}
export async function listMyNotifications(accountId: number) {const db = await getDb();if (!db) return [];return db.select().from(auditNotifications).where(eq(auditNotifications.accountId, accountId)).orderBy(desc(auditNotifications.createdAt)).limit(100);}
export async function markNotificationRead(accountId: number, notificationId: number) {const db = await getDb();if (!db) throw new Error("База данных недоступна");const [notification] = await db.select().from(auditNotifications).where(eq(auditNotifications.id, notificationId)).limit(1);if (!notification || notification.accountId !== accountId) throw new Error("Уведомление не найдено");await db.update(auditNotifications).set({ isRead: true }).where(eq(auditNotifications.id, notificationId));return { success: true };}
