import { createHash, randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { localAccounts, localPasskeyChallenges, localPasskeys } from "../drizzle/schema";
import { getDb } from "./db";
import { ensureCoreUserForPasskey, formatRussianPhone, normalizeRussianPhone, recordChange } from "./localAuth";

export const PASSKEY_ATTEMPT_COOKIE = "audit_passkey_attempt";
const CHALLENGE_MS = 1000 * 60 * 5;

type RequestLike = { protocol?: string; headers: Record<string, string | string[] | undefined> };

const headerValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function passkeyRelyingParty(req: RequestLike) {
  const browserOrigin = headerValue(req.headers.origin);
  if (browserOrigin) {
    try {
      const url = new URL(browserOrigin);
      const rpId = url.hostname;
      if (rpId) return { rpId, origin: url.origin };
    } catch {
      // Для невалидного Origin используем проверенный прокси-заголовок ниже.
    }
  }
  const forwardedHost = headerValue(req.headers["x-forwarded-host"]);
  const rawHost = (forwardedHost ?? headerValue(req.headers.host) ?? "").split(",")[0].trim();
  if (!rawHost) throw new Error("Не удалось определить адрес приложения для passkey");
  const rpId = rawHost.startsWith("[") ? rawHost.slice(1, rawHost.indexOf("]")) : rawHost.replace(/:\d+$/, "");
  const forwardedProto = headerValue(req.headers["x-forwarded-proto"]);
  const proto = (forwardedProto ?? req.protocol ?? (rpId === "localhost" ? "http" : "https")).split(",")[0].trim().toLowerCase();
  return { rpId, origin: `${proto}://${rawHost}` };
}

function attemptFromCookie(cookieHeader?: string) {
  return parseCookie(cookieHeader ?? "")[PASSKEY_ATTEMPT_COOKIE] ?? null;
}

async function saveChallenge(accountId: number, ceremony: "registration" | "authentication", challenge: string, req: RequestLike) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const attempt = randomBytes(32).toString("base64url");
  const { rpId, origin } = passkeyRelyingParty(req);
  await db.delete(localPasskeyChallenges).where(and(eq(localPasskeyChallenges.accountId, accountId), eq(localPasskeyChallenges.ceremony, ceremony)));
  await db.insert(localPasskeyChallenges).values({ attemptHash: tokenHash(attempt), accountId, ceremony, challenge, rpId, origin, expiresAt: new Date(Date.now() + CHALLENGE_MS) });
  return { attempt, expiresAt: new Date(Date.now() + CHALLENGE_MS) };
}

async function consumeChallenge(accountId: number | undefined, ceremony: "registration" | "authentication", cookieHeader?: string) {
  const attempt = attemptFromCookie(cookieHeader);
  if (!attempt) throw new Error("Срок подтверждения passkey истек. Начните заново.");
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const conditions = [eq(localPasskeyChallenges.attemptHash, tokenHash(attempt)), eq(localPasskeyChallenges.ceremony, ceremony), gt(localPasskeyChallenges.expiresAt, new Date())];
  if (typeof accountId === "number") conditions.push(eq(localPasskeyChallenges.accountId, accountId));
  const [challenge] = await db.select().from(localPasskeyChallenges).where(and(...conditions)).limit(1);
  await db.delete(localPasskeyChallenges).where(eq(localPasskeyChallenges.attemptHash, tokenHash(attempt)));
  if (!challenge) throw new Error("Срок подтверждения passkey истек. Начните заново.");
  return challenge;
}

export async function listAccountPasskeys(accountId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: localPasskeys.id, deviceType: localPasskeys.deviceType, backedUp: localPasskeys.backedUp, createdAt: localPasskeys.createdAt, lastUsedAt: localPasskeys.lastUsedAt }).from(localPasskeys).where(eq(localPasskeys.accountId, accountId));
}

export async function beginPasskeyRegistration(account: { id: number; username: string; displayName: string }, req: RequestLike) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const { rpId } = passkeyRelyingParty(req);
  const existing = await db.select().from(localPasskeys).where(eq(localPasskeys.accountId, account.id));
  const options = await generateRegistrationOptions({
    rpName: "Аналитика «Рыбный»",
    rpID: rpId,
    userID: new TextEncoder().encode(`audit:${account.id}`),
    userName: account.username,
    userDisplayName: account.displayName,
    attestationType: "none",
    excludeCredentials: existing.map(item => ({ id: item.credentialId, transports: Array.isArray(item.transports) ? item.transports.map(String) : undefined })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const ceremony = await saveChallenge(account.id, "registration", options.challenge, req);
  return { options, ...ceremony };
}

export async function finishPasskeyRegistration(account: { id: number }, response: RegistrationResponseJSON, cookieHeader?: string) {
  const challenge = await consumeChallenge(account.id, "registration", cookieHeader);
  const verification = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpId, requireUserVerification: true });
  if (!verification.verified || !verification.registrationInfo) throw new Error("Не удалось подтвердить passkey");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await db.insert(localPasskeys).values({ accountId: account.id, credentialId: credential.id, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, transports: credential.transports ?? null, deviceType: credentialDeviceType, backedUp: credentialBackedUp }).onDuplicateKeyUpdate({ set: { counter: credential.counter, transports: credential.transports ?? null, deviceType: credentialDeviceType, backedUp: credentialBackedUp } });
  await recordChange({ actorId: account.id, action: "passkey.register", entityType: "passkey", entityId: credential.id, afterState: { deviceType: credentialDeviceType, backedUp: credentialBackedUp } });
  return { verified: true };
}

async function activeAccountForPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const username = normalizeRussianPhone(phone);
  const [account] = await db.select().from(localAccounts).where(eq(localAccounts.username, username)).limit(1);
  if (!account || !account.isActive) throw new Error("Для этого номера быстрый вход недоступен");
  return account;
}

export async function beginPasskeyAuthentication(phone: string | undefined, req: RequestLike) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const { rpId } = passkeyRelyingParty(req);
  const normalizedPhone = phone?.trim();
  if (normalizedPhone) {
    const account = await activeAccountForPhone(normalizedPhone);
    const credentials = await db.select().from(localPasskeys).where(eq(localPasskeys.accountId, account.id));
    if (!credentials.length) throw new Error("На этом номере еще не настроен быстрый вход");
    const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: "required", allowCredentials: credentials.map(credential => ({ id: credential.credentialId, transports: Array.isArray(credential.transports) ? credential.transports.map(String) : undefined })) });
    const ceremony = await saveChallenge(account.id, "authentication", options.challenge, req);
    return { accountId: account.id, options, ...ceremony };
  }
  const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: "required" });
  const ceremony = await saveChallenge(0, "authentication", options.challenge, req);
  return { options, ...ceremony };
}

export async function finishPasskeyAuthentication(phone: string | undefined, response: AuthenticationResponseJSON, cookieHeader?: string) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const normalizedPhone = phone?.trim();
  let account;
  let passkey;
  if (normalizedPhone) {
    account = await activeAccountForPhone(normalizedPhone);
    [passkey] = await db.select().from(localPasskeys).where(and(eq(localPasskeys.accountId, account.id), eq(localPasskeys.credentialId, response.id))).limit(1);
  } else {
    [passkey] = await db.select().from(localPasskeys).where(eq(localPasskeys.credentialId, response.id)).limit(1);
    if (passkey) {
      const [storedAccount] = await db.select().from(localAccounts).where(eq(localAccounts.id, passkey.accountId)).limit(1);
      if (storedAccount?.isActive) account = storedAccount;
    }
  }
  if (!passkey) throw new Error("Ключ быстрого входа не найден");
  if (!account) throw new Error("Для этого ключа быстрый вход недоступен");
  const challenge = await consumeChallenge(normalizedPhone ? account.id : undefined, "authentication", cookieHeader);
  const verification = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpId, requireUserVerification: true, credential: { id: passkey.credentialId, publicKey: Buffer.from(passkey.publicKey, "base64url"), counter: passkey.counter, transports: Array.isArray(passkey.transports) ? passkey.transports.map(String) : undefined } });
  if (!verification.verified) throw new Error("Не удалось подтвердить быстрый вход");
  await db.update(localPasskeys).set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(localPasskeys.id, passkey.id));
  await db.update(localAccounts).set({ lastLoginAt: new Date() }).where(eq(localAccounts.id, account.id));
  await ensureCoreUserForPasskey(account.username, account.displayName, account.role);
  await recordChange({ actorId: account.id, action: "account.passkey.login", entityType: "account", entityId: String(account.id) });
  return account;
}

export async function deleteAccountPasskey(accountId: number, passkeyId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [passkey] = await db.select().from(localPasskeys).where(and(eq(localPasskeys.id, passkeyId), eq(localPasskeys.accountId, accountId))).limit(1);
  if (!passkey) throw new Error("Ключ быстрого входа не найден");
  await db.delete(localPasskeys).where(eq(localPasskeys.id, passkey.id));
  await recordChange({ actorId: accountId, action: "passkey.delete", entityType: "passkey", entityId: passkey.credentialId, beforeState: { deviceType: passkey.deviceType, backedUp: passkey.backedUp }, afterState: { deleted: true } });
  return { success: true };
}

export const passkeyAccountLabel = (account: { username: string; displayName: string }) => ({ phone: formatRussianPhone(account.username), displayName: account.displayName });
