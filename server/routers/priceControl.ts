import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCurrentLocalAccount, hasPriceAccess } from "../accessControl";
import { protectedProcedure, router } from "../_core/trpc";
import { bulkAssignPriceCategory, bulkSetPriceOfferMarketByProducts, bulkSetPriceProductsActive, createManualPriceOffer, createPriceCategory, createPriceProduct, createPriceProductCharacteristic, createPriceSupplier, deletePriceImport, deletePriceImportRow, deletePriceSupplier, getPriceCategoryAuditState, getPriceImportAuditState, getPriceImportDownload, getPriceImportRowAuditState, getPriceOfferAuditState, getPriceOfferMarketAuditState, getPriceProductAuditState, getPriceProductCharacteristicAuditState, getPriceProductsAuditStates, getPriceSupplierAuditState, linkPriceImportRow, listPriceControlData, reassignPriceSupplierAlias, repairRecognizedPriceProductVariants, seedPriceOfferPlaceContentsCharacteristics, setPriceSupplierActive, unlinkPriceSupplierAlias, updatePriceCategory, updatePriceImportDate, updatePriceOffer, updatePriceProduct, updatePriceProductCharacteristic, updatePriceSupplier } from "../priceControl";
import { recordChange } from "../localAuth";

async function requirePricePermission(openId: string | null | undefined, required: "view" | "upload" | "edit") {
  if (!await hasPriceAccess(openId, required)) throw new TRPCError({ code: "FORBIDDEN", message: "Нет назначенного доступа к прайс‑контролю." });
}
async function localActor(openId: string | null | undefined) {
  const actor = await getCurrentLocalAccount(openId);
  if (!actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "Требуется локальный вход." });
  return actor;
}

export const priceControlRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await requirePricePermission(ctx.user.openId, "view");
    return listPriceControlData();
  }),
  downloadImport: protectedProcedure.input(z.object({ importId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "view");
    return getPriceImportDownload(input.importId);
  }),
  createProduct: protectedProcedure.input(z.object({ canonicalName: z.string().trim().min(2).max(255), internalCode: z.string().trim().min(3).max(64).optional(), categoryId: z.number().int().positive().optional(), category: z.string().trim().max(160).optional(), variantCharacteristicId: z.number().int().positive().nullable().optional(), sizeCharacteristicId: z.number().int().positive().nullable().optional(), placeContentsCharacteristicId: z.number().int().positive().nullable().optional(), variant: z.string().trim().max(255).optional(), sizeText: z.string().trim().max(120).optional(), placeContents: z.string().trim().max(160).optional(), baseUnit: z.enum(["kg", "l", "piece", "unknown"]).optional(), defaultWeightGrams: z.number().positive().max(1_000_000).optional(), defaultVolumeMl: z.number().positive().max(1_000_000).optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const product = await createPriceProduct(input);
    await recordChange({ actorId: actor.id, action: "price_product.create", entityType: "price_product", entityId: String(product.id), afterState: await getPriceProductAuditState(product.id) });
    return product;
  }),
  updateProduct: protectedProcedure.input(z.object({ id: z.number().int().positive(), canonicalName: z.string().trim().min(2).max(255), internalCode: z.string().trim().min(3).max(64), categoryId: z.number().int().positive().nullable().optional(), category: z.string().trim().max(160).nullable().optional(), variantCharacteristicId: z.number().int().positive().nullable().optional(), sizeCharacteristicId: z.number().int().positive().nullable().optional(), placeContentsCharacteristicId: z.number().int().positive().nullable().optional(), variant: z.string().trim().max(255).nullable().optional(), sizeText: z.string().trim().max(120).nullable().optional(), placeContents: z.string().trim().max(160).nullable().optional(), baseUnit: z.enum(["kg", "l", "piece", "unknown"]).optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceProductAuditState(input.id); const product = await updatePriceProduct(input);
    await recordChange({ actorId: actor.id, action: "price_product.update", entityType: "price_product", entityId: String(input.id), beforeState: before, afterState: await getPriceProductAuditState(product.id) });
    return product;
  }),
  bulkAssignCategory: protectedProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(300), categoryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const before = await getPriceProductsAuditStates(input.productIds); const result = await bulkAssignPriceCategory(input);
    const after = await getPriceProductsAuditStates(input.productIds);
    await recordChange({ actorId: actor.id, action: "price_product.category_bulk_assign", entityType: "price_product", entityId: input.productIds.join(","), beforeState: { products: before }, afterState: { products: after, categoryName: result.category.name } });
    return result;
  }),
  bulkSetProductActive: protectedProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(300), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const before = await getPriceProductsAuditStates(input.productIds);
    const result = await bulkSetPriceProductsActive(input);
    const after = await getPriceProductsAuditStates(input.productIds);
    await recordChange({ actorId: actor.id, action: "price_product.visibility_bulk_update", entityType: "price_product", entityId: input.productIds.join(","), beforeState: { products: before }, afterState: { products: after, isActive: result.isActive } });
    return result;
  }),
  bulkSetOfferMarket: protectedProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(300), market: z.enum(["unknown", "spb", "moscow"]) })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const before = await getPriceOfferMarketAuditState(input.productIds);
    const result = await bulkSetPriceOfferMarketByProducts(input);
    const after = await getPriceOfferMarketAuditState(input.productIds);
    await recordChange({ actorId: actor.id, action: "price_offer.market_bulk_update", entityType: "price_offer", entityId: input.productIds.join(","), beforeState: before, afterState: { ...after, selectedMarket: result.market, updatedOffers: result.updatedOffers } });
    return result;
  }),
  createCharacteristic: protectedProcedure.input(z.object({ kind: z.enum(["variant", "size", "place_contents", "manufacturer"]), value: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const characteristic = await createPriceProductCharacteristic(input);
    if (!characteristic) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать характеристику товара." });
    await recordChange({ actorId: actor.id, action: "price_product_characteristic.create", entityType: "price_product_characteristic", entityId: String(characteristic.id), afterState: await getPriceProductCharacteristicAuditState(characteristic.id) });
    return characteristic;
  }),
  repairRecognizedVariants: protectedProcedure.mutation(async ({ ctx }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await repairRecognizedPriceProductVariants();
    if (result.updated) {
      await recordChange({
        actorId: actor.id,
        action: "price_product.variant_repair",
        entityType: "price_product",
        entityId: `recognized-variants:${result.updated}`,
        beforeState: {
          productsMissingVariant: result.updated,
          recognizedVariants: result.recognizedVariants,
        },
        afterState: {
          productsUpdated: result.updated,
          variants: result.variants,
          repair: "Вариант распознан из сохраненного названия",
        },
      });
    }
    return result;
  }),
  refreshPlaceContents: protectedProcedure.mutation(async ({ ctx }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await seedPriceOfferPlaceContentsCharacteristics();
    await recordChange({
      actorId: actor.id,
      action: "price_product_characteristic.place_contents_refresh",
      entityType: "price_product_characteristic",
      entityId: `place-contents:${result.created.length}`,
      afterState: { scannedOfferValues: result.scanned, createdValues: result.created },
    });
    return result;
  }),
  updateCharacteristic: protectedProcedure.input(z.object({ id: z.number().int().positive(), value: z.string().trim().min(1).max(160), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceProductCharacteristicAuditState(input.id); const characteristic = await updatePriceProductCharacteristic(input);
    await recordChange({ actorId: actor.id, action: "price_product_characteristic.update", entityType: "price_product_characteristic", entityId: String(input.id), beforeState: before, afterState: await getPriceProductCharacteristicAuditState(characteristic.id) });
    return characteristic;
  }),
  createCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const category = await createPriceCategory(input);
    await recordChange({ actorId: actor.id, action: "price_category.create", entityType: "price_category", entityId: String(category.id), afterState: await getPriceCategoryAuditState(category.id) });
    return category;
  }),
  updateCategory: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceCategoryAuditState(input.id); const category = await updatePriceCategory(input);
    await recordChange({ actorId: actor.id, action: "price_category.update", entityType: "price_category", entityId: String(input.id), beforeState: before, afterState: await getPriceCategoryAuditState(category.id) });
    return category;
  }),
  createSupplier: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), contactNote: z.string().trim().max(2000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const supplier = await createPriceSupplier(input);
    await recordChange({ actorId: actor.id, action: "price_supplier.create", entityType: "price_supplier", entityId: String(supplier.id), afterState: await getPriceSupplierAuditState(supplier.id) });
    return supplier;
  }),
  updateSupplier: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), contactNote: z.string().trim().max(2000).nullable().optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceSupplierAuditState(input.id); const supplier = await updatePriceSupplier(input);
    await recordChange({ actorId: actor.id, action: "price_supplier.update", entityType: "price_supplier", entityId: String(input.id), beforeState: before, afterState: await getPriceSupplierAuditState(supplier.id) });
    return supplier;
  }),
  setSupplierActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceSupplierAuditState(input.id); const supplier = await setPriceSupplierActive(input);
    await recordChange({ actorId: actor.id, action: "price_supplier.update", entityType: "price_supplier", entityId: String(input.id), beforeState: before, afterState: await getPriceSupplierAuditState(supplier.id) });
    return supplier;
  }),
  deleteSupplier: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const supplier = await getPriceSupplierAuditState(input.id); await deletePriceSupplier(input.id);
    await recordChange({ actorId: actor.id, action: "price_supplier.delete", entityType: "price_supplier", entityId: String(input.id), beforeState: supplier, afterState: null });
    return { success: true };
  }),
  updateOffer: protectedProcedure.input(z.object({ priceId: z.number().int().positive(), priceAmount: z.number().positive().max(10_000_000), priceBasis: z.enum(["kg", "l", "piece", "package", "unknown"]), priceMode: z.enum(["cash", "cashless_no_vat", "cashless_vat"]).optional(), market: z.enum(["unknown", "spb", "moscow"]).optional(), manufacturer: z.string().trim().max(255).nullable().optional(), placeContents: z.string().trim().max(255).nullable().optional(), manufacturedOn: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable().optional(), shelfLifeMonths: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(12), z.literal(18), z.literal(24)]).nullable().optional(), expiresOn: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceOfferAuditState(input.priceId); const result = await updatePriceOffer(input);
    await recordChange({ actorId: actor.id, action: "price_offer.update", entityType: "price_offer", entityId: String(input.priceId), beforeState: before, afterState: await getPriceOfferAuditState(input.priceId) });
    return result;
  }),
  createManualOffer: protectedProcedure.input(z.object({ productId: z.number().int().positive(), supplierId: z.number().int().positive(), sourceDate: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/), priceAmount: z.number().positive().max(10_000_000), priceBasis: z.enum(["kg", "l", "piece", "package", "unknown"]), priceMode: z.enum(["cash", "cashless_no_vat", "cashless_vat"]).optional(), market: z.enum(["unknown", "spb", "moscow"]).optional(), manufacturer: z.string().trim().max(255).nullable().optional(), placeContents: z.string().trim().max(255).nullable().optional(), manufacturedOn: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable().optional(), shelfLifeMonths: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(12), z.literal(18), z.literal(24)]).nullable().optional(), expiresOn: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable().optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await createManualPriceOffer({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "price_offer.create", entityType: "price_offer", entityId: String(result.priceId), afterState: await getPriceOfferAuditState(result.priceId) });
    return result;
  }),
  updateImportDate: protectedProcedure.input(z.object({ importId: z.number().int().positive(), sourceDate: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).nullable() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId); const before = await getPriceImportAuditState(input.importId); const record = await updatePriceImportDate(input);
    await recordChange({ actorId: actor.id, action: "price_import.date_update", entityType: "price_import", entityId: String(input.importId), beforeState: before, afterState: await getPriceImportAuditState(record.id) });
    return record;
  }),
  linkRow: protectedProcedure.input(z.object({ rowId: z.number().int().positive(), productId: z.number().int().positive(), saveAlias: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await linkPriceImportRow({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "price_alias.link", entityType: "price_import_row", entityId: String(input.rowId), beforeState: result.audit.before, afterState: result.audit.after });
    return result;
  }),
  reassignAlias: protectedProcedure.input(z.object({ aliasId: z.number().int().positive(), productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await reassignPriceSupplierAlias(input);
    await recordChange({ actorId: actor.id, action: "price_alias.reassign", entityType: "price_supplier_alias", entityId: String(input.aliasId), beforeState: result.audit.before, afterState: result.audit.after });
    return result;
  }),
  unlinkAlias: protectedProcedure.input(z.object({ aliasId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await unlinkPriceSupplierAlias(input.aliasId);
    await recordChange({ actorId: actor.id, action: "price_alias.unlink", entityType: "price_supplier_alias", entityId: String(input.aliasId), beforeState: result.audit.before, afterState: result.audit.after });
    return result;
  }),
  deleteImport: protectedProcedure.input(z.object({ importId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const before = await getPriceImportAuditState(input.importId); const result = await deletePriceImport(input.importId);
    await recordChange({ actorId: actor.id, action: "price_import.delete", entityType: "price_import", entityId: String(input.importId), beforeState: before, afterState: null });
    return result;
  }),
  deleteImportRow: protectedProcedure.input(z.object({ rowId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const before = await getPriceImportRowAuditState(input.rowId);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Позиция прайс‑листа не найдена." });
    const result = await deletePriceImportRow(input.rowId);
    await recordChange({ actorId: actor.id, action: "price_import.row_delete", entityType: "price_import_row", entityId: String(input.rowId), beforeState: before, afterState: { importId: result.importId, rowCount: result.rowCount, originalFileKept: true } });
    return result;
  }),
});
