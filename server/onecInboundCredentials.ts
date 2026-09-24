import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { auditChangeLog, operationalOnecInboundCredentials } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const CREDENTIAL_KEY = "onec_inbound_json_v1";
const ALGORITHM = "aes-256-gcm";
type StoredCredential = typeof operationalOnecInboundCredentials.$inferSelect;

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("Не настроен серверный ключ защиты входящего обмена 1С.");
  return createHash("sha256").update(`retail-audit:onec-inbound:v1:${ENV.cookieSecret}`).digest();
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
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
    throw new Error("Сохранённый ключ входящего обмена 1С не удалось безопасно прочитать. Замените его в «Импорте 1С».");
  }
}

function normalizedReplacement(value: string) {
  const key = value.trim();
  if (key.length < 24 || key.length > 4096) throw new Error("Ключ 1С должен содержать от 24 до 4096 символов.");
  return key;
}

async function storedCredential() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select().from(operationalOnecInboundCredentials)
    .where(eq(operationalOnecInboundCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
  return row ?? null;
}

/** Never returns plaintext, ciphertext, IV, tag or fingerprint. */
export async function getOnecInboundCredentialStatus() {
  const saved = await storedCredential();
  return { configured: Boolean(saved), updatedAt: saved?.updatedAt ?? null, lastAcceptedAt: saved?.lastAcceptedAt ?? null };
}

/** Returned only by the explicit admin reveal command; the value is not audited or logged. */
export async function revealOnecInboundCredential() {
  const saved = await storedCredential();
  if (!saved) throw new Error("Ключ входящего обмена 1С ещё не задан.");
  return decryptToken(saved);
}

/** Rotates the endpoint key atomically with a redacted audit entry. */
export async function replaceOnecInboundCredential(value: string, actorId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const encrypted = encryptToken(normalizedReplacement(value));
  const now = new Date();
  await db.transaction(async tx => {
    const [before] = await tx.select({ id: operationalOnecInboundCredentials.id })
      .from(operationalOnecInboundCredentials)
      .where(eq(operationalOnecInboundCredentials.credentialKey, CREDENTIAL_KEY)).limit(1);
    if (before) {
      await tx.update(operationalOnecInboundCredentials).set({ ...encrypted, updatedByAccountId: actorId })
        .where(eq(operationalOnecInboundCredentials.id, before.id));
    } else {
      await tx.insert(operationalOnecInboundCredentials).values({ credentialKey: CREDENTIAL_KEY, ...encrypted, updatedByAccountId: actorId });
    }
    await tx.insert(auditChangeLog).values({
      actorId,
      action: "operational_onec.inbound_credential.replace",
      entityType: "operational_onec_inbound_credential",
      entityId: CREDENTIAL_KEY,
      beforeState: { configured: Boolean(before) },
      afterState: { configured: true, rotatedAt: now.toISOString() },
    });
  });
  return { configured: true };
}

/** Validates the opaque `X-1C-Key` request header without logging or exposing it. */
export async function authorizeOnecInboundKey(presented: string | undefined) {
  const saved = await storedCredential();
  if (!saved || !presented) return null;
  const expected = Buffer.from(decryptToken(saved), "utf8");
  const received = Buffer.from(presented.trim(), "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  return { credentialId: saved.id, actorId: saved.updatedByAccountId };
}

/** Recorded only after a fully accepted or idempotently recognised package. */
export async function markOnecInboundAccepted(credentialId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await db.update(operationalOnecInboundCredentials).set({ lastAcceptedAt: new Date() })
    .where(eq(operationalOnecInboundCredentials.id, credentialId));
}

export const __onecInboundCredentialInternals = { CREDENTIAL_KEY, normalizedReplacement, encryptToken, decryptToken };
