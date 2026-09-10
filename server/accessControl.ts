import { and, eq, inArray } from "drizzle-orm";
import { localAccounts, storeAccess } from "../drizzle/schema";
import { getDb } from "./db";
import { getLocalAccountByOpenId } from "./localAuth";

export type StoreAccessLevel = "view" | "edit";
export type ImportAccessLevel = "none" | "upload" | "edit";

export function isAccessLevelAllowed(granted: StoreAccessLevel | undefined, required: StoreAccessLevel) {
  return granted === "edit" || (granted === "view" && required === "view");
}

export function isImportAccessAllowed(granted: ImportAccessLevel | undefined, required: Exclude<ImportAccessLevel, "none">) {
  return granted === "edit" || (granted === "upload" && required === "upload");
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
  if (account.role === "admin") return true;
  return isImportAccessAllowed(account.importAccessLevel, required);
}

/** Importing a workbook and viewing its financial control preview are separate permissions. */
export async function hasImportControlAccess(openId: string | null | undefined) {
  const account = await getCurrentLocalAccount(openId);
  return Boolean(account && (account.role === "admin" || account.canViewImportControls));
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
    const grants = await db.select({ accountId: storeAccess.accountId }).from(storeAccess).where(inArray(storeAccess.storeId, storeIds));
    grants.forEach(grant => recipients.add(grant.accountId));
  }
  return Array.from(recipients);
}
