import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "../_core/cookies";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { authenticateLocalAccount, changeLocalPassword, createLocalAccount, createLocalSession, deleteLocalSessionFromCookie, getLocalAccountByOpenId, getLocalSessionFromCookie, listLocalAccounts, LOCAL_SESSION_COOKIE, updateLocalAccount } from "../localAuth";

const password = z.string().min(10, "Пароль должен содержать не менее 10 символов").max(128);
const role = z.enum(["admin", "analyst", "viewer"]);

async function localAccountFromContext(openId?: string | null) {
  const account = await getLocalAccountByOpenId(openId);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется локальный вход" });
  return account;
}

export const localAuthRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    const account = (await getLocalSessionFromCookie(ctx.req.headers.cookie))?.account ?? await getLocalAccountByOpenId(ctx.user?.openId);
    return account ? { id: account.id, username: account.username, displayName: account.displayName, role: account.role } : null;
  }),
  login: publicProcedure.input(z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const account = await authenticateLocalAccount(input.username, input.password);
    if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный логин или пароль" });
    const session = await createLocalSession(account.id);
    ctx.res.cookie(LOCAL_SESSION_COOKIE, session.token, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: session.expiresAt.getTime()-Date.now() });
    return { id: account.id, username: account.username, displayName: account.displayName, role: account.role };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await deleteLocalSessionFromCookie(ctx.req.headers.cookie);
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(ctx.req), sameSite: "lax", maxAge: -1 });
    return { success: true };
  }),
  changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1), nextPassword: password })).mutation(async ({ input, ctx }) => {
    const account = await localAccountFromContext(ctx.user?.openId);
    return changeLocalPassword(account.id, input.currentPassword, input.nextPassword, account.id);
  }),
  list: adminProcedure.query(async ({ ctx }) => {
    await localAccountFromContext(ctx.user?.openId);
    return listLocalAccounts();
  }),
  create: adminProcedure.input(z.object({ username: z.string().regex(/^[A-Za-z0-9._-]{3,64}$/), displayName: z.string().min(2).max(128), password, role })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return { id: await createLocalAccount(input, actor.id) };
  }),
  update: adminProcedure.input(z.object({ id: z.number().int(), displayName: z.string().min(2).max(128).optional(), role: role.optional(), isActive: z.boolean().optional() })).mutation(async ({ input, ctx }) => {
    const actor = await localAccountFromContext(ctx.user?.openId);
    return updateLocalAccount(input, actor.id);
  }),
});
