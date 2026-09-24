import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAccessibleStoreIds, getCurrentLocalAccount, hasStoreAccess } from "../accessControl";
import {
  archiveOperationalCatalogProduct,
  permanentlyDeleteUnusedOperationalCatalogProduct,
  archiveClosedInventory,
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
  deleteOperationalStoreRequest,
  deleteOperationalStoreRequestDraft,
  deleteInventoryDraft,
  fillInventoryLinesFromAccounting,
  getInventoryAuditState,
  getInventoryDetail,
  getOperationalStoreRequestDetail,
  getOperationalStoreRequestPrintProjection,
  getOperationalRequestPrintSettings,
  getOperationalEvotorStockSnapshot,
  getOperationalEvotorSyncStatus,
  getOperationalEvotorReceiptDetail,
  reconcileOperationalEvotorPaymentFacts,
  listOperationalEvotorReceipts,
  listOperationalEvotorSalesAnalytics,
  listOperationalPriceTypes,
  listOperationalCatalogCategoryNames,
  listOperationalCatalogCategories,
  listOperationalPrintCategoryGroups,
  listOperationalPrintGroups,
  listOperationalOnecWarehouseGroupMappings,
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
  setOperationalCatalogEvotorExportEnabled,
  setOperationalOnecWarehouseGroupMapping,
  setOperationalRequestCommentCategory,
  setOperationalProductSalePrice,
  setOperationalWarehouseEvotorMapping,
  setOperationalWarehousePrintGroup,
  setOperationalWarehouseVisibility,
  saveOperationalStoreRequestDraft,
  setOperationalStoreRequestHidden,
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
import {
  createOperationalStockTransfer,
  createOperationalStockTransferReversal,
  deleteOperationalStockTransferDraft,
  getOperationalStockTransferRecommendation,
  getOperationalStockTransferDetail,
  listOperationalStockTransfers,
  postOperationalStockTransfer,
  removeOperationalStockTransferLine,
  upsertOperationalStockTransferLine,
} from "../stockTransfers";
import {
  confirmOnecShipmentReceipt,
  applyOnecPurchaseCostToCatalog,
  getOnecShipmentReceiptDetail,
  importOnecPackage,
  listOnecImportBatches,
  listOnecMappingOptions,
  listOnecPurchaseCosts,
  listOnecQuarantine,
  listOnecShipmentReceipts,
  listOnecShipmentLines,
  listOnecStoreShipments,
  listOnecWarehouseSummary,
  listOnecWarehouseSnapshots,
  reportOnecShipmentReceipt,
  resolveOnecQuarantineProduct,
  resolveOnecShipmentDestination,
} from "../onecImport";
import {
  getOnecInboundCredentialStatus,
  replaceOnecInboundCredential,
  revealOnecInboundCredential,
} from "../onecInboundCredentials";
import { queueAndDispatchOperationalEvotorBroadcast, queueAndDispatchOperationalEvotorCatalogArchive, queueAndDispatchOperationalEvotorOutbound, queueOperationalEvotorPriceChange, queueOperationalEvotorStoreCatalog } from "../evotorOutbound";
import { getOperationalEvotorPushSettings, listOperationalEvotorPushRecipients, sendOperationalEvotorPush, setOperationalEvotorPushApplication } from "../evotorPush";
import { recordChange } from "../localAuth";
import { hasNotificationEntityAccess } from "../notifications";
import { protectedProcedure, router } from "../_core/trpc";

const dateInput = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, "Выберите дату в формате ГГГГ-ММ-ДД");
/** The UI labels `fraction` as «кг» while the stored catalog code remains compatible with Evotor. */
const inventoryUnit = z.enum(["fraction", "l", "piece"]);
const markingCategory = z.enum(["none", "supplement", "seafood_caviar", "seafood_canned", "alcohol", "beer_marked", "beer_non_alcoholic", "soft_drinks", "water", "dairy"]);
const onecUnit = z.enum(["kg", "l", "piece"]);
const onecSnapshotRecord = z.object({ source_record_id: z.string().trim().min(1).max(191), location_code: z.string().trim().max(32).optional(), location_source_id: z.string().trim().max(32).optional(), product_source_id: z.string().trim().min(1).max(191), product_name: z.string().trim().max(512).nullable().optional(), quantity_on_hand: z.number().finite().min(0), quantity_available: z.number().finite().min(0).nullable().optional(), expiration_date: dateInput.nullable().optional(), business_date: dateInput, as_of: z.string().datetime({ offset: true }) });
const onecShipmentLine = z.object({ line_id: z.string().trim().min(1).max(191), product_source_id: z.string().trim().min(1).max(191), product_name: z.string().trim().max(512).nullable().optional(), quantity: z.number().finite().positive(), unit: onecUnit, expiration_date: dateInput.nullable().optional() });
const onecShipmentRecord = z.object({ shipment_id: z.string().trim().min(1).max(191), source_record_id: z.string().trim().min(1).max(191), revision_id: z.string().trim().min(1).max(191), business_date: dateInput, origin_warehouse_code: z.string().trim().max(32).optional(), origin_location_source_id: z.string().trim().max(32).optional(), destination_store_reference: z.string().trim().min(1).max(191), document_number: z.string().trim().max(128).nullable().optional(), status: z.enum(["posted", "cancelled", "corrected"]), lines: z.array(onecShipmentLine).min(1).max(2_000) });
const onecPurchaseCostRecord = z.object({ source_record_id: z.string().trim().min(1).max(191), product_source_id: z.string().trim().min(1).max(191), product_name: z.string().trim().max(512).nullable().optional(), unit: onecUnit, purchase_price: z.number().finite().min(0).max(10_000_000), effective_date: dateInput, warehouse_code: z.string().trim().max(32).nullable().optional(), basis: z.string().trim().max(512).nullable().optional() });
const onecPackageInput = z.object({ schema_version: z.string().trim().min(1).max(32), source_system: z.string().trim().min(1).max(128), entity: z.enum(["inventory_snapshots", "store_shipments", "purchase_costs"]), batch_id: z.string().trim().min(1).max(191), mode: z.enum(["snapshot", "delta"]), generated_at: z.string().datetime({ offset: true }), business_timezone: z.literal("Europe/Moscow"), as_of: z.string().datetime({ offset: true }).nullable().optional(), records: z.union([z.array(onecSnapshotRecord).min(1).max(10_000), z.array(onecShipmentRecord).min(1).max(10_000), z.array(onecPurchaseCostRecord).min(1).max(10_000)]) });
const onecReceiptReportInput = z.object({ shipmentId: z.number().int().positive(), storeNote: z.string().trim().max(512).optional(), lines: z.array(z.object({ shipmentLineId: z.number().int().positive(), actualQuantity: z.number().finite().min(0).max(10_000_000) })).min(1).max(2_000) });
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

async function stockTransferWithPermission(openId: string | null | undefined, transferId: number, action: "view" | "edit") {
  const detail = await getOperationalStockTransferDetail(transferId);
  if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Перемещение не найдено." });
  const actor = await localActor(openId);
  if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Перемещения доступны руководителю или администратору." });
  await requireInventoryStoreAccess(openId, detail.sourceStoreId, action);
  await requireInventoryStoreAccess(openId, detail.destinationStoreId, action);
  return { actor, detail };
}

async function shipmentReceiptWithPermission(openId: string | null | undefined, shipmentId: number, action: "view" | "edit") {
  const detail = await getOnecShipmentReceiptDetail({ shipmentId });
  if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Накладная недоступна для приёмки." });
  const actor = await requireInventoryStoreAccess(openId, detail.storeId, action);
  return { actor, detail };
}

/**
 * Aggregate receipt facts are read-only between the scheduled current-day cycles.
 * A short, process-local cache keeps a repeated navigation from reconstructing the
 * same 30-day product projection while never bypassing the admin gate below.
 */
const EVOTOR_SALES_ANALYTICS_CACHE_TTL_MS = 20_000;
type EvotorSalesAnalyticsInput = {
  from: string;
  to: string;
  granularity: "month" | "week" | "day" | "hour";
  storeIds?: number[];
  includeProducts?: boolean;
};
type EvotorSalesAnalyticsResult = Awaited<ReturnType<typeof listOperationalEvotorSalesAnalytics>>;
const evotorSalesAnalyticsCache = new Map<string, { expiresAt: number; value: EvotorSalesAnalyticsResult }>();

function evotorSalesAnalyticsCacheKey(input: EvotorSalesAnalyticsInput) {
  return JSON.stringify({
    from: input.from,
    to: input.to,
    granularity: input.granularity,
    storeIds: input.storeIds?.slice().sort((left, right) => left - right) ?? [],
    includeProducts: input.includeProducts !== false,
  });
}

async function cachedOperationalEvotorSalesAnalytics(input: EvotorSalesAnalyticsInput) {
  const now = Date.now();
  const key = evotorSalesAnalyticsCacheKey(input);
  const cached = evotorSalesAnalyticsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await listOperationalEvotorSalesAnalytics(input);
  evotorSalesAnalyticsCache.set(key, { expiresAt: now + EVOTOR_SALES_ANALYTICS_CACHE_TTL_MS, value });
  if (evotorSalesAnalyticsCache.size > 32) {
    for (const [cacheKey, entry] of Array.from(evotorSalesAnalyticsCache.entries())) {
      if (entry.expiresAt <= now || evotorSalesAnalyticsCache.size > 32) evotorSalesAnalyticsCache.delete(cacheKey);
    }
  }
  return value;
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
  createCatalogProduct: protectedProcedure.input(z.object({ canonicalName: z.string().trim().min(1).max(512), evotorCategoryName: z.string().trim().max(512).nullable().optional(), catalogCategoryId: z.number().int().positive().nullable().optional(), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]).optional(), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable().optional(), isEvotorCostExportEnabled: z.boolean().optional(), markingCategory: markingCategory.optional(), alcoholCode: z.string().trim().max(255).nullable().optional(), alcoholTypeCode: z.string().trim().max(64).nullable().optional(), alcoholStrengthPercent: z.number().finite().min(0).max(100).nullable().optional(), alcoholVolumeLiters: z.number().finite().min(0).max(1_000).nullable().optional(), manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean().optional(), isEvotorExportEnabled: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Добавлять номенклатуру может только администратор." });
    const after = await createOperationalCatalogProduct({ ...input, actorId: actor.id });
    const outbound = after.isEvotorExportEnabled
      ? { ...await queueAndDispatchOperationalEvotorBroadcast({ productIds: [after.id], reason: "catalog_create", sourceKey: `catalog-create:${after.id}` }), delivery: "queued_and_dispatched" as const }
      : null;
    await recordChange({ actorId: actor.id, action: "operational_catalog.manual.create", entityType: "operational_catalog_product", entityId: String(after.id), afterState: { product: after.canonicalName, categoryId: after.catalogCategoryId, category: after.evotorCategoryName, unit: after.baseUnit, vatRate: after.vatRate, markingCategory: after.markingCategory, alcoholCode: after.alcoholCode, alcoholTypeCode: after.alcoholTypeCode, alcoholStrengthPercent: after.alcoholStrengthPercent, manualBarcodes: after.manualBarcodes, isVisibleInRequests: after.isVisibleInRequests, isEvotorExportEnabled: after.isEvotorExportEnabled, internalCostPrice: after.internalCostPrice, isEvotorCostExportEnabled: after.isEvotorCostExportEnabled, outbound } });
    return after;
  }),
  updateCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), canonicalName: z.string().trim().min(1).max(512), evotorCategoryName: z.string().trim().max(512).nullable().optional(), catalogCategoryId: z.number().int().positive().nullable().optional(), baseUnit: inventoryUnit, vatRate: z.enum(["VAT_10", "VAT_22"]), internalCostPrice: z.number().finite().min(0).max(10_000_000).nullable().optional(), isEvotorCostExportEnabled: z.boolean().optional(), markingCategory, alcoholCode: z.string().trim().max(255).nullable().optional(), alcoholTypeCode: z.string().trim().max(64).nullable().optional(), alcoholStrengthPercent: z.number().finite().min(0).max(100).nullable().optional(), alcoholVolumeLiters: z.number().finite().min(0).max(1_000).nullable().optional(), manualBarcodes: z.string().max(4_000).nullable().optional(), isVisibleInRequests: z.boolean(), isEvotorExportEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Изменять номенклатуру может только администратор." });
    const result = await updateOperationalCatalogProduct(input);
    const outbound = result.after.isEvotorExportEnabled
      ? { ...await queueAndDispatchOperationalEvotorBroadcast({ productIds: [input.id], reason: "catalog_update", sourceKey: `catalog-update:${input.id}:${result.after.updatedAt.getTime()}` }), delivery: "queued_and_dispatched" as const }
      : null;
    await recordChange({ actorId: actor.id, action: "operational_catalog.update", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, categoryId: result.before.catalogCategoryId, category: result.before.evotorCategoryName, unit: result.before.baseUnit, vatRate: result.before.vatRate, markingCategory: result.before.markingCategory, alcoholCode: result.before.alcoholCode, alcoholTypeCode: result.before.alcoholTypeCode, alcoholStrengthPercent: result.before.alcoholStrengthPercent, manualBarcodes: result.before.manualBarcodes, isVisibleInRequests: result.before.isVisibleInRequests, isEvotorExportEnabled: result.before.isEvotorExportEnabled, internalCostPrice: result.before.internalCostPrice, isEvotorCostExportEnabled: result.before.isEvotorCostExportEnabled }, afterState: { product: result.after.canonicalName, categoryId: result.after.catalogCategoryId, category: result.after.evotorCategoryName, unit: result.after.baseUnit, vatRate: result.after.vatRate, markingCategory: result.after.markingCategory, alcoholCode: result.after.alcoholCode, alcoholTypeCode: result.after.alcoholTypeCode, alcoholStrengthPercent: result.after.alcoholStrengthPercent, manualBarcodes: result.after.manualBarcodes, isVisibleInRequests: result.after.isVisibleInRequests, isEvotorExportEnabled: result.after.isEvotorExportEnabled, internalCostPrice: result.after.internalCostPrice, isEvotorCostExportEnabled: result.after.isEvotorCostExportEnabled, outbound } });
    return result;
  }),
  setCatalogEvotorExportEnabled: protectedProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(2_000), isEvotorExportEnabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать выгрузку номенклатуры в Эвотор может только администратор." });
    const result = await setOperationalCatalogEvotorExportEnabled(input);
    const outbound = input.isEvotorExportEnabled
      ? { ...await queueAndDispatchOperationalEvotorBroadcast({ productIds: input.productIds, reason: "catalog_enable", sourceKey: `catalog-enable:${Date.now()}` }), delivery: "queued_and_dispatched" as const }
      : null;
    await recordChange({
      actorId: actor.id,
      action: "operational_catalog.evotor_export.configure",
      entityType: "operational_catalog_export_selection",
      entityId: input.isEvotorExportEnabled ? "enabled" : "disabled",
      afterState: { productCount: result.productCount, changed: result.changed, isEvotorExportEnabled: result.isEvotorExportEnabled, productNames: result.productNames, outbound },
    });
    return result;
  }),
  archiveCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Скрывать номенклатуру может только администратор." });
    const result = await archiveOperationalCatalogProduct(input.id);
    const queued = result.before.isActive && result.before.isEvotorExportEnabled
      ? await queueAndDispatchOperationalEvotorCatalogArchive({ productId: input.id, sourceKey: `catalog-archive:${input.id}:${result.after.updatedAt.getTime()}` })
      : null;
    await recordChange({ actorId: actor.id, action: "operational_catalog.archive", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, isActive: result.before.isActive, isEvotorExportEnabled: result.before.isEvotorExportEnabled }, afterState: { product: result.after.canonicalName, isActive: result.after.isActive, outbound: queued ? { ...queued, delivery: "queued_and_dispatched" as const } : null } });
    return result;
  }),
  permanentlyDeleteCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Безвозвратно удалять номенклатуру может только администратор." });
    const result = await permanentlyDeleteUnusedOperationalCatalogProduct(input.id);
    await recordChange({ actorId: actor.id, action: "operational_catalog.permanent_delete", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.canonicalName, catalogNumber: result.catalogNumber }, afterState: { permanentlyDeleted: true } });
    return result;
  }),
  restoreCatalogProduct: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Возвращать номенклатуру может только администратор." });
    const result = await restoreOperationalCatalogProduct(input.id);
    const outbound = !result.before.isActive && result.after.isEvotorExportEnabled
      ? { ...await queueAndDispatchOperationalEvotorBroadcast({ productIds: [input.id], reason: "catalog_enable", sourceKey: `catalog-restore:${input.id}:${result.after.updatedAt.getTime()}` }), delivery: "queued_and_dispatched" as const }
      : null;
    await recordChange({ actorId: actor.id, action: "operational_catalog.restore", entityType: "operational_catalog_product", entityId: String(input.id), beforeState: { product: result.before.canonicalName, isActive: result.before.isActive, isEvotorExportEnabled: result.before.isEvotorExportEnabled }, afterState: { product: result.after.canonicalName, isActive: result.after.isActive, outbound } });
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
  evotorPushSettings: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки push Эвотор доступны только администратору." });
    return getOperationalEvotorPushSettings();
  }),
  evotorPushRecipients: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Получатели push Эвотор доступны только администратору." });
    return listOperationalEvotorPushRecipients();
  }),
  setEvotorPushApplication: protectedProcedure.input(z.object({ applicationId: z.string().trim().min(3).max(128) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать приложение push Эвотор может только администратор." });
    const result = await setOperationalEvotorPushApplication({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_evotor_push.application.configure", entityType: "operational_evotor_push", entityId: "application", beforeState: result.before, afterState: result.after });
    return result.after;
  }),
  sendEvotorPush: protectedProcedure.input(z.object({ message: z.string().trim().min(1).max(1_700), storeIds: z.array(z.number().int().positive()).max(100).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Отправлять push на кассы Эвотор может только администратор." });
    let result;
    try {
      result = await sendOperationalEvotorPush(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка push Эвотор.";
      await recordChange({ actorId: actor.id, action: "operational_evotor_push.send_failed", entityType: "operational_evotor_push", entityId: input.storeIds?.join(",") || "all", afterState: { messageLength: input.message.trim().length, storeIds: input.storeIds ?? null, error: message } });
      throw error;
    }
    await recordChange({ actorId: actor.id, action: "operational_evotor_push.send", entityType: "operational_evotor_push", entityId: result.storeIds.join(","), afterState: { applicationId: result.applicationId, messageLength: result.messageLength, recipientCount: result.recipientCount, storeIds: result.storeIds, storeNames: result.storeNames, requests: result.requests } });
    return result;
  }),
  printGroups: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Группы печати доступны только руководителю или администратору." });
    return listOperationalPrintGroups(true);
  }),
  onecWarehouseGroupMappings: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки складов 1С доступны только администратору." });
    return listOperationalOnecWarehouseGroupMappings();
  }),
  setOnecWarehouseGroupMapping: protectedProcedure.input(z.object({ warehouseCode: z.enum(["BM", "SRS"]), printGroupId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать склады 1С может только администратор." });
    const result = await setOperationalOnecWarehouseGroupMapping({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_onec_warehouse_group.assign", entityType: "operational_onec_warehouse_group", entityId: input.warehouseCode, beforeState: result.before, afterState: result.after });
    return result;
  }),
  requestPrintSettings: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати доступны только администратору." });
    return getOperationalRequestPrintSettings();
  }),
  updateRequestPrintSettings: protectedProcedure.input(z.object({
    zebraMode: z.enum(["none", "rows", "columns"]),
    headingFontSize: z.number().int().min(7).max(14),
    bodyFontSize: z.number().int().min(7).max(14),
    totalFontSize: z.number().int().min(7).max(14),
    headingBold: z.boolean(),
    bodyBold: z.boolean(),
    totalBold: z.boolean(),
    showStoreQuantity: z.boolean(),
    showAverageDailySales: z.boolean(),
    showSalesCover: z.boolean(),
    showOverstockSignal: z.boolean(),
    recommendationFontSize: z.number().int().min(6).max(10),
    recommendationTone: z.enum(["muted", "dark"]),
  })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройки печати может менять только администратор." });
    const result = await updateOperationalRequestPrintSettings({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_request_print_settings.update", entityType: "operational_request_print_settings", entityId: "network", beforeState: result.before ? { zebraMode: result.before.zebraMode, headingFontSize: result.before.headingFontSize, bodyFontSize: result.before.bodyFontSize, totalFontSize: result.before.totalFontSize, headingBold: result.before.headingBold, bodyBold: result.before.bodyBold, totalBold: result.before.totalBold, showStoreQuantity: result.before.showStoreQuantity, showAverageDailySales: result.before.showAverageDailySales, showSalesCover: result.before.showSalesCover, showOverstockSignal: result.before.showOverstockSignal, recommendationFontSize: result.before.recommendationFontSize, recommendationTone: result.before.recommendationTone } : null, afterState: { zebraMode: result.after.zebraMode, headingFontSize: result.after.headingFontSize, bodyFontSize: result.after.bodyFontSize, totalFontSize: result.after.totalFontSize, headingBold: result.after.headingBold, bodyBold: result.after.bodyBold, totalBold: result.after.totalBold, showStoreQuantity: result.after.showStoreQuantity, showAverageDailySales: result.after.showAverageDailySales, showSalesCover: result.after.showSalesCover, showOverstockSignal: result.after.showOverstockSignal, recommendationFontSize: result.after.recommendationFontSize, recommendationTone: result.after.recommendationTone } });
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
    await recordChange({ actorId: actor.id, action: "operational_catalog_category.archive", entityType: "operational_catalog_category", entityId: String(input.id), beforeState: { name: result.before.name, isActive: result.before.isActive }, afterState: { name: result.after.name, isActive: result.after.isActive, detachedProducts: result.detachedProducts, detachedPrintMembers: result.detachedPrintMembers } });
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
  setRequestCommentCategory: protectedProcedure.input(z.object({ slot: z.enum(["slot_1", "slot_2"]), categoryGroupId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать комментарии печати может только администратор." });
    const result = await setOperationalRequestCommentCategory(input);
    await recordChange({ actorId: actor.id, action: "operational_request_comment_category.assign", entityType: "operational_print_category_group", entityId: input.slot, beforeState: result.before, afterState: result.after });
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
    const outbound = await queueOperationalEvotorStoreCatalog({ storeId: input.storeId, reason: "price_update", sourceKey: `store-price-type:${input.storeId}:${input.priceTypeId}` });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.price_type.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before ? { priceTypeId: result.before.priceTypeId } : null, afterState: { priceTypeId: result.after.priceTypeId, outbound } });
    return result;
  }),
  setWarehousePrintGroup: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), printGroupId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настраивать группы печати склада может только администратор." });
    const result = await setOperationalWarehousePrintGroup({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.print_group.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before ? { printGroupId: result.before.printGroupId } : null, afterState: { printGroupId: result.after.printGroupId } });
    return result;
  }),
  setWarehouseVisibility: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), isHidden: z.boolean() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять видимость склада может только администратор." });
    const result = await setOperationalWarehouseVisibility(input);
    await recordChange({ actorId: actor.id, action: "operational_warehouse.visibility", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: { store: result.before.name, isHidden: result.before.isHidden }, afterState: { store: result.after.name, isHidden: result.after.isHidden, visibility: result.after.isHidden ? "скрыт из рабочих списков" : "виден в рабочих списках" } });
    return result;
  }),
  setWarehouseEvotorMapping: protectedProcedure.input(z.object({ storeId: z.number().int().positive(), evotorStoreId: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Связь склада с Эвотор может изменить только администратор." });
    const result = await setOperationalWarehouseEvotorMapping({ ...input, actorId: actor.id });
    const outbound = await queueOperationalEvotorStoreCatalog({ storeId: input.storeId, reason: "warehouse_mapping", sourceKey: `warehouse-mapping:${input.storeId}:${input.evotorStoreId}` });
    await recordChange({ actorId: actor.id, action: "operational_warehouse.evotor_mapping.assign", entityType: "operational_warehouse", entityId: String(input.storeId), beforeState: result.before, afterState: { ...result.after, outbound } });
    return result;
  }),
  setProductSalePrice: protectedProcedure.input(z.object({ productId: z.number().int().positive(), priceTypeId: z.number().int().positive(), salePrice: z.number().finite().min(0).max(10_000_000).nullable() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Менять продажную цену может только администратор." });
    const result = await setOperationalProductSalePrice({ ...input, actorId: actor.id });
    const outbound = await queueOperationalEvotorPriceChange({ productId: input.productId, priceTypeId: input.priceTypeId, sourceKey: `sale-price:${input.productId}:${input.priceTypeId}:${Date.now()}` });
    await recordChange({ actorId: actor.id, action: input.salePrice === null ? "operational_product_sale_price.delete" : "operational_product_sale_price.update", entityType: "operational_product_sale_price", entityId: `${input.productId}:${input.priceTypeId}`, beforeState: result.before ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.before.salePrice } : null, afterState: result.after ? { product: result.product.canonicalName, priceType: result.priceType.name, salePrice: result.after.salePrice, outbound } : { deleted: true, outbound } });
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
  stock: protectedProcedure.input(z.object({ storeId: z.number().int().positive().optional(), query: z.string().max(160).optional(), category: z.string().max(512).optional(), sort: z.enum(["code", "store", "product", "quantity", "value"]).optional(), direction: z.enum(["asc", "desc"]).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(2_000).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (input?.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOperationalStock({ ...input, storeIds, storeId: input?.storeId, limit: input?.limit ?? 50 });
  }),
  onecImportBatches: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Реестр импорта 1С доступен только администратору." });
    return listOnecImportBatches();
  }),
  onecWarehouseSnapshots: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Остатки из 1С доступны только администратору." });
    return listOnecWarehouseSnapshots(input?.limit ?? 120);
  }),
  onecPurchaseCosts: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Закупочные цены 1С доступны только администратору." });
    return listOnecPurchaseCosts(input?.limit ?? 160);
  }),
  applyOnecPurchaseCost: protectedProcedure.input(z.object({ costId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Применять закупочную цену 1С может только администратор." });
    const result = await applyOnecPurchaseCostToCatalog({ costId: input.costId, actorId: actor.id });
    const outbound = result.after.isEvotorCostExportEnabled && result.after.isEvotorExportEnabled
      ? { ...await queueAndDispatchOperationalEvotorBroadcast({ productIds: [result.cost.productId], reason: "catalog_update", sourceKey: `onec-purchase-cost:${input.costId}:${result.cost.effectiveDate}` }), delivery: "queued_and_dispatched" as const }
      : { delivery: "not_requested" as const, reason: "Передача закупочной цены в Эвотор выключена в карточке товара" };
    await recordChange({ actorId: actor.id, action: "operational_onec.purchase_cost.apply", entityType: "operational_onec_purchase_cost", entityId: String(input.costId), beforeState: result.before, afterState: { ...result.after, effectiveDate: result.cost.effectiveDate, warehouseCode: result.cost.warehouseCode, outbound } });
    return { ...result, outbound };
  }),
  onecWarehouseSummary: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Сводка основных складов 1С доступна административному персоналу." });
    return listOnecWarehouseSummary();
  }),
  onecStoreShipments: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Накладные из 1С доступны только администратору." });
    return listOnecStoreShipments(input?.limit ?? 120);
  }),
  onecShipmentLines: protectedProcedure.input(z.object({ shipmentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Строки накладной 1С доступны только администратору." });
    return listOnecShipmentLines(input.shipmentId);
  }),
  onecShipmentReceipts: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOnecShipmentReceipts({ storeIds, limit: input?.limit ?? 80 });
  }),
  onecShipmentReceiptDetail: protectedProcedure.input(z.object({ shipmentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { detail } = await shipmentReceiptWithPermission(ctx.user.openId, input.shipmentId, "view");
    return detail;
  }),
  reportOnecShipmentReceipt: protectedProcedure.input(onecReceiptReportInput).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await shipmentReceiptWithPermission(ctx.user.openId, input.shipmentId, "edit");
    const result = await reportOnecShipmentReceipt({ ...input, actorId: actor.id });
    const outbound = result.appliedMovements
      ? await queueAndDispatchOperationalEvotorOutbound({ storeIds: [detail.storeId], productIds: detail.lines.map(line => line.productId), reason: "shipment_receipt", sourceKey: `shipment-receipt:${result.receiptId}` })
      : null;
    await recordChange({ actorId: actor.id, action: "operational_onec.shipment_receipt.report", entityType: "operational_onec_shipment_receipt", entityId: String(result.receiptId), afterState: { shipmentId: detail.id, storeId: detail.storeId, status: result.status, differenceCount: result.differenceCount, appliedMovements: result.appliedMovements, stockPolicy: result.stockPolicy, outbound } });
    return result;
  }),
  confirmOnecShipmentReceipt: protectedProcedure.input(z.object({ shipmentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await shipmentReceiptWithPermission(ctx.user.openId, input.shipmentId, "edit");
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Расхождение приёмки подтверждает только руководитель или администратор." });
    const result = await confirmOnecShipmentReceipt({ shipmentId: input.shipmentId, actorId: actor.id });
    const outbound = result.appliedMovements
      ? await queueAndDispatchOperationalEvotorOutbound({ storeIds: [detail.storeId], productIds: detail.lines.map(line => line.productId), reason: "shipment_receipt", sourceKey: `shipment-confirm:${result.receiptId}` })
      : null;
    await recordChange({ actorId: actor.id, action: "operational_onec.shipment_receipt.confirm", entityType: "operational_onec_shipment_receipt", entityId: String(result.receiptId), afterState: { shipmentId: detail.id, storeId: detail.storeId, status: result.status, differenceCount: result.differenceCount, appliedMovements: result.appliedMovements, stockPolicy: result.stockPolicy, outbound } });
    return result;
  }),
  onecQuarantine: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Карантин импорта 1С доступен только администратору." });
    return listOnecQuarantine(input?.limit ?? 120);
  }),
  onecMappingOptions: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Сопоставление 1С доступно только администратору." });
    return listOnecMappingOptions();
  }),
  onecInboundCredentialStatus: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Настройка входящего обмена 1С доступна только администратору." });
    return getOnecInboundCredentialStatus();
  }),
  revealOnecInboundCredential: protectedProcedure.mutation(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Ключ входящего обмена 1С может раскрыть только администратор." });
    return { token: await revealOnecInboundCredential() };
  }),
  replaceOnecInboundCredential: protectedProcedure.input(z.object({ token: z.string().trim().min(24).max(4096) })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Ключ входящего обмена 1С может заменить только администратор." });
    return replaceOnecInboundCredential(input.token, actor.id);
  }),
  importOnecPackage: protectedProcedure.input(onecPackageInput).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Принимать пакет 1С может только администратор." });
    const packet = input.entity === "inventory_snapshots"
      ? { ...input, records: input.records as z.infer<typeof onecSnapshotRecord>[] }
      : input.entity === "purchase_costs"
        ? { ...input, records: input.records as z.infer<typeof onecPurchaseCostRecord>[] }
        : { ...input, records: input.records as z.infer<typeof onecShipmentRecord>[] };
    const result = await importOnecPackage({ packet, actorId: actor.id });
    if (result.created) await recordChange({ actorId: actor.id, action: "operational_onec.import", entityType: "operational_onec_import_batch", entityId: String(result.batch.id), afterState: { entity: result.batch.entity, totalRecords: result.batch.totalRecords, acceptedRecords: result.batch.acceptedRecords, quarantinedRecords: result.batch.quarantinedRecords, status: result.batch.status, policy: "separate registry; no automatic store stock or external write" } });
    return result;
  }),
  resolveOnecQuarantineProduct: protectedProcedure.input(z.object({ kind: z.enum(["snapshot", "shipment", "purchase_cost"]), id: z.number().int().positive(), productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Сопоставлять товары 1С может только администратор." });
    const result = await resolveOnecQuarantineProduct({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_onec.product_map", entityType: "operational_onec_quarantine", entityId: `${input.kind}:${input.id}`, afterState: { product: result.product.canonicalName, policy: "explicit mapping; source id not logged" } });
    return result;
  }),
  resolveOnecShipmentDestination: protectedProcedure.input(z.object({ shipmentId: z.number().int().positive(), storeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Сопоставлять получателя накладной 1С может только администратор." });
    const result = await resolveOnecShipmentDestination({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "operational_onec.destination_map", entityType: "operational_onec_shipment", entityId: String(input.shipmentId), afterState: { destinationStore: result.store.name, policy: "explicit mapping; source reference not logged" } });
    return result;
  }),
  stockTransfers: protectedProcedure.input(z.object({ from: dateInput.optional(), to: dateInput.optional(), limit: z.number().int().min(1).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Перемещения доступны руководителю или администратору." });
    if (input?.from && input.to && input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Начало периода не может быть позже конца." });
    const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    return listOperationalStockTransfers({ storeIds, from: input?.from, to: input?.to, limit: input?.limit ?? 20 });
  }),
  stockTransferDetail: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { detail } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "view");
    return detail;
  }),
  stockTransferRecommendation: protectedProcedure.input(z.object({ sourceStoreId: z.number().int().positive(), destinationStoreId: z.number().int().positive(), productId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Перемещения доступны руководителю или администратору." });
    await requireInventoryStoreAccess(ctx.user.openId, input.sourceStoreId, "view");
    await requireInventoryStoreAccess(ctx.user.openId, input.destinationStoreId, "view");
    return getOperationalStockTransferRecommendation(input);
  }),
  createStockTransfer: protectedProcedure.input(z.object({ sourceStoreId: z.number().int().positive(), destinationStoreId: z.number().int().positive(), businessDate: dateInput, note: z.string().max(512).optional() })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role === "seller") throw new TRPCError({ code: "FORBIDDEN", message: "Перемещения доступны руководителю или администратору." });
    await requireInventoryStoreAccess(ctx.user.openId, input.sourceStoreId, "edit");
    await requireInventoryStoreAccess(ctx.user.openId, input.destinationStoreId, "edit");
    const result = await createOperationalStockTransfer({ ...input, createdByAccountId: actor.id });
    await recordChange({ actorId: actor.id, action: "stock_transfer.create", entityType: "operational_stock_transfer", entityId: String(result.transfer.id), afterState: { ...result.transfer, sourceStoreName: result.sourceStoreName, destinationStoreName: result.destinationStoreName } });
    return result;
  }),
  upsertStockTransferLine: protectedProcedure.input(z.object({ transferId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().finite().positive().max(1_000_000) })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "edit");
    const result = await upsertOperationalStockTransferLine(input);
    await recordChange({ actorId: actor.id, action: "stock_transfer.line.upsert", entityType: "operational_stock_transfer_line", entityId: `${input.transferId}:${input.productId}`, beforeState: result.before, afterState: { ...result.after, sourceStoreId: detail.sourceStoreId, destinationStoreId: detail.destinationStoreId } });
    return result;
  }),
  removeStockTransferLine: protectedProcedure.input(z.object({ transferId: z.number().int().positive(), productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "edit");
    const result = await removeOperationalStockTransferLine(input);
    await recordChange({ actorId: actor.id, action: "stock_transfer.line.remove", entityType: "operational_stock_transfer_line", entityId: `${input.transferId}:${input.productId}`, beforeState: result.before, afterState: { deleted: true } });
    return result;
  }),
  deleteStockTransferDraft: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "edit");
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Удалять черновики перемещений может только администратор." });
    const result = await deleteOperationalStockTransferDraft(input.transferId);
    await recordChange({ actorId: actor.id, action: "stock_transfer.draft.delete", entityType: "operational_stock_transfer", entityId: String(input.transferId), beforeState: result.before, afterState: { deleted: true, lineCount: result.lines.length } });
    return result;
  }),
  createStockTransferReversal: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "edit");
    const result = await createOperationalStockTransferReversal({ transferId: input.transferId, createdByAccountId: actor.id });
    await recordChange({ actorId: actor.id, action: "stock_transfer.reversal.create", entityType: "operational_stock_transfer", entityId: String(result.transfer.id), beforeState: { originalTransferId: result.original.id, originalTransferNumber: result.original.transferNumber, sourceStoreName: detail.sourceStoreName, destinationStoreName: detail.destinationStoreName }, afterState: { ...result.transfer, sourceStoreName: result.sourceStoreName, destinationStoreName: result.destinationStoreName, lineCount: result.lineCount } });
    return result;
  }),
  postStockTransfer: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await stockTransferWithPermission(ctx.user.openId, input.transferId, "edit");
    const result = await postOperationalStockTransfer({ transferId: input.transferId, postedByAccountId: actor.id });
    const outbound = await queueAndDispatchOperationalEvotorOutbound({ storeIds: [result.after.sourceStoreId, result.after.destinationStoreId], productIds: result.lines.map(line => line.productId), reason: "transfer", sourceKey: `transfer:${input.transferId}` });
    await recordChange({ actorId: actor.id, action: result.before.reversalOfTransferId ? "stock_transfer.reversal.post" : "stock_transfer.post", entityType: "operational_stock_transfer", entityId: String(input.transferId), beforeState: { ...result.before, sourceStoreName: detail.sourceStoreName, destinationStoreName: detail.destinationStoreName }, afterState: { ...result.after, lineCount: result.lines.length, pairedMovementCount: result.movements.length, outbound } });
    return result;
  }),
  evotorSalesAnalytics: protectedProcedure.input(z.object({
    from: dateInput,
    to: dateInput,
    granularity: z.enum(["month", "week", "day", "hour"]),
    storeIds: z.array(z.number().int().positive()).max(64).optional(),
    includeProducts: z.boolean().optional(),
  })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Показатели чеков Эвотор доступны только администратору." });
    if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Дата начала не может быть позже даты окончания." });
    return cachedOperationalEvotorSalesAnalytics(input);
  }),
  evotorStockSnapshot: protectedProcedure.input(z.object({
    storeIds: z.array(z.number().int().positive()).max(64).optional(),
  }).optional()).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Остатки Эвотор доступны только администратору." });
    return getOperationalEvotorStockSnapshot({ storeIds: input?.storeIds });
  }),
  evotorReceipts: protectedProcedure.input(z.object({
    from: dateInput,
    to: dateInput,
    storeIds: z.array(z.number().int().positive()).max(64).optional(),
    search: z.string().trim().max(64).optional(),
    limit: z.number().int().min(1).max(30).optional(),
    offset: z.number().int().min(0).max(10_000).optional(),
  })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Реестр чеков Эвотор доступен только администратору." });
    if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "Дата начала не может быть позже даты окончания." });
    return listOperationalEvotorReceipts(input);
  }),
  evotorReceiptDetail: protectedProcedure.input(z.object({ receiptId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Состав чеков Эвотор доступен только администратору." });
    return getOperationalEvotorReceiptDetail({ ...input, storeIds: null });
  }),
  evotorReturnNotificationDetail: protectedProcedure.input(z.object({ receiptId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    const entityId = `evotor_return:${input.receiptId}`;
    if (actor.role !== "admin" && !await hasNotificationEntityAccess(actor.id, "operational_signal", entityId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Этот возврат не был адресован вашей учетной записи." });
    }
    const detail = await getOperationalEvotorReceiptDetail({ ...input, storeIds: null, documentTypes: ["PAYBACK", "RETURN", "SELL_RETURN"] });
    if (actor.role !== "admin" && !await hasStoreAccess(ctx.user.openId, detail.storeId, "view")) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Нет текущего доступа к магазину этого возврата." });
    }
    return { id: detail.id, storeName: detail.storeName, receiptNumber: detail.receiptNumber, typeLabel: detail.typeLabel, occurredAt: detail.occurredAt, total: detail.total, positions: detail.positions.map(position => ({ id: position.id, productName: position.productName, quantity: position.quantity, unit: position.unit })) };
  }),
  evotorSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Статус загрузки чеков Эвотор доступен только администратору." });
    return getOperationalEvotorSyncStatus();
  }),
  reconcileEvotorPayments: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Сверка оплат Эвотор доступна только администратору." });
    const result = await reconcileOperationalEvotorPaymentFacts({ limit: input?.limit });
    await recordChange({
      actorId: actor.id,
      action: "evotor_payment.reconcile",
      entityType: "operational_evotor_document",
      entityId: "payment-facts",
      afterState: result,
    });
    return result;
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
  saveRequestDraft: protectedProcedure.input(z.object({
    requestId: z.number().int().positive(),
    businessDate: dateInput.optional(),
    lines: z.array(z.object({ productId: z.number().int().positive(), requestedQuantity: z.number().finite().positive().max(1_000_000) })).max(2_000),
    comments: z.array(z.object({ slot: z.union([z.literal(1), z.literal(2)]), text: z.string().max(2_000) })).length(2),
  }).superRefine((input, context) => {
    if (new Set(input.lines.map(line => line.productId)).size !== input.lines.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Один товар нельзя сохранить в заявке дважды.", path: ["lines"] });
    if (new Set(input.comments.map(comment => comment.slot)).size !== 2) context.addIssue({ code: z.ZodIssueCode.custom, message: "Передайте оба комментария черновика.", path: ["comments"] });
  })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    if (input.businessDate !== undefined && input.businessDate !== detail.businessDate && actor.role === "seller") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Продавец не может переносить дату открытой заявки." });
    }
    const result = await saveOperationalStoreRequestDraft({ ...input, actorId: actor.id, allowHidden: actor.role === "admin" });
    await recordChange({
      actorId: actor.id,
      action: "store_request.draft.save",
      entityType: "operational_store_request",
      entityId: String(input.requestId),
      beforeState: { requestNumber: detail.requestNumber, storeName: detail.storeName, businessDate: result.before.businessDate, lineCount: result.before.lineCount, commentCount: result.before.commentCount },
      afterState: { businessDate: result.after.businessDate, lineCount: result.after.lineCount, commentCount: result.after.commentCount, retainedManualLines: result.after.retainedManualLines, saveMode: "single-transaction" },
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
  deleteRequest: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    if (actor.role !== "admin" && actor.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Удалять закрытые заявки может только руководитель или администратор." });
    }
    const result = await deleteOperationalStoreRequest(input.requestId);
    await recordChange({
      actorId: actor.id,
      action: "store_request.delete",
      entityType: "operational_store_request",
      entityId: String(input.requestId),
      beforeState: {
        requestNumber: result.before.requestNumber,
        storeName: detail.storeName,
        businessDate: result.before.businessDate,
        status: result.before.status,
        lineCount: result.lineCount,
        commentCount: result.commentCount,
      },
      afterState: { deleted: true },
    });
    return result;
  }),
  setRequestHidden: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), hidden: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await storeRequestDetailWithPermission(ctx.user.openId, input.requestId, "edit");
    if (actor.role !== "admin" && actor.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Скрывать закрытые заявки может только руководитель или администратор." });
    }
    const result = await setOperationalStoreRequestHidden({ ...input, changedByAccountId: actor.id });
    await recordChange({
      actorId: actor.id,
      action: "store_request.visibility.set",
      entityType: "operational_store_request",
      entityId: String(input.requestId),
      beforeState: { requestNumber: result.before.requestNumber, storeName: detail.storeName, businessDate: result.before.businessDate, status: result.before.status, hidden: result.before.isHidden },
      afterState: { hidden: result.after.isHidden, policy: "hidden requests are excluded from default history and print projections; no snapshot data was deleted" },
    });
    return result;
  }),
  printRequests: protectedProcedure.input(z.object({ from: dateInput, to: dateInput, storeId: z.number().int().positive().optional(), printGroupIds: z.array(z.number().int().positive()).max(100).optional(), printCategoryGroupIds: z.array(z.number().int().positive()).max(200).optional() }).refine(input => input.from <= input.to, { message: "Дата начала печати не может быть позже даты окончания.", path: ["to"] })).mutation(async ({ ctx, input }) => {
    const actor = await localActor(ctx.user.openId);
    if (actor.role !== "admin" && actor.role !== "manager") throw new TRPCError({ code: "FORBIDDEN", message: "Печать заявок доступна только руководителю или администратору." });
    if (input.storeId) await requireInventoryStoreAccess(ctx.user.openId, input.storeId, "view");
    const storeIds = input.storeId ? [input.storeId] : actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId);
    if (Array.isArray(storeIds) && !storeIds.length) throw new TRPCError({ code: "FORBIDDEN", message: "Нет доступных магазинов для печати заявок." });
    const projection = await getOperationalStoreRequestPrintProjection({ ...input, storeIds });
    if (!projection.printableLineCount) return projection;
    await recordChange({ actorId: actor.id, action: "store_request.print", entityType: "operational_store_request_print", entityId: `${input.from}:${input.to}`, afterState: { from: input.from, to: input.to, storeId: input.storeId ?? "all_accessible", printGroupIds: input.printGroupIds ?? "all", printCategoryGroupIds: input.printCategoryGroupIds ?? "all_active", sheets: projection.sheets.length, printableRequestCount: projection.printableRequestCount, printableLineCount: projection.printableLineCount, source: "saved_or_closed_request_snapshots" } });
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
  archiveClosed: protectedProcedure.input(z.object({ inventoryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { actor, detail } = await detailWithPermission(ctx.user.openId, input.inventoryId, "edit", true);
    if (actor.role !== "admin" && actor.role !== "manager") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Архивировать закрытую инвентаризацию может только руководитель или администратор." });
    }
    const result = await archiveClosedInventory(input.inventoryId);
    await recordChange({
      actorId: actor.id,
      action: "inventory.closed.archive",
      entityType: "operational_inventory",
      entityId: String(input.inventoryId),
      beforeState: { ...result.before, storeName: detail.storeName, movementCount: result.movementCount },
      afterState: { ...result.after, archived: true, policy: "history and stock movements preserved" },
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
    const outbound = await queueAndDispatchOperationalEvotorOutbound({ storeIds: [detail.storeId], productIds: result.movements.map(movement => movement.productId), reason: "inventory_close", sourceKey: `inventory-close:${input.inventoryId}` });
    await recordChange({ actorId: actor.id, action: "inventory.close", entityType: "operational_inventory", entityId: String(input.inventoryId), beforeState: { ...result.before, storeName: detail.storeName }, afterState: { ...result.after, storeName: detail.storeName, movements: result.movements, outbound } });
    return result;
  }),
});
