import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAccessibleStoreIds, getCurrentLocalAccount, hasStoreAccess } from "../accessControl";
import {
  archiveOperationalCatalogProduct,
  closeInventory,
  confirmOperationalCatalogFromEvotor,
  createOperationalPriceType,
  createOperationalCatalogProduct,
  createInventoryDraft,
  deleteOperationalPriceType,
  deleteInventoryDraft,
  getInventoryAuditState,
  getInventoryDetail,
  listOperationalPriceTypes,
  listOperationalSalePrices,
  listOperationalWarehouses,
  listInventoryProducts,
  listOperationalStock,
  listStoreInventories,
  removeInventoryLine,
  restoreOperationalCatalogProduct,
  setOperationalProductSalePrice,
  setOperationalStorePriceType,
  syncOperationalEvotorDocumentPage,
  updateInventoryNote,
  updateOperationalCatalogProduct,
  updateOperationalCatalogCost,
  updateOperationalPriceType,
  upsertInventoryLine,
} from "../inventoryRegistry";
import { recordChange } from "../localAuth";
import { protectedProcedure, router } from "../_core/trpc";

const dateInput = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, "Выберите дату в формате ГГГГ-ММ-ДД");
const inventoryUnit = z.enum(["kg", "l", "piece"]);
const markingCategory = z.enum(["none", "supplement", "seafood_caviar", "seafood_canned", "alcohol", "beer_marked", "beer_non_alcoholic", "soft_drinks", "water", "dairy"]);

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
  syncEvotorDocumentPage: protectedProcedure.input(z.object({ storeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Загружать документы Эвотор может только администратор." });
    const result = await syncOperationalEvotorDocumentPage({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_evotor.documents.sync_page", entityType: "operational_evotor_document_sync", entityId: String(result.syncId), afterState: { storeId: input.storeId, readDocuments: result.readDocuments, readPositions: result.readPositions, insertedDocuments: result.insertedDocuments, insertedPositions: result.insertedPositions, completed: result.completed, policy: "read-only; normalized; no fiscal/payment/device fields" } });
    return result;
  }),
  updateInternalCost: protectedProcedure.input(z.object({ id: z.number().int().positive(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять внутреннюю себестоимость может только администратор." });
    const result = await updateOperationalCatalogCost(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog.internal_cost.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, evotorCostPrice: result.before.evotorCostPrice, internalCostPrice: result.before.internalCostPrice }, afterState: { product: result.after.canonicalName, evotorCostPrice: result.after.evotorCostPrice, internalCostPrice: result.after.internalCostPrice } });
    return result;
  }),
  createCatalogProduct: protectedProcedure.input(z.object({ canonicalName: z.string().trim().min(1).max(512), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]).optional(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable().optional(), markingCategory: markingCategory.optional(), manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean().optional(), isEvotorExportEnabled: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Добавлять номенклатуру может только администратор." });
    const after = await createOperationalCatalogProduct({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_catalog.manual.create", entityType: "operational_catalog_product", entityId: String(after.id), afterState: { product: after.canonicalName, unit: after.baseUnit, vatRate: after.vatRate, markingCategory: after.markingCategory, manualBarcodes: after.manualBarcodes, isVisibleInRequests: after.isVisibleInRequests, isEvotorExportEnabled: after.isEvotorExportEnabled, internalCostPrice: after.internalCostPrice } });
    return after;
  }),
  updateCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), canonicalName: z.string().trim().min(1).max(512), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]), markingCategory, manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean(), isEvotorExportEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять номенклатуру может только администратор." });
    const result = await updateOperationalCatalogProduct(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, unit: result.before.baseUnit, vatRate: result.before.vatRate, markingCategory: result.before.markingCategory, manualBarcodes: result.before.manualBarcodes, isVisibleInRequests: result.before.isVisibleInRequests, isEvotorExportEnabled: result.before.isEvotorExportEnabled }, afterState: { product: result.after.canonicalName, unit: result.after.baseUnit, vatRate: result.after.vatRate, markingCategory: result.after.markingCategory, manualBarcodes: result.after.manualBarcodes, isVisibleInRequests: result.after.isVisibleInRequests, isEvotorExportEnabled: result.after.isEvotorExportEnabled } });
    return result;
  }),
  archiveCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Скрывать номенклатуру может только администратор." });
    const result = await archiveOperationalCatalogProduct(input.id);
    await recordChange({ actorId: actor.id, action: "operational_catalog.archive", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, isActive: result.before.isActive }, afterState: { product: result.after.canonicalName, isActive: result.after.isActive } });
    return result;
  }),
  restoreCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Возвращать номенклатуру может только администратор." });
    const result = await restoreOperationalCatalogProduct(input.id);
    await recordChange({ actorId: actor.id, action: "operational_catalog.restore", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, isActive: result.before.isActive }, afterState: { product: result.after.canonicalName, isActive: result.after.isActive } });
    return result;
  }),
  priceTypes: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Виды цен доступны только администратору." });
    return listOperationalPriceTypes(true);
  }),
  salePrices: protectedProcedure.input(z.object({ priceTypeId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Продажные цены доступны только администратору." });
    return listOperationalSalePrices(input?.priceTypeId);
  }),
  warehouses: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Список складов доступен только администратору." });
    return listOperationalWarehouses();
  }),
  createPriceType: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(128), isDefault: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Создавать виды цен может только администратор." });
    const after = await createOperationalPriceType(input);
    await recordChange({ actorId: actor.id, action: "operational_price_type.create", entityType: "operational_price_type", entityId: String(after.id), afterState: { name: after.name, isDefault: after.isDefault, isActive: after.isActive } });
    return after;
  }),
  updatePriceType: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(128), isDefault: z.boolean(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять виды цен может только администратор." });
    const result = await updateOperationalPriceType(input);
    await recordChange({ actorId: actor.id, action: "operational_price_type.update", entityType: "operational_price_type", entityId: String(input.id), beforeState: { name: result.before.name, isDefault: result.before.isDefault, isActive: result.before.isActive }, afterState: { name: result.after.name, isDefault: result.after.isDefault, isActive: result.after.isActive } });
    return result;
  }),
  deletePriceType: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Удалять виды цен может только администратор." });
    const result = await deleteOperationalPriceType(input.id);
    await recordChange({ actorId: actor.id, action: "operational_price_type.delete", entityType: "operational_price_type", entityId: String(input.id), beforeState: { name: result.before.name, isDefault: result.before.isDefault }, afterState: { deleted: true } });
    return result;
  }),
  setStorePriceType: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), priceTypeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Назначать вид цены складу может только администратор." });
    const result = await setOperationalStorePriceType({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.price_type.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before ? { priceTypeId: result.before.priceTypeId } : null, afterState: { priceTypeId: result.after.priceTypeId } });
    return result;
  }),
  setProductSalePrice: protectedProcedure.input(z.object({ productId: z.number().int().positive(), priceTypeId: z.number().int().positive(), salePrice: z.number().finite().min(0).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять продажную цену может только администратор." });
    const result = await setOperationalProductSalePrice({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: input.salePrice === null ? "operational_product_sale_price.delete" : "operational_product_sale_price.update", entityType: "operational_product_sale_price", entityId: `${input.productId}:${input.priceTypeId}`, beforeState: result.before ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.before.salePrice } : null, afterState: result.after ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.after.salePrice } : { deleted: true } });
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
  stock: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), query: z.string().max(160).optional(), category: z.string().max(512).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(2_000).optional() }).optional()).query(async ({ ctx, input }) => {
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
