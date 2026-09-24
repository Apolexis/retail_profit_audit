import { and, eq, inArray } from "drizzle-orm";
import { localAccounts, storeAccess } from "../drizzle/schema";
import { getDb } from "./db";
import { getLocalAccountByOpenId } from "./localAuth";

export type StoreAccessLevel = "view" | "edit";
export type ImportAccessLevel = "none" | "upload" | "edit";
export type PriceAccessLevel = "none" | "view" | "upload" | "edit";

export function isAccessLevelAllowed(granted: StoreAccessLevel | undefined, required: StoreAccessLevel) {
  return granted === "edit" || (granted === "view" && required === "view");
}

export function isImportAccessAllowed(granted: ImportAccessLevel | undefined, required: Exclude<ImportAccessLevel, "none">) {
  return granted === "edit" || (granted === "upload" && required === "upload");
}

export function isPriceAccessAllowed(granted: PriceAccessLevel | undefined, required: Exclude<PriceAccessLevel, "none">) {
  return granted === "edit" || granted === required || (granted === "upload" && required === "view");
}

export async function getCurrentLocalAccount(openId?: string | null) {
  return getLocalAccountByOpenId(openId);
}

export async function getAccessibleStoreIds(openId?: string | null): Promise<number[] | null> {
  const account = await getCurrentLocalAccount(openId);
  if (!account) return [];
  if (account.role === "admin") return null;
  const db = await getDb();
  if (!db) return [];
  const grants = await db.select({ storeId: storeAccess.storeId }).from(storeAccess).where(eq(storeAccess.accountId, account.id));
  return grants.map(grant => grant.storeId);
}

export async function hasStoreAccess(openId: string | null | undefined, storeId: number, required: StoreAccessLevel) {
  const account = await getCurrentLocalAccount(openId);
  if (!account) return false;
  if (account.role === "admin") return true;
  const db = await getDb();
  if (!db) return false;
  const [grant] = await db.select().from(storeAccess).where(and(eq(storeAccess.accountId, account.id), eq(storeAccess.storeId, storeId))).limit(1);
  return isAccessLevelAllowed(grant?.accessLevel, required);
}

export async function hasImportAccess(openId: string | null | undefined, required: Exclude<ImportAccessLevel, "none">) {
  const account = await getCurrentLocalAccount(openId);
  if (!account) return false;
  if (account.role === "seller" || account.role === "manager") return false;
  if (account.role === "admin") return true;
  return isImportAccessAllowed(account.importAccessLevel, required);
}

/** Price-list access is deliberately independent from financial workbook permissions. */
export async function hasPriceAccess(openId: string | null | undefined, required: Exclude<PriceAccessLevel, "none">) {
  const account = await getCurrentLocalAccount(openId);
  if (!account) return false;
  if (account.role === "seller" || account.role === "manager") return false;
  if (account.role === "admin") return true;
  return isPriceAccessAllowed(account.priceAccessLevel, required);
}

/** Importing a workbook and viewing its financial control preview are separate permissions. */
export async function hasImportControlAccess(openId: string | null | undefined) {
  const account = await getCurrentLocalAccount(openId);
  return Boolean(account && (account.role === "admin" || account.role === "analyst") && (account.role === "admin" || account.canViewImportControls));
}

/** Sellers work only with the isolated operating modules and never receive financial facts. */
export async function hasFinancialAccess(openId?: string | null) {
  const account = await getCurrentLocalAccount(openId);
  return Boolean(account && (account.role === "admin" || account.role === "analyst"));
}

export async function listAccountStoreAccess(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(storeAccess).where(eq(storeAccess.accountId, accountId));
}

export async function replaceAccountStoreAccess(accountId: number, grants: Array<{ storeId: number; accessLevel: StoreAccessLevel }>) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const unique = Array.from(new Map(grants.map(grant => [grant.storeId, grant])).values());
  const [account] = await db.select().from(localAccounts).where(eq(localAccounts.id, accountId)).limit(1);
  if (!account) throw new Error("Учетная запись не найдена");
  const before = await listAccountStoreAccess(accountId);
  await db.delete(storeAccess).where(eq(storeAccess.accountId, accountId));
  if (unique.length) await db.insert(storeAccess).values(unique.map(grant => ({ accountId, storeId: grant.storeId, accessLevel: grant.accessLevel })));
  return { before, after: unique };
}

export async function getAlertRecipients(storeIds?: number[]) {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select({ id: localAccounts.id }).from(localAccounts).where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  const recipients = new Set(admins.map(account => account.id));
  if (storeIds?.length) {
    const grants = await db.select({ accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess).innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id)).where(and(inArray(storeAccess.storeId, storeIds), eq(localAccounts.isActive, true)));
    grants.filter(grant => grant.role === "admin" || grant.role === "analyst").forEach(grant => recipients.add(grant.accountId));
  }
  return Array.from(recipients);
}

/**
 * Operational deadlines are addressed only to the assigned seller of the
 * store. They contain no P&L, import details or printing rights, and must not
 * become an administrative broadcast. Financial/threshold alerts deliberately
 * continue to use getAlertRecipients.
 */
export function isOperationalSignalRecipient(role: (typeof localAccounts.$inferSelect)["role"]) {
  return role === "seller";
}

export async function getOperationalSignalRecipients(storeIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (!storeIds.length) return [];
  const grants = await db.select({ accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess)
    .innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id))
    .where(and(inArray(storeAccess.storeId, storeIds), eq(localAccounts.isActive, true)));
  return Array.from(new Set(grants.filter(grant => isOperationalSignalRecipient(grant.role)).map(grant => grant.accountId)));
}

/** A return is an exact, non-financial operating event: shop, responsible manager and active administrators may open only that delivered return. */
export async function getReturnSignalRecipients(storeIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select({ id: localAccounts.id }).from(localAccounts)
    .where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  const recipients = new Set(admins.map(account => account.id));
  if (!storeIds.length) return Array.from(recipients);
  const grants = await db.select({ accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess)
    .innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id))
    .where(and(inArray(storeAccess.storeId, storeIds), eq(localAccounts.isActive, true)));
  grants.filter(grant => grant.role === "seller" || grant.role === "manager" || grant.role === "admin")
    .forEach(grant => recipients.add(grant.accountId));
  return Array.from(recipients);
}

/** Freshness of receipts and physical stock is actionable by a shop and its operating management. */
export async function getDataFreshnessSignalRecipients(storeIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select({ id: localAccounts.id }).from(localAccounts)
    .where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  const recipients = new Set(admins.map(account => account.id));
  if (!storeIds.length) return Array.from(recipients);
  const grants = await db.select({ accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess)
    .innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id))
    .where(and(inArray(storeAccess.storeId, storeIds), eq(localAccounts.isActive, true)));
  grants.filter(grant => grant.role === "seller" || grant.role === "manager" || grant.role === "admin")
    .forEach(grant => recipients.add(grant.accountId));
  return Array.from(recipients);
}

/** Returns the exact per-store audience in two bounded reads, for a whole freshness sweep. */
export async function getDataFreshnessSignalRecipientsByStore(storeIds: number[]) {
  const db = await getDb();
  const uniqueStoreIds = Array.from(new Set(storeIds));
  if (!db || !uniqueStoreIds.length) return new Map<number, number[]>();
  const admins = await db.select({ id: localAccounts.id }).from(localAccounts)
    .where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  const recipients = new Map(uniqueStoreIds.map(storeId => [storeId, new Set(admins.map(account => account.id))]));
  const grants = await db.select({ storeId: storeAccess.storeId, accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess)
    .innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id))
    .where(and(inArray(storeAccess.storeId, uniqueStoreIds), eq(localAccounts.isActive, true)));
  for (const grant of grants) {
    if (grant.role === "seller" || grant.role === "manager" || grant.role === "admin") recipients.get(grant.storeId)?.add(grant.accountId);
  }
  return new Map(Array.from(recipients, ([storeId, accountIds]) => [storeId, Array.from(accountIds)]));
}

/** Expiry risk is operational: notify the assigned shop and its managers, plus active administrators. */
export async function getExpirySignalRecipients(storeIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  const admins = await db.select({ id: localAccounts.id }).from(localAccounts)
    .where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  const recipients = new Set(admins.map(account => account.id));
  if (!storeIds.length) return Array.from(recipients);
  const grants = await db.select({ accountId: storeAccess.accountId, role: localAccounts.role }).from(storeAccess)
    .innerJoin(localAccounts, eq(storeAccess.accountId, localAccounts.id))
    .where(and(inArray(storeAccess.storeId, storeIds), eq(localAccounts.isActive, true)));
  grants.filter(grant => grant.role === "seller" || grant.role === "manager" || grant.role === "admin")
    .forEach(grant => recipients.add(grant.accountId));
  return Array.from(recipients);
}

/** Main-warehouse expiry has no shop recipient, so it remains with active management only. */
export async function getWarehouseExpirySignalRecipients() {
  const db = await getDb();
  if (!db) return [];
  const accounts = await db.select({ id: localAccounts.id }).from(localAccounts)
    .where(and(eq(localAccounts.isActive, true), inArray(localAccounts.role, ["admin", "manager"])));
  return accounts.map(account => account.id);
}

/** Recipients of price-control events are independent from store access. */
export async function getPriceAlertRecipients() {
  const db = await getDb();
  if (!db) return [];
  const accounts = await db
    .select({ id: localAccounts.id })
    .from(localAccounts)
    .where(
      and(
        eq(localAccounts.isActive, true),
        inArray(localAccounts.priceAccessLevel, ["view", "upload", "edit"])
      )
    );
  const admins = await db
    .select({ id: localAccounts.id })
    .from(localAccounts)
    .where(and(eq(localAccounts.role, "admin"), eq(localAccounts.isActive, true)));
  return Array.from(new Set([...accounts, ...admins].map(account => account.id)));
}
