import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCurrentLocalAccount, hasPriceAccess } from "../accessControl";
import { protectedProcedure, router } from "../_core/trpc";
import { createPriceProduct, deletePriceImport, linkPriceImportRow, listPriceControlData, reassignPriceSupplierAlias, unlinkPriceSupplierAlias } from "../priceControl";
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
  createProduct: protectedProcedure.input(z.object({ canonicalName: z.string().trim().min(2).max(255), internalCode: z.string().trim().min(3).max(64).optional(), category: z.string().trim().max(160).optional(), variant: z.string().trim().max(255).optional(), sizeText: z.string().trim().max(120).optional(), baseUnit: z.enum(["kg", "l", "piece", "unknown"]).optional(), defaultWeightGrams: z.number().positive().max(1_000_000).optional(), defaultVolumeMl: z.number().positive().max(1_000_000).optional() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const product = await createPriceProduct(input);
    await recordChange({ actorId: actor.id, action: "price_product.create", entityType: "price_product", entityId: String(product.id), afterState: { internalCode: product.internalCode, canonicalName: product.canonicalName, normalizedSignature: product.normalizedSignature } });
    return product;
  }),
  linkRow: protectedProcedure.input(z.object({ rowId: z.number().int().positive(), productId: z.number().int().positive(), saveAlias: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await linkPriceImportRow({ ...input, actorId: actor.id });
    await recordChange({ actorId: actor.id, action: "price_alias.link", entityType: "price_import_row", entityId: String(input.rowId), afterState: { productId: input.productId, saveAlias: input.saveAlias } });
    return result;
  }),
  reassignAlias: protectedProcedure.input(z.object({ aliasId: z.number().int().positive(), productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await reassignPriceSupplierAlias(input);
    await recordChange({ actorId: actor.id, action: "price_alias.reassign", entityType: "price_supplier_alias", entityId: String(input.aliasId), afterState: { productId: input.productId } });
    return result;
  }),
  unlinkAlias: protectedProcedure.input(z.object({ aliasId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await unlinkPriceSupplierAlias(input.aliasId);
    await recordChange({ actorId: actor.id, action: "price_alias.unlink", entityType: "price_supplier_alias", entityId: String(input.aliasId), afterState: { unlinked: true } });
    return result;
  }),
  deleteImport: protectedProcedure.input(z.object({ importId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requirePricePermission(ctx.user.openId, "edit");
    const actor = await localActor(ctx.user.openId);
    const result = await deletePriceImport(input.importId);
    await recordChange({ actorId: actor.id, action: "price_import.delete", entityType: "price_import", entityId: String(input.importId), afterState: { deleted: true } });
    return result;
  }),
});
