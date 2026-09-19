import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { auditChangeLog, operationalEvotorCredentials } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const CREDENTIAL_KEY = "evotor_cloud_api_v2";
const ALGORITHM = "aes-256-gcm";

type StoredCredential = typeof operationalEvotorCredentials.$inferSelect;

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("Не настроен серверный ключ защиты доступа Эвотор.");
  return createHash("sha256").update(`retail-audit:evotor-token:v1:${ENV.cookieSecret}`).digest();
}

function tokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function encryptToken(token: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    encryptedToken: encrypted.toString("base64url"),
    initializationVector: initializationVector.toString("base64url"),
    authenticationTag: cipher.getAuthTag().toString("base64url"),
    fingerprint: tokenFingerprint(token),
  };
}

function decryptToken(credential: Pick<StoredCredential, "encryptedToken" | "initializationVector" | "authenticationTag">) {
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(credential.initializationVector, "base64url"));
    decipher.setAuthTag(Buffer.from(credential.authenticationTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(credential.encryptedToken, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Сохраненный ключ Эвотор не удалось безопасно прочитать. Замените его в разделе «Доступ».");
  }
}

function environmentToken() {
  return process.env.EVOTOR_API_TOKEN?.trim() || null;
}

async function storedCredential() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select().from(operationalEvotorCredentials)
    .where(eq(operationalEvotorCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
  return row ?? null;
}

/** The only server-side source for the outbound read-only Evotor Bearer credential. */
export async function getEvotorApiToken() {
  const saved = await storedCredential();
  if (saved) return decryptToken(saved);
  const token = environmentToken();
  if (!token) throw new Error("Не настроен серверный доступ Эвотор.");
  return token;
}

/** Status intentionally never returns a token, ciphertext, IV, tag or fingerprint. */
export async function getEvotorCredentialStatus() {
  const saved = await storedCredential();
  const fallbackConfigured = Boolean(environmentToken());
  return {
    configured: Boolean(saved || fallbackConfigured),
    source: saved ? "managed" as const : fallbackConfigured ? "environment" as const : "none" as const,
    updatedAt: saved?.updatedAt ?? null,
  };
}

function normalizedReplacement(token: string) {
  const value = token.trim();
  if (value.length < 16 || value.length > 4096) throw new Error("Введите корректный ключ Эвотор.");
  return value;
}

/** Replaces the managed server override and writes a redacted audit event atomically. */
export async function replaceEvotorApiToken(token: string, actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const next = normalizedReplacement(token);
  const encrypted = encryptToken(next);
  const now = new Date();

  await db.transaction(async tx => {
    const [before] = await tx.select({ id: operationalEvotorCredentials.id })
      .from(operationalEvotorCredentials)
      .where(eq(operationalEvotorCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
    if (before) {
      await tx.update(operationalEvotorCredentials)
        .set({ ...encrypted, updatedByAccountId: actorId })
        .where(eq(operationalEvotorCredentials.id, before.id));
    } else {
      await tx.insert(operationalEvotorCredentials).values({ credentialKey: CREDENTIAL_KEY, ...encrypted, updatedByAccountId: actorId });
    }
    // Never add token, ciphertext, IV, tag or fingerprint to audit JSON.
    await tx.insert(auditChangeLog).values({
      actorId,
      action: "evotor_credential.replace",
      entityType: "evotor_credential",
      entityId: CREDENTIAL_KEY,
      beforeState: { configured: Boolean(before), source: before ? "managed" : environmentToken() ? "environment" : "none" },
      afterState: { configured: true, source: "managed", rotatedAt: now.toISOString() },
    });
  });
  return { configured: true, source: "managed" as const };
}

export const __evotorCredentialInternals = { CREDENTIAL_KEY, encryptToken, decryptToken, normalizedReplacement };
