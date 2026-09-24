import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getLocalSessionFromCookie } from "../localAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const localSession = await getLocalSessionFromCookie(opts.req.headers.cookie);
  if (localSession) {
    const account = localSession.account;
    user = {
      id: account.id,
      openId: localSession.openId,
      name: account.displayName,
      email: null,
      loginMethod: "local-password",
      role: account.role === "admin" ? "admin" : "user",
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastSignedIn: account.lastLoginAt ?? account.updatedAt,
    };
  }
  if (!user) {
    try { user = await sdk.authenticateRequest(opts.req); } catch { user = null; }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
