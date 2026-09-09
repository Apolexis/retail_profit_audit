import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { adminResetLocalPassword, authenticateLocalAccount, changeLocalPassword, createLocalAccount, createLocalSession, deleteLocalAccount, deleteLocalSessionFromCookie, formatRussianPhone, getLocalAccountByOpenId, getLocalSessionFromCookie, listLocalAccounts, LOCAL_SESSION_COOKIE, recordChange, updateLocalAccount } from "../localAuth";
import { listAccountStoreAccess, replaceAccountStoreAccess } from "../accessControl";
import { listAuditStores } from "../audit";
import { getPushStatus, listMyNotifications, markNotificationRead, removePushSubscription, savePushSubscription } from "../notifications";
import { PASSKEY_ATTEMPT_COOKIE, beginPasskeyAuthentication, beginPasskeyRegistration, deleteAccountPasskey, finishPasskeyAuthentication, finishPasskeyRegistration, listAccountPasskeys } from "../passkeys";

const password = z.string().min(10, "Пароль должен содержать не менее 10 символов").max(128);
const role = z.enum(["admin", "analyst"]);
const passkeyResponse = z.any();

async function localAccountFromContext(openId?: string | null) {
  const account = await getLocalAccountByOpenId(openId);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется локальный вход" });
  return account;
}

export const localAuthRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    const account = (await getLocalSessionFromCookie(ctx.req.headers.cookie))?.account ?? await getLocalAccountByOpenId(ctx.user?.openId);
    return account ? { id: account.id, phone: formatRussianPhone(account.username), displayName: account.displayName, role: account.role } : null;
  }),
  login: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const account = await authenticateLocalAccount(input.username, input.password);
    if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный логин или пароль" });
    const session = await createLocalSession(account.id);
    ctx.res.cookie(LOCAL_SESSION_COOKIE, session.token, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: session.expiresAt.getTime()-Date.now() });
    return { id: account.id, phone: formatRussianPhone(account.username), displayName: account.displayName, role: account.role };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const account = (await getLocalSessionFromCookie(ctx.req.headers.cookie))?.account;
    await deleteLocalSessionFromCookie(ctx.req.headers.cookie);
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: -1 });
    if (account) await recordChange({ actorId: account.id, action: "account.logout", entityType: "account", entityId: String(account.id) });
    return { success: true };
  }),
  passkeys: protectedProcedure.query(async ({ ctx }) => listAccountPasskeys((await localAccountFromContext(ctx.user?.openId)).id)),
  beginPasskeyRegistration: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    const result = await beginPasskeyRegistration(account, ctx.req);
    ctx.res.cookie(PASSKEY_ATTEMPT_COOKIE, result.attempt, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: result.expiresAt.getTime() - Date.now() });
    return result.options;
  }),
  finishPasskeyRegistration: protectedProcedure.input(z.object({ response: passkeyResponse })).mutation(async ({ input, ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    const result = await finishPasskeyRegistration(account, input.response, ctx.req.headers.cookie);
    ctx.res.clearCookie(PASSKEY_ATTEMPT_COOKIE, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: -1 });
    return result;
  }),
  deletePasskey: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => deleteAccountPasskey((await localAccountFromContext(ctx.user?.openId)).id, input.id)),
  beginPasskeyLogin: publicProcedure.input(z.object({ phone: z.string().min(1).max(64) })).mutation(async ({ input, ctx }) => {
    const result = await beginPasskeyAuthentication(input.phone, ctx.req);
    ctx.res.cookie(PASSKEY_ATTEMPT_COOKIE, result.attempt, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: result.expiresAt.getTime() - Date.now() });
    return { options: result.options };
  }),
  finishPasskeyLogin: publicProcedure.input(z.object({ phone: z.string().min(1).max(64), response: passkeyResponse })).mutation(async ({ input, ctx }) => {
    const account = await finishPasskeyAuthentication(input.phone, input.response, ctx.req.headers.cookie);
    const session = await createLocalSession(account.id);
    ctx.res.clearCookie(PASSKEY_ATTEMPT_COOKIE, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: -1 });
    ctx.res.cookie(LOCAL_SESSION_COOKIE, session.token, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: session.expiresAt.getTime() - Date.now() });
    return { id: account.id, phone: formatRussianPhone(account.username), displayName: account.displayName, role: account.role };
  }),
  changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1), nextPassword: password })).mutation(async ({ input, ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    return changeLocalPassword(account.id, input.currentPassword, input.nextPassword, account.id);
  }),
  list: adminProcedure.query(async ({ ctx }) => {
    await localAccountFromContext(ctx.user?.openId);
    return listLocalAccounts();
  }),
  create: adminProcedure.input(z.object({ username: z.string().min(10).max(24), password, role })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return { id: await createLocalAccount(input, actor.id) };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int(), role: role.optional(), isActive: z.boolean().optional() })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return updateLocalAccount(input, actor.id);
  }),
  delete: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return deleteLocalAccount(input.id, actor.id);
  }),
  adminResetPassword: adminProcedure.input(z.object({ id: z.number().int(), nextPassword: password })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return adminResetLocalPassword(input.id, input.nextPassword, actor.id);
  }),
  storeAccess: adminProcedure.input(z.object({ accountId: z.number().int() })).query(async ({ input, ctx }) => {
    await localAccountFromContext(ctx.user?.openId);
    return listAccountStoreAccess(input.accountId);
  }),
  replaceStoreAccess: adminProcedure.input(z.object({ accountId: z.number().int(), grants: z.array(z.object({ storeId: z.number().int(), accessLevel: z.enum(["view", "edit"]) })).max(500) })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    const result = await replaceAccountStoreAccess(input.accountId, input.grants);
    const [accounts, stores] = await Promise.all([listLocalAccounts(), listAuditStores()]);
    const target = accounts.find(account => account.id === input.accountId);
    const names = new Map(stores.map(store => [store.id, store.name]));
    const describe = (grant: { storeId: number; accessLevel: "view" | "edit" }) => ({ storeId: grant.storeId, storeName: names.get(grant.storeId) ?? `Магазин #${grant.storeId}`, accessLevel: grant.accessLevel, accessLabel: grant.accessLevel === "edit" ? "редактирование" : "просмотр" });
    await recordChange({ actorId: actor.id, action: "store_access.replace", entityType: "account", entityId: String(input.accountId), beforeState: { accountId: input.accountId, account: target?.displayName ?? `Пользователь #${input.accountId}`, grants: result.before.map(describe) }, afterState: { accountId: input.accountId, account: target?.displayName ?? `Пользователь #${input.accountId}`, grants: result.after.map(describe) } });
    return { success: true };
  }),
  notifications: protectedProcedure.query(async ({ ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    return listMyNotifications(account.id);
  }),
  markNotificationRead: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input, ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    return markNotificationRead(account.id, input.id);
  }),
  pushStatus: protectedProcedure.query(async({ctx})=>getPushStatus((await localAccountFromContext(ctx.user?.openId)).id)),
  subscribePush: protectedProcedure.input(z.object({endpoint:z.string().url(),keys:z.object({p256dh:z.string().min(1),auth:z.string().min(1)})})).mutation(async({input,ctx})=>savePushSubscription((await localAccountFromContext(ctx.user?.openId)).id,input)),
  unsubscribePush: protectedProcedure.input(z.object({endpoint:z.string().url().optional()})).mutation(async({input,ctx})=>removePushSubscription((await localAccountFromContext(ctx.user?.openId)).id,input.endpoint)),
});
