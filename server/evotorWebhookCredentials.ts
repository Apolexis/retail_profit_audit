import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { auditChangeLog, operationalEvotorCloudUserTokens, operationalEvotorCredentials, operationalEvotorWebhookUsers } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const CREDENTIAL_KEY = "evotor_v2_webhook_application_token";
const ALGORITHM = "aes-256-gcm";
type StoredCredential = typeof operationalEvotorCredentials.$inferSelect;

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("Не настроен серверный ключ защиты webhook Эвотор.");
  return createHash("sha256").update(`retail-audit:evotor-webhook:v1:${ENV.cookieSecret}`).digest();
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeToken(value: string) {
  const token = value.trim();
  if (token.length < 16 || token.length > 4096) throw new Error("Токен webhook Эвотор должен содержать от 16 до 4096 символов.");
  return token;
}

function encryptToken(value: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encryptedToken: encrypted.toString("base64url"),
    initializationVector: initializationVector.toString("base64url"),
    authenticationTag: cipher.getAuthTag().toString("base64url"),
    fingerprint: fingerprint(value),
  };
}

function decryptToken(credential: Pick<StoredCredential, "encryptedToken" | "initializationVector" | "authenticationTag">) {
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(credential.initializationVector, "base64url"));
    decipher.setAuthTag(Buffer.from(credential.authenticationTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(credential.encryptedToken, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Сохранённый токен webhook Эвотор не удалось безопасно прочитать. Замените его в разделе «Доступ»." );
  }
}

async function storedCredential() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select().from(operationalEvotorCredentials)
    .where(eq(operationalEvotorCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
  return row ?? null;
}

/** Ordinary status never returns the token, ciphertext, IV, tag or fingerprint. */
export async function getEvotorWebhookCredentialStatus() {
  const saved = await storedCredential();
  return { configured: Boolean(saved), updatedAt: saved?.updatedAt ?? null };
}

/** Returned only after an explicit administrator command; never recorded in audit data. */
export async function revealEvotorWebhookCredential() {
  const saved = await storedCredential();
  if (!saved) throw new Error("Токен webhook Эвотор ещё не задан.");
  return decryptToken(saved);
}

/**
 * Replaces the integration-level application token for V2 "Отправить чек".
 * V1 terminal documents require their own per-user token issued by the
 * documented user create/verify handshake and never use this credential.
 */
export async function replaceEvotorWebhookCredential(value: string, actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const encrypted = encryptToken(normalizeToken(value));
  const now = new Date();
  await db.transaction(async tx => {
    const [before] = await tx.select({ id: operationalEvotorCredentials.id })
      .from(operationalEvotorCredentials).where(eq(operationalEvotorCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
    if (before) {
      await tx.update(operationalEvotorCredentials).set({ ...encrypted, updatedByAccountId: actorId })
        .where(eq(operationalEvotorCredentials.id, before.id));
    } else {
      await tx.insert(operationalEvotorCredentials).values({ credentialKey: CREDENTIAL_KEY, ...encrypted, updatedByAccountId: actorId });
    }
    // The token and every representation of it stay out of the audit log.
    await tx.insert(auditChangeLog).values({
      actorId,
      action: "evotor_webhook_credential.replace",
      entityType: "evotor_webhook_credential",
      entityId: CREDENTIAL_KEY,
      beforeState: { configured: Boolean(before) },
      afterState: { configured: true, rotatedAt: now.toISOString() },
    });
  });
  return { configured: true };
}

/** Constant-time verification of the external Authorization header; nothing is logged or revealed. */
export async function authorizeEvotorWebhook(presented: string | undefined) {
  const saved = await storedCredential();
  if (!saved || !presented) return false;
  const expected = Buffer.from(decryptToken(saved), "utf8");
  const normalizedHeader = presented.trim().replace(/^(Bearer|Basic)\s+/i, "");
  const received = Buffer.from(normalizedHeader, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function normalizePresentedToken(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/^(Bearer|Basic)\s+/i, "");
  return normalized.length >= 16 && normalized.length <= 4096 ? normalized : null;
}

function normalizeEvotorUserId(value: unknown) {
  if (typeof value !== "string") return null;
  const userId = value.trim();
  return userId.length >= 3 && userId.length <= 96 ? userId : null;
}

/** Issues a fresh, opaque V1 user token after Cloud has authenticated by application token. */
export async function issueEvotorWebhookUserToken(evotorUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const token = randomBytes(32).toString("base64url");
  const tokenFingerprint = fingerprint(token);
  const now = new Date();
  const [existing] = await db.select({ id: operationalEvotorWebhookUsers.id })
    .from(operationalEvotorWebhookUsers)
    .where(eq(operationalEvotorWebhookUsers.evotorUserId, evotorUserId))
    .limit(1);
  if (existing) {
    await db.update(operationalEvotorWebhookUsers)
      .set({ tokenFingerprint, lastAuthorizedAt: now })
      .where(eq(operationalEvotorWebhookUsers.id, existing.id));
  } else {
    await db.insert(operationalEvotorWebhookUsers).values({ evotorUserId, tokenFingerprint, lastAuthorizedAt: now });
  }
  return { userId: evotorUserId, token };
}

/**
 * Accepts the separate V1 Cloud token posted after an app installation. It is
 * never a substitute for the token issued by create/verify and is retained only
 * encrypted for future Cloud calls on behalf of this Evotor user.
 */
export async function storeEvotorCloudUserToken(evotorUserId: string, tokenValue: string) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const userId = normalizeEvotorUserId(evotorUserId);
  if (!userId) throw new Error("Не передан корректный userId Эвотор.");
  const encrypted = encryptToken(normalizeToken(tokenValue));
  const now = new Date();
  const [existing] = await db.select({ id: operationalEvotorCloudUserTokens.id })
    .from(operationalEvotorCloudUserTokens)
    .where(eq(operationalEvotorCloudUserTokens.evotorUserId, userId))
    .limit(1);
  if (existing) {
    await db.update(operationalEvotorCloudUserTokens)
      .set({ ...encrypted, receivedAt: now })
      .where(eq(operationalEvotorCloudUserTokens.id, existing.id));
  } else {
    await db.insert(operationalEvotorCloudUserTokens).values({ evotorUserId: userId, ...encrypted, receivedAt: now });
  }
  return { accepted: true as const };
}

/** Verifies the per-user V1 token without retaining or revealing its plaintext. */
export async function authorizeEvotorWebhookUser(presented: string | undefined) {
  const token = normalizePresentedToken(presented);
  if (!token) return false;
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const tokenFingerprint = fingerprint(token);
  const [saved] = await db.select({ tokenFingerprint: operationalEvotorWebhookUsers.tokenFingerprint })
    .from(operationalEvotorWebhookUsers)
    .where(eq(operationalEvotorWebhookUsers.tokenFingerprint, tokenFingerprint))
    .limit(1);
  if (!saved) return false;
  const expected = Buffer.from(saved.tokenFingerprint, "utf8");
  const received = Buffer.from(tokenFingerprint, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const __evotorWebhookCredentialInternals = { CREDENTIAL_KEY, normalizeToken, encryptToken, decryptToken, normalizeEvotorUserId };
