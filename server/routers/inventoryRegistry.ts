import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAccessibleStoreIds, getCurrentLocalAccount, hasStoreAccess } from "../accessControl";
import {
  archiveOperationalCatalogProduct,
  closeInventory,
  confirmOperationalCatalogFromEvotor,
  createOperationalCatalogProduct,
  createInventoryDraft,
  deleteInventoryDraft,
  getInventoryAuditState,
  getInventoryDetail,
  listInventoryProducts,
  listOperationalStock,
  listStoreInventories,
  removeInventoryLine,
  updateInventoryNote,
  updateOperationalCatalogProduct,
  updateOperationalCatalogCost,
  upsertInventoryLine,
} from "../inventoryRegistry";
import { recordChange } from "../localAuth";
import { protectedProcedure, router } from "../_core/trpc";

const dateInput = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, "Выберите дату в формате ГГГГ-ММ-ДД");
const inventoryUnit = z.enum(["kg", "l", "piece"]);

async function localActor(openId: string | null | undefined) {
  const actor = await getCurrentLocalAccount(openId);
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется локальный вход." });
  if (actor.role !== "admin" && actor.role !== "seller" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Операционный контур доступен только продавцу, руководителю или администратору." });
  if (actor.role === "seller" && actor.mustChangePassword) throw new TRPCError({ code: "FORBIDDEN", message: "Сначала замените первичный пароль в профиле." });
  return actor;
}

async function requireInventoryStoreAccess(openId: string | null | undefined, storeId: number, action: "view" | "edit") {
  const actor = await localActor(openId);
  if (actor.role === "admin") return actor;
  const required = actor.role === "seller" ? "view" : action;
  if (!await hasStoreAccess(openId, storeId, required)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к этой операционной точке." });
  if (actor.role === "seller") {
    const assigned = await getAccessibleStoreIds(openId);
    if (!assigned || assigned.length !== 1 || assigned[0] !== storeId) throw new TRPCError({ code: "FORBIDDEN", message: "Продавцу должна быть назначена ровно одна операционная точка." });
  }
  return actor;
}

async function detailWithPermission(openId: string | null | undefined, inventoryId: number, action: "view" | "edit", includeAccounting = false) {
  const detail = await getInventoryDetail(inventoryId);
  if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Инвентаризация не найдена." });
  const actor = await requireInventoryStoreAccess(openId, detail.storeId, action);
  return { actor, detail: includeAccounting && actor.role !== "seller" ? await getInventoryDetail(inventoryId, { includeAccounting: true }) ?? detail : detail };
}

export const inventoryRegistryRouter = router({
  confirmEvotorCatalog: protectedProcedure.input(z.object({ storeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Подтвердить номенклатуру Эвотор может только администратор." });
    const result = await confirmOperationalCatalogFromEvotor({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_catalog.evotor_confirm", entityType: "operational_catalog", entityId: String(input.storeId), afterState: { storeId: input.storeId, evotorStoreName: result.evotorStoreName, savedPositions: result.imported, costPricePolicy: "evotor=0/read-only; internal=manual" } });
    return result;
  }),
  updateInternalCost: protectedProcedure.input(z.object({ id: z.number().int().positive(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять внутреннюю себестоимость может только администратор." });
    const result = await updateOperationalCatalogCost(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog.internal_cost.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, evotorCostPrice: result.before.evotorCostPrice, internalCostPrice: result.before.internalCostPrice }, afterState: { product: result.after.canonicalName, evotorCostPrice: result.after.evotorCostPrice, internalCostPrice: result.after.internalCostPrice } });
    return result;
  }),
  createCatalogProduct: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), canonicalName: z.string().trim().min(1).max(512), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]).optional(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Добавлять номенклатуру может только администратор." });
    const after = await createOperationalCatalogProduct({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_catalog.manual.create", entityType: "operational_catalog_product", entityId: String(after.id), afterState: { storeId: after.storeId, product: after.canonicalName, unit: after.baseUnit, vatRate: after.vatRate, internalCostPrice: after.internalCostPrice } });
    return after;
  }),
  updateCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), canonicalName: z.string().trim().min(1).max(512), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять номенклатуру может только администратор." });
    const result = await updateOperationalCatalogProduct(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, unit: result.before.baseUnit, vatRate: result.before.vatRate }, afterState: { product: result.after.canonicalName, unit: result.after.baseUnit, vatRate: result.after.vatRate } });
    return result;
  }),
  archiveCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Скрывать номенклатуру может только администратор." });
    const result = await archiveOperationalCatalogProduct(input.id);
    await recordChange({ actorId: actor.id, action: "operational_catalog.archive", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, isActive: result.before.isActive }, afterState: { product: result.after.canonicalName, isActive: result.after.isActive } });
    return result;
  }),
  products: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const products = await listInventoryProducts({ storeId: input?.storeId, includeAccounting: actor.role !== "seller" && Boolean(input?.storeId), includeInactive: actor.role === "admin" });
    return actor.role === "admin"
      ? products
      : products.map(({ evotorCostPrice: _evotorCostPrice, internalCostPrice: _internalCostPrice, ...product }) => product);
  }),
  stock: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), query: z.string().max(160).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOperationalStock({ ...input, storeIds, storeId: input?.storeId, limit: input?.limit ?? 50 });
  }),
  list: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(30).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    return listStoreInventories({ storeIds, storeId: input?.storeId, limit: actor.role === "seller" ? Math.min(input?.limit ?? 5, 5) : input?.limit });
  }),
  detail: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { detail } = await detailWithPermission(ctx.user.openId, input.inventoryId, "view", true);
    return detail;
  }),
  create: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), businessDate: dateInput, note: z.string().max(1_000).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "edit");
    const result = await createInventoryDraft({ ...input, createdByAccountId: actor.id });
    if (result.created) await recordChange({ actorId: actor.id, action: "inventory.create", entityType: "operational_inventory", entityId: String(result.inventory.id), afterState: await getInventoryAuditState(result.inventory.id) });
    return { ...result, detail: await getInventoryDetail(result.inventory.id) };
  }),
  deleteDraft: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit");
    const result = await deleteInventoryDraft(input.inventoryId);
    await recordChange({
      actorId: actor.id,
      action: "inventory.draft.delete",
      entityType: "operational_inventory",
      entityId: String(input.inventoryId),
      beforeState: { ...result.before, storeName: detail.storeName, lineCount: result.lineCount },
      afterState: { deleted: true },
    });
    return result;
  }),
  updateNote: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive(), note: z.string().max(1_000) })).mutation(async ({ ctx, input }) => {
    const { actor } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit");
    const result = await updateInventoryNote(input);
    await recordChange({ actorId: actor.id, action: "inventory.note.update", entityType: "operational_inventory", entityId: String(input.inventoryId), beforeState: result.before, afterState: result.after });
    return result;
  }),
  upsertLine: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive(), productId: z.number().int().positive(), countedQuantity: z.number().finite().min(0).max(1_000_000), unit: inventoryUnit.optional() })).mutation(async ({ ctx, input }) => {
    const { actor } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit");
    const result = await upsertInventoryLine(input);
    await recordChange({ actorId: actor.id, action: "inventory.line.upsert", entityType: "operational_inventory_line", entityId: `${input.inventoryId}:${input.productId}`, beforeState: result.before, afterState: { ...result.after, product: result.product.canonicalName, code: result.product.internalCode } });
    return result;
  }),
  removeLine: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive(), productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit");
    const result = await removeInventoryLine(input);
    await recordChange({ actorId: actor.id, action: "inventory.line.remove", entityType: "operational_inventory_line", entityId: `${input.inventoryId}:${input.productId}`, beforeState: result.before, afterState: { deleted: true, storeId: result.inventory.storeId, businessDate: result.inventory.businessDate } });
    return result;
  }),
  close: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit");
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Продавец может подготовить пересчет, но закрывает его руководитель или администратор." });
    const result = await closeInventory({ inventoryId: input.inventoryId, closedByAccountId: actor.id });
    await recordChange({ actorId: actor.id, action: "inventory.close", entityType: "operational_inventory", entityId: String(input.inventoryId), beforeState: { ...result.before, storeName: detail.storeName }, afterState: { ...result.after, storeName: detail.storeName, movements: result.movements } });
    return result;
  }),
});
