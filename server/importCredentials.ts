import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { importCredentialSettings } from "../drizzle/schema";
import { getDb } from "./db";

const SETTINGS_KEY = "default";
const CIPHER_VERSION = "v1";

export type ImportWorkbookCredentials = {
  workbookPassword?: string;
  unprotectPassword?: string;
};

const encryptionKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Не настроен ключ защиты конфигурации импорта");
  return createHash("sha256").update(`${secret}:audit-import-passwords`).digest();
};

export function encryptImportCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${CIPHER_VERSION}.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptImportCredential(payload: string) {
  const [version, ivValue, tagValue, ciphertextValue] = payload.split(".");
  if (version !== CIPHER_VERSION || !ivValue || !tagValue || !ciphertextValue) throw new Error("Не удалось прочитать защищенную конфигурацию импорта");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

async function currentSettings() {
  const db = await getDb();
  if (!db) return null;
  const [settings] = await db.select().from(importCredentialSettings).where(eq(importCredentialSettings.settingsKey, SETTINGS_KEY)).limit(1);
  return settings ?? null;
}

export async function getImportCredentialStatus() {
  const settings = await currentSettings();
  return {
    workbookPasswordConfigured: Boolean(settings?.openPasswordCiphertext || process.env.IMPORT_WORKBOOK_OPEN_PASSWORD),
    unprotectPasswordConfigured: Boolean(settings?.unprotectPasswordCiphertext || process.env.IMPORT_SHEET_UNPROTECT_PASSWORD),
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function resolveImportCredentials(): Promise<ImportWorkbookCredentials> {
  const settings = await currentSettings();
  return {
    workbookPassword: settings?.openPasswordCiphertext ? decryptImportCredential(settings.openPasswordCiphertext) : process.env.IMPORT_WORKBOOK_OPEN_PASSWORD,
    unprotectPassword: settings?.unprotectPasswordCiphertext ? decryptImportCredential(settings.unprotectPasswordCiphertext) : process.env.IMPORT_SHEET_UNPROTECT_PASSWORD,
  };
}

export async function updateImportCredentials(input: { workbookPassword?: string; unprotectPassword?: string }) {
  if (!input.workbookPassword && !input.unprotectPassword) throw new Error("Введите хотя бы один пароль для сохранения");
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const previous = await currentSettings();
  const values = {
    settingsKey: SETTINGS_KEY,
    openPasswordCiphertext: input.workbookPassword ? encryptImportCredential(input.workbookPassword) : previous?.openPasswordCiphertext ?? null,
    unprotectPasswordCiphertext: input.unprotectPassword ? encryptImportCredential(input.unprotectPassword) : previous?.unprotectPasswordCiphertext ?? null,
  };
  await db.insert(importCredentialSettings).values(values).onDuplicateKeyUpdate({ set: { openPasswordCiphertext: values.openPasswordCiphertext, unprotectPasswordCiphertext: values.unprotectPasswordCiphertext } });
  return getImportCredentialStatus();
}
