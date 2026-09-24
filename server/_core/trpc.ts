import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const containsRussianText = (value: string) => /[А-Яа-яЁё]/.test(value);

/**
 * Server exceptions can contain names of infrastructure services or libraries.
 * They are neither actionable nor safe to expose to an operator; every visible
 * error therefore has a Russian, role-neutral fallback.
 */
export const russianErrorMessage = (code: string, message: string) => {
  if (containsRussianText(message)) return message;
  if (code === "UNAUTHORIZED") return "Требуется вход в систему.";
  if (code === "FORBIDDEN") return "Недостаточно прав для выполнения действия.";
  if (code === "NOT_FOUND") return "Запрошенные данные не найдены.";
  if (code === "BAD_REQUEST") return "Проверьте введенные данные и повторите попытку.";
  if (code === "CONFLICT") return "Данные уже изменены. Обновите страницу и повторите действие.";
  if (code === "TOO_MANY_REQUESTS") return "Слишком много запросов. Повторите попытку немного позже.";
  return "Не удалось выполнить операцию. Повторите попытку позже.";
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return { ...shape, message: russianErrorMessage(error.code, shape.message) };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
