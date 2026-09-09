import { desc, eq } from "drizzle-orm";
import { auditNotifications } from "../drizzle/schema";
import { getDb } from "./db";
import { getAlertRecipients } from "./accessControl";

export type NotificationSeverity = "critical" | "warning" | "info";

export function evaluateMetricAlert(metricCode: string, previousAmount: number, nextAmount: number) {
  const delta = nextAmount - previousAmount;
  const relativeChange = previousAmount === 0 ? (nextAmount === 0 ? 0 : Infinity) : Math.abs(delta / previousAmount);
  if (metricCode === "net_profit" && nextAmount < 0) {
    return { severity: "critical" as const, reason: "чистая прибыль стала отрицательной", delta, relativeChange };
  }
  const threshold = metricCode === "revenue" ? 100000 : metricCode === "net_profit" ? 50000 : metricCode === "writeoff_frozen" ? 25000 : Infinity;
  if (Math.abs(delta) >= threshold && relativeChange >= 0.25) {
    return { severity: metricCode === "writeoff_frozen" ? "critical" as const : "warning" as const, reason: "изменение превысило 25% и абсолютный порог контроля", delta, relativeChange };
  }
  return null;
}

export async function createNotifications(input: { accountIds: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string }) {
  const db = await getDb();
  if (!db || !input.accountIds.length) return { created: 0 };
  await db.insert(auditNotifications).values(input.accountIds.map(accountId => ({ ...input, accountId, entityType: input.entityType ?? null, entityId: input.entityId ?? null })));
  return { created: input.accountIds.length };
}

export async function createStoreEventNotifications(input: { storeIds?: number[]; severity: NotificationSeverity; title: string; message: string; entityType?: string; entityId?: string }) {
  return createNotifications({ ...input, accountIds: await getAlertRecipients(input.storeIds) });
}

export async function listMyNotifications(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditNotifications).where(eq(auditNotifications.accountId, accountId)).orderBy(desc(auditNotifications.createdAt)).limit(100);
}

export async function markNotificationRead(accountId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [notification] = await db.select().from(auditNotifications).where(eq(auditNotifications.id, notificationId)).limit(1);
  if (!notification || notification.accountId !== accountId) throw new Error("Уведомление не найдено");
  await db.update(auditNotifications).set({ isRead: true }).where(eq(auditNotifications.id, notificationId));
  return { success: true };
}
