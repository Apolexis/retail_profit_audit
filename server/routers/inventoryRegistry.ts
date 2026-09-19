import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAccessibleStoreIds, getCurrentLocalAccount, hasStoreAccess } from "../accessControl";
import {
  archiveOperationalCatalogProduct,
  addOperationalStoreRequestManualLine,
  closeInventory,
  closeOperationalStoreRequest,
  closeOperationalStoreRequestsForPrint,
  countOperationalStoreRequestPrintCandidates,
  createOperationalPrintGroup,
  createOperationalPrintCategoryGroup,
  createOperationalStoreRequest,
  confirmOperationalCatalogFromEvotor,
  createOperationalPriceType,
  createOperationalCatalogProduct,
  createOperationalCatalogCategory,
  createInventoryDraft,
  deleteOperationalPrintGroup,
  deleteOperationalPrintCategoryGroup,
  deleteOperationalPriceType,
  deleteOperationalStoreRequestDraft,
  deleteInventoryDraft,
  fillInventoryLinesFromAccounting,
  getInventoryAuditState,
  getInventoryDetail,
  getOperationalStoreRequestDetail,
  getOperationalStoreRequestPrintProjection,
  getOperationalRequestPrintSettings,
  getOperationalEvotorSyncStatus,
  listOperationalEvotorSalesAnalytics,
  listOperationalPriceTypes,
  listOperationalCatalogCategoryNames,
  listOperationalCatalogCategories,
  listOperationalPrintCategoryGroups,
  listOperationalPrintGroups,
  listOperationalSalePrices,
  listOperationalStoreRequestProducts,
  listOperationalStoreRequestStores,
  listOperationalStoreRequests,
  listOperationalEvotorStoreChoices,
  listOperationalWarehouses,
  listInventoryProducts,
  listOperationalStock,
  listStoreInventories,
  removeInventoryLine,
  removeOperationalPrintCategoryGroupMember,
  removeOperationalStoreRequestLine,
  restoreOperationalCatalogProduct,
  setOperationalProductSalePrice,
  setOperationalWarehouseEvotorMapping,
  setOperationalWarehousePrintGroup,
  setOperationalPrintCategoryGroupMember,
  setOperationalStorePriceType,
  syncOperationalEvotorDocumentPage,
  updateInventoryNote,
  updateOperationalCatalogProduct,
  updateOperationalCatalogCategory,
  updateOperationalCatalogCost,
  updateOperationalPrintCategoryGroup,
  updateOperationalPrintGroup,
  updateOperationalRequestPrintSettings,
  updateOperationalPriceType,
  upsertOperationalStoreRequestComment,
  upsertInventoryLine,
  upsertOperationalStoreRequestLine,
  archiveOperationalCatalogCategory,
} from "../inventoryRegistry";
import { recordChange } from "../localAuth";
import { protectedProcedure, router } from "../_core/trpc";

const dateInput = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, "Выберите дату в формате ГГГГ-ММ-ДД");
/** The UI labels `fraction` as «кг» while the stored catalog code remains compatible with Evotor. */
const inventoryUnit = z.enum(["fraction", "l", "piece"]);
const markingCategory = z.enum(["none", "supplement", "seafood_caviar", "seafood_canned", "alcohol", "beer_marked", "beer_non_alcoholic", "soft_drinks", "water", "dairy"]);
const moscowToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

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

async function storeRequestDetailWithPermission(openId: string | null | undefined, requestId: number, action: "view" | "edit") {
  const detail = await getOperationalStoreRequestDetail(requestId);
  if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Заявка магазина не найдена." });
  const actor = await requireInventoryStoreAccess(openId, detail.storeId, action);
  return { actor, detail };
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
  createCatalogProduct: protectedProcedure.input(z.object({ canonicalName: z.string().trim().min(1).max(512), evotorCategoryName: z.string().trim().max(512).nullable().optional(), catalogCategoryId: z.number().int().positive().nullable().optional(), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]).optional(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable().optional(), markingCategory: markingCategory.optional(), alcoholCode: z.string().trim().max(255).nullable().optional(), alcoholTypeCode: z.string().trim().max(64).nullable().optional(), alcoholStrengthPercent: z.number().finite().min(0).max(100).nullable().optional(), alcoholVolumeLiters: z.number().finite().min(0).max(1_000).nullable().optional(), manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean().optional(), isEvotorExportEnabled: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Добавлять номенклатуру может только администратор." });
    const after = await createOperationalCatalogProduct({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_catalog.manual.create", entityType: "operational_catalog_product", entityId: String(after.id), afterState: { product: after.canonicalName, categoryId: after.catalogCategoryId, category: after.evotorCategoryName, unit: after.baseUnit, vatRate: after.vatRate, markingCategory: after.markingCategory, alcoholCode: after.alcoholCode, alcoholTypeCode: after.alcoholTypeCode, alcoholStrengthPercent: after.alcoholStrengthPercent, manualBarcodes: after.manualBarcodes, isVisibleInRequests: after.isVisibleInRequests, isEvotorExportEnabled: after.isEvotorExportEnabled, internalCostPrice: after.internalCostPrice } });
    return after;
  }),
  updateCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), canonicalName: z.string().trim().min(1).max(512), evotorCategoryName: z.string().trim().max(512).nullable().optional(), catalogCategoryId: z.number().int().positive().nullable().optional(), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]), markingCategory, alcoholCode: z.string().trim().max(255).nullable().optional(), alcoholTypeCode: z.string().trim().max(64).nullable().optional(), alcoholStrengthPercent: z.number().finite().min(0).max(100).nullable().optional(), alcoholVolumeLiters: z.number().finite().min(0).max(1_000).nullable().optional(), manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean(), isEvotorExportEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять номенклатуру может только администратор." });
    const result = await updateOperationalCatalogProduct(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, categoryId: result.before.catalogCategoryId, category: result.before.evotorCategoryName, unit: result.before.baseUnit, vatRate: result.before.vatRate, markingCategory: result.before.markingCategory, alcoholCode: result.before.alcoholCode, alcoholTypeCode: result.before.alcoholTypeCode, alcoholStrengthPercent: result.before.alcoholStrengthPercent, manualBarcodes: result.before.manualBarcodes, isVisibleInRequests: result.before.isVisibleInRequests, isEvotorExportEnabled: result.before.isEvotorExportEnabled }, afterState: { product: result.after.canonicalName, categoryId: result.after.catalogCategoryId, category: result.after.evotorCategoryName, unit: result.after.baseUnit, vatRate: result.after.vatRate, markingCategory: result.after.markingCategory, alcoholCode: result.after.alcoholCode, alcoholTypeCode: result.after.alcoholTypeCode, alcoholStrengthPercent: result.after.alcoholStrengthPercent, manualBarcodes: result.after.manualBarcodes, isVisibleInRequests: result.after.isVisibleInRequests, isEvotorExportEnabled: result.after.isEvotorExportEnabled } });
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
  evotorStoreChoices: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Связи складов с Эвотор доступны только администратору." });
    return listOperationalEvotorStoreChoices();
  }),
  printGroups: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Группы печати доступны только руководителю или администратору." });
    return listOperationalPrintGroups(true);
  }),
  requestPrintSettings: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати доступны только администратору." });
    return getOperationalRequestPrintSettings();
  }),
  updateRequestPrintSettings: protectedProcedure.input(z.object({ zebraMode: z.enum(["none", "rows", "columns"]) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати может менять только администратор." });
    const result = await updateOperationalRequestPrintSettings({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_request_print_settings.update", entityType: "operational_request_print_settings", entityId: "network", beforeState: { zebraMode: result.before?.zebraMode ?? "none" }, afterState: { zebraMode: result.after.zebraMode } });
    return result.after;
  }),
  catalogCategoryNames: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Категории печати доступны только администратору." });
    return listOperationalCatalogCategoryNames();
  }),
  catalogCategories: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Справочник категорий доступен только администратору." });
    return listOperationalCatalogCategories(true);
  }),
  createCatalogCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(512) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Создавать категории может только администратор." });
    const after = await createOperationalCatalogCategory({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_catalog_category.create", entityType: "operational_catalog_category", entityId: String(after.id), afterState: { name: after.name, normalizedName: after.normalizedName, isActive: after.isActive } });
    return after;
  }),
  updateCatalogCategory: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(512) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять категории может только администратор." });
    const result = await updateOperationalCatalogCategory(input);
    await recordChange({ actorId: actor.id, action: "operational_catalog_category.update", entityType: "operational_catalog_category", entityId: String(input.id), beforeState: { name: result.before.name, normalizedName: result.before.normalizedName, isActive: result.before.isActive }, afterState: { name: result.after.name, normalizedName: result.after.normalizedName, isActive: result.after.isActive } });
    return result;
  }),
  archiveCatalogCategory: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Архивировать категории может только администратор." });
    const result = await archiveOperationalCatalogCategory(input.id);
    await recordChange({ actorId: actor.id, action: "operational_catalog_category.archive", entityType: "operational_catalog_category", entityId: String(input.id), beforeState: { name: result.before.name, isActive: result.before.isActive }, afterState: { name: result.after.name, isActive: result.after.isActive } });
    return result;
  }),
  printCategoryGroups: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager" && actor.role !== "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Нет операционного доступа к категориям печати." });
    return listOperationalPrintCategoryGroups();
  }),
  createPrintGroup: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Создавать группы печати может только администратор." });
    const after = await createOperationalPrintGroup(input);
    await recordChange({ actorId: actor.id, action: "operational_print_group.create", entityType: "operational_print_group", entityId: String(after.id), afterState: { name: after.name } });
    return after;
  }),
  updatePrintGroup: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(128), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять группы печати может только администратор." });
    const result = await updateOperationalPrintGroup(input);
    await recordChange({ actorId: actor.id, action: input.isActive ? "operational_print_group.update" : "operational_print_group.archive", entityType: "operational_print_group", entityId: String(input.id), beforeState: { name: result.before.name, isActive: result.before.isActive }, afterState: { name: result.after.name, isActive: result.after.isActive } });
    return result;
  }),
  deletePrintGroup: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Удалять группы печати может только администратор." });
    const result = await deleteOperationalPrintGroup(input.id);
    await recordChange({ actorId: actor.id, action: "operational_print_group.delete", entityType: "operational_print_group", entityId: String(input.id), beforeState: { name: result.before.name, isActive: result.before.isActive }, afterState: { deleted: true, detachedWarehouses: result.detachedWarehouses } });
    return result;
  }),
  createPrintCategoryGroup: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(128), printMode: z.enum(["per_store", "grouped_stores"]).optional(), supplyPrintGroupId: z.number().int().positive().nullable().optional(), requestCommentSlot: z.enum(["slot_1", "slot_2"]).nullable().optional(), maxStoreCoverDays: z.number().int().min(1).max(14).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать категории печати может только администратор." });
    const after = await createOperationalPrintCategoryGroup({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_print_category_group.create", entityType: "operational_print_category_group", entityId: String(after.id), afterState: { name: after.name, printMode: after.printMode, supplyPrintGroupId: after.supplyPrintGroupId, requestCommentSlot: after.requestCommentSlot, maxStoreCoverDays: after.maxStoreCoverDays } });
    return after;
  }),
  updatePrintCategoryGroup: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(128), printMode: z.enum(["per_store", "grouped_stores"]), supplyPrintGroupId: z.number().int().positive().nullable(), requestCommentSlot: z.enum(["slot_1", "slot_2"]).nullable(), maxStoreCoverDays: z.number().int().min(1).max(14) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать категории печати может только администратор." });
    const result = await updateOperationalPrintCategoryGroup(input);
    await recordChange({ actorId: actor.id, action: "operational_print_category_group.update", entityType: "operational_print_category_group", entityId: String(input.id), beforeState: { name: result.before.name, printMode: result.before.printMode, supplyPrintGroupId: result.before.supplyPrintGroupId, requestCommentSlot: result.before.requestCommentSlot, maxStoreCoverDays: result.before.maxStoreCoverDays }, afterState: { name: result.after.name, printMode: result.after.printMode, supplyPrintGroupId: result.after.supplyPrintGroupId, requestCommentSlot: result.after.requestCommentSlot, maxStoreCoverDays: result.after.maxStoreCoverDays } });
    return result;
  }),
  deletePrintCategoryGroup: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать категории печати может только администратор." });
    const result = await deleteOperationalPrintCategoryGroup(input.id);
    await recordChange({ actorId: actor.id, action: "operational_print_category_group.delete", entityType: "operational_print_category_group", entityId: String(input.id), beforeState: { name: result.before.name, detachedMembers: result.detachedMembers }, afterState: { deleted: true } });
    return result;
  }),
  addPrintCategoryGroupMember: protectedProcedure.input(z.object({ groupId: z.number().int().positive(), memberType: z.enum(["catalog_category", "category_group"]), catalogCategoryId: z.number().int().positive().optional(), catalogCategory: z.string().trim().min(1).max(512).optional(), childGroupId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать категории печати может только администратор." });
    const result = await setOperationalPrintCategoryGroupMember(input);
    if (result.created) await recordChange({ actorId: actor.id, action: "operational_print_category_group.member.add", entityType: "operational_print_category_group", entityId: String(input.groupId), afterState: { memberType: input.memberType, catalogCategoryId: input.catalogCategoryId ?? null, catalogCategory: input.catalogCategory ?? null, childGroupId: input.childGroupId ?? null } });
    return result;
  }),
  removePrintCategoryGroupMember: protectedProcedure.input(z.object({ groupId: z.number().int().positive(), memberId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать категории печати может только администратор." });
    const before = await removeOperationalPrintCategoryGroupMember(input);
    await recordChange({ actorId: actor.id, action: "operational_print_category_group.member.remove", entityType: "operational_print_category_group", entityId: String(input.groupId), beforeState: { memberType: before.memberType, catalogCategory: before.catalogCategory, childGroupId: before.childGroupId } });
    return before;
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
  setWarehousePrintGroup: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), printGroupId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать группы печати склада может только администратор." });
    const result = await setOperationalWarehousePrintGroup({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.print_group.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before ? { printGroupId: result.before.printGroupId } : null, afterState: { printGroupId: result.after.printGroupId } });
    return result;
  }),
  setWarehouseEvotorMapping: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), evotorStoreId: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Связь склада с Эвотор может изменить только администратор." });
    const result = await setOperationalWarehouseEvotorMapping({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.evotor_mapping.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before, afterState: result.after });
    return result;
  }),
  setProductSalePrice: protectedProcedure.input(z.object({ productId: z.number().int().positive(), priceTypeId: z.number().int().positive(), salePrice: z.number().finite().min(0).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять продажную цену может только администратор." });
    const result = await setOperationalProductSalePrice({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: input.salePrice === null ? "operational_product_sale_price.delete" : "operational_product_sale_price.update", entityType: "operational_product_sale_price", entityId: `${input.productId}:${input.priceTypeId}`, beforeState: result.before ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.before.salePrice } : null, afterState: result.after ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.after.salePrice } : { deleted: true } });
    return result;
  }),
  products: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), includeUnknown: z.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const products = await listInventoryProducts({ storeId: input?.storeId, includeAccounting: actor.role !== "seller" && Boolean(input?.storeId), includeInactive: actor.role === "admin", includeUnknown: actor.role === "admin" && Boolean(input?.includeUnknown) });
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
  evotorSalesAnalytics: protectedProcedure.input(z.object({
    from: dateInput,
    to: dateInput,
    granularity: z.enum(["month", "week", "day", "hour"]),
    storeIds: z.array(z.number().int().positive()).max(64).optional(),
  })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Показатели чеков Эвотор доступны только администратору." });
    if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Дата начала не может быть позже даты окончания." });
    return listOperationalEvotorSalesAnalytics(input);
  }),
  evotorSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Статус загрузки чеков Эвотор доступен только администратору." });
    return getOperationalEvotorSyncStatus();
  }),
  requestStores: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOperationalStoreRequestStores({ storeIds });
  }),
  requestProducts: protectedProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const actor = await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    return listOperationalStoreRequestProducts({ ...input, includeHidden: actor.role === "admin" });
  }),
  requestList: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), status: z.enum(["draft", "closed"]).optional(), from: dateInput.optional(), to: dateInput.optional(), limit: z.number().int().min(1).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    if (input?.from && input?.to && input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Начало периода не может быть позже конца." });
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOperationalStoreRequests({ ...input, storeIds, limit: actor.role === "seller" ? Math.min(input?.limit ?? 10, 10) : input?.limit });
  }),
  requestDetail: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "view");
    return detail;
  }),
  createRequest: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), businessDate: dateInput, note: z.string().max(4_000).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "edit");
    if (actor.role !== "admin" && input.businessDate !== moscowToday()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Магазин может создавать заявку только на текущую дату." });
    }
    const result = await createOperationalStoreRequest({ ...input, createdByAccountId: actor.id });
    if (result.created) await recordChange({ actorId: actor.id, action: "store_request.create", entityType: "operational_store_request", entityId: String(result.request.id), afterState: { requestNumber: result.request.requestNumber, storeName: result.request.storeName, businessDate: result.request.businessDate, status: result.request.status } });
    return { created: result.created, request: await getOperationalStoreRequestDetail(result.request.id) };
  }),
  upsertRequestComment: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), slot: z.union([z.literal(1), z.literal(2)]), text: z.string().max(2_000) })).mutation(async ({ ctx, input }) => {
    const { actor } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    const result = await upsertOperationalStoreRequestComment({ ...input, actorId: actor.id });
    await recordChange({
      actorId: actor.id,
      action: result.after ? "store_request.comment.upsert" : "store_request.comment.delete",
      entityType: "operational_store_request_comment",
      entityId: `${input.requestId}:${input.slot}`,
      beforeState: result.before ? { categoryGroupId: result.before.printCategoryGroupId, categoryGroup: result.before.printCategoryGroupName, text: result.before.text } : null,
      afterState: result.after ? { categoryGroupId: result.after.printCategoryGroupId, categoryGroup: result.after.printCategoryGroupName, text: result.after.text } : { deleted: true },
    });
    return result;
  }),
  upsertRequestLine: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), productId: z.number().int().positive(), requestedQuantity: z.number().finite().positive().max(1_000_000), note: z.string().max(512).optional() })).mutation(async ({ ctx, input }) => {
    const { actor } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    const result = await upsertOperationalStoreRequestLine({ ...input, allowHidden: actor.role === "admin" });
    await recordChange({ actorId: actor.id, action: "store_request.line.upsert", entityType: "operational_store_request_line", entityId: `${input.requestId}:${input.productId}`, beforeState: result.before ? { quantity: result.before.requestedQuantity, note: result.before.note } : null, afterState: { product: result.product.canonicalName, catalogNumber: result.product.catalogNumber, quantity: result.after.requestedQuantity, unit: result.after.unit, note: result.after.note } });
    return result;
  }),
  addRequestManualLine: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), productName: z.string().trim().min(2).max(512), requestedQuantity: z.number().finite().positive().max(1_000_000), unit: z.enum(["kg", "l", "piece"]), printCategoryGroupId: z.number().int().positive(), note: z.string().max(512).optional() })).mutation(async ({ ctx, input }) => {
    const { actor } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    const after = await addOperationalStoreRequestManualLine(input);
    await recordChange({ actorId: actor.id, action: "store_request.line.manual_add", entityType: "operational_store_request_line", entityId: String(after.id), afterState: { product: after.productName, manual: true, quantity: after.requestedQuantity, unit: after.unit, printCategoryGroupId: after.manualPrintCategoryGroupId, note: after.note } });
    return after;
  }),
  removeRequestLine: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), productId: z.number().int().positive().optional(), lineId: z.number().int().positive().optional() }).refine(input => Boolean(input.productId || input.lineId), "Укажите строку заявки для удаления.")).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    const before = await removeOperationalStoreRequestLine(input);
    await recordChange({ actorId: actor.id, action: "store_request.line.remove", entityType: "operational_store_request_line", entityId: String(before.id), beforeState: { requestId: input.requestId, catalogNumber: before.catalogNumber || null, product: before.productName, manual: Boolean(before.manualProductName), quantity: before.requestedQuantity, unit: before.unit, note: before.note }, afterState: { deleted: true } });
    return before;
  }),
  closeRequest: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Продавец готовит заявку; закрывает ее руководитель или администратор." });
    const result = await closeOperationalStoreRequest({ requestId: input.requestId, closedByAccountId: actor.id });
    await recordChange({ actorId: actor.id, action: "store_request.close", entityType: "operational_store_request", entityId: String(input.requestId), beforeState: { requestNumber: result.before.requestNumber, storeName: detail.storeName, status: result.before.status, lineCount: detail.lines.length }, afterState: { status: result.after.status, closedAt: result.after.closedAt, lineCount: result.lineCount } });
    return result;
  }),
  deleteRequestDraft: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    const result = await deleteOperationalStoreRequestDraft(input.requestId);
    await recordChange({ actorId: actor.id, action: "store_request.draft.delete", entityType: "operational_store_request", entityId: String(input.requestId), beforeState: { requestNumber: result.before.requestNumber, storeName: detail.storeName, businessDate: result.before.businessDate, lineCount: result.lineCount }, afterState: { deleted: true } });
    return result;
  }),
  printRequests: protectedProcedure.input(z.object({ businessDate: dateInput, storeId: z.number().int().positive().optional(), printGroupIds: z.array(z.number().int().positive()).max(100).optional(), printCategoryGroupIds: z.array(z.number().int().positive()).max(200).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Печать заявок доступна только руководителю или администратору." });
    if (input.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const storeIds = input.storeId ? [input.storeId] : actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    if (Array.isArray(storeIds) && !storeIds.length) throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступных магазинов для печати заявок." });
    const projection = await getOperationalStoreRequestPrintProjection({ ...input, storeIds });
    await recordChange({ actorId: actor.id, action: "store_request.print", entityType: "operational_store_request_print", entityId: input.businessDate, afterState: { businessDate: input.businessDate, storeId: input.storeId ?? "all_accessible", printGroupIds: input.printGroupIds ?? "all", printCategoryGroupIds: input.printCategoryGroupIds ?? "all_active", sheets: projection.sheets.length, source: "closed_request_snapshots" } });
    return projection;
  }),
  requestPrintCandidates: protectedProcedure.input(z.object({ businessDate: dateInput, storeId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Закрытие заявок доступно только руководителю или администратору." });
    if (input.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const storeIds = input.storeId ? [input.storeId] : actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return { count: await countOperationalStoreRequestPrintCandidates({ businessDate: input.businessDate, storeIds }) };
  }),
  closeRequestsForPrint: protectedProcedure.input(z.object({ businessDate: dateInput })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Закрытие заявок доступно только руководителю или администратору." });
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    const result = await closeOperationalStoreRequestsForPrint({ businessDate: input.businessDate, storeIds, closedByAccountId: actor.id });
    if (result.requests.length) await recordChange({ actorId: actor.id, action: "store_request.close_for_print", entityType: "operational_store_request_print", entityId: input.businessDate, afterState: { businessDate: input.businessDate, requests: result.requests.map(request => ({ requestNumber: request.requestNumber, storeName: request.storeName, lineCount: request.lineCount })) } });
    return result;
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
  fillFromAccounting: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit", true);
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Продавцу не раскрываются учетные остатки для автозаполнения." });
    const result = await fillInventoryLinesFromAccounting(input.inventoryId);
    await recordChange({ actorId: actor.id, action: "inventory.lines.fill_from_accounting", entityType: "operational_inventory", entityId: String(input.inventoryId), beforeState: { storeName: detail.storeName, lineCount: detail.lines.length }, afterState: { added: result.added, preserved: result.preserved, unavailable: result.unavailable, policy: "only-known-accounting; manual-facts-preserved" } });
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
