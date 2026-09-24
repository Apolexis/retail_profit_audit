import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getCurrentLocalAccount, getAccessibleStoreIds, hasStoreAccess } from "../accessControl";
import { recordChange } from "../localAuth";
import { REVENUE_AMOUNT_FIELDS, REVENUE_EXPENSE_FIELDS, correctRevenueRecord, createRevenueRecord, getOperationalRevenuePrintSettings, getRevenueRecord, listRevenueEvotorReconciliation, listRevenueRecordVersions, listRevenueRecords, updateOperationalRevenuePrintSettings, voidRevenueRecord, type RevenueAmountField, type RevenueExpenseField } from "../revenueRegistry";

const businessDate = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, "Выберите дату в формате ГГГГ-ММ-ДД");
const money = z.number().finite().min(0).multipleOf(0.01, "Сумма допускает не более двух знаков после точки");
const amounts = Object.fromEntries(REVENUE_AMOUNT_FIELDS.map(field => [field, money])) as Record<RevenueAmountField, typeof money>;
const comments = Object.fromEntries(REVENUE_EXPENSE_FIELDS.map(field => [field, z.string().max(500).optional()])) as Record<RevenueExpenseField, z.ZodOptional<z.ZodString>>;
const revenueEntry = z.object({ ...amounts, expenseComments: z.object(comments) });

async function requireOperationalActor(openId?: string | null) {
  const account = await getCurrentLocalAccount(openId);
  if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется локальный вход" });
  if (account.mustChangePassword) throw new TRPCError({ code: "FORBIDDEN", message: "Сначала измените первичный пароль в профиле" });
  return account;
}

async function requireRevenueStorePermission(openId: string | null | undefined, storeId: number) {
  if (!await hasStoreAccess(openId, storeId, "view")) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к этому магазину" });
}

/** Managers are administrative staff for the operational register: they can view and print only assigned stores. */
const isRevenueAdministrativeRole = (role: string) => role === "admin" || role === "analyst" || role === "manager";

/** A seller belongs to exactly one operational point; broad financial grants never imply this access. */
async function requireSellerStore(openId: string | null | undefined) {
  const storeIds = await getAccessibleStoreIds(openId);
  if (!Array.isArray(storeIds) || storeIds.length !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Продавцу должна быть назначена ровно одна операционная точка" });
  }
  return storeIds[0];
}

export const revenueRegistryRouter = router({
  printSettings: protectedProcedure.query(async ({ ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати выручки доступны только администратору" });
    return getOperationalRevenuePrintSettings();
  }),
  updatePrintSettings: protectedProcedure.input(z.object({ zebraMode: z.enum(["none", "rows", "columns"]), headingFontSize: z.number().int().min(7).max(14), bodyFontSize: z.number().int().min(7).max(14), totalFontSize: z.number().int().min(7).max(14), headingBold: z.boolean(), bodyBold: z.boolean(), totalBold: z.boolean() })).mutation(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати выручки может менять только администратор" });
    const result = await updateOperationalRevenuePrintSettings({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_revenue_print_settings.update", entityType: "operational_revenue_print_settings", entityId: "network", beforeState: result.before ? { zebraMode: result.before.zebraMode, headingFontSize: result.before.headingFontSize, bodyFontSize: result.before.bodyFontSize, totalFontSize: result.before.totalFontSize, headingBold: result.before.headingBold, bodyBold: result.before.bodyBold, totalBold: result.before.totalBold } : null, afterState: { zebraMode: result.after.zebraMode, headingFontSize: result.after.headingFontSize, bodyFontSize: result.after.bodyFontSize, totalFontSize: result.after.totalFontSize, headingBold: result.after.headingBold, bodyBold: result.after.bodyBold, totalBold: result.after.totalBold } });
    return result.after;
  }),
  myLatest: protectedProcedure.query(async ({ ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "seller" && actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Реестр «Выручка» доступен продавцу и администратору" });
    const storeIds = actor.role === "seller" ? [await requireSellerStore(ctx.user?.openId)] : await getAccessibleStoreIds(ctx.user?.openId);
    return listRevenueRecords({ storeIds, createdByAccountId: actor.role === "seller" ? actor.id : undefined, limit: actor.role === "seller" ? 5 : 50 });
  }),
  create: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), businessDate, entry: revenueEntry })).mutation(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "seller" && actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Создавать записи «Выручки» может продавец или администратор" });
    if (actor.role === "seller" && input.storeId !== await requireSellerStore(ctx.user?.openId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Продавец может передавать выручку только за свою точку" });
    }
    await requireRevenueStorePermission(ctx.user?.openId, input.storeId);
    const created = await createRevenueRecord({ storeId: input.storeId, businessDate: input.businessDate, createdByAccountId: actor.id, entry: input.entry });
    if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать запись «Выручки»" });
    await recordChange({ actorId: actor.id, action: created.wasRecreated ? "operational_revenue.recreate" : "operational_revenue.create", entityType: "operational_revenue", entityId: String(created.id), beforeState: null, afterState: { ...created, actorRole: actor.role } });
    return created;
  }),
  adminList: protectedProcedure.input(z.object({ from: businessDate.optional(), to: businessDate.optional(), storeId: z.number().int().positive().optional() }).refine(input => !input.from || !input.to || input.from <= input.to, { message: "Дата начала не может быть позже даты окончания" })).query(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (!isRevenueAdministrativeRole(actor.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Реестр всех магазинов доступен только административному персоналу" });
    const storeIds = await getAccessibleStoreIds(ctx.user?.openId);
    if (input.storeId && storeIds && !storeIds.includes(input.storeId)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к этому магазину" });
    return listRevenueRecords({ ...input, storeIds, limit: 500 });
  }),
  reconciliation: protectedProcedure.input(z.object({ from: businessDate.optional(), to: businessDate.optional(), storeId: z.number().int().positive().optional() }).refine(input => !input.from || !input.to || input.from <= input.to, { message: "Дата начала не может быть позже даты окончания" })).query(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (!isRevenueAdministrativeRole(actor.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Сверка выручки доступна только административному персоналу" });
    const storeIds = await getAccessibleStoreIds(ctx.user?.openId);
    if (input.storeId && storeIds && !storeIds.includes(input.storeId)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к этому магазину" });
    return listRevenueEvotorReconciliation({ ...input, storeIds, limit: 500 });
  }),
  print: protectedProcedure.input(z.object({ from: businessDate.optional(), to: businessDate.optional(), storeId: z.number().int().positive().optional() }).refine(input => !input.from || !input.to || input.from <= input.to, { message: "Дата начала не может быть позже даты окончания" })).mutation(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (!isRevenueAdministrativeRole(actor.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Печать реестра доступна только административному персоналу" });
    const storeIds = await getAccessibleStoreIds(ctx.user?.openId);
    if (input.storeId && storeIds && !storeIds.includes(input.storeId)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к этому магазину" });
    const [records, printSettings] = await Promise.all([
      listRevenueRecords({ ...input, storeIds, limit: 500 }),
      getOperationalRevenuePrintSettings(),
    ]);
    const printTypography = { headingFontSize: printSettings.headingFontSize, bodyFontSize: printSettings.bodyFontSize, totalFontSize: printSettings.totalFontSize, headingBold: printSettings.headingBold, bodyBold: printSettings.bodyBold, totalBold: printSettings.totalBold };
    /** A zero-row request never creates a misleading audit entry or blank sheet. */
    if (!records.length) return { recordCount: 0, records, zebraMode: printSettings.zebraMode, ...printTypography };
    await recordChange({ actorId: actor.id, action: "operational_revenue.print", entityType: "operational_revenue_register", entityId: `${input.from ?? "all"}:${input.to ?? "all"}:${input.storeId ?? "all"}`, afterState: { businessDate: input.from ?? input.to ?? null, storeId: input.storeId ?? null, recordCount: records.length, storeCount: new Set(records.map(record => record.storeId)).size } });
    return { recordCount: records.length, records, zebraMode: printSettings.zebraMode, ...printTypography };
  }),
  correct: protectedProcedure.input(z.object({ recordId: z.number().int().positive(), businessDate, correctionReason: z.string().trim().min(1, "Укажите причину исправления").max(500), entry: revenueEntry })).mutation(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Исправлять записи «Выручки» может только администратор" });
    const corrected = await correctRevenueRecord({ recordId: input.recordId, changedByAccountId: actor.id, businessDate: input.businessDate, correctionReason: input.correctionReason, entry: input.entry });
    await recordChange({ actorId: actor.id, action: "operational_revenue.correct", entityType: "operational_revenue", entityId: String(input.recordId), beforeState: corrected.before, afterState: { ...corrected.after, correctionReason: corrected.correctionReason } });
    return corrected.after;
  }),
  remove: protectedProcedure.input(z.object({ recordId: z.number().int().positive(), reason: z.string().trim().min(1, "Укажите причину удаления").max(500) })).mutation(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Удалять записи «Выручки» может только администратор" });
    const removed = await voidRevenueRecord({ recordId: input.recordId, changedByAccountId: actor.id, reason: input.reason });
    await recordChange({ actorId: actor.id, action: "operational_revenue.remove", entityType: "operational_revenue", entityId: String(input.recordId), beforeState: removed.before, afterState: { ...removed.after, reason: removed.reason } });
    return removed.after;
  }),
  versions: protectedProcedure.input(z.object({ recordId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "История версий доступна только администратору" });
    return listRevenueRecordVersions(input.recordId);
  }),
  details: protectedProcedure.input(z.object({ recordId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const actor = await requireOperationalActor(ctx.user?.openId);
    const record = await getRevenueRecord(input.recordId);
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Запись «Выручки» не найдена" });
    if (actor.role !== "admin") {
      if (actor.role !== "seller" || record.createdByAccountId !== actor.id) throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этой записи «Выручки»" });
      if (record.storeId !== await requireSellerStore(ctx.user?.openId)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступа к этой операционной точке" });
      await requireRevenueStorePermission(ctx.user?.openId, record.storeId);
    }
    return record;
  }),
});
