import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  localAccounts,
  operationalCatalogCategories,
  operationalCatalogProducts,
  operationalEvotorDocumentPositions,
  operationalEvotorDocuments,
  operationalEvotorReceiptStockMovements,
  operationalEvotorDocumentSyncs,
  operationalEvotorOutboundJobs,
  operationalEvotorProductLinks,
  operationalInventories,
  operationalInventoryLines,
  operationalOnecWarehouseGroupMappings,
  operationalOnecProductLinks,
  operationalOnecPurchaseCosts,
  operationalOnecShipmentLines,
  operationalOnecShipmentReceiptLines,
  operationalOnecWarehouseSnapshots,
  operationalPriceTypes,
  operationalPrintCategoryGroupMembers,
  operationalPrintCategoryGroups,
  operationalPrintGroups,
  operationalProductSalePrices,
  operationalRequestPrintSettings,
  operationalScheduledSyncJobs,
  operationalStockMovements,
  operationalStockTransferLines,
  operationalStockTransfers,
  operationalStoreMappings,
  operationalStorePriceTypes,
  operationalStoreRequestComments,
  operationalStoreRequestLines,
  operationalStoreRequests,
  operationalWarehouseSettings,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getEvotorDocumentPreviewForOperationalStore, listEvotorCatalogPreviewForOperationalStore, listEvotorCatalogStoresPreview, listEvotorDocumentsPreviewForOperationalStore, type EvotorDocumentPreview } from "./evotorCatalog";
import { enqueueOperationalEvotorOutbound } from "./evotorOutbound";
import { evaluateCurrentDayEvotorReturnSignals } from "./operationalSignals";

/** The catalog retains Evotor's `fraction` code. Physical inventory rows render and store it as kilograms. */
export type CatalogUnit = "fraction" | "l" | "piece" | "unknown";
export type EditableCatalogUnit = Exclude<CatalogUnit, "unknown">;
export type InventoryUnit = "kg" | "l" | "piece";
export type InventoryStatus = "draft" | "closed";
export type InventoryVatRate = "VAT_10" | "VAT_22";
export type InventoryMarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";

const isoDate = /^20\d{2}-\d{2}-\d{2}$/;
const finiteThreeDecimals = (value: number) => Number.isFinite(value) && value >= 0 && Math.round(value * 1000) === value * 1000;
/** A ledger can temporarily be negative after an earlier confirmed movement.
 * A new physical count must be allowed to correct it, while a user-entered fact
 * remains strictly non-negative. */
const finiteSignedThreeDecimals = (value: number) => Number.isFinite(value) && Math.round(value * 1000) === value * 1000;
const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ");
const storedMoney = (value: number | null) => value === null ? null : value.toFixed(2);
/** Persists only safe aggregate payment values from an already normalized V2 document. */
const storedPaymentSummary = (payment: EvotorDocumentPreview["paymentSummary"]) => ({
  cashAmount: storedMoney(payment.cashAmount),
  cashTenderedAmount: storedMoney(payment.cashTenderedAmount),
  cashChangeAmount: storedMoney(payment.cashChangeAmount),
  cashlessAmount: storedMoney(payment.cashlessAmount),
  otherPaymentAmount: storedMoney(payment.otherPaymentAmount),
  unknownPaymentAmount: storedMoney(payment.unknownPaymentAmount),
  paymentCaptureStatus: payment.captureStatus,
  paymentReconciliationDelta: storedMoney(payment.reconciliationDelta),
});
const normalizedKey = (value: string) => normalizedText(value).toLocaleLowerCase("ru-RU");
const normalizedManualBarcodes = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;
  const unique = Array.from(new Set((value ?? "").split(";").map(item => item.trim()).filter(Boolean)));
  if (unique.some(item => item.length > 128)) throw new Error("Каждый ручной штрихкод не должен быть длиннее 128 символов.");
  // Empty text is an intentional administrator override: it means that the
  // old source barcodes were removed, rather than "show source barcodes again".
  return unique.join(";");
};
const alcoholProductKindCodes = ["500", "510"] as const;

/** The UI offers exactly the two agreed AP (FSRAR) kinds. It never writes an empty kind for alcohol or marked beer. */
export function normalizeAlcoholProductKindCode(value: string | null | undefined, isAlcoholProduct: boolean) {
  if (!isAlcoholProduct) return null;
  const code = normalizedText(value ?? "") || "500";
  if (!alcoholProductKindCodes.includes(code as typeof alcoholProductKindCodes[number])) {
    throw new Error("Код вида АП (ФСРАР) допускает только значения 500 или 510.");
  }
  return code;
}

async function nextCatalogNumber() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [last] = await db.select({ catalogNumber: operationalCatalogProducts.catalogNumber }).from(operationalCatalogProducts).orderBy(desc(operationalCatalogProducts.catalogNumber)).limit(1);
  return (last?.catalogNumber ?? 0) + 1;
}
export const markingFromEvotorCategory = (product: { name: string; categoryName: string | null; type?: string | null }): InventoryMarkingCategory => {
  /**
   * Cloud V2 exposes the marking class as the product `type`; it is more reliable
   * than a category name. A declared `NORMAL` class remains unmarked; textual
   * fallback is only for manual or legacy records with no source type at all.
   */
  switch (product.type?.toUpperCase()) {
    case "DIETARY_SUPPLEMENTS_MARKED": return "supplement";
    case "CAVIAR_MARKED": return "seafood_caviar";
    case "GROCERIES_MARKED":
    case "CANNED_FISH_MARKED": return "seafood_canned";
    case "BEER_MARKED":
    case "BEER_MARKED_KEG": return "beer_marked";
    case "NOT_ALCOHOL_BEER_MARKED": return "beer_non_alcoholic";
    case "JUICE_MARKED": return "soft_drinks";
    case "WATER_MARKED": return "water";
    case "DAIRY_MARKED":
    case "MILK_MARKED": return "dairy";
    case "ALCOHOL_MARKED":
    case "ALCOHOL_NOT_MARKED":
    case "ALCOHOL": return "alcohol";
    case "NORMAL": return "none";
  }
  if (product.type) return "none";
  const source = `${product.categoryName ?? ""} ${product.name}`.toLocaleLowerCase("ru-RU");
  if (/\b(бад|витамин)/.test(source)) return "supplement";
  if (/икр/.test(source)) return "seafood_caviar";
  if (/консерв/.test(source)) return "seafood_canned";
  if (/безалкогольн.*пиво/.test(source)) return "beer_non_alcoholic";
  if (/пиво/.test(source)) return "beer_marked";
  if (/бутилирован.*вод|питьев.*вод/.test(source)) return "water";
  if (/молок|сливк|сыр|йогурт/.test(source)) return "dairy";
  if (/сок|лимонад|напит/.test(source)) return "soft_drinks";
  if (/алкогол|вино|водка|коньяк|виски|ром|ликер/.test(source)) return "alcohol";
  return "none";
};

export function validateInventoryDate(value: string) {
  if (!isoDate.test(value)) throw new Error("Выберите дату инвентаризации в формате ГГГГ-ММ-ДД");
  return value;
}

/** Zero is an entered count. It cannot be treated as a missing line. */
export function validateCountedQuantity(value: number) {
  if (!finiteThreeDecimals(value)) throw new Error("Фактическое количество должно быть неотрицательным и содержать не более трех знаков после точки");
  return Math.round(value * 1000) / 1000;
}

/** A transfer is a positive, gram-precise quantity and never silently creates stock. */
export function validateStockTransferQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0 || Math.round(value * 1_000) !== value * 1_000 || value > 1_000_000) {
    throw new Error("Количество перемещения должно быть больше нуля и содержать не более трех знаков после точки.");
  }
  return Math.round(value * 1_000) / 1_000;
}

export function calculateInventoryAdjustment(previousQuantity: number, countedQuantity: number) {
  if (!finiteSignedThreeDecimals(previousQuantity)) throw new Error("Учетный остаток перед пересчетом должен содержать не более трех знаков после точки");
  const previous = Math.round(previousQuantity * 1000) / 1000;
  const counted = validateCountedQuantity(countedQuantity);
  return Math.round((counted - previous) * 1000) / 1000;
}

export function inventoryUnitFromCatalogUnit(unit: CatalogUnit): InventoryUnit {
  if (unit === "fraction") return "kg";
  if (unit === "l" || unit === "piece") return unit;
  throw new Error("Для товара не задана рабочая единица. Сначала уточните карточку товара.");
}

type TimedSnapshot = { storeId: number; productId: number; quantity: string | null; updatedAt: Date | null };
type TimedMovement = { storeId: number; productId: number; quantityDelta: string; createdAt: Date };

/** A later Evotor snapshot replaces its already-observed local movement, preventing a duplicated balance. */
export function projectSnapshotAwareStock(snapshots: TimedSnapshot[], movements: TimedMovement[]) {
  const values = new Map<string, number>();
  const known = new Set<string>();
  const snapshotAt = new Map<string, Date>();
  for (const snapshot of snapshots) {
    if (snapshot.quantity === null) continue;
    const key = `${snapshot.storeId}:${snapshot.productId}`;
    values.set(key, Number(snapshot.quantity));
    known.add(key);
    if (snapshot.updatedAt) snapshotAt.set(key, snapshot.updatedAt);
  }
  for (const movement of movements) {
    const key = `${movement.storeId}:${movement.productId}`;
    const baselineAt = snapshotAt.get(key);
    if (baselineAt && movement.createdAt <= baselineAt) continue;
    values.set(key, Math.round(((values.get(key) ?? 0) + Number(movement.quantityDelta)) * 1_000) / 1_000);
    known.add(key);
  }
  return { values, known, snapshotAt };
}

/** Receipt documents are operational deltas until the next catalog snapshot replaces them. */
export function evotorReceiptStockDelta(documentType: string, quantity: number | null) {
  if (quantity === null || !Number.isFinite(quantity) || quantity < 0) return null;
  if (documentType === "SELL") return -quantity;
  if (["PAYBACK", "RETURN", "SELL_RETURN"].includes(documentType)) return quantity;
  return null;
}

export async function materializeEvotorReceiptStockMovements(input: { storeId: number; documentIds?: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (input.documentIds && !input.documentIds.length) return 0;
  const conditions = [
    eq(operationalEvotorDocuments.storeId, input.storeId),
    inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"]),
    isNotNull(operationalEvotorDocumentPositions.quantity),
    input.documentIds?.length ? inArray(operationalEvotorDocuments.id, input.documentIds) : undefined,
  ].filter(Boolean);
  const rows = await db.select({
    documentPositionId: operationalEvotorDocumentPositions.id,
    documentId: operationalEvotorDocuments.id,
    storeId: operationalEvotorDocuments.storeId,
    productId: operationalEvotorProductLinks.productId,
    productName: operationalEvotorDocumentPositions.productName,
    documentType: operationalEvotorDocuments.documentType,
    quantity: operationalEvotorDocumentPositions.quantity,
    occurredAt: operationalEvotorDocuments.occurredAt,
  }).from(operationalEvotorDocumentPositions)
    .innerJoin(operationalEvotorDocuments, eq(operationalEvotorDocumentPositions.documentId, operationalEvotorDocuments.id))
    .leftJoin(operationalEvotorProductLinks, and(
      eq(operationalEvotorProductLinks.storeId, operationalEvotorDocuments.storeId),
      eq(operationalEvotorProductLinks.evotorProductId, operationalEvotorDocumentPositions.evotorProductId),
    ))
    .where(and(...conditions));
  // After a confirmed full reset a terminal can emit a short-lived old product
  // UUID while the Cloud catalog already exposes a new UUID. Never create a
  // durable link by name: only this receipt projection may use an exact active
  // canonical name, only where it resolves to one product globally, and only
  // for a document that happened after that exact product's reset baseline.
  // This prevents any historical name coincidence from changing a live balance.
  const unmatched = rows.filter(row => row.productId === null && row.productName !== null);
  const exactNameCandidates = unmatched.length
    ? await db.select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName })
      .from(operationalCatalogProducts)
      .where(and(eq(operationalCatalogProducts.isActive, true), inArray(operationalCatalogProducts.canonicalName, Array.from(new Set(unmatched.map(row => row.productName!))))))
    : [];
  const uniqueProductIdByExactName = new Map<string, number>();
  const candidateIdsByName = new Map<string, number[]>();
  for (const candidate of exactNameCandidates) {
    const ids = candidateIdsByName.get(candidate.canonicalName) ?? [];
    ids.push(candidate.id);
    candidateIdsByName.set(candidate.canonicalName, ids);
  }
  for (const [name, ids] of Array.from(candidateIdsByName.entries())) if (ids.length === 1) uniqueProductIdByExactName.set(name, ids[0]!);
  const fallbackProductIds = Array.from(new Set(Array.from(uniqueProductIdByExactName.values())));
  const resetBaselineByProductId = fallbackProductIds.length
    ? new Map((await db.select({ productId: operationalEvotorProductLinks.productId, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt })
      .from(operationalEvotorProductLinks)
      .where(and(
        eq(operationalEvotorProductLinks.storeId, input.storeId),
        inArray(operationalEvotorProductLinks.productId, fallbackProductIds),
        eq(operationalEvotorProductLinks.evotorQuantitySource, "confirmed_reset"),
        isNotNull(operationalEvotorProductLinks.evotorQuantityUpdatedAt),
      ))).map(row => [row.productId, row.updatedAt!] as const))
    : new Map<number, Date>();
  const movements = rows.flatMap(row => {
    const quantityDelta = evotorReceiptStockDelta(row.documentType, row.quantity === null ? null : Number(row.quantity));
    const occurredAt = row.occurredAt ? new Date(row.occurredAt) : null;
    const fallbackProductId = row.productName ? uniqueProductIdByExactName.get(row.productName) ?? null : null;
    const fallbackBaselineAt = fallbackProductId === null ? null : resetBaselineByProductId.get(fallbackProductId) ?? null;
    const productId = row.productId ?? (
      fallbackProductId !== null && fallbackBaselineAt !== null && occurredAt !== null && occurredAt > fallbackBaselineAt
        ? fallbackProductId
        : null
    );
    if (productId === null || quantityDelta === null || !occurredAt || !Number.isFinite(occurredAt.getTime())) return [];
    return [{
      documentPositionId: row.documentPositionId,
      documentId: row.documentId,
      storeId: row.storeId,
      productId,
      quantityDelta: quantityDelta.toFixed(3),
      occurredAt,
    }];
  });
  if (!movements.length) return 0;
  await db.insert(operationalEvotorReceiptStockMovements).values(movements).onDuplicateKeyUpdate({
    set: { documentPositionId: sql`${operationalEvotorReceiptStockMovements.documentPositionId}` },
  });
  // The scheduler performs the external PATCH in its bounded outbound phase.
  // Enqueue only: importing an incoming receipt must not turn a read callback
  // into a fan-out of remote writes. One source key per imported document batch
  // keeps the request idempotent while the dispatcher recalculates the latest
  // net quantity directly before delivery.
  const sourceDocuments = Array.from(new Set(movements.map(movement => movement.documentId))).sort((left, right) => left - right);
  await enqueueOperationalEvotorOutbound({
    storeIds: [input.storeId],
    productIds: Array.from(new Set(movements.map(movement => movement.productId))),
    reason: "stock_adjustment",
    sourceKey: `receipt-stock:${input.storeId}:${sourceDocuments.join(",")}`,
  });
  return movements.length;
}

async function listEvotorReceiptStockProjectionMovements(input: { storeIds: number[]; productIds?: number[] }) {
  const db = await getDb();
  if (!db || !input.storeIds.length || (input.productIds && !input.productIds.length)) return [] as Array<TimedMovement>;
  const conditions = [
    inArray(operationalEvotorReceiptStockMovements.storeId, input.storeIds),
    input.productIds?.length ? inArray(operationalEvotorReceiptStockMovements.productId, input.productIds) : undefined,
  ].filter(Boolean);
  return db.select({
    storeId: operationalEvotorReceiptStockMovements.storeId,
    productId: operationalEvotorReceiptStockMovements.productId,
    quantityDelta: operationalEvotorReceiptStockMovements.quantityDelta,
    createdAt: operationalEvotorReceiptStockMovements.occurredAt,
  }).from(operationalEvotorReceiptStockMovements).where(and(...conditions));
}

export function catalogUnitFromEvotor(value: string | null): CatalogUnit {
  const unit = String(value ?? "").toLocaleLowerCase("ru-RU");
  if (/кг|кил|дроб|вес|fraction/.test(unit)) return "fraction";
  if (/\bл\b|лит/.test(unit)) return "l";
  if (/шт|штук|упак|бутыл|бан|\bpiece\b|\bpcs?\b/.test(unit)) return "piece";
  return "unknown";
}

function inventoryState(row: typeof operationalInventories.$inferSelect) {
  return {
    id: row.id,
    storeId: row.storeId,
    businessDate: row.businessDate,
    status: row.status,
    createdByAccountId: row.createdByAccountId,
    closedByAccountId: row.closedByAccountId,
    closedAt: row.closedAt,
    note: row.note,
  };
}

async function requireInventory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [inventory] = await db.select().from(operationalInventories).where(eq(operationalInventories.id, id)).limit(1);
  if (!inventory) throw new Error("Инвентаризация не найдена");
  return inventory;
}

export async function getInventoryAccountingQuantities(storeId: number, productIds?: number[]) {
  const db = await getDb();
  if (!db) return new Map<number, number>();
  const snapshotConditions = [eq(operationalEvotorProductLinks.storeId, storeId), productIds?.length ? inArray(operationalEvotorProductLinks.productId, productIds) : undefined].filter(Boolean);
  const conditions = [eq(operationalStockMovements.storeId, storeId), productIds?.length ? inArray(operationalStockMovements.productId, productIds) : undefined].filter(Boolean);
  const [snapshots, localMovements, receiptMovements] = await Promise.all([
    db.select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt }).from(operationalEvotorProductLinks).where(and(...snapshotConditions)),
    db.select({ storeId: operationalStockMovements.storeId, productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt }).from(operationalStockMovements).where(and(...conditions)),
    listEvotorReceiptStockProjectionMovements({ storeIds: [storeId], productIds }),
  ]);
  const projection = projectSnapshotAwareStock(snapshots, [...localMovements, ...receiptMovements]);
  const quantities = new Map<number, number>();
  for (const [key, value] of Array.from(projection.values.entries())) quantities.set(Number(key.split(":")[1]), value);
  return quantities;
}

/** Direct correction never overwrites history: it emits one immutable, reasoned adjustment. */
export async function setOperationalStockQuantity(input: { storeId: number; productId: number; countedQuantity: number; reason: string; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const countedQuantity = validateCountedQuantity(input.countedQuantity);
  const reason = normalizedText(input.reason);
  if (reason.length < 3 || reason.length > 512) throw new Error("Укажите причину корректировки остатка (от 3 до 512 символов).");
  const [product] = await db
    .select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName, baseUnit: operationalCatalogProducts.baseUnit })
    .from(operationalCatalogProducts)
    .where(and(eq(operationalCatalogProducts.id, input.productId), eq(operationalCatalogProducts.isActive, true)))
    .limit(1);
  if (!product) throw new Error("Товар не найден в активном общем справочнике.");
  const previousQuantity = (await getInventoryAccountingQuantities(input.storeId, [input.productId])).get(input.productId) ?? 0;
  const quantityDelta = calculateInventoryAdjustment(previousQuantity, countedQuantity);
  const movement = {
    storeId: input.storeId,
    productId: input.productId,
    inventoryId: null,
    kind: "manual_adjustment" as const,
    previousQuantity: previousQuantity.toFixed(3),
    countedQuantity: countedQuantity.toFixed(3),
    quantityDelta: quantityDelta.toFixed(3),
    unit: inventoryUnitFromCatalogUnit(product.baseUnit),
    adjustmentReason: reason,
    createdByAccountId: input.actorId,
  };
  await db.insert(operationalStockMovements).values(movement);
  return { product, before: previousQuantity, after: countedQuantity, quantityDelta, reason };
}

export async function listInventoryProducts(input?: { storeId?: number; includeAccounting?: boolean; includeInactive?: boolean; includeUnknown?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: operationalCatalogProducts.id,
      catalogNumber: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      metadataSource: operationalCatalogProducts.metadataSource,
      barcodes: operationalCatalogProducts.barcodes,
      // Keep the source name stable for the card editor. The stock projection
      // independently exposes the same field under the shorter `category` key.
      evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
      catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
      catalogCategoryName: operationalCatalogCategories.name,
      baseUnit: operationalCatalogProducts.baseUnit,
      vatRate: operationalCatalogProducts.vatRate,
      evotorCostPrice: operationalCatalogProducts.evotorCostPrice,
      internalCostPrice: operationalCatalogProducts.internalCostPrice,
      isEvotorCostExportEnabled: operationalCatalogProducts.isEvotorCostExportEnabled,
      markingCategory: operationalCatalogProducts.markingCategory,
      alcoholCode: operationalCatalogProducts.alcoholCode,
      alcoholTypeCode: operationalCatalogProducts.alcoholTypeCode,
      alcoholStrengthPercent: operationalCatalogProducts.alcoholStrengthPercent,
      alcoholVolumeLiters: operationalCatalogProducts.alcoholVolumeLiters,
      manualBarcodes: operationalCatalogProducts.manualBarcodes,
      isVisibleInRequests: operationalCatalogProducts.isVisibleInRequests,
      isEvotorExportEnabled: operationalCatalogProducts.isEvotorExportEnabled,
      isActive: operationalCatalogProducts.isActive,
    })
    .from(operationalCatalogProducts)
    // Archived local categories stay linked in history but are deliberately
    // absent from active working selectors.
    .leftJoin(operationalCatalogCategories, and(
      eq(operationalCatalogProducts.catalogCategoryId, operationalCatalogCategories.id),
      eq(operationalCatalogCategories.isActive, true),
    ))
    .where(input?.includeInactive ? undefined : eq(operationalCatalogProducts.isActive, true))
    .orderBy(operationalCatalogProducts.catalogNumber)
    .limit(2_000);
  const products = rows
    .filter(row => input?.includeUnknown || row.baseUnit !== "unknown")
    .map(row => ({
      ...row,
      // Do not revive a removed local category through its stale source label.
      category: row.catalogCategoryId ? row.catalogCategoryName : row.evotorCategoryName,
      baseUnit: row.baseUnit as CatalogUnit,
      internalCode: String(row.catalogNumber),
      variant: null,
    }));
  const quantities = input?.includeAccounting && input.storeId ? await getInventoryAccountingQuantities(input.storeId, products.map(product => product.id)) : null;
  return products.map(product => ({ ...product, accountingQuantity: quantities?.get(product.id) ?? null }));
}

/**
 * Current operational stock is a projection of closed inventory movements.
 * A null quantity means that the product has not yet been counted, rather than
 * a fictitious zero. This is intentionally separate from the inventory draft.
 */
export async function listOperationalStock(input: { storeIds?: number[] | null; storeId?: number; query?: string; category?: string; sort?: "code" | "store" | "product" | "quantity" | "value"; direction?: "asc" | "desc"; offset?: number; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return { items: [], total: 0 };
  const storeConditions = [
    input.storeId ? eq(stores.id, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(stores.id, input.storeIds) : undefined,
    eq(stores.isHidden, false),
  ].filter(Boolean);
  const storeRows = await db.select({ storeId: stores.id, storeName: stores.name }).from(stores).where(and(...storeConditions)).orderBy(stores.name).limit(200);
  if (!storeRows.length) return { items: [], total: 0 };
  const catalog = await db
    .select({
      productId: operationalCatalogProducts.id,
      internalCode: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      category: operationalCatalogProducts.evotorCategoryName,
      baseUnit: operationalCatalogProducts.baseUnit,
      vatRate: operationalCatalogProducts.vatRate,
    })
    .from(operationalCatalogProducts)
    .where(eq(operationalCatalogProducts.isActive, true))
    .orderBy(operationalCatalogProducts.catalogNumber)
    .limit(2_000);
  if (!catalog.length) return { items: [], total: 0 };
  const productIds = catalog.map(product => product.productId);
  const storeIds = storeRows.map(store => store.storeId);
  const priceAssignments = await db
    .select({ storeId: operationalStorePriceTypes.storeId, priceTypeId: operationalStorePriceTypes.priceTypeId })
    .from(operationalStorePriceTypes)
    .where(inArray(operationalStorePriceTypes.storeId, storeIds));
  const priceTypeByStore = new Map(priceAssignments.map(row => [row.storeId, row.priceTypeId]));
  const priceTypeIds = Array.from(new Set(priceAssignments.map(row => row.priceTypeId)));
  const salePriceRows = priceTypeIds.length
    ? await db.select({ productId: operationalProductSalePrices.productId, priceTypeId: operationalProductSalePrices.priceTypeId, salePrice: operationalProductSalePrices.salePrice }).from(operationalProductSalePrices).where(and(inArray(operationalProductSalePrices.productId, productIds), inArray(operationalProductSalePrices.priceTypeId, priceTypeIds)))
    : [];
  const salePriceByProductType = new Map(salePriceRows.map(row => [`${row.productId}:${row.priceTypeId}`, Number(row.salePrice)]));
  const snapshots = await db
    .select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt })
    .from(operationalEvotorProductLinks)
    .where(and(inArray(operationalEvotorProductLinks.productId, productIds), inArray(operationalEvotorProductLinks.storeId, storeIds)));
  const [localMovements, receiptMovements] = await Promise.all([
    db.select({ storeId: operationalStockMovements.storeId, productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
      .from(operationalStockMovements)
      .where(and(inArray(operationalStockMovements.productId, productIds), inArray(operationalStockMovements.storeId, storeIds))),
    listEvotorReceiptStockProjectionMovements({ storeIds, productIds }),
  ]);
  const movements = [...localMovements, ...receiptMovements];
  const temporalProjection = projectSnapshotAwareStock(snapshots, movements);
  const balanceByStoreProduct = new Map<string, { quantity: number; lastCountedAt: Date | null }>();
  for (const movement of movements) {
    const key = `${movement.storeId}:${movement.productId}`;
    const current = balanceByStoreProduct.get(key) ?? { quantity: 0, lastCountedAt: null };
    const snapshotAt = temporalProjection.snapshotAt.get(key);
    if (snapshotAt && movement.createdAt <= snapshotAt) continue;
    current.quantity = Math.round((current.quantity + Number(movement.quantityDelta)) * 1_000) / 1_000;
    if (!current.lastCountedAt || movement.createdAt > current.lastCountedAt) current.lastCountedAt = movement.createdAt;
    balanceByStoreProduct.set(key, current);
  }
  const queryTokens = normalizedText(input.query ?? "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").split(/[^0-9A-Za-zА-Яа-я]+/).filter(Boolean);
  const matchedProducts = queryTokens.length
    ? catalog.filter(product => {
      const haystack = `${product.canonicalName} ${product.internalCode ?? ""}`.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
      return queryTokens.every(token => haystack.includes(token));
    })
    : catalog;
  const normalizedCategory = normalizedText(input.category ?? "").toLocaleLowerCase("ru-RU");
  const categorizedProducts = normalizedCategory ? matchedProducts.filter(product => (product.category ?? "").toLocaleLowerCase("ru-RU") === normalizedCategory) : matchedProducts;
	  const filtered = storeRows.flatMap(store => categorizedProducts.map(product => ({ ...product, storeId: store.storeId, storeName: store.storeName })));
	  const offset = Math.max(0, Math.floor(input.offset ?? 0));
	  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? 50)), 2_000);
	  const projectedRows = filtered.map(product => {
	    const key = `${product.storeId}:${product.productId}`;
	    const movementBalance = balanceByStoreProduct.get(key);
      const projectedQuantity = temporalProjection.values.get(key);
	    const salePrice = priceTypeByStore.get(product.storeId) ? salePriceByProductType.get(`${product.productId}:${priceTypeByStore.get(product.storeId)}`) ?? null : null;
      const accountingQuantity = temporalProjection.known.has(key) ? Math.round((projectedQuantity ?? 0) * 1_000) / 1_000 : null;
	    return {
	      ...product,
	      internalCode: product.internalCode || `Эвотор #${product.productId}`,
	      accountingQuantity,
	      salePrice,
	      stockValue: accountingQuantity === null || salePrice === null ? null : Math.round(accountingQuantity * salePrice * 100) / 100,
	      lastCountedAt: movementBalance?.lastCountedAt ?? null,
	    };
	  });
  const valuedPositions = projectedRows.filter(row => row.stockValue !== null).length;
  const totalStockValue = Math.round(projectedRows.reduce((total, row) => total + (row.stockValue ?? 0), 0) * 100) / 100;
  const sort = input.sort ?? "code";
  const direction = input.direction === "desc" ? -1 : 1;
  const compareText = (left: string, right: string) => left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" });
  const compareNullableNumber = (left: number | null, right: number | null) => {
    // An unknown accounting value is never presented as the "largest" value.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * direction;
  };
  const sortedRows = [...projectedRows].sort((left, right) => {
    const comparison = sort === "store"
      ? compareText(left.storeName, right.storeName) * direction
      : sort === "product"
        ? compareText(left.canonicalName, right.canonicalName) * direction
        : sort === "quantity"
          ? compareNullableNumber(left.accountingQuantity, right.accountingQuantity)
          : sort === "value"
            ? compareNullableNumber(left.stockValue, right.stockValue)
            : compareText(String(left.internalCode), String(right.internalCode)) * direction;
    return comparison || compareText(left.storeName, right.storeName) || compareText(left.canonicalName, right.canonicalName);
  });
  return {
	    total: projectedRows.length,
	    valuedPositions,
	    totalStockValue,
    items: sortedRows.slice(offset, offset + limit),
	  };
}

/**
 * The catalog's quantity is a read-only physical snapshot, not a money balance
 * and not a stock-movement ledger. Units stay separated: adding kilograms,
 * liters and pieces would produce a fictitious balance.
 */
export async function getOperationalEvotorStockSnapshot(input: { storeIds?: number[] | null } = {}) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return { units: [], positions: 0, stores: 0, snapshotAt: null as Date | null };
  const commonConditions = [
    eq(stores.isHidden, false),
    Array.isArray(input.storeIds) ? inArray(operationalEvotorProductLinks.storeId, input.storeIds) : undefined,
  ].filter(Boolean);
  // Business rule: each non-null quantity saved from Evotor, including 1,000,000,
  // is an actual physical balance. Units remain separate in the projection.
  const quantityConditions = [...commonConditions, isNotNull(operationalEvotorProductLinks.evotorQuantitySnapshot)];
  const rows = await db
    .select({
      unit: operationalCatalogProducts.baseUnit,
      quantity: sql<string>`coalesce(sum(${operationalEvotorProductLinks.evotorQuantitySnapshot}), 0)`,
      positions: sql<number>`count(*)`,
      stores: sql<number>`count(distinct ${operationalEvotorProductLinks.storeId})`,
      snapshotAt: sql<Date | null>`max(${operationalEvotorProductLinks.evotorQuantityUpdatedAt})`,
    })
    .from(operationalEvotorProductLinks)
    .innerJoin(operationalCatalogProducts, eq(operationalCatalogProducts.id, operationalEvotorProductLinks.productId))
    .innerJoin(stores, eq(stores.id, operationalEvotorProductLinks.storeId))
    .where(and(...quantityConditions))
    .groupBy(operationalCatalogProducts.baseUnit);
  const units = rows
    .filter(row => row.unit === "fraction" || row.unit === "l" || row.unit === "piece")
    .map(row => ({ unit: row.unit as "fraction" | "l" | "piece", quantity: Number(row.quantity ?? 0), positions: Number(row.positions ?? 0), stores: Number(row.stores ?? 0) }))
    .filter(row => Number.isFinite(row.quantity));
  return {
    units,
    positions: units.reduce((total, row) => total + row.positions, 0),
    stores: Math.max(0, ...units.map(row => row.stores)),
    snapshotAt: rows.reduce<Date | null>((latest, row) => !latest || (row.snapshotAt && row.snapshotAt > latest) ? row.snapshotAt : latest, null),
  };
}

export type OperationalExcessStockCoverageFinding = {
  storeId: number;
  storeName: string;
  productId: number;
  productName: string;
  category: string | null;
  unit: InventoryUnit;
  coverageDays: number;
  thresholdDays: number;
};

function subtractMoscowBusinessDays(businessDate: string, days: number) {
  const [year, month, day] = businessDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day - days));
  return value.toISOString().slice(0, 10);
}

/** Null intentionally means that a signal cannot be justified from current facts. */
export function calculateOperationalStockCoverageDays(quantity: number | null | undefined, weeklySold: number | null | undefined) {
  if (!Number.isFinite(quantity) || !Number.isFinite(weeklySold) || !quantity || !weeklySold || quantity <= 0 || weeklySold <= 0) return null;
  return Math.round((quantity / (weeklySold / 7)) * 10) / 10;
}

/**
 * Read-only daily stock-cover projection for operational signals. It uses only
 * confirmed store balances (Evotor quantity snapshot plus immutable movements)
 * and the last seven Moscow calendar days of retained SELL positions. Missing
 * stock or missing sales is skipped rather than treated as zero.
 */
export async function listOperationalExcessStockCoverage(input: { storeIds?: number[] | null; businessDate?: string } = {}) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [] as OperationalExcessStockCoverageFinding[];
  const businessDate = input.businessDate ? validateInventoryDate(input.businessDate) : moscowBusinessDate();
  const [storeRows, catalog, categoryGroups, categoryMembers] = await Promise.all([
    db.select({ storeId: stores.id, storeName: stores.name }).from(stores).where(and(
      eq(stores.isHidden, false),
      Array.isArray(input.storeIds) ? inArray(stores.id, input.storeIds) : undefined,
    )).orderBy(stores.name).limit(200),
    db.select({
      productId: operationalCatalogProducts.id,
      productName: operationalCatalogProducts.canonicalName,
      catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
      category: operationalCatalogProducts.evotorCategoryName,
      baseUnit: operationalCatalogProducts.baseUnit,
    }).from(operationalCatalogProducts).where(and(
      eq(operationalCatalogProducts.isActive, true),
      inArray(operationalCatalogProducts.baseUnit, ["fraction", "l", "piece"]),
    )).limit(2_000),
    db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.isActive, true)).orderBy(operationalPrintCategoryGroups.name),
    db.select().from(operationalPrintCategoryGroupMembers).limit(2_000),
  ]);
  if (!storeRows.length || !catalog.length) return [] as OperationalExcessStockCoverageFinding[];

  const storeIds = storeRows.map(store => store.storeId);
  const productIds = catalog.map(product => product.productId);
  const [links, snapshots, localMovements, receiptMovements, sold] = await Promise.all([
    db.select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId, evotorProductId: operationalEvotorProductLinks.evotorProductId })
      .from(operationalEvotorProductLinks)
      .where(and(inArray(operationalEvotorProductLinks.storeId, storeIds), inArray(operationalEvotorProductLinks.productId, productIds))),
    db.select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt })
      .from(operationalEvotorProductLinks)
      .where(and(inArray(operationalEvotorProductLinks.storeId, storeIds), inArray(operationalEvotorProductLinks.productId, productIds))),
    db.select({ storeId: operationalStockMovements.storeId, productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
      .from(operationalStockMovements)
      .where(and(inArray(operationalStockMovements.storeId, storeIds), inArray(operationalStockMovements.productId, productIds))),
    listEvotorReceiptStockProjectionMovements({ storeIds, productIds }),
    db.select({
      storeId: operationalEvotorDocuments.storeId,
      evotorProductId: operationalEvotorDocumentPositions.evotorProductId,
      quantity: sql<string>`sum(${operationalEvotorDocumentPositions.quantity})`,
    }).from(operationalEvotorDocumentPositions)
      .innerJoin(operationalEvotorDocuments, eq(operationalEvotorDocumentPositions.documentId, operationalEvotorDocuments.id))
      .where(and(
        inArray(operationalEvotorDocuments.storeId, storeIds),
        eq(operationalEvotorDocuments.documentType, "SELL"),
        isNotNull(operationalEvotorDocuments.occurredAt),
        gte(operationalEvotorDocuments.occurredAt, `${subtractMoscowBusinessDays(businessDate, 6)}T00:00:00`),
      ))
      .groupBy(operationalEvotorDocuments.storeId, operationalEvotorDocumentPositions.evotorProductId),
  ]);

  const productById = new Map(catalog.map(product => [product.productId, product]));
  const storeNameById = new Map(storeRows.map(store => [store.storeId, store.storeName]));
  const linkedProductByExternalId = new Map(links.map(link => [`${link.storeId}:${link.evotorProductId}`, link.productId]));
  const stockProjection = projectSnapshotAwareStock(snapshots, [...localMovements, ...receiptMovements]);
  const categoryCoverById = new Map<number, number>();
  const categoryCoverByName = new Map<string, number>();
  for (const group of categoryGroups) {
    // Reuse exactly the category scope already configured for replenishment.
    // A purely print-oriented group cannot silently change an operating limit.
    if (group.supplyPrintGroupId === null) continue;
    const threshold = Math.min(14, Math.max(1, group.maxStoreCoverDays ?? 2));
    const categories = expandPrintCategoryReferences(group.id, categoryGroups, categoryMembers);
    for (const categoryId of Array.from(categories.categoryIds)) if (!categoryCoverById.has(categoryId)) categoryCoverById.set(categoryId, threshold);
    for (const categoryName of Array.from(categories.categoryNames)) if (!categoryCoverByName.has(categoryName)) categoryCoverByName.set(categoryName, threshold);
  }

  const stockByStoreProduct = stockProjection.values;
  const knownStock = stockProjection.known;
  const weeklySoldByStoreProduct = new Map<string, number>();
  for (const row of sold) {
    if (!row.evotorProductId) continue;
    const productId = linkedProductByExternalId.get(`${row.storeId}:${row.evotorProductId}`);
    if (!productId) continue;
    const key = `${row.storeId}:${productId}`;
    weeklySoldByStoreProduct.set(key, (weeklySoldByStoreProduct.get(key) ?? 0) + Math.max(0, Number(row.quantity ?? 0)));
  }

  const findings: OperationalExcessStockCoverageFinding[] = [];
  for (const key of Array.from(knownStock)) {
    const [storeIdText, productIdText] = key.split(":");
    const storeId = Number(storeIdText);
    const productId = Number(productIdText);
    const product = productById.get(productId);
    const storeName = storeNameById.get(storeId);
    if (!product || !storeName) continue;
    const quantity = Math.max(0, stockByStoreProduct.get(key) ?? 0);
    const weeklySold = Math.max(0, weeklySoldByStoreProduct.get(key) ?? 0);
    if (quantity <= 0 || weeklySold <= 0) continue;
    const thresholdDays = product.catalogCategoryId ? categoryCoverById.get(product.catalogCategoryId) ?? 2 : product.category ? categoryCoverByName.get(product.category) ?? 2 : 2;
    const coverageDays = calculateOperationalStockCoverageDays(quantity, weeklySold);
    if (coverageDays === null || coverageDays <= thresholdDays) continue;
    findings.push({
      storeId,
      storeName,
      productId,
      productName: product.productName,
      category: product.category,
      unit: inventoryUnitFromCatalogUnit(product.baseUnit as CatalogUnit),
      coverageDays,
      thresholdDays,
    });
  }
  return findings.sort((left, right) => right.coverageDays - left.coverageDays || left.storeName.localeCompare(right.storeName, "ru") || left.productName.localeCompare(right.productName, "ru"));
}

export type StoreRequestStatus = "draft" | "closed";
export type PrintCategoryMode = "per_store" | "grouped_stores";

/** Normalized receipt data is retained for operational analytics from 2025 only. */
export const EVOTOR_DOCUMENT_RETENTION_START = "2025-01-01";

/**
 * The public V2 list endpoint filters by creation time but current production
 * document objects can omit that source field.  A short rolling overlap keeps
 * the stream safe against a delayed or equal-time document without ever
 * restarting the historical 2025+ archive.  External IDs make overlap rows
 * idempotent no-ops.
 */
export const EVOTOR_CURRENT_DAY_OVERLAP_MINUTES = 120;
const EVOTOR_CURRENT_DAY_OVERLAP_MS = EVOTOR_CURRENT_DAY_OVERLAP_MINUTES * 60_000;

function moscowBusinessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isRetainedEvotorDocument(document: { closedAt: string | null; createdAt: string | null }) {
  const businessDate = (document.closedAt ?? document.createdAt ?? "").slice(0, 10);
  return /^20\d{2}-\d{2}-\d{2}$/.test(businessDate) && businessDate >= EVOTOR_DOCUMENT_RETENTION_START;
}

/** Gives a current-day lower bound without treating close_date as a V2 source watermark. */
export function currentDayEvotorWindowStartFromWatermarks(input: {
  businessDate: string;
  sourceCreatedAt?: string | Date | null;
  lastCompletedAt?: string | Date | null;
}) {
  const dayStart = new Date(`${input.businessDate}T00:00:00.000+03:00`).getTime();
  const asEpoch = (value: string | Date | null | undefined) => {
    if (!value) return null;
    const epoch = new Date(value).getTime();
    return Number.isFinite(epoch) ? epoch : null;
  };
  // V2 `since` is explicitly based on the document creation time. Therefore a
  // supplied `sourceCreatedAt` always wins over the later local callback time;
  // the latter is only a fallback for legacy objects that omit `created_at`.
  // `close_date` remains intentionally excluded because it is not the V2
  // creation-time watermark. Every selected value is overlapped, not advanced
  // by +1ms, so equal-time and delayed documents stay idempotently visible.
  const highWatermark = Math.max(
    dayStart,
    asEpoch(input.sourceCreatedAt) ?? asEpoch(input.lastCompletedAt) ?? dayStart,
  );
  return new Date(Math.max(dayStart, highWatermark - EVOTOR_CURRENT_DAY_OVERLAP_MS));
}

/**
 * Current-day polling is a short idempotent overlap, never a repeated archive.
 * It makes no undocumented claim that `close_date` is equal to V2 `created_at`.
 * A sale, cancellation and return are distinct documents keyed by external ID.
 */
async function currentDayEvotorWindowStart(storeId: number, businessDate: string) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const sourceTimeFilter = and(
    eq(operationalEvotorDocuments.storeId, storeId),
    isNotNull(operationalEvotorDocuments.sourceCreatedAt),
    gte(operationalEvotorDocuments.sourceCreatedAt, `${businessDate}T00:00:00`),
  );
  const syncFilter = and(
    eq(operationalEvotorDocumentSyncs.storeId, storeId),
    eq(operationalEvotorDocumentSyncs.syncMode, "current_day"),
    eq(operationalEvotorDocumentSyncs.status, "completed"),
    eq(operationalEvotorDocumentSyncs.requestedTo, businessDate),
  );
  const [[latestSource], [lastCompleted]] = await Promise.all([
    db.select({ sourceCreatedAt: operationalEvotorDocuments.sourceCreatedAt }).from(operationalEvotorDocuments).where(sourceTimeFilter).orderBy(desc(operationalEvotorDocuments.sourceCreatedAt)).limit(1),
    db.select({ completedAt: operationalEvotorDocumentSyncs.completedAt }).from(operationalEvotorDocumentSyncs).where(syncFilter).orderBy(desc(operationalEvotorDocumentSyncs.completedAt)).limit(1),
  ]);
  return currentDayEvotorWindowStartFromWatermarks({
    businessDate,
    sourceCreatedAt: latestSource?.sourceCreatedAt,
    lastCompletedAt: lastCompleted?.completedAt,
  });
}

export const validateStoreRequestQuantity = (value: number) => {
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000 || Math.round(value * 10) !== value * 10) {
    throw new Error("Количество в заявке должно быть больше нуля и содержать не более одного знака после точки.");
  }
  return Math.round(value * 1_000) / 1_000;
};

async function nextStoreRequestNumber() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [last] = await db.select({ requestNumber: operationalStoreRequests.requestNumber }).from(operationalStoreRequests).orderBy(desc(operationalStoreRequests.requestNumber)).limit(1);
  return (last?.requestNumber ?? 0) + 1;
}

function requestHeaderState(row: typeof operationalStoreRequests.$inferSelect) {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    storeId: row.storeId,
    storeName: row.storeName,
    businessDate: row.businessDate,
    status: row.status,
    note: row.note,
    createdByAccountId: row.createdByAccountId,
    closedByAccountId: row.closedByAccountId,
    closedAt: row.closedAt,
    isHidden: row.isHidden,
    hiddenAt: row.hiddenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireStoreRequest(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [request] = await db.select().from(operationalStoreRequests).where(eq(operationalStoreRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Заявка магазина не найдена.");
  return request;
}

async function requireDraftStoreRequest(requestId: number) {
  const request = await requireStoreRequest(requestId);
  if (request.status !== "draft") throw new Error("Закрытую заявку нельзя изменять.");
  return request;
}

/**
 * Request preparation intentionally returns operating, not financial, facts.
 * A store sees a qualitative current-stock state and the demand observed in
 * the last seven calendar days. Exact snapshot quantities, prices and costs
 * never reach this projection.
 */
export async function listOperationalStoreRequestProducts(input: { storeId: number; includeHidden?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const [store] = await db.select({ id: stores.id, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!store || store.isHidden) throw new Error("Рабочий склад не найден.");
  const rows = await db
    .select({
      id: operationalCatalogProducts.id,
      catalogNumber: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
      managedCategoryName: operationalCatalogCategories.name,
      evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
      baseUnit: operationalCatalogProducts.baseUnit,
      isVisibleInRequests: operationalCatalogProducts.isVisibleInRequests,
    })
    .from(operationalCatalogProducts)
    .leftJoin(operationalCatalogCategories, eq(operationalCatalogProducts.catalogCategoryId, operationalCatalogCategories.id))
    .where(and(
      eq(operationalCatalogProducts.isActive, true),
      input.includeHidden ? undefined : eq(operationalCatalogProducts.isVisibleInRequests, true),
    ))
    .orderBy(operationalCatalogProducts.catalogNumber)
    .limit(2_000);
  const products = rows
    .map(row => ({ ...row, categoryName: row.managedCategoryName ?? row.evotorCategoryName }))
    .filter(row => row.baseUnit === "fraction" || row.baseUnit === "l" || row.baseUnit === "piece");
  if (!products.length) return [];

  const productIds = products.map(product => product.id);
  const [accounting, links, categoryGroups, categoryMembers, onecMappings, onecSnapshots] = await Promise.all([
    getInventoryAccountingQuantities(input.storeId, productIds),
    db.select({ productId: operationalEvotorProductLinks.productId, evotorProductId: operationalEvotorProductLinks.evotorProductId })
      .from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, input.storeId), inArray(operationalEvotorProductLinks.productId, productIds))),
    db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.isActive, true)).orderBy(operationalPrintCategoryGroups.name),
    db.select().from(operationalPrintCategoryGroupMembers).limit(2_000),
    db.select({ warehouseCode: operationalOnecWarehouseGroupMappings.warehouseCode, printGroupId: operationalOnecWarehouseGroupMappings.printGroupId }).from(operationalOnecWarehouseGroupMappings),
    db.select({ warehouseCode: operationalOnecWarehouseSnapshots.warehouseCode, productId: operationalOnecWarehouseSnapshots.productId, quantityOnHand: operationalOnecWarehouseSnapshots.quantityOnHand, businessDate: operationalOnecWarehouseSnapshots.businessDate, asOf: operationalOnecWarehouseSnapshots.asOf })
      .from(operationalOnecWarehouseSnapshots)
      .where(and(inArray(operationalOnecWarehouseSnapshots.productId, productIds), eq(operationalOnecWarehouseSnapshots.mappingState, "mapped")))
      .limit(100_000),
  ]);
  const productIdByEvotorId = new Map(links.map(link => [link.evotorProductId, link.productId]));
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const documents = await db
    .select({ id: operationalEvotorDocuments.id })
    .from(operationalEvotorDocuments)
    .where(and(
      eq(operationalEvotorDocuments.storeId, input.storeId),
      eq(operationalEvotorDocuments.documentType, "SELL"),
      isNotNull(operationalEvotorDocuments.occurredAt),
      gte(operationalEvotorDocuments.occurredAt, `${sevenDaysAgo}T00:00:00`),
    ))
    .limit(20_000);
  const documentIds = documents.map(document => document.id);
  const weeklySoldByProduct = new Map<number, number>();
  for (let start = 0; start < documentIds.length; start += 500) {
    const positions = await db
      .select({ evotorProductId: operationalEvotorDocumentPositions.evotorProductId, quantity: operationalEvotorDocumentPositions.quantity })
      .from(operationalEvotorDocumentPositions)
      .where(inArray(operationalEvotorDocumentPositions.documentId, documentIds.slice(start, start + 500)));
    for (const position of positions) {
      const productId = position.evotorProductId ? productIdByEvotorId.get(position.evotorProductId) : undefined;
      if (!productId) continue;
      const quantity = Math.max(0, Number(position.quantity ?? 0));
      weeklySoldByProduct.set(productId, (weeklySoldByProduct.get(productId) ?? 0) + quantity);
    }
  }

  // A group is usable as a supplier only after an administrator explicitly maps
  // BM/SRS to it. The source is the latest received 1С warehouse snapshot, never
  // a store balance or an inferred quantity.
  const printGroupByOnecWarehouse = new Map(onecMappings.map(mapping => [mapping.warehouseCode, mapping.printGroupId]));
  const latestOnecSnapshot = new Map<string, { quantity: number; stamp: string }>();
  for (const row of onecSnapshots) {
    if (row.productId === null || !printGroupByOnecWarehouse.has(row.warehouseCode)) continue;
    const key = `${row.warehouseCode}:${row.productId}`;
    const stamp = `${row.businessDate}:${row.asOf}`;
    const existing = latestOnecSnapshot.get(key);
    if (!existing || stamp > existing.stamp) latestOnecSnapshot.set(key, { quantity: Math.max(0, Number(row.quantityOnHand)), stamp });
  }
  const supplierQuantity = (printGroupId: number, productId: number) => {
    const sourceRows = Array.from(printGroupByOnecWarehouse.entries()).filter(([, groupId]) => groupId === printGroupId);
    const snapshots = sourceRows.map(([warehouseCode]) => latestOnecSnapshot.get(`${warehouseCode}:${productId}`)).filter((row): row is { quantity: number; stamp: string } => Boolean(row));
    if (!snapshots.length) return null;
    return Math.round(snapshots.reduce((sum, row) => sum + row.quantity, 0) * 1_000) / 1_000;
  };
  const categorySettingsForCover = new Map<number, { maxStoreCoverDays: number }>();
  const legacyCategorySettingsForCover = new Map<string, { maxStoreCoverDays: number }>();
  const supplyGroupForCategory = new Map<number, number>();
  const legacySupplyGroupForCategory = new Map<string, number>();
  for (const group of categoryGroups) {
    const categories = expandPrintCategoryReferences(group.id, categoryGroups, categoryMembers);
    for (const categoryId of Array.from(categories.categoryIds)) {
      if (!categorySettingsForCover.has(categoryId)) categorySettingsForCover.set(categoryId, {
        maxStoreCoverDays: Math.min(14, Math.max(1, group.maxStoreCoverDays ?? 2)),
      });
      if (group.supplyPrintGroupId !== null && !supplyGroupForCategory.has(categoryId)) supplyGroupForCategory.set(categoryId, group.supplyPrintGroupId);
    }
    for (const category of Array.from(categories.categoryNames)) {
      if (!legacyCategorySettingsForCover.has(category)) legacyCategorySettingsForCover.set(category, {
        maxStoreCoverDays: Math.min(14, Math.max(1, group.maxStoreCoverDays ?? 2)),
      });
      if (group.supplyPrintGroupId !== null && !legacySupplyGroupForCategory.has(category)) legacySupplyGroupForCategory.set(category, group.supplyPrintGroupId);
    }
  }

  return products.map(product => {
    const quantity = accounting.get(product.id);
    const weeklySold = Math.round((weeklySoldByProduct.get(product.id) ?? 0) * 1_000) / 1_000;
    const dailySold = weeklySold > 0 ? Math.round((weeklySold / 7) * 1_000) / 1_000 : null;
    const daysCover = quantity !== undefined && dailySold
      ? Math.max(0, Math.round(quantity / dailySold))
      : null;
    const storeStockState = quantity === undefined
      ? "unknown"
      : daysCover !== null
        ? daysCover <= 3 ? "low" : daysCover <= 10 ? "sufficient" : "high"
        : quantity <= 0 ? "low" : "high";
    const categoryCoverSettings = product.catalogCategoryId
      ? categorySettingsForCover.get(product.catalogCategoryId)
      : product.categoryName ? legacyCategorySettingsForCover.get(product.categoryName) : undefined;
    const maxStoreCoverDays = categoryCoverSettings?.maxStoreCoverDays ?? 2;
    const supplyPrintGroupId = product.catalogCategoryId
      ? supplyGroupForCategory.get(product.catalogCategoryId)
      : product.categoryName ? legacySupplyGroupForCategory.get(product.categoryName) : undefined;
    const supplyQuantity = supplyPrintGroupId ? supplierQuantity(supplyPrintGroupId, product.id) : null;
    const supplyStockState = supplyQuantity === null ? "unknown" : supplyQuantity <= 0 || (dailySold !== null && supplyQuantity < dailySold) ? "low" : dailySold !== null && supplyQuantity < dailySold * 4 ? "sufficient" : "high";
    const baselineOrderQuantity = dailySold !== null && dailySold > 0
      ? Math.ceil(dailySold + (product.baseUnit === "fraction" ? 2 : 1))
      : null;
    // Daily delivery remains fresh only when the configurable category cover is
    // respected. When an exact local stock is known, fill only the daily sale
    // plus the unit buffer rather than stacking another full order on top.
    const recommendedQuantity = baselineOrderQuantity === null
      ? null
      : daysCover !== null && daysCover >= maxStoreCoverDays
        ? 0
        : Math.max(0, baselineOrderQuantity - (quantity !== undefined ? Math.max(0, quantity) : 0));
    return {
      ...product,
      weeklySold,
      dailySold,
      storeQuantity: quantity ?? null,
      daysCover,
      storeStockState,
      supplyStockState,
      supplySourceLabel: supplyPrintGroupId && supplyQuantity !== null ? "остаток 1С по последнему срезу" : null,
      maxStoreCoverDays,
      recommendedQuantity,
      recommendation: daysCover !== null && daysCover <= 3
        ? "order_soon"
        : dailySold === null
          ? "no_recent_sales"
          : "normal",
    };
  });
}

/** Safe store projection for requests. The caller's access scope is resolved in the router. */
export async function listOperationalStoreRequestStores(input: { storeIds?: number[] | null }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  return db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(and(
      eq(stores.isHidden, false),
      Array.isArray(input.storeIds) ? inArray(stores.id, input.storeIds) : undefined,
    ))
    .orderBy(stores.name)
    .limit(100);
}

export async function listOperationalStoreRequests(input: { storeIds?: number[] | null; storeId?: number; status?: StoreRequestStatus; from?: string; to?: string; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const conditions = [
    input.storeId ? eq(operationalStoreRequests.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalStoreRequests.storeId, input.storeIds) : undefined,
    eq(operationalStoreRequests.isHidden, false),
    input.status ? eq(operationalStoreRequests.status, input.status) : undefined,
    input.from ? gte(operationalStoreRequests.businessDate, validateInventoryDate(input.from)) : undefined,
    input.to ? lte(operationalStoreRequests.businessDate, validateInventoryDate(input.to)) : undefined,
  ].filter(Boolean);
  const requests = await db.select().from(operationalStoreRequests).where(and(...conditions)).orderBy(desc(operationalStoreRequests.updatedAt), desc(operationalStoreRequests.id)).limit(Math.min(Math.max(input.limit ?? 30, 1), 100));
  if (!requests.length) return [];
  const requestIds = requests.map(request => request.id);
  const lines = await db.select({ requestId: operationalStoreRequestLines.requestId }).from(operationalStoreRequestLines).where(inArray(operationalStoreRequestLines.requestId, requestIds));
  const counts = new Map<number, number>();
  for (const line of lines) counts.set(line.requestId, (counts.get(line.requestId) ?? 0) + 1);
  return requests.map(request => ({ ...requestHeaderState(request), lineCount: counts.get(request.id) ?? 0 }));
}

export async function getOperationalStoreRequestDetail(requestId: number) {
  const db = await getDb();
  if (!db) return null;
  const request = await requireStoreRequest(requestId);
  const [lines, comments] = await Promise.all([
    db
      .select()
      .from(operationalStoreRequestLines)
      .where(eq(operationalStoreRequestLines.requestId, requestId))
      .orderBy(operationalStoreRequestLines.categoryName, operationalStoreRequestLines.catalogNumber)
      .limit(2_000),
    db
      .select()
      .from(operationalStoreRequestComments)
      .where(eq(operationalStoreRequestComments.requestId, requestId))
      .orderBy(operationalStoreRequestComments.slot)
      .limit(2),
  ]);
  return {
    ...requestHeaderState(request),
    lines: lines.map(line => ({ ...line, requestedQuantity: Number(line.requestedQuantity) })),
    comments,
  };
}

export async function createOperationalStoreRequest(input: { storeId: number; businessDate: string; note?: string; createdByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const businessDate = validateInventoryDate(input.businessDate);
  const [store] = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!store || store.isHidden) throw new Error("Рабочий склад не найден.");
  const draftStoreKey = `draft:${store.id}`;
  const [existing] = await db.select().from(operationalStoreRequests).where(eq(operationalStoreRequests.draftStoreKey, draftStoreKey)).limit(1);
  if (existing) return { created: false, request: existing };
  const note = normalizedText(input.note ?? "").slice(0, 4_000) || null;
  try {
    const [inserted] = await db.insert(operationalStoreRequests).values({
      requestNumber: await nextStoreRequestNumber(),
      storeId: store.id,
      storeName: store.name,
      businessDate,
      draftStoreKey,
      note,
      createdByAccountId: input.createdByAccountId,
    }).$returningId();
    const request = await requireStoreRequest(inserted.id);
    return { created: true, request };
  } catch (error) {
    const [concurrentDraft] = await db.select().from(operationalStoreRequests).where(eq(operationalStoreRequests.draftStoreKey, draftStoreKey)).limit(1);
    if (concurrentDraft) return { created: false, request: concurrentDraft };
    throw error;
  }
}

/** Each request has two optional comments whose destination is configured on the print category. */
export async function upsertOperationalStoreRequestComment(input: {
  requestId: number;
  slot: 1 | 2;
  text: string;
  actorId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await requireDraftStoreRequest(input.requestId);
  const [categoryGroup] = await db
    .select({ id: operationalPrintCategoryGroups.id, name: operationalPrintCategoryGroups.name, isActive: operationalPrintCategoryGroups.isActive })
    .from(operationalPrintCategoryGroups)
    .where(and(eq(operationalPrintCategoryGroups.requestCommentSlot, input.slot === 1 ? "slot_1" : "slot_2"), eq(operationalPrintCategoryGroups.isActive, true)))
    .limit(1);
  if (!categoryGroup || !categoryGroup.isActive) throw new Error(`Для комментария ${input.slot} настройте категорию печати в разделе «Состав печатных подборок».`);
  const text = normalizedText(input.text).slice(0, 2_000);
  const [before] = await db.select().from(operationalStoreRequestComments)
    .where(and(eq(operationalStoreRequestComments.requestId, input.requestId), eq(operationalStoreRequestComments.slot, input.slot)))
    .limit(1);
  if (!text) {
    if (before) await db.delete(operationalStoreRequestComments).where(eq(operationalStoreRequestComments.id, before.id));
    return { before: before ?? null, after: null };
  }
  const values = {
    requestId: input.requestId,
    slot: input.slot,
    printCategoryGroupId: categoryGroup.id,
    printCategoryGroupName: categoryGroup.name,
    text,
    updatedByAccountId: input.actorId,
  };
  if (before) {
    await db.update(operationalStoreRequestComments).set(values).where(eq(operationalStoreRequestComments.id, before.id));
  } else {
    await db.insert(operationalStoreRequestComments).values({ ...values, createdByAccountId: input.actorId });
  }
  const [after] = await db.select().from(operationalStoreRequestComments)
    .where(and(eq(operationalStoreRequestComments.requestId, input.requestId), eq(operationalStoreRequestComments.slot, input.slot)))
    .limit(1);
  return { before: before ?? null, after: after! };
}

export async function upsertOperationalStoreRequestLine(input: { requestId: number; productId: number; requestedQuantity: number; note?: string; allowHidden?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await requireDraftStoreRequest(input.requestId);
  const [product] = await db
    .select({
      id: operationalCatalogProducts.id,
      catalogNumber: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
      managedCategoryName: operationalCatalogCategories.name,
      evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
      baseUnit: operationalCatalogProducts.baseUnit,
      isActive: operationalCatalogProducts.isActive,
      isVisibleInRequests: operationalCatalogProducts.isVisibleInRequests,
    })
    .from(operationalCatalogProducts)
    .leftJoin(operationalCatalogCategories, eq(operationalCatalogProducts.catalogCategoryId, operationalCatalogCategories.id))
    .where(eq(operationalCatalogProducts.id, input.productId))
    .limit(1);
  if (!product || !product.isActive || (!product.isVisibleInRequests && !input.allowHidden)) throw new Error("Товар недоступен для заявки.");
  if (product.baseUnit !== "fraction" && product.baseUnit !== "l" && product.baseUnit !== "piece") throw new Error("Для товара не задана рабочая единица.");
  const [before] = await db.select().from(operationalStoreRequestLines).where(and(eq(operationalStoreRequestLines.requestId, input.requestId), eq(operationalStoreRequestLines.productId, input.productId))).limit(1);
  const requestedQuantity = validateStoreRequestQuantity(input.requestedQuantity);
  const note = normalizedText(input.note ?? "").slice(0, 512) || null;
  const values = {
    requestId: input.requestId,
    productId: product.id,
    catalogNumber: product.catalogNumber,
    productName: product.canonicalName,
    catalogCategoryId: product.catalogCategoryId,
    categoryName: product.managedCategoryName ?? product.evotorCategoryName,
    requestedQuantity: requestedQuantity.toFixed(1),
    unit: inventoryUnitFromCatalogUnit(product.baseUnit),
    note,
  };
  if (before) {
    await db.update(operationalStoreRequestLines).set(values).where(eq(operationalStoreRequestLines.id, before.id));
  } else {
    await db.insert(operationalStoreRequestLines).values(values);
  }
  const [after] = await db.select().from(operationalStoreRequestLines).where(and(eq(operationalStoreRequestLines.requestId, input.requestId), eq(operationalStoreRequestLines.productId, input.productId))).limit(1);
  return { before: before ?? null, after: after!, product };
}

/**
 * Replaces the editable product lines and both print comments as one transaction.
 * The operation never creates catalogue products and retains legacy manual lines
 * untouched, because they are not editable from the current request interface.
 */
export async function saveOperationalStoreRequestDraft(input: {
  requestId: number;
  businessDate?: string;
  lines: Array<{ productId: number; requestedQuantity: number }>;
  comments: Array<{ slot: 1 | 2; text: string }>;
  actorId: number;
  allowHidden?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (input.lines.length > 2_000) throw new Error("Открытая заявка может содержать не более 2 000 позиций.");
  const linesByProduct = new Map<number, { productId: number; requestedQuantity: number }>();
  for (const line of input.lines) {
    if (linesByProduct.has(line.productId)) throw new Error("Один товар нельзя сохранить в заявке дважды.");
    linesByProduct.set(line.productId, { productId: line.productId, requestedQuantity: validateStoreRequestQuantity(line.requestedQuantity) });
  }
  const commentsBySlot = new Map<1 | 2, string>();
  for (const comment of input.comments) {
    if (commentsBySlot.has(comment.slot)) throw new Error("Каждый комментарий можно сохранить только один раз.");
    commentsBySlot.set(comment.slot, normalizedText(comment.text).slice(0, 2_000));
  }
  if (commentsBySlot.size !== 2 || !commentsBySlot.has(1) || !commentsBySlot.has(2)) {
    throw new Error("Передайте оба комментария открытой заявки.");
  }
  const productIds = Array.from(linesByProduct.keys());
  return db.transaction(async tx => {
    const [request] = await tx.select().from(operationalStoreRequests).where(eq(operationalStoreRequests.id, input.requestId)).limit(1);
    if (!request) throw new Error("Заявка не найдена.");
    if (request.status !== "draft") throw new Error("Закрытую заявку нельзя изменять.");
    const businessDate = input.businessDate === undefined ? request.businessDate : validateInventoryDate(input.businessDate);
    const [existingLines, existingComments, commentCategories] = await Promise.all([
      tx.select().from(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, input.requestId)).limit(2_000),
      tx.select().from(operationalStoreRequestComments).where(eq(operationalStoreRequestComments.requestId, input.requestId)).limit(2),
      tx.select({ id: operationalPrintCategoryGroups.id, name: operationalPrintCategoryGroups.name, requestCommentSlot: operationalPrintCategoryGroups.requestCommentSlot })
        .from(operationalPrintCategoryGroups)
        .where(and(eq(operationalPrintCategoryGroups.isActive, true), inArray(operationalPrintCategoryGroups.requestCommentSlot, ["slot_1", "slot_2"]))),
    ]);
    const products = productIds.length
      ? await tx.select({
        id: operationalCatalogProducts.id,
        catalogNumber: operationalCatalogProducts.catalogNumber,
        canonicalName: operationalCatalogProducts.canonicalName,
        catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
        managedCategoryName: operationalCatalogCategories.name,
        evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
        baseUnit: operationalCatalogProducts.baseUnit,
        isActive: operationalCatalogProducts.isActive,
        isVisibleInRequests: operationalCatalogProducts.isVisibleInRequests,
      }).from(operationalCatalogProducts)
        .leftJoin(operationalCatalogCategories, eq(operationalCatalogProducts.catalogCategoryId, operationalCatalogCategories.id))
        .where(inArray(operationalCatalogProducts.id, productIds))
      : [];
    const productsById = new Map(products.map(product => [product.id, product]));
    if (productsById.size !== productIds.length) throw new Error("Один из товаров больше недоступен для заявки.");
    for (const product of products) {
      if (!product.isActive || (!product.isVisibleInRequests && !input.allowHidden)) throw new Error("Товар недоступен для заявки.");
      if (product.baseUnit !== "fraction" && product.baseUnit !== "l" && product.baseUnit !== "piece") throw new Error("Для товара не задана рабочая единица.");
    }
    const categoryBySlot = new Map<1 | 2, { id: number; name: string }>();
    for (const category of commentCategories) {
      if (category.requestCommentSlot === "slot_1") categoryBySlot.set(1, category);
      if (category.requestCommentSlot === "slot_2") categoryBySlot.set(2, category);
    }
    for (const slot of [1, 2] as const) {
      if (commentsBySlot.get(slot) && !categoryBySlot.has(slot)) throw new Error(`Для комментария ${slot} настройте категорию печати в разделе «Состав печатных подборок».`);
    }
    const existingLineByProduct = new Map(existingLines.filter(line => line.productId !== null).map(line => [line.productId!, line]));
    const existingCommentBySlot = new Map(existingComments.map(comment => [comment.slot, comment]));
    const desiredProductIds = new Set(productIds);
    const removableLineIds = existingLines.filter(line => line.productId !== null && !desiredProductIds.has(line.productId)).map(line => line.id);
    if (removableLineIds.length) await tx.delete(operationalStoreRequestLines).where(inArray(operationalStoreRequestLines.id, removableLineIds));
    for (const entry of Array.from(linesByProduct.values())) {
      const product = productsById.get(entry.productId)!;
      const values = {
        requestId: input.requestId,
        productId: product.id,
        catalogNumber: product.catalogNumber,
        productName: product.canonicalName,
        catalogCategoryId: product.catalogCategoryId,
        categoryName: product.managedCategoryName ?? product.evotorCategoryName,
        requestedQuantity: entry.requestedQuantity.toFixed(1),
        unit: inventoryUnitFromCatalogUnit(product.baseUnit),
        note: null,
      };
      const before = existingLineByProduct.get(product.id);
      if (before) await tx.update(operationalStoreRequestLines).set(values).where(eq(operationalStoreRequestLines.id, before.id));
      else await tx.insert(operationalStoreRequestLines).values(values);
    }
    for (const slot of [1, 2] as const) {
      const before = existingCommentBySlot.get(slot);
      const text = commentsBySlot.get(slot)!;
      if (!text) {
        if (before) await tx.delete(operationalStoreRequestComments).where(eq(operationalStoreRequestComments.id, before.id));
        continue;
      }
      const category = categoryBySlot.get(slot)!;
      const values = {
        requestId: input.requestId,
        slot,
        printCategoryGroupId: category.id,
        printCategoryGroupName: category.name,
        text,
        updatedByAccountId: input.actorId,
      };
      if (before) await tx.update(operationalStoreRequestComments).set(values).where(eq(operationalStoreRequestComments.id, before.id));
      else await tx.insert(operationalStoreRequestComments).values({ ...values, createdByAccountId: input.actorId });
    }
    await tx.update(operationalStoreRequests).set({ businessDate, updatedAt: new Date() }).where(eq(operationalStoreRequests.id, input.requestId));
    const retainedManualLines = existingLines.filter(line => line.productId === null).length;
    return {
      before: { businessDate: request.businessDate, lineCount: existingLines.length, commentCount: existingComments.length },
      after: { businessDate, lineCount: linesByProduct.size + retainedManualLines, commentCount: Array.from(commentsBySlot.values()).filter(Boolean).length, retainedManualLines },
    };
  });
}

/**
 * A missing assortment item may be noted by a store without turning a free-text
 * request into a new catalog record. Such a line is intentionally print-only
 * and has no route into Evotor.
 */
export async function addOperationalStoreRequestManualLine(input: { requestId: number; productName: string; requestedQuantity: number; unit: InventoryUnit; printCategoryGroupId: number; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await requireDraftStoreRequest(input.requestId);
  const productName = normalizedText(input.productName);
  if (productName.length < 2 || productName.length > 512) throw new Error("Укажите название товара от 2 до 512 символов.");
  const requestedQuantity = validateStoreRequestQuantity(input.requestedQuantity);
  const note = normalizedText(input.note ?? "").slice(0, 512) || null;
  const [printCategoryGroup] = await db
    .select({ id: operationalPrintCategoryGroups.id, isActive: operationalPrintCategoryGroups.isActive })
    .from(operationalPrintCategoryGroups)
    .where(eq(operationalPrintCategoryGroups.id, input.printCategoryGroupId))
    .limit(1);
  if (!printCategoryGroup?.isActive) throw new Error("Выбранная категория печати недоступна.");
  const [inserted] = await db.insert(operationalStoreRequestLines).values({
    requestId: input.requestId,
    productId: null,
    catalogNumber: 0,
    productName,
    manualProductName: productName,
    categoryName: "Не найдено в справочнике",
    manualPrintCategoryGroupId: printCategoryGroup.id,
    requestedQuantity: requestedQuantity.toFixed(1),
    unit: input.unit,
    note,
  }).$returningId();
  const [after] = await db.select().from(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.id, inserted.id)).limit(1);
  return after!;
}

export async function removeOperationalStoreRequestLine(input: { requestId: number; productId?: number; lineId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await requireDraftStoreRequest(input.requestId);
  const condition = input.lineId
    ? and(eq(operationalStoreRequestLines.requestId, input.requestId), eq(operationalStoreRequestLines.id, input.lineId))
    : input.productId
      ? and(eq(operationalStoreRequestLines.requestId, input.requestId), eq(operationalStoreRequestLines.productId, input.productId))
      : undefined;
  if (!condition) throw new Error("Укажите строку заявки для удаления.");
  const [before] = await db.select().from(operationalStoreRequestLines).where(condition).limit(1);
  if (!before) throw new Error("Строка заявки не найдена.");
  await db.delete(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.id, before.id));
  return before;
}

export async function closeOperationalStoreRequest(input: { requestId: number; closedByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireDraftStoreRequest(input.requestId);
  const lines = await db.select({ id: operationalStoreRequestLines.id }).from(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, input.requestId)).limit(2_000);
  if (!lines.length) throw new Error("Добавьте хотя бы одну позицию перед закрытием заявки.");
  await db.update(operationalStoreRequests).set({ status: "closed", draftStoreKey: null, closedByAccountId: input.closedByAccountId, closedAt: new Date() }).where(eq(operationalStoreRequests.id, input.requestId));
  const after = await requireStoreRequest(input.requestId);
  return { before, after, lineCount: lines.length };
}

/** Closes every non-empty visible draft in the authorized print run before a single print projection is built. */
export async function closeOperationalStoreRequestsForPrint(input: { businessDate: string; closedByAccountId: number; storeIds?: number[] | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const businessDate = validateInventoryDate(input.businessDate);
  if (Array.isArray(input.storeIds) && !input.storeIds.length) return { businessDate, requests: [] as Array<{ id: number; requestNumber: number; storeName: string; lineCount: number }> };
  const drafts = await db
    .select({ id: operationalStoreRequests.id, requestNumber: operationalStoreRequests.requestNumber, storeName: operationalStoreRequests.storeName })
    .from(operationalStoreRequests)
    .innerJoin(stores, eq(stores.id, operationalStoreRequests.storeId))
    .where(and(
      eq(operationalStoreRequests.businessDate, businessDate),
      eq(operationalStoreRequests.status, "draft"),
      eq(stores.isHidden, false),
      Array.isArray(input.storeIds) ? inArray(operationalStoreRequests.storeId, input.storeIds) : undefined,
    ))
    .limit(2_000);
  if (!drafts.length) return { businessDate, requests: [] as Array<{ id: number; requestNumber: number; storeName: string; lineCount: number }> };
  const draftIds = drafts.map(draft => draft.id);
  const lines = await db.select({ requestId: operationalStoreRequestLines.requestId }).from(operationalStoreRequestLines).where(inArray(operationalStoreRequestLines.requestId, draftIds)).limit(20_000);
  const lineCounts = new Map<number, number>();
  for (const line of lines) lineCounts.set(line.requestId, (lineCounts.get(line.requestId) ?? 0) + 1);
  const closable = drafts.filter(draft => (lineCounts.get(draft.id) ?? 0) > 0);
  if (closable.length) {
    await db.update(operationalStoreRequests).set({ status: "closed", draftStoreKey: null, closedByAccountId: input.closedByAccountId, closedAt: new Date() }).where(inArray(operationalStoreRequests.id, closable.map(draft => draft.id)));
  }
  return { businessDate, requests: closable.map(draft => ({ ...draft, lineCount: lineCounts.get(draft.id) ?? 0 })) };
}

/** Lightweight gate for hiding the print-and-close action when the run has no non-empty drafts. */
export async function countOperationalStoreRequestPrintCandidates(input: { businessDate: string; storeIds?: number[] | null }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return 0;
  const businessDate = validateInventoryDate(input.businessDate);
  const rows = await db
    .select({ requestId: operationalStoreRequestLines.requestId })
    .from(operationalStoreRequestLines)
    .innerJoin(operationalStoreRequests, eq(operationalStoreRequests.id, operationalStoreRequestLines.requestId))
    .innerJoin(stores, eq(stores.id, operationalStoreRequests.storeId))
    .where(and(
      eq(operationalStoreRequests.businessDate, businessDate),
      eq(operationalStoreRequests.status, "draft"),
      eq(stores.isHidden, false),
      Array.isArray(input.storeIds) ? inArray(operationalStoreRequests.storeId, input.storeIds) : undefined,
    ))
    .limit(2_000);
  return new Set(rows.map(row => row.requestId)).size;
}

export async function deleteOperationalStoreRequestDraft(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireDraftStoreRequest(requestId);
  const lines = await db.select({ id: operationalStoreRequestLines.id }).from(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, requestId)).limit(2_000);
  await db.transaction(async tx => {
    await tx.delete(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, requestId));
    await tx.delete(operationalStoreRequests).where(eq(operationalStoreRequests.id, requestId));
  });
  return { before, lineCount: lines.length };
}

/**
 * Management-only removal for a closed request. The regular seller flow keeps
 * its draft-only deletion above; a closed snapshot can be removed only by the
 * router after it establishes manager/admin store access and records an audit.
 */
export async function deleteOperationalStoreRequest(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireStoreRequest(requestId);
  const [lines, comments] = await Promise.all([
    db.select({ id: operationalStoreRequestLines.id }).from(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, requestId)).limit(2_000),
    db.select({ id: operationalStoreRequestComments.id }).from(operationalStoreRequestComments).where(eq(operationalStoreRequestComments.requestId, requestId)).limit(10),
  ]);
  await db.transaction(async tx => {
    await tx.delete(operationalStoreRequestComments).where(eq(operationalStoreRequestComments.requestId, requestId));
    await tx.delete(operationalStoreRequestLines).where(eq(operationalStoreRequestLines.requestId, requestId));
    await tx.delete(operationalStoreRequests).where(eq(operationalStoreRequests.id, requestId));
  });
  return { before, lineCount: lines.length, commentCount: comments.length };
}

/**
 * A closed request can leave day-to-day history without deleting its immutable
 * snapshot. It remains recoverable only through the audited management action.
 */
export async function setOperationalStoreRequestHidden(input: { requestId: number; hidden: boolean; changedByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireStoreRequest(input.requestId);
  if (before.status !== "closed") throw new Error("Скрыть можно только закрытую заявку.");
  await db.update(operationalStoreRequests).set({
    isHidden: input.hidden,
    hiddenByAccountId: input.hidden ? input.changedByAccountId : null,
    hiddenAt: input.hidden ? new Date() : null,
  }).where(eq(operationalStoreRequests.id, input.requestId));
  const after = await requireStoreRequest(input.requestId);
  return { before, after };
}

function expandPrintCategoryReferences(groupId: number, groups: Array<typeof operationalPrintCategoryGroups.$inferSelect>, members: Array<typeof operationalPrintCategoryGroupMembers.$inferSelect>) {
  const byId = new Map(groups.map(group => [group.id, group]));
  const categoryIds = new Set<number>();
  const categoryNames = new Set<string>();
  const visited = new Set<number>();
  const visit = (id: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const member of members.filter(candidate => candidate.groupId === id)) {
      if (member.memberType === "catalog_category") {
        if (member.catalogCategoryId) categoryIds.add(member.catalogCategoryId);
        if (member.catalogCategory) categoryNames.add(member.catalogCategory);
      }
      if (member.memberType === "category_group" && member.childGroupId && byId.has(member.childGroupId)) visit(member.childGroupId);
    }
  };
  visit(groupId);
  return { categoryIds, categoryNames };
}

/** Legacy string-only members are retained for historical closed requests. */
function expandPrintCategoryNames(groupId: number, groups: Array<typeof operationalPrintCategoryGroups.$inferSelect>, members: Array<typeof operationalPrintCategoryGroupMembers.$inferSelect>) {
  return expandPrintCategoryReferences(groupId, groups, members).categoryNames;
}

/** Builds a reproducible, read-only print projection from saved or closed request snapshots. */
export async function getOperationalStoreRequestPrintProjection(input: { from: string; to: string; printGroupIds?: number[]; printCategoryGroupIds?: number[]; storeIds?: number[] | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const from = validateInventoryDate(input.from);
  const to = validateInventoryDate(input.to);
  if (from > to) throw new Error("Дата начала печати не может быть позже даты окончания.");
  const printSettings = await getOperationalRequestPrintSettings();
  const [allPrintGroups, allCategoryGroups, members] = await Promise.all([
    db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.isActive, true)).orderBy(operationalPrintGroups.name).limit(100),
    db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.isActive, true)).orderBy(operationalPrintCategoryGroups.name).limit(200),
    db.select().from(operationalPrintCategoryGroupMembers).limit(2_000),
  ]);
  const categoryGroupIds = input.printCategoryGroupIds?.length
    ? Array.from(new Set(input.printCategoryGroupIds)).filter(Number.isInteger)
    : allCategoryGroups.map(group => group.id);
  const categoryGroups = allCategoryGroups.filter(group => categoryGroupIds.includes(group.id));
  if (input.printCategoryGroupIds?.length && categoryGroups.length !== categoryGroupIds.length) throw new Error("Одна из выбранных категорий печати недоступна.");
  const chosenPrintGroups = input.printGroupIds?.length ? allPrintGroups.filter(group => input.printGroupIds!.includes(group.id)) : allPrintGroups;
  if (input.printGroupIds?.length && chosenPrintGroups.length !== Array.from(new Set(input.printGroupIds)).length) throw new Error("Одна из выбранных групп магазинов недоступна.");
  const [warehouseSettings, requestCandidates] = await Promise.all([
    db.select({ storeId: operationalWarehouseSettings.storeId, printGroupId: operationalWarehouseSettings.printGroupId }).from(operationalWarehouseSettings),
    db.select().from(operationalStoreRequests).where(and(
      Array.isArray(input.storeIds) ? inArray(operationalStoreRequests.storeId, input.storeIds) : undefined,
      gte(operationalStoreRequests.businessDate, from),
      lte(operationalStoreRequests.businessDate, to),
      eq(operationalStoreRequests.isHidden, false),
      inArray(operationalStoreRequests.status, ["draft", "closed"]),
    )).orderBy(operationalStoreRequests.businessDate, operationalStoreRequests.storeName, operationalStoreRequests.id).limit(2_000),
  ]);
  const requestStoreIds = Array.from(new Set(requestCandidates.map(request => request.storeId)));
  const visibleStores = requestStoreIds.length
    ? await db.select({ id: stores.id, name: stores.name }).from(stores).where(and(inArray(stores.id, requestStoreIds), eq(stores.isHidden, false))).orderBy(stores.name)
    : [];
  const visibleStoreById = new Map(visibleStores.map(store => [store.id, store]));
  const printGroupById = new Map(allPrintGroups.map(group => [group.id, group]));
  const configuredGroupByStore = new Map(warehouseSettings.filter(setting => setting.printGroupId !== null).map(setting => [setting.storeId, setting.printGroupId!]));
  const chosenPrintGroupIds = new Set(chosenPrintGroups.map(group => group.id));
  const fallbackStoreGroup = { id: "fallback-store-group", name: "Без группы магазинов" };
  const effectiveStoreGroup = (storeId: number) => {
    const configuredGroupId = configuredGroupByStore.get(storeId);
    const configuredGroup = configuredGroupId ? printGroupById.get(configuredGroupId) : undefined;
    if (configuredGroup && (!input.printGroupIds?.length || chosenPrintGroupIds.has(configuredGroup.id))) return configuredGroup;
    return input.printGroupIds?.length ? null : fallbackStoreGroup;
  };
  const requests = requestCandidates.filter(request => visibleStoreById.has(request.storeId) && effectiveStoreGroup(request.storeId) !== null);
  const requestIds = requests.map(request => request.id);
  const [lines, comments] = requestIds.length ? await Promise.all([
    db.select().from(operationalStoreRequestLines).where(inArray(operationalStoreRequestLines.requestId, requestIds)).orderBy(operationalStoreRequestLines.catalogNumber).limit(20_000),
    db.select().from(operationalStoreRequestComments).where(inArray(operationalStoreRequestComments.requestId, requestIds)).orderBy(operationalStoreRequestComments.slot).limit(4_000),
  ]) : [[], []] as const;
  const linesByRequest = new Map<number, typeof lines>();
  for (const line of lines) linesByRequest.set(line.requestId, [...(linesByRequest.get(line.requestId) ?? []), line]);
  const commentsByRequest = new Map<number, typeof comments>();
  for (const comment of comments) commentsByRequest.set(comment.requestId, [...(commentsByRequest.get(comment.requestId) ?? []), comment]);
  const categoryGroupById = new Map(categoryGroups.map(group => [group.id, group]));
  const categoryReferencesByGroup = new Map(categoryGroups.map(group => [group.id, expandPrintCategoryReferences(group.id, allCategoryGroups, members)]));
  const requestFactsByStoreProduct = new Map<string, { storeQuantity: number | null; weeklySold: number; dailySold: number | null; daysCover: number | null; maxStoreCoverDays: number; recommendedQuantity: number | null; baseUnit: CatalogUnit }>();
  await Promise.all(Array.from(new Set(requests.map(request => request.storeId))).map(async storeId => {
    const products = await listOperationalStoreRequestProducts({ storeId });
    for (const product of products) requestFactsByStoreProduct.set(`${storeId}:${product.id}`, {
      storeQuantity: product.storeQuantity,
      weeklySold: product.weeklySold,
      dailySold: product.dailySold,
      daysCover: product.daysCover,
      maxStoreCoverDays: product.maxStoreCoverDays,
      recommendedQuantity: product.recommendedQuantity,
      baseUnit: product.baseUnit,
    });
  }));
  const fallbackCategoryGroup = { id: "fallback-category-group", name: "Не распределено", printMode: "per_store" as const, maxStoreCoverDays: null, supplyPrintGroupId: null };
  const categoriesForLine = (line: typeof operationalStoreRequestLines.$inferSelect) => {
    if (line.manualPrintCategoryGroupId !== null) return [categoryGroupById.get(line.manualPrintCategoryGroupId) ?? fallbackCategoryGroup];
    const matchedGroups = categoryGroups.filter(group => {
      const allowed = categoryReferencesByGroup.get(group.id)!;
      return (line.catalogCategoryId !== null && allowed.categoryIds.has(line.catalogCategoryId))
        || (line.catalogCategoryId === null && line.categoryName !== null && allowed.categoryNames.has(line.categoryName));
    });
    // A nested print group contributes to its parent but is still an independent
    // configured sheet. For example, СРС В/У appears both in СРС and on its own
    // sheet when both groups are active; do not collapse the graph to first match.
    return matchedGroups.length ? matchedGroups : [fallbackCategoryGroup];
  };
  type PrintFact = { storeQuantity: number | null; weeklySold: number; dailySold: number | null; daysCover: number | null; maxStoreCoverDays: number; recommendedQuantity: number | null; baseUnit: CatalogUnit };
  type PrintLine = typeof operationalStoreRequestLines.$inferSelect & { requestNumber: number; stock: PrintFact | null };
  type PrintStore = { storeId: number; storeName: string; lines: PrintLine[]; comments: Array<{ id: number; slot: number; text: string; requestNumber: number }> };
  type PrintCategory = { id: number | string; name: string; printMode: "per_store" | "grouped_stores"; maxStoreCoverDays: number | null; supplyPrintGroupId: number | null };
  type PrintSheet = { id: string; businessDate: string; storeGroupName: string; categoryGroupName: string; printMode: "per_store" | "grouped_stores"; stockIndicator: { supplyGroupName: string | null; maxStoreCoverDays: number | null }; stores: PrintStore[] };
  const sheetsByKey = new Map<string, PrintSheet>();
  const ensureStore = (request: typeof operationalStoreRequests.$inferSelect, categoryGroup: PrintCategory) => {
    const store = visibleStoreById.get(request.storeId)!;
    const storeGroup = effectiveStoreGroup(request.storeId)!;
    const sheetId = categoryGroup.printMode === "grouped_stores"
      ? `${request.businessDate}:${storeGroup.id}:${categoryGroup.id}:grouped`
      : `${request.businessDate}:${storeGroup.id}:${categoryGroup.id}:${store.id}`;
    let sheet = sheetsByKey.get(sheetId);
    if (!sheet) {
      sheet = { id: sheetId, businessDate: request.businessDate, storeGroupName: storeGroup.name, categoryGroupName: categoryGroup.name, printMode: categoryGroup.printMode, stockIndicator: { supplyGroupName: categoryGroup.supplyPrintGroupId ? printGroupById.get(categoryGroup.supplyPrintGroupId)?.name ?? null : null, maxStoreCoverDays: categoryGroup.maxStoreCoverDays ?? null }, stores: [] };
      sheetsByKey.set(sheetId, sheet);
    }
    let printStore = sheet.stores.find(candidate => candidate.storeId === store.id);
    if (!printStore) {
      printStore = { storeId: store.id, storeName: store.name, lines: [], comments: [] };
      sheet.stores.push(printStore);
    }
    return printStore;
  };
  for (const request of requests) {
    for (const line of linesByRequest.get(request.id) ?? []) {
      if (Number(line.requestedQuantity) <= 0) continue;
      for (const categoryGroup of categoriesForLine(line)) {
        ensureStore(request, categoryGroup).lines.push({ ...line, requestNumber: request.requestNumber, stock: line.productId ? requestFactsByStoreProduct.get(`${request.storeId}:${line.productId}`) ?? null : null });
      }
    }
  }
  for (const request of requests) {
    for (const comment of commentsByRequest.get(request.id) ?? []) {
      if (!comment.text.trim().length) continue;
      const categoryGroup = categoryGroupById.get(comment.printCategoryGroupId);
      if (!categoryGroup) continue;
      const store = ensureStore(request, categoryGroup);
      if (store.lines.length) store.comments.push({ id: comment.id, slot: comment.slot, text: comment.text, requestNumber: request.requestNumber });
    }
  }
  const sheets = Array.from(sheetsByKey.values())
    .map(sheet => ({ ...sheet, stores: sheet.stores.filter(store => store.lines.length) }))
    .filter(sheet => sheet.stores.length)
    .sort((left, right) => left.businessDate.localeCompare(right.businessDate) || left.storeGroupName.localeCompare(right.storeGroupName, "ru") || left.categoryGroupName.localeCompare(right.categoryGroupName, "ru") || left.id.localeCompare(right.id));
  const printableLines = sheets.flatMap(sheet => sheet.stores.flatMap(store => store.lines));
  const printableRequestCount = new Set(printableLines.map(line => line.requestNumber)).size;
  return {
    from,
    to,
    zebraMode: printSettings.zebraMode,
    headingFontSize: printSettings.headingFontSize,
    bodyFontSize: printSettings.bodyFontSize,
    totalFontSize: printSettings.totalFontSize,
    headingBold: printSettings.headingBold,
    bodyBold: printSettings.bodyBold,
    totalBold: printSettings.totalBold,
    showStoreQuantity: printSettings.showStoreQuantity,
    showAverageDailySales: printSettings.showAverageDailySales,
    showSalesCover: printSettings.showSalesCover,
    showOverstockSignal: printSettings.showOverstockSignal,
    recommendationFontSize: printSettings.recommendationFontSize,
    recommendationTone: printSettings.recommendationTone,
    sheets,
    totalRequests: requests.length,
    totalLines: lines.length,
    printableRequestCount,
    printableLineCount: printableLines.length,
  };
}

/**
 * Imports exactly one cursor page on each call. The current-day refresh and the
 * 2025+ historical backfill keep independent cursors so fresh facts are not
 * blocked by a long archive chain. The operation retains no raw or fiscal payload
 * and never writes back to Evotor.
 */
export async function syncOperationalEvotorDocumentPage(input: { storeId: number; actorId: number | null; mode?: "historical" | "current_day" }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const syncMode = input.mode ?? "historical";
  const businessDate = moscowBusinessDate();
  const [activeSync] = await db
    .select()
    .from(operationalEvotorDocumentSyncs)
    .where(and(eq(operationalEvotorDocumentSyncs.storeId, input.storeId), eq(operationalEvotorDocumentSyncs.syncMode, syncMode), eq(operationalEvotorDocumentSyncs.status, "running")))
    .orderBy(desc(operationalEvotorDocumentSyncs.id))
    .limit(1);
  // A legacy cursor without a declared window could still be traversing older
  // records. Close that series without deleting its existing facts and start the
  // next first-page request at the approved 2025 retention boundary.
  if (syncMode === "historical" && activeSync && !activeSync.requestedFrom) {
    await db.update(operationalEvotorDocumentSyncs).set({
      status: "failed",
      completedAt: new Date(),
      failureMessage: "Серия перезапущена с границы хранения 2025-01-01.",
    }).where(eq(operationalEvotorDocumentSyncs.id, activeSync.id));
  }
  if (syncMode === "current_day" && activeSync && activeSync.requestedTo !== businessDate) {
    await db.update(operationalEvotorDocumentSyncs).set({
      status: "completed",
      completedAt: new Date(),
      failureMessage: "Текущий день сменился; следующий запуск начинает новое суточное окно.",
    }).where(eq(operationalEvotorDocumentSyncs.id, activeSync.id));
  }
  const canReuseActive = Boolean(activeSync?.requestedFrom && (syncMode !== "current_day" || activeSync.requestedTo === businessDate));
  const sync = canReuseActive
    ? activeSync
    : (await db.insert(operationalEvotorDocumentSyncs).values({
      storeId: input.storeId,
      syncMode,
      startedByAccountId: input.actorId,
      requestedFrom: syncMode === "current_day" ? businessDate : EVOTOR_DOCUMENT_RETENTION_START,
      requestedTo: businessDate,
    }).$returningId()).map(({ id }) => ({
      id,
      documentsRead: 0,
      positionsRead: 0,
      cursor: null,
      requestedFrom: syncMode === "current_day" ? businessDate : EVOTOR_DOCUMENT_RETENTION_START,
      requestedTo: businessDate,
    }))[0];
  const currentDaySince = syncMode === "current_day" && !sync.cursor
    ? await currentDayEvotorWindowStart(input.storeId, businessDate)
    : undefined;
  const page = await listEvotorDocumentsPreviewForOperationalStore({
    storeId: input.storeId,
    cursor: sync.cursor ?? undefined,
    since: sync.cursor ? undefined : currentDaySince ?? sync.requestedFrom ?? EVOTOR_DOCUMENT_RETENTION_START,
    until: sync.cursor ? undefined : syncMode === "current_day" ? new Date() : sync.requestedTo ?? moscowBusinessDate(),
  });
  let insertedDocuments = 0;
  let insertedPositions = 0;
  let hydratedPaymentDocuments = 0;
  let hydratedPositionDocuments = 0;
  let hydratedPositions = 0;
  const receiptStockDocumentIds = new Set<number>();
  // Keep advancing the opaque external cursor through legacy records without
  // persisting them, so the retained 2025+ analytical window is eventually reached.
  const uniqueDocuments = Array.from(new Map(page.documents
    .filter(isRetainedEvotorDocument)
    .map(document => [document.id, document])).values());
  const existingByExternalId = uniqueDocuments.length
    ? new Map((await db
      .select({ id: operationalEvotorDocuments.id, evotorDocumentId: operationalEvotorDocuments.evotorDocumentId, cashChangeAmount: operationalEvotorDocuments.cashChangeAmount, paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus })
      .from(operationalEvotorDocuments)
      .where(and(eq(operationalEvotorDocuments.storeId, input.storeId), inArray(operationalEvotorDocuments.evotorDocumentId, uniqueDocuments.map(document => document.id))))
    ).map(row => [row.evotorDocumentId, row]))
    : new Map<string, { id: number; evotorDocumentId: string; cashChangeAmount: string | null; paymentCaptureStatus: "unavailable" | "complete" | "unreconciled" | "malformed" }>();
  const newDocuments = uniqueDocuments.filter(document => !existingByExternalId.has(document.id));
  const existingDocumentIds = Array.from(existingByExternalId.values()).map(document => document.id);
  const existingPositionCounts = existingDocumentIds.length
    ? new Map((await db.select({
      documentId: operationalEvotorDocumentPositions.documentId,
      count: sql<number>`count(*)`,
    }).from(operationalEvotorDocumentPositions)
      .where(inArray(operationalEvotorDocumentPositions.documentId, existingDocumentIds))
      .groupBy(operationalEvotorDocumentPositions.documentId)).map(row => [row.documentId, Number(row.count)]))
    : new Map<number, number>();
  // Historical documents are intentionally read once. A current-day overlap can
  // only hydrate safe aggregates on facts it already revisits.
  const paymentHydrationDocuments = syncMode === "current_day"
    ? uniqueDocuments.filter(document => {
      const existing = existingByExternalId.get(document.id);
      // A normalizer upgrade may turn a prior unreconciled projection into a
      // complete payment fact even where old code stored zero change. Revisit
      // only current-day overlap; the archive remains a one-time sequence.
      return Boolean(existing && (existing.cashChangeAmount === null || existing.paymentCaptureStatus !== "complete") && document.paymentSummary.captureStatus !== "unavailable");
    })
    : [];
  // The terminal V1 webhook can arrive before the richer V2 receipt event and
  // contains no documented item lines. A bounded current-day revisit may add
  // the still-missing normalized positions once; it never replaces persisted
  // lines or changes the business document itself.
  const positionHydrationDocuments = syncMode === "current_day"
    ? uniqueDocuments.filter(document => {
      const existing = existingByExternalId.get(document.id);
      return Boolean(existing && document.positions.length && !existingPositionCounts.get(existing.id));
    })
    : [];

  // Each batch becomes one document insert and one position insert. On a retry,
  // the unique store/document key makes already persisted rows a safe no-op.
  // This is intentionally far below the platform callback timeout even for a
  // full cursor page; no raw response or fiscal payload is retained.
  for (let start = 0; start < newDocuments.length; start += 20) {
    const batch = newDocuments.slice(start, start + 20);
    const inserted = await db.insert(operationalEvotorDocuments).values(batch.map(document => ({
      storeId: input.storeId,
      syncId: sync.id,
      evotorDocumentId: document.id,
      receiptNumber: document.receiptNumber,
      documentType: document.type,
      sourceCreatedAt: document.createdAt,
      occurredAt: document.closedAt ?? document.createdAt,
      total: document.total === null ? null : document.total.toFixed(2),
      discountAmount: document.discountAmount === null ? null : document.discountAmount.toFixed(2),
      ...storedPaymentSummary(document.paymentSummary),
    }))).$returningId();
    const insertedIdByExternalId = new Map(batch.map((document, index) => [document.id, inserted[index]?.id]).filter((entry): entry is [string, number] => Number.isFinite(entry[1])));
    const positions = batch.flatMap(document => {
      const documentId = insertedIdByExternalId.get(document.id);
      if (!documentId) return [];
      return document.positions.filter(position => position.productId || position.productName).map(position => ({
        documentId,
        evotorProductId: position.productId,
        productName: position.productName,
        quantity: position.quantity === null ? null : position.quantity.toFixed(3),
        initialQuantity: position.initialQuantity === null ? null : position.initialQuantity.toFixed(3),
        unit: position.unit,
        settlementMethod: position.settlementMethod,
        resultSum: position.resultSum === null ? null : position.resultSum.toFixed(2),
      }));
    });
    if (positions.length) await db.insert(operationalEvotorDocumentPositions).values(positions);
    for (const documentId of Array.from(insertedIdByExternalId.values())) receiptStockDocumentIds.add(documentId);
    insertedDocuments += batch.length;
    insertedPositions += positions.length;
  }
  await forEachBoundedBatch(paymentHydrationDocuments, 20, async document => {
    const existing = existingByExternalId.get(document.id);
    if (!existing) return;
    await db.update(operationalEvotorDocuments).set(storedPaymentSummary(document.paymentSummary)).where(eq(operationalEvotorDocuments.id, existing.id));
    hydratedPaymentDocuments += 1;
  });
  await forEachBoundedBatch(positionHydrationDocuments, 20, async document => {
    const existing = existingByExternalId.get(document.id);
    if (!existing) return;
    const positions = document.positions.filter(position => position.productId || position.productName).map(position => ({
      documentId: existing.id,
      evotorProductId: position.productId,
      productName: position.productName,
      quantity: position.quantity === null ? null : position.quantity.toFixed(3),
      initialQuantity: position.initialQuantity === null ? null : position.initialQuantity.toFixed(3),
      unit: position.unit,
      settlementMethod: position.settlementMethod,
      resultSum: position.resultSum === null ? null : position.resultSum.toFixed(2),
    }));
    if (!positions.length) return;
    await db.insert(operationalEvotorDocumentPositions).values(positions);
    receiptStockDocumentIds.add(existing.id);
    hydratedPositionDocuments += 1;
    hydratedPositions += positions.length;
  });
  // A sale, cancellation and return are separate Evotor documents. The live
  // flow inserts a previously unseen external document ID only; it never
  // rewrites an existing business event or its saved positions. Current-day
  // overlap can only fill previously absent normalized payment or line facts.
  // Both modes retain the opaque cursor until the window is exhausted. Current
  // day starts only a bounded two-hour overlap, but a high-volume point must
  // still receive every page in that bounded window before a new minute opens
  // the next overlap. The archive remains a separate one-time chain.
  const materializedStockMovements = await materializeEvotorReceiptStockMovements({
    storeId: input.storeId,
    documentIds: Array.from(receiptStockDocumentIds),
  });
  const completed = !page.nextCursor;
  await db.update(operationalEvotorDocumentSyncs).set({
    cursor: page.nextCursor,
    documentsRead: Number(sync.documentsRead) + page.documents.length,
    positionsRead: Number(sync.positionsRead) + page.documents.reduce((total, document) => total + document.positions.length, 0),
    status: completed ? "completed" : "running",
    completedAt: completed ? new Date() : null,
    failureMessage: null,
  }).where(eq(operationalEvotorDocumentSyncs.id, sync.id));
  return { syncId: sync.id, storeId: input.storeId, readDocuments: page.documents.length, readPositions: page.documents.reduce((total, document) => total + document.positions.length, 0), insertedDocuments, insertedPositions, hydratedPaymentDocuments, hydratedPositionDocuments, hydratedPositions, materializedStockMovements, completed, rateLimit: page.rateLimit };
}

type EvotorWebhookRecord = Record<string, unknown>;
const webhookRecord = (value: unknown): EvotorWebhookRecord | null => value && typeof value === "object" && !Array.isArray(value) ? value as EvotorWebhookRecord : null;
const webhookText = (value: unknown, limit = 512) => typeof value === "string" && value.trim().length ? value.trim().slice(0, limit) : null;
const webhookNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const webhookTimestamp = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const text = webhookText(value, 128);
  if (!text) return null;
  const milliseconds = Date.parse(text);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
};

function webhookPaymentSummary(source: string | null, total: number | null): EvotorDocumentPreview["paymentSummary"] {
  const normalized = source?.toUpperCase() ?? "";
  const empty = { cashAmount: null, cashTenderedAmount: null, cashChangeAmount: null, cashlessAmount: null, otherPaymentAmount: null, unknownPaymentAmount: null, reconciliationDelta: null };
  if (total === null) return { ...empty, captureStatus: "unavailable" };
  if (normalized === "PAY_CASH" || normalized === "CASH") return { ...empty, cashAmount: total, cashTenderedAmount: total, cashChangeAmount: 0, captureStatus: "complete" };
  if (normalized === "PAY_CARD" || normalized === "PAY_ELECTRON" || normalized === "ELECTRON") return { ...empty, cashlessAmount: total, captureStatus: "complete" };
  return { ...empty, captureStatus: "unavailable" };
}

/**
 * Persists one V2 "Отправить чек" webhook after authorization. Unknown fields are
 * ignored, raw payloads/requisites are never stored, and the unique store/document
 * key makes repeated cloud deliveries a durable no-op. The scheduled V2 reader
 * remains the independent reconciliation fallback.
 */
export async function ingestOperationalEvotorWebhookReceipt(input: { payload: unknown }) {
  const envelope = webhookRecord(input.payload);
  const data = webhookRecord(envelope?.data);
  const externalStoreId = webhookText(data?.storeId ?? data?.storeUuid ?? envelope?.storeId, 128);
  const documentId = webhookText(data?.id ?? envelope?.id, 128);
  const documentType = webhookText(data?.type, 64);
  if (!envelope || !data || !externalStoreId || !documentId || !documentType) throw new Error("Webhook чека Эвотор не содержит обязательные идентификаторы.");
  const occurredAt = webhookTimestamp(data.dateTime ?? data.closeDate ?? envelope.timestamp);
  if (!occurredAt || occurredAt.slice(0, 10) < EVOTOR_DOCUMENT_RETENTION_START) return { accepted: false, duplicate: false, reason: "out-of-retention" as const };
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [mapping] = await db.select({ storeId: operationalStoreMappings.storeId })
    .from(operationalStoreMappings).where(eq(operationalStoreMappings.evotorTerminalUuid, externalStoreId)).limit(1);
  // A valid application may emit an event from a point that has not been mapped
  // yet. Acknowledge it without persisting an untraceable business fact.
  if (!mapping) return { accepted: false, duplicate: false, reason: "unmapped-store" as const };
  const [existing] = await db.select({ id: operationalEvotorDocuments.id })
    .from(operationalEvotorDocuments).where(and(eq(operationalEvotorDocuments.storeId, mapping.storeId), eq(operationalEvotorDocuments.evotorDocumentId, documentId))).limit(1);
  const evaluateCurrentDaySignals = async () => {
    try {
      await evaluateCurrentDayEvotorReturnSignals();
    } catch {
      // Durable receipt intake succeeds first. The next current-day lane retries
      // the same idempotent return/plan milestone without exposing receipt data.
      console.warn("[evotor-current-day-signal] notification deferred");
    }
  };
  if (existing) {
    await materializeEvotorReceiptStockMovements({ storeId: mapping.storeId, documentIds: [existing.id] });
    await evaluateCurrentDaySignals();
    return { accepted: true, duplicate: true, documentId: existing.id };
  }
  const total = webhookNumber(data.totalAmount ?? data.total ?? data.resultSum);
  const discountAmount = webhookNumber(data.totalDiscount ?? data.discount);
  const paymentSummary = webhookPaymentSummary(webhookText(data.paymentSource, 64), total);
  const positions = Array.isArray(data.items) ? data.items.flatMap(item => {
    const line = webhookRecord(item);
    if (!line) return [];
    const productId = webhookText(line.id ?? line.productId, 128);
    const productName = webhookText(line.name ?? line.productName, 512);
    return productId || productName ? [{
      productId, productName, quantity: webhookNumber(line.quantity), initialQuantity: null,
      unit: webhookText(line.measureName ?? line.unit, 64), settlementMethod: null,
      resultSum: webhookNumber(line.sumPrice ?? line.resultSum),
    }] : [];
  }) : [];
  const businessDate = occurredAt.slice(0, 10);
  const [sync] = await db.insert(operationalEvotorDocumentSyncs).values({
    storeId: mapping.storeId, syncMode: "current_day", status: "completed", requestedFrom: businessDate, requestedTo: businessDate,
    documentsRead: 1, positionsRead: positions.length, completedAt: new Date(), failureMessage: null,
  }).$returningId();
  try {
    const [inserted] = await db.insert(operationalEvotorDocuments).values({
      storeId: mapping.storeId, syncId: sync.id, evotorDocumentId: documentId,
      receiptNumber: webhookText(data.number ?? data.receiptNumber, 64), documentType,
      sourceCreatedAt: occurredAt, occurredAt, total: storedMoney(total), discountAmount: storedMoney(discountAmount),
      ...storedPaymentSummary(paymentSummary),
    }).$returningId();
    if (positions.length) await db.insert(operationalEvotorDocumentPositions).values(positions.map(position => ({
      documentId: inserted.id, evotorProductId: position.productId, productName: position.productName,
      quantity: position.quantity === null ? null : position.quantity.toFixed(3), initialQuantity: null,
      unit: position.unit, settlementMethod: null, resultSum: storedMoney(position.resultSum),
    })));
    await materializeEvotorReceiptStockMovements({ storeId: mapping.storeId, documentIds: [inserted.id] });
    await evaluateCurrentDaySignals();
    return { accepted: true, duplicate: false, documentId: inserted.id, positionCount: positions.length };
  } catch (error) {
    // Concurrent duplicate delivery may race between the preflight and insert.
    const [raceExisting] = await db.select({ id: operationalEvotorDocuments.id }).from(operationalEvotorDocuments)
      .where(and(eq(operationalEvotorDocuments.storeId, mapping.storeId), eq(operationalEvotorDocuments.evotorDocumentId, documentId))).limit(1);
    if (raceExisting) {
      await evaluateCurrentDaySignals();
      return { accepted: true, duplicate: true, documentId: raceExisting.id };
    }
    throw error;
  }
}

/**
 * Persists the documented V1 "Передать документы" terminal callback. Cloud
 * supplies an array and the store UUID is part of the route. The V1 contract
 * contains document-level facts but no documented item lines, so receipt V2
 * remains the independent enrichment/reconciliation source for positions.
 */
export async function ingestOperationalEvotorTerminalDocuments(input: { externalStoreId: string; payload: unknown }) {
  if (!Array.isArray(input.payload) || input.payload.length > 200) {
    throw new Error("Webhook документов терминала Эвотор должен содержать до 200 документов.");
  }
  const externalStoreId = webhookText(input.externalStoreId, 128);
  if (!externalStoreId) throw new Error("Webhook документов терминала Эвотор не содержит идентификатор магазина.");
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  // `evotorTerminalUuid` is the established field name, but mapping setup
  // stores the selected Cloud store UUID in this field.
  const [mapping] = await db.select({ storeId: operationalStoreMappings.storeId })
    .from(operationalStoreMappings)
    .where(eq(operationalStoreMappings.evotorTerminalUuid, externalStoreId)).limit(1);
  if (!mapping) return { accepted: false, receivedDocuments: input.payload.length, insertedDocuments: 0, duplicateDocuments: 0, skippedDocuments: input.payload.length, reason: "unmapped-store" as const };

  const normalized = input.payload.flatMap(value => {
    const document = webhookRecord(value);
    const id = webhookText(document?.uuid ?? document?.id, 128);
    const type = webhookText(document?.type, 64);
    const occurredAt = webhookTimestamp(document?.closeDate ?? document?.dateTime ?? document?.openDate);
    if (!id || !type || !occurredAt || occurredAt.slice(0, 10) < EVOTOR_DOCUMENT_RETENTION_START) return [];
    return [{
      id,
      type,
      receiptNumber: webhookText(document?.number ?? document?.receiptNumber, 64),
      occurredAt,
      sourceCreatedAt: webhookTimestamp(document?.openDate) ?? occurredAt,
      total: webhookNumber(document?.closeResultSum ?? document?.closeSum ?? document?.total),
    }];
  });
  const uniqueDocuments = Array.from(new Map(normalized.map(document => [document.id, document])).values());
  if (!uniqueDocuments.length) return { accepted: true, receivedDocuments: input.payload.length, insertedDocuments: 0, duplicateDocuments: 0, skippedDocuments: input.payload.length };
  const existing = new Set((await db.select({ id: operationalEvotorDocuments.evotorDocumentId })
    .from(operationalEvotorDocuments)
    .where(and(eq(operationalEvotorDocuments.storeId, mapping.storeId), inArray(operationalEvotorDocuments.evotorDocumentId, uniqueDocuments.map(document => document.id)))))
    .map(document => document.id));
  const newDocuments = uniqueDocuments.filter(document => !existing.has(document.id));
  if (!newDocuments.length) return { accepted: true, receivedDocuments: input.payload.length, insertedDocuments: 0, duplicateDocuments: uniqueDocuments.length, skippedDocuments: input.payload.length - uniqueDocuments.length };
  const businessDate = newDocuments[0]!.occurredAt.slice(0, 10);
  const [sync] = await db.insert(operationalEvotorDocumentSyncs).values({
    storeId: mapping.storeId,
    syncMode: "current_day",
    status: "completed",
    requestedFrom: businessDate,
    requestedTo: businessDate,
    documentsRead: newDocuments.length,
    positionsRead: 0,
    completedAt: new Date(),
    failureMessage: null,
  }).$returningId();
  try {
    for (let start = 0; start < newDocuments.length; start += 20) {
      const batch = newDocuments.slice(start, start + 20);
      await db.insert(operationalEvotorDocuments).values(batch.map(document => ({
        storeId: mapping.storeId,
        syncId: sync.id,
        evotorDocumentId: document.id,
        receiptNumber: document.receiptNumber,
        documentType: document.type,
        sourceCreatedAt: document.sourceCreatedAt,
        occurredAt: document.occurredAt,
        total: storedMoney(document.total),
        discountAmount: null,
        ...storedPaymentSummary(webhookPaymentSummary(null, null)),
      })));
    }
    // V1 terminal documents may arrive before the V2 reconciliation pass. The
    // same idempotent evaluator makes an already crossed monthly plan visible
    // without waiting for the next minute; it never changes the receipt itself.
    try {
      await evaluateCurrentDayEvotorReturnSignals();
    } catch {
      console.warn("[evotor-current-day-signal] notification deferred");
    }
    return {
      accepted: true,
      receivedDocuments: input.payload.length,
      insertedDocuments: newDocuments.length,
      duplicateDocuments: existing.size,
      skippedDocuments: input.payload.length - uniqueDocuments.length,
    };
  } catch (error) {
    // Retry deliveries can race on the durable store/document uniqueness key.
    const allPresent = (await db.select({ id: operationalEvotorDocuments.evotorDocumentId })
      .from(operationalEvotorDocuments)
      .where(and(eq(operationalEvotorDocuments.storeId, mapping.storeId), inArray(operationalEvotorDocuments.evotorDocumentId, newDocuments.map(document => document.id)))))
      .length === newDocuments.length;
    if (allPresent) {
      try {
        await evaluateCurrentDayEvotorReturnSignals();
      } catch {
        console.warn("[evotor-current-day-signal] notification deferred");
      }
      return { accepted: true, receivedDocuments: input.payload.length, insertedDocuments: 0, duplicateDocuments: uniqueDocuments.length, skippedDocuments: input.payload.length - uniqueDocuments.length };
    }
    throw error;
  }
}

async function forEachBoundedBatch<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

/**
 * Re-reads only previously retained, unresolved SELL documents by their fixed
 * Cloud V2 IDs. It never walks the archive, writes to Evotor, alters positions
 * or changes a sale fact; only safe payment aggregates may be refreshed.
 */
export async function reconcileOperationalEvotorPaymentFacts(input: { limit?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const candidates = await db
    .select({
      id: operationalEvotorDocuments.id,
      storeId: operationalEvotorDocuments.storeId,
      evotorDocumentId: operationalEvotorDocuments.evotorDocumentId,
    })
    .from(operationalEvotorDocuments)
    .where(and(
      eq(operationalEvotorDocuments.documentType, "SELL"),
      eq(operationalEvotorDocuments.paymentCaptureStatus, "unreconciled"),
    ))
    .orderBy(desc(operationalEvotorDocuments.occurredAt))
    .limit(limit);
  let readCount = 0;
  let updatedCount = 0;
  let reconciledCount = 0;
  let unresolvedCount = 0;
  let failedCount = 0;
  // Three serially bounded requests keep this repair well inside the V2
  // request budget while avoiding a wide archive traversal.
  await forEachBoundedBatch(candidates, 3, async candidate => {
    try {
      const document = await getEvotorDocumentPreviewForOperationalStore({ storeId: candidate.storeId, documentId: candidate.evotorDocumentId });
      readCount += 1;
      if (document.type !== "SELL" || document.paymentSummary.captureStatus === "unavailable") {
        unresolvedCount += 1;
        return;
      }
      await db.update(operationalEvotorDocuments)
        .set(storedPaymentSummary(document.paymentSummary))
        .where(eq(operationalEvotorDocuments.id, candidate.id));
      updatedCount += 1;
      if (document.paymentSummary.captureStatus === "complete") reconciledCount += 1;
      else unresolvedCount += 1;
    } catch {
      // Preserve the old explicitly unresolved fact and expose only a count;
      // credentials, URL fragments and external response bodies never reach UI.
      failedCount += 1;
    }
  });
  return { candidateCount: candidates.length, readCount, updatedCount, reconciledCount, unresolvedCount, failedCount };
}

export type EvotorSalesGranularity = "month" | "week" | "day" | "hour";

type EvotorSalesInterval = {
  key: string;
  label: string;
};

/** Builds Moscow-calendar labels only from the already normalized, read-only check timestamp. */
function evotorSalesInterval(value: string, granularity: EvotorSalesGranularity): EvotorSalesInterval | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Map(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map(part => [part.type, part.value]));
  const year = Number(parts.get("year"));
  const month = Number(parts.get("month"));
  const day = Number(parts.get("day"));
  const hour = Number(parts.get("hour"));
  if (![year, month, day, hour].every(Number.isFinite)) return null;
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateLabel = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
  if (granularity === "hour") return { key: String(hour).padStart(2, "0"), label: `${String(hour).padStart(2, "0")}:00 МСК` };
  if (granularity === "day") return { key: dateKey, label: dateLabel };
  if (granularity === "month") return { key: dateKey.slice(0, 7), label: new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(date) };
  // The Rhythm screen uses ISO week identity. Reuse the same key/label so a
  // receipt fact is overlaid on the exact same week rather than a parallel row.
  const weekDate = new Date(Date.UTC(year, month - 1, day));
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - (weekDate.getUTCDay() || 7));
  const weekYear = weekDate.getUTCFullYear();
  const weekStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil((((weekDate.getTime() - weekStart) / 86_400_000) + 1) / 7);
  return { key: `${weekYear}-${String(week).padStart(2, "0")}`, label: `Нед. ${week} · ${weekYear}` };
}

/** Converts a Moscow calendar boundary to the canonical `+0000` receipt string. */
function evotorMoscowBoundary(date: string, edge: "start" | "end") {
  const localTime = edge === "start" ? "00:00:00.000" : "23:59:59.999";
  return new Date(`${date}T${localTime}+03:00`).toISOString().replace("Z", "+0000");
}

export const __evotorSalesTestUtils = { evotorSalesInterval, evotorMoscowBoundary };

type EvotorSyncTerminalState = "pending" | "running" | "completed" | "failed";
/** Four sequential minute lanes keep live receipts independent of archive backfill without platform queue bursts. */
const OPERATIONAL_EVOTOR_CURRENT_DAY_WORKERS = 4;
const OPERATIONAL_EVOTOR_CURRENT_DAY_SLA_MINUTES = 2;
type EvotorSyncCycleRow = {
  storeId: number;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date | null;
};

/**
 * Collapses append-only cursor attempts into a non-sensitive cycle status.  The
 * latest attempt per store is the source of truth; prior failed attempts remain
 * in the audit trail but do not turn a later successful retry into an error.
 */
function summarizeOperationalEvotorSyncCycle(storeIds: number[], syncs: EvotorSyncCycleRow[]) {
  const latestByStore = new Map<number, EvotorSyncCycleRow>();
  for (const sync of [...syncs].sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())) {
    if (!latestByStore.has(sync.storeId)) latestByStore.set(sync.storeId, sync);
  }
  const states = Array.from(latestByStore.values()).map(sync => sync.status);
  const startedStores = latestByStore.size;
  const completedStores = states.filter(status => status === "completed").length;
  const runningStores = states.filter(status => status === "running").length;
  const failedStores = states.filter(status => status === "failed").length;
  const allTerminal = startedStores === storeIds.length && runningStores === 0;
  const terminalState: EvotorSyncTerminalState = !startedStores
    ? "pending"
    : allTerminal
      ? failedStores ? "failed" : "completed"
      : "running";
  // Current-day rows recur all day. Measure the active pass from the latest row
  // of every store, not from the initial morning row, otherwise the displayed
  // SLA would falsely grow for every successful refresh.
  const firstStartedAt = latestByStore.size
    ? new Date(Math.min(...Array.from(latestByStore.values()).map(sync => sync.startedAt.getTime())))
    : null;
  const lastTerminalAt = Array.from(latestByStore.values())
    .filter(sync => sync.status !== "running" && sync.completedAt)
    .reduce<Date | null>((latest, sync) => !latest || sync.completedAt!.getTime() > latest.getTime() ? sync.completedAt! : latest, null);
  const terminalDurationMinutes = terminalState === "completed" || terminalState === "failed"
    ? firstStartedAt && lastTerminalAt ? Math.max(0, Math.ceil((lastTerminalAt.getTime() - firstStartedAt.getTime()) / 60_000)) : 0
    : null;
  return { startedStores, completedStores, runningStores, failedStores, terminalState, firstStartedAt, lastTerminalAt, terminalDurationMinutes };
}

export const __operationalEvotorSyncTestUtils = { summarizeOperationalEvotorSyncCycle, currentDayEvotorWindowStartFromWatermarks };

/** Marks the in-flight page terminally failed so the scheduler status cannot mistake it for a running page. */
export async function failOperationalEvotorDocumentSync(input: { storeId: number; mode: "historical" | "current_day"; failureMessage: string }) {
  const db = await getDb();
  if (!db) return null;
  const [active] = await db
    .select({ id: operationalEvotorDocumentSyncs.id })
    .from(operationalEvotorDocumentSyncs)
    .where(and(
      eq(operationalEvotorDocumentSyncs.storeId, input.storeId),
      eq(operationalEvotorDocumentSyncs.syncMode, input.mode),
      eq(operationalEvotorDocumentSyncs.status, "running"),
    ))
    .orderBy(desc(operationalEvotorDocumentSyncs.id))
    .limit(1);
  if (!active) return null;
  await db.update(operationalEvotorDocumentSyncs).set({
    status: "failed",
    completedAt: new Date(),
    failureMessage: input.failureMessage.slice(0, 512),
  }).where(eq(operationalEvotorDocumentSyncs.id, active.id));
  return active.id;
}

/**
 * Compact, non-sensitive status of the rolling receipt import. It intentionally
 * exposes no store identifier, document, cursor, payment or credential data.
 */
export async function getOperationalEvotorSyncStatus() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const businessDate = moscowBusinessDate();
  const mappedRows = await db
    .select({ storeId: stores.id })
    .from(stores)
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(stores.isHidden, false));
  const storeIds = Array.from(new Set(mappedRows.map(row => row.storeId)));
  const scheduledJobs = await db
    .select({ kind: operationalScheduledSyncJobs.kind, isActive: operationalScheduledSyncJobs.isActive, lastCompletedAt: operationalScheduledSyncJobs.lastCompletedAt, hasError: operationalScheduledSyncJobs.lastError })
    .from(operationalScheduledSyncJobs);
  const documentJobs = scheduledJobs.filter(job => job.kind === "evotor_documents" || job.kind.startsWith("evotor_documents_current_"));
  const activeCurrentDayWorkers = scheduledJobs.filter(job => job.kind.startsWith("evotor_documents_current_") && job.isActive).length;
  const documentJob = {
    active: documentJobs.some(job => Boolean(job.isActive)),
    lastCompletedAt: documentJobs.reduce<Date | null>((latest, job) => !latest || (job.lastCompletedAt && job.lastCompletedAt > latest) ? job.lastCompletedAt : latest, null),
    hasError: documentJobs.some(job => Boolean(job.hasError)),
  };
  if (!storeIds.length) {
    return {
      businessDate,
      mappedStores: 0,
      currentDay: { startedStores: 0, completedStores: 0, runningStores: 0, failedStores: 0, terminalState: "pending" as const, firstStartedAt: null, lastTerminalAt: null, terminalDurationMinutes: null, firstPassSlaMinutes: 0, refreshSlaMinutes: 0, activeWorkers: activeCurrentDayWorkers, workerCapacity: OPERATIONAL_EVOTOR_CURRENT_DAY_WORKERS, uncoveredStores: 0, overlapMinutes: EVOTOR_CURRENT_DAY_OVERLAP_MINUTES, documentsWithSourceTimestamp: 0, currentDayDocuments: 0, failureMessages: [] as string[] },
      archive: { startedStores: 0, completedStores: 0, runningStores: 0, failedStores: 0, terminalState: "pending" as const, firstStartedAt: null, lastTerminalAt: null, terminalDurationMinutes: null, pageSlaMinutes: 1 },
      documentJob,
      retentionStart: EVOTOR_DOCUMENT_RETENTION_START,
    };
  }
  const [syncs, sourceTimestampRows] = await Promise.all([
    db
    .select({ storeId: operationalEvotorDocumentSyncs.storeId, syncMode: operationalEvotorDocumentSyncs.syncMode, status: operationalEvotorDocumentSyncs.status, startedAt: operationalEvotorDocumentSyncs.startedAt, completedAt: operationalEvotorDocumentSyncs.completedAt, requestedTo: operationalEvotorDocumentSyncs.requestedTo, failureMessage: operationalEvotorDocumentSyncs.failureMessage })
    .from(operationalEvotorDocumentSyncs)
    .where(inArray(operationalEvotorDocumentSyncs.storeId, storeIds))
    .orderBy(desc(operationalEvotorDocumentSyncs.startedAt))
    .limit(5_000),
    db.select({
      currentDayDocuments: sql<number>`count(*)`,
      documentsWithSourceTimestamp: sql<number>`sum(case when ${operationalEvotorDocuments.sourceCreatedAt} is not null then 1 else 0 end)`,
    }).from(operationalEvotorDocuments).where(and(
      inArray(operationalEvotorDocuments.storeId, storeIds),
      isNotNull(operationalEvotorDocuments.occurredAt),
      gte(operationalEvotorDocuments.occurredAt, `${businessDate}T00:00:00`),
    )),
  ]);
  const sourceTimestampCoverage = sourceTimestampRows[0] ?? { currentDayDocuments: 0, documentsWithSourceTimestamp: 0 };
  const currentDayRows = syncs.filter(sync => sync.syncMode === "current_day" && sync.requestedTo === businessDate);
  const currentDay = summarizeOperationalEvotorSyncCycle(storeIds, currentDayRows);
  // Append-only attempts retain old failures for audit, but the live status must
  // show only the newest state of every store. A later successful retry clears
  // the previous error from the operational screen without deleting its trail.
  const latestCurrentDayByStore = new Map<number, typeof currentDayRows[number]>();
  for (const sync of [...currentDayRows].sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())) {
    if (!latestCurrentDayByStore.has(sync.storeId)) latestCurrentDayByStore.set(sync.storeId, sync);
  }
  const currentDayFailureMessages = Array.from(new Set(Array.from(latestCurrentDayByStore.values())
    .filter(sync => sync.status === "failed" && Boolean(sync.failureMessage?.trim()))
    .map(sync => String(sync.failureMessage).replace(/(?:bearer|basic)\s+[^\s]+/gi, "[скрыто]").trim())
  )).slice(0, 3);
  const archive = summarizeOperationalEvotorSyncCycle(storeIds, syncs
    .filter(sync => sync.syncMode === "historical"));
  return {
    businessDate,
    mappedStores: storeIds.length,
    // Four deterministic lanes cover every visible mapping. Archive backfill has
    // a separate worker, so current-day receipts do not wait for old pages.
    currentDay: {
      ...currentDay,
      firstPassSlaMinutes: OPERATIONAL_EVOTOR_CURRENT_DAY_SLA_MINUTES,
      refreshSlaMinutes: OPERATIONAL_EVOTOR_CURRENT_DAY_SLA_MINUTES,
      activeWorkers: activeCurrentDayWorkers,
      workerCapacity: OPERATIONAL_EVOTOR_CURRENT_DAY_WORKERS,
      overlapMinutes: EVOTOR_CURRENT_DAY_OVERLAP_MINUTES,
      currentDayDocuments: Number(sourceTimestampCoverage.currentDayDocuments ?? 0),
      failureMessages: currentDayFailureMessages,
      documentsWithSourceTimestamp: Number(sourceTimestampCoverage.documentsWithSourceTimestamp ?? 0),
      // A shard receives every Nth point, therefore no mapped store is silently
      // excluded when the network grows beyond the four execution lanes.
      uncoveredStores: 0,
    },
    archive: { ...archive, pageSlaMinutes: 1 },
    documentJob,
    retentionStart: EVOTOR_DOCUMENT_RETENTION_START,
  };
}

/**
 * Read-only sales view over normalized Evotor receipts and positions. This does
 * not query Evotor, does not retain a new payload, and deliberately omits fiscal,
 * payment, terminal and credential fields.
 */
export async function listOperationalEvotorSalesAnalytics(input: {
  from: string;
  to: string;
  granularity: EvotorSalesGranularity;
  storeIds?: number[];
  /** Home and Forecast require only receipt aggregates; do not load every product line. */
  includeProducts?: boolean;
}) {
  const startedAt = performance.now();
  const performanceSnapshot = (documentCount: number, productLineCount: number) => ({
    serviceMs: Math.max(0, Math.round(performance.now() - startedAt)),
    documentCount,
    productLineCount,
    productsIncluded: input.includeProducts !== false,
  });
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const from = input.from < EVOTOR_DOCUMENT_RETENTION_START ? EVOTOR_DOCUMENT_RETENTION_START : input.from;
  if (input.to < EVOTOR_DOCUMENT_RETENTION_START) {
    return { stores: [], timeline: [], products: [], productTimeline: [], summary: { checks: 0, amount: 0, cashAmount: 0, cashlessAmount: 0, returns: 0, returnAmount: 0, quantitiesByUnit: [], paymentCapture: { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 } }, coverage: { from: null, to: null } };
  }
  const allVisibleStores = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(eq(stores.isHidden, false))
    .orderBy(stores.name);
  const requestedStoreIds = input.storeIds?.length ? new Set(input.storeIds) : null;
  const scopedStores = requestedStoreIds ? allVisibleStores.filter(store => requestedStoreIds.has(store.id)) : allVisibleStores;
  if (!scopedStores.length) return { stores: [], timeline: [], products: [], productTimeline: [], summary: { checks: 0, amount: 0, cashAmount: 0, cashlessAmount: 0, returns: 0, returnAmount: 0, quantitiesByUnit: [], paymentCapture: { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 } }, coverage: { from: null, to: null }, performance: performanceSnapshot(0, 0) };
  const storeIds = scopedStores.map(store => store.id);
  const storeNameById = new Map(scopedStores.map(store => [store.id, store.name]));
  const fromAt = evotorMoscowBoundary(from, "start");
  const toAt = evotorMoscowBoundary(input.to, "end");
  const returnDocumentFilter = and(
    inArray(operationalEvotorDocuments.storeId, storeIds),
    // Cloud V2 names a fiscal refund PAYBACK. Keep legacy RETURN aliases as
    // well, but never merge this separate business event into SELL revenue.
    inArray(operationalEvotorDocuments.documentType, ["PAYBACK", "RETURN", "SELL_RETURN"]),
    isNotNull(operationalEvotorDocuments.occurredAt),
    gte(operationalEvotorDocuments.occurredAt, fromAt),
    lte(operationalEvotorDocuments.occurredAt, toAt),
  );
  const [firstDocument, lastDocument, returnSummaryRows] = await Promise.all([
    db.select({ occurredAt: operationalEvotorDocuments.occurredAt }).from(operationalEvotorDocuments).where(and(inArray(operationalEvotorDocuments.storeId, storeIds), isNotNull(operationalEvotorDocuments.occurredAt), gte(operationalEvotorDocuments.occurredAt, `${EVOTOR_DOCUMENT_RETENTION_START}T00:00:00`))).orderBy(operationalEvotorDocuments.occurredAt).limit(1),
    db.select({ occurredAt: operationalEvotorDocuments.occurredAt }).from(operationalEvotorDocuments).where(and(inArray(operationalEvotorDocuments.storeId, storeIds), isNotNull(operationalEvotorDocuments.occurredAt), gte(operationalEvotorDocuments.occurredAt, `${EVOTOR_DOCUMENT_RETENTION_START}T00:00:00`))).orderBy(desc(operationalEvotorDocuments.occurredAt)).limit(1),
    // Source totals may be signed differently by return document type. The summary
    // shows the positive reversal magnitude, while sales remain SELL-only below.
    db.select({ returns: sql<number>`COUNT(*)`, returnAmount: sql<string>`COALESCE(SUM(ABS(${operationalEvotorDocuments.total})), 0)` }).from(operationalEvotorDocuments).where(returnDocumentFilter),
  ]);
  const coverage = {
    from: firstDocument[0]?.occurredAt?.slice(0, 10) ?? null,
    to: lastDocument[0]?.occurredAt?.slice(0, 10) ?? null,
  };
  const returns = Number(returnSummaryRows[0]?.returns ?? 0);
  const returnAmount = Math.round(Number(returnSummaryRows[0]?.returnAmount ?? 0) * 100) / 100;
  const documentFilter = and(
    inArray(operationalEvotorDocuments.storeId, storeIds),
    eq(operationalEvotorDocuments.documentType, "SELL"),
    isNotNull(operationalEvotorDocuments.occurredAt),
    gte(operationalEvotorDocuments.occurredAt, fromAt),
    lte(operationalEvotorDocuments.occurredAt, toAt),
  );

  /** The hourly Rhythm is a Moscow time-of-day profile for the selected range. Group
   * inside the database rather than serializing every document into Node. */
  if (input.includeProducts === false && input.granularity === "hour") {
    // Existing receipt timestamps are canonical +0000 strings; Moscow stays UTC+3
    // for the supported 2025+ history, which matches the calendar boundary above.
    const moscowHour = sql<string>`DATE_FORMAT(DATE_ADD(STR_TO_DATE(\`occurredAt\`, '%Y-%m-%dT%H:%i:%s.%f+0000'), INTERVAL 3 HOUR), '%H')`;
    const moscowHourLabel = sql<string>`CONCAT(DATE_FORMAT(DATE_ADD(STR_TO_DATE(\`occurredAt\`, '%Y-%m-%dT%H:%i:%s.%f+0000'), INTERVAL 3 HOUR), '%H'), ':00 МСК')`;
    const hourlyRows = await db
      .select({
        storeId: operationalEvotorDocuments.storeId,
        key: moscowHour,
        label: moscowHourLabel,
        checks: sql<number>`COUNT(*)`,
        amount: sql<string>`COALESCE(SUM(${operationalEvotorDocuments.total}), 0)`,
        // A receipt total remains useful when V2 omitted payment details, but a
        // guessed cash/cashless split must not enter the financial series.
        cashAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashAmount}, 0) ELSE 0 END), 0)`,
        cashlessAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashlessAmount}, 0) ELSE 0 END), 0)`,
        complete: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'complete')`,
        unavailable: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unavailable')`,
        unreconciled: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unreconciled')`,
        malformed: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'malformed')`,
      })
      .from(operationalEvotorDocuments)
      .where(documentFilter)
      .groupBy(operationalEvotorDocuments.storeId, moscowHour, moscowHourLabel);
    const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 };
    let checks = 0;
    let amount = 0;
    let cashAmount = 0;
    let cashlessAmount = 0;
    const timeline = hourlyRows.flatMap(row => {
      const storeName = storeNameById.get(row.storeId);
      if (!storeName || !row.key || !row.label) return [];
      const rowChecks = Number(row.checks ?? 0);
      const rowAmount = Number(row.amount ?? 0);
      const rowCashAmount = Number(row.cashAmount ?? 0);
      const rowCashlessAmount = Number(row.cashlessAmount ?? 0);
      checks += rowChecks;
      amount += rowAmount;
      cashAmount += rowCashAmount;
      cashlessAmount += rowCashlessAmount;
      paymentCapture.complete += Number(row.complete ?? 0);
      paymentCapture.unavailable += Number(row.unavailable ?? 0);
      paymentCapture.unreconciled += Number(row.unreconciled ?? 0);
      paymentCapture.malformed += Number(row.malformed ?? 0);
      return [{ key: row.key, label: row.label, storeId: row.storeId, storeName, checks: rowChecks, amount: Math.round(rowAmount * 100) / 100, cashAmount: Math.round(rowCashAmount * 100) / 100, cashlessAmount: Math.round(rowCashlessAmount * 100) / 100, quantity: 0 }];
    }).sort((left, right) => left.key.localeCompare(right.key) || left.storeName.localeCompare(right.storeName, "ru"));
    return { stores: scopedStores, timeline, products: [], productTimeline: [], summary: { checks, amount: Math.round(amount * 100) / 100, cashAmount: Math.round(cashAmount * 100) / 100, cashlessAmount: Math.round(cashlessAmount * 100) / 100, returns, returnAmount, quantitiesByUnit: [], paymentCapture }, coverage, performance: performanceSnapshot(checks, 0) };
  }

  /**
   * KPI, Rhythm and Forecast never need every raw receipt to build a calendar
   * line. Month and hour already aggregated in TiDB; week/day must follow the
   * same rule for a two-year range, otherwise 900k+ rows reach Node before the
   * browser can receive a short timeline. Keep the Moscow expression identical
   * in SELECT and GROUP BY because TiDB's ONLY_FULL_GROUP_BY is strict.
   */
  if (input.includeProducts === false && (input.granularity === "month" || input.granularity === "week" || input.granularity === "day")) {
    const moscowOccurredAt = sql`DATE_ADD(STR_TO_DATE(\`occurredAt\`, '%Y-%m-%dT%H:%i:%s.%f+0000'), INTERVAL 3 HOUR)`;
    const moscowPeriod = input.granularity === "month"
      ? sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%Y-%m')`
      : input.granularity === "week"
        ? sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%x-%v')`
        : sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%Y-%m-%d')`;
    const monthlyRows = await db
      .select({
        storeId: operationalEvotorDocuments.storeId,
        key: moscowPeriod,
        checks: sql<number>`COUNT(*)`,
        amount: sql<string>`COALESCE(SUM(${operationalEvotorDocuments.total}), 0)`,
        // Summary and forecast follow the same verified-only payment rule as
        // every other time granularity.
        cashAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashAmount}, 0) ELSE 0 END), 0)`,
        cashlessAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashlessAmount}, 0) ELSE 0 END), 0)`,
        complete: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'complete')`,
        unavailable: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unavailable')`,
        unreconciled: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unreconciled')`,
        malformed: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'malformed')`,
      })
      .from(operationalEvotorDocuments)
      .where(documentFilter)
      .groupBy(operationalEvotorDocuments.storeId, moscowPeriod);
    const monthFormatter = new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "Europe/Moscow" });
    const intervalLabel = (key: string) => {
      if (input.granularity === "month") return monthFormatter.format(new Date(`${key}-01T00:00:00+03:00`));
      if (input.granularity === "week") {
        const [year, week] = key.split("-");
        return `Нед. ${Number(week)} · ${year}`;
      }
      return key.split("-").reverse().join(".");
    };
    const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 };
    let checks = 0;
    let amount = 0;
    let cashAmount = 0;
    let cashlessAmount = 0;
    const timeline = monthlyRows.flatMap(row => {
      const storeName = storeNameById.get(row.storeId);
      if (!storeName || !row.key) return [];
      const rowChecks = Number(row.checks ?? 0);
      const rowAmount = Number(row.amount ?? 0);
      const rowCashAmount = Number(row.cashAmount ?? 0);
      const rowCashlessAmount = Number(row.cashlessAmount ?? 0);
      checks += rowChecks;
      amount += rowAmount;
      cashAmount += rowCashAmount;
      cashlessAmount += rowCashlessAmount;
      paymentCapture.complete += Number(row.complete ?? 0);
      paymentCapture.unavailable += Number(row.unavailable ?? 0);
      paymentCapture.unreconciled += Number(row.unreconciled ?? 0);
      paymentCapture.malformed += Number(row.malformed ?? 0);
      return [{ key: row.key, label: intervalLabel(row.key), storeId: row.storeId, storeName, checks: rowChecks, amount: Math.round(rowAmount * 100) / 100, cashAmount: Math.round(rowCashAmount * 100) / 100, cashlessAmount: Math.round(rowCashlessAmount * 100) / 100, quantity: 0 }];
    }).sort((left, right) => left.key.localeCompare(right.key) || left.storeName.localeCompare(right.storeName, "ru"));
    return { stores: scopedStores, timeline, products: [], productTimeline: [], summary: { checks, amount: Math.round(amount * 100) / 100, cashAmount: Math.round(cashAmount * 100) / 100, cashlessAmount: Math.round(cashlessAmount * 100) / 100, returns, returnAmount, quantitiesByUnit: [], paymentCapture }, coverage, performance: performanceSnapshot(checks, 0) };
  }

  /**
   * Product analytics can cover tens of thousands of document rows in one month.
   * Group the receipt and position facts inside TiDB first: the browser receives
   * only table/chart aggregates, never the whole normalized receipt stream.
   */
  if (input.includeProducts !== false) {
    const moscowOccurredAt = sql`DATE_ADD(STR_TO_DATE(${operationalEvotorDocuments.occurredAt}, '%Y-%m-%dT%H:%i:%s.%f+0000'), INTERVAL 3 HOUR)`;
    const moscowKey = input.granularity === "month"
      ? sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%Y-%m')`
      : input.granularity === "week"
        ? sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%x-%v')`
        : input.granularity === "day"
          ? sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%Y-%m-%d')`
          : sql<string>`DATE_FORMAT(${moscowOccurredAt}, '%H')`;
    const intervalLabel = (key: string) => {
      if (input.granularity === "month") return new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(`${key}-01T00:00:00+03:00`));
      if (input.granularity === "week") {
        const [year, week] = key.split("-");
        return `Нед. ${Number(week)} · ${year}`;
      }
      if (input.granularity === "hour") return `${key}:00 МСК`;
      return key.split("-").reverse().join(".");
    };
    const [documentRows, positionRows] = await Promise.all([
      db.select({
        storeId: operationalEvotorDocuments.storeId,
        key: moscowKey,
        checks: sql<number>`COUNT(*)`,
        amount: sql<string>`COALESCE(SUM(${operationalEvotorDocuments.total}), 0)`,
        cashAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashAmount}, 0) ELSE 0 END), 0)`,
        cashlessAmount: sql<string>`COALESCE(SUM(CASE WHEN ${operationalEvotorDocuments.paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashlessAmount}, 0) ELSE 0 END), 0)`,
        complete: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'complete')`,
        unavailable: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unavailable')`,
        unreconciled: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'unreconciled')`,
        malformed: sql<number>`SUM(${operationalEvotorDocuments.paymentCaptureStatus} = 'malformed')`,
      }).from(operationalEvotorDocuments).where(documentFilter).groupBy(operationalEvotorDocuments.storeId, moscowKey),
      db.select({
        storeId: operationalEvotorDocuments.storeId,
        key: moscowKey,
        productName: operationalEvotorDocumentPositions.productName,
        unit: operationalEvotorDocumentPositions.unit,
        linkedUnit: operationalCatalogProducts.baseUnit,
        amount: sql<string>`COALESCE(SUM(${operationalEvotorDocumentPositions.resultSum}), 0)`,
        quantity: sql<string>`COALESCE(SUM(${operationalEvotorDocumentPositions.quantity}), 0)`,
        lineCount: sql<number>`COUNT(*)`,
      })
        .from(operationalEvotorDocumentPositions)
        .innerJoin(operationalEvotorDocuments, eq(operationalEvotorDocumentPositions.documentId, operationalEvotorDocuments.id))
        .leftJoin(operationalEvotorProductLinks, and(
          eq(operationalEvotorProductLinks.storeId, operationalEvotorDocuments.storeId),
          eq(operationalEvotorProductLinks.evotorProductId, operationalEvotorDocumentPositions.evotorProductId),
        ))
        .leftJoin(operationalCatalogProducts, eq(operationalCatalogProducts.id, operationalEvotorProductLinks.productId))
        .where(documentFilter)
        .groupBy(operationalEvotorDocuments.storeId, moscowKey, operationalEvotorDocumentPositions.productName, operationalEvotorDocumentPositions.unit, operationalCatalogProducts.baseUnit),
    ]);
    const timelineMap = new Map<string, { key: string; label: string; storeId: number; storeName: string; checks: number; amount: number; cashAmount: number; cashlessAmount: number; quantity: number }>();
    const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 };
    let checks = 0;
    let amount = 0;
    let cashAmount = 0;
    let cashlessAmount = 0;
    for (const row of documentRows) {
      const storeName = storeNameById.get(row.storeId);
      const key = String(row.key ?? "");
      if (!storeName || !key) continue;
      const rowChecks = Number(row.checks ?? 0);
      const rowAmount = Number(row.amount ?? 0);
      const rowCashAmount = Number(row.cashAmount ?? 0);
      const rowCashlessAmount = Number(row.cashlessAmount ?? 0);
      timelineMap.set(`${key}:${row.storeId}`, { key, label: intervalLabel(key), storeId: row.storeId, storeName, checks: rowChecks, amount: rowAmount, cashAmount: rowCashAmount, cashlessAmount: rowCashlessAmount, quantity: 0 });
      checks += rowChecks;
      amount += rowAmount;
      cashAmount += rowCashAmount;
      cashlessAmount += rowCashlessAmount;
      paymentCapture.complete += Number(row.complete ?? 0);
      paymentCapture.unavailable += Number(row.unavailable ?? 0);
      paymentCapture.unreconciled += Number(row.unreconciled ?? 0);
      paymentCapture.malformed += Number(row.malformed ?? 0);
    }
    const productMap = new Map<string, { key: string; productName: string; unit: string | null; amount: number; quantity: number; stores: Set<number> }>();
    const productTimelineMap = new Map<string, { key: string; label: string; storeId: number; storeName: string; productKey: string; productName: string; unit: string | null; amount: number; quantity: number }>();
    const quantitiesByUnit = new Map<string, { unit: string | null; quantity: number }>();
    let productLineCount = 0;
    for (const row of positionRows) {
      const storeName = storeNameById.get(row.storeId);
      const intervalKey = String(row.key ?? "");
      if (!storeName || !intervalKey) continue;
      const productName = normalizedText(row.productName ?? "") || "Товар без названия";
      const unit = row.unit ?? row.linkedUnit ?? null;
      const key = `${productName}\u0000${unit ?? ""}`;
      const rowAmount = Number(row.amount ?? 0);
      const rowQuantity = Number(row.quantity ?? 0);
      const product = productMap.get(key) ?? { key, productName, unit, amount: 0, quantity: 0, stores: new Set<number>() };
      product.amount += rowAmount;
      product.quantity += rowQuantity;
      product.stores.add(row.storeId);
      productMap.set(key, product);
      const unitQuantity = quantitiesByUnit.get(unit ?? "") ?? { unit, quantity: 0 };
      unitQuantity.quantity += rowQuantity;
      quantitiesByUnit.set(unit ?? "", unitQuantity);
      const timeline = timelineMap.get(`${intervalKey}:${row.storeId}`);
      if (timeline) timeline.quantity += rowQuantity;
      const productTimelineKey = `${intervalKey}\u0000${row.storeId}\u0000${key}`;
      const productTimeline = productTimelineMap.get(productTimelineKey) ?? { key: intervalKey, label: intervalLabel(intervalKey), storeId: row.storeId, storeName, productKey: key, productName, unit, amount: 0, quantity: 0 };
      productTimeline.amount += rowAmount;
      productTimeline.quantity += rowQuantity;
      productTimelineMap.set(productTimelineKey, productTimeline);
      productLineCount += Number(row.lineCount ?? 0);
    }
    return {
      stores: scopedStores,
      timeline: Array.from(timelineMap.values()).map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100, cashAmount: Math.round(row.cashAmount * 100) / 100, cashlessAmount: Math.round(row.cashlessAmount * 100) / 100, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => left.key.localeCompare(right.key) || left.storeName.localeCompare(right.storeName, "ru")),
      products: Array.from(productMap.values()).map(product => ({ key: product.key, productName: product.productName, unit: product.unit, amount: Math.round(product.amount * 100) / 100, quantity: Math.round(product.quantity * 1_000) / 1_000, stores: product.stores.size })).sort((left, right) => right.amount - left.amount || left.productName.localeCompare(right.productName, "ru")),
      productTimeline: Array.from(productTimelineMap.values()).map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => left.key.localeCompare(right.key) || left.productName.localeCompare(right.productName, "ru")),
      summary: { checks, amount: Math.round(amount * 100) / 100, cashAmount: Math.round(cashAmount * 100) / 100, cashlessAmount: Math.round(cashlessAmount * 100) / 100, returns, returnAmount, quantitiesByUnit: Array.from(quantitiesByUnit.values()).map(row => ({ ...row, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => String(left.unit ?? "").localeCompare(String(right.unit ?? ""))), paymentCapture },
      coverage,
      performance: performanceSnapshot(checks, productLineCount),
    };
  }
  const documents = await db
    .select({
      id: operationalEvotorDocuments.id,
      storeId: operationalEvotorDocuments.storeId,
      occurredAt: operationalEvotorDocuments.occurredAt,
      total: operationalEvotorDocuments.total,
      cashAmount: operationalEvotorDocuments.cashAmount,
      cashlessAmount: operationalEvotorDocuments.cashlessAmount,
      paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus,
    })
    .from(operationalEvotorDocuments)
    .where(documentFilter);
  const timelineMap = new Map<string, { key: string; label: string; storeId: number; storeName: string; checks: number; amount: number; cashAmount: number; cashlessAmount: number; quantity: number }>();
  const documentById = new Map<number, { storeId: number; storeName: string; intervalKey: string; intervalLabel: string; timelineKey: string }>();
  let checks = 0;
  let amount = 0;
  let cashAmount = 0;
  let cashlessAmount = 0;
  const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 };
  for (const document of documents) {
    const interval = document.occurredAt ? evotorSalesInterval(document.occurredAt, input.granularity) : null;
    const storeName = storeNameById.get(document.storeId);
    if (!interval || !storeName) continue;
    const aggregateKey = `${interval.key}:${document.storeId}`;
    const aggregate = timelineMap.get(aggregateKey) ?? { key: interval.key, label: interval.label, storeId: document.storeId, storeName, checks: 0, amount: 0, cashAmount: 0, cashlessAmount: 0, quantity: 0 };
    aggregate.checks += 1;
    aggregate.amount += Number(document.total ?? 0);
    if (document.paymentCaptureStatus === "complete") {
      aggregate.cashAmount += Number(document.cashAmount ?? 0);
      aggregate.cashlessAmount += Number(document.cashlessAmount ?? 0);
    }
    timelineMap.set(aggregateKey, aggregate);
    documentById.set(document.id, { storeId: document.storeId, storeName, intervalKey: interval.key, intervalLabel: interval.label, timelineKey: aggregateKey });
    checks += 1;
    amount += Number(document.total ?? 0);
    if (document.paymentCaptureStatus === "complete") {
      cashAmount += Number(document.cashAmount ?? 0);
      cashlessAmount += Number(document.cashlessAmount ?? 0);
    }
    paymentCapture[document.paymentCaptureStatus] += 1;
  }
  const documentIds = documents.map(document => document.id);
  const linkedUnits = input.includeProducts !== false && scopedStores.length
    ? await db
      .select({ storeId: operationalEvotorProductLinks.storeId, evotorProductId: operationalEvotorProductLinks.evotorProductId, baseUnit: operationalCatalogProducts.baseUnit })
      .from(operationalEvotorProductLinks)
      .innerJoin(operationalCatalogProducts, eq(operationalCatalogProducts.id, operationalEvotorProductLinks.productId))
      .where(inArray(operationalEvotorProductLinks.storeId, scopedStores.map(store => store.id)))
    : [];
  const linkedUnitByStoreProduct = new Map(linkedUnits.map(link => [`${link.storeId}\u0000${link.evotorProductId}`, link.baseUnit]));
  const positions = [] as Array<{ documentId: number; evotorProductId: string | null; productName: string | null; unit: string | null; quantity: string | null; resultSum: string | null }>;
  if (input.includeProducts !== false) {
    for (let start = 0; start < documentIds.length; start += 5_000) {
      positions.push(...await db
        .select({ documentId: operationalEvotorDocumentPositions.documentId, evotorProductId: operationalEvotorDocumentPositions.evotorProductId, productName: operationalEvotorDocumentPositions.productName, unit: operationalEvotorDocumentPositions.unit, quantity: operationalEvotorDocumentPositions.quantity, resultSum: operationalEvotorDocumentPositions.resultSum })
        .from(operationalEvotorDocumentPositions)
        .where(inArray(operationalEvotorDocumentPositions.documentId, documentIds.slice(start, start + 5_000))));
    }
  }
  const productMap = new Map<string, { key: string; productName: string; unit: string | null; amount: number; quantity: number; stores: Set<number> }>();
  const productTimelineMap = new Map<string, { key: string; label: string; storeId: number; storeName: string; productKey: string; productName: string; unit: string | null; amount: number; quantity: number }>();
  const quantitiesByUnit = new Map<string, { unit: string | null; quantity: number }>();
  for (const position of positions) {
    const document = documentById.get(position.documentId);
    if (!document) continue;
    const productName = normalizedText(position.productName ?? "") || "Товар без названия";
    const unit = position.unit ?? (position.evotorProductId ? linkedUnitByStoreProduct.get(`${document.storeId}\u0000${position.evotorProductId}`) ?? null : null);
    const key = `${productName}\u0000${unit ?? ""}`;
    const product = productMap.get(key) ?? { key, productName, unit, amount: 0, quantity: 0, stores: new Set<number>() };
    const lineQuantity = Number(position.quantity ?? 0);
    product.amount += Number(position.resultSum ?? 0);
    product.quantity += lineQuantity;
    if (document) product.stores.add(document.storeId);
    productMap.set(key, product);
    const quantityKey = unit ?? "";
    const unitQuantity = quantitiesByUnit.get(quantityKey) ?? { unit, quantity: 0 };
    unitQuantity.quantity += lineQuantity;
    quantitiesByUnit.set(quantityKey, unitQuantity);
    const timeline = document ? timelineMap.get(document.timelineKey) : undefined;
    if (timeline) {
      timeline.quantity += lineQuantity;
    }
    const productTimelineKey = `${document.intervalKey}\u0000${document.storeId}\u0000${key}`;
    const productTimeline = productTimelineMap.get(productTimelineKey) ?? {
      key: document.intervalKey,
      label: document.intervalLabel,
      storeId: document.storeId,
      storeName: document.storeName,
      productKey: key,
      productName,
      unit,
      amount: 0,
      quantity: 0,
    };
    productTimeline.amount += Number(position.resultSum ?? 0);
    productTimeline.quantity += lineQuantity;
    productTimelineMap.set(productTimelineKey, productTimeline);
  }
  return {
    stores: scopedStores,
    timeline: Array.from(timelineMap.values()).map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100, cashAmount: Math.round(row.cashAmount * 100) / 100, cashlessAmount: Math.round(row.cashlessAmount * 100) / 100, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => left.key.localeCompare(right.key) || left.storeName.localeCompare(right.storeName, "ru")),
    products: Array.from(productMap.values()).map(product => ({ key: product.key, productName: product.productName, unit: product.unit, amount: Math.round(product.amount * 100) / 100, quantity: Math.round(product.quantity * 1_000) / 1_000, stores: product.stores.size })).sort((left, right) => right.amount - left.amount || left.productName.localeCompare(right.productName, "ru")),
    productTimeline: Array.from(productTimelineMap.values()).map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => left.key.localeCompare(right.key) || left.productName.localeCompare(right.productName, "ru")),
    summary: {
      checks,
      amount: Math.round(amount * 100) / 100,
      cashAmount: Math.round(cashAmount * 100) / 100,
      cashlessAmount: Math.round(cashlessAmount * 100) / 100,
      returns,
      returnAmount,
      quantitiesByUnit: Array.from(quantitiesByUnit.values()).map(row => ({ ...row, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => String(left.unit ?? "").localeCompare(String(right.unit ?? ""))),
      paymentCapture,
    },
    coverage,
    performance: performanceSnapshot(documents.length, positions.length),
  };
}

export type EvotorReceiptType = "sale" | "return";

const receiptType = (value: string): EvotorReceiptType => value === "SELL" ? "sale" : "return";

function receiptTypeLabel(value: string) {
  return value === "SELL" ? "Продажа" : "Возврат";
}

/**
 * A bounded, read-only receipt register. It returns only the human receipt
 * number when V2 supplied one, summary amounts and product lines; external,
 * fiscal, payment, terminal and credential identifiers remain server-only.
 */
export async function listOperationalEvotorReceipts(input: {
  from: string;
  to: string;
  storeIds?: number[];
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const from = input.from < EVOTOR_DOCUMENT_RETENTION_START ? EVOTOR_DOCUMENT_RETENTION_START : input.from;
  if (input.to < EVOTOR_DOCUMENT_RETENTION_START) return { stores: [], items: [], summary: { sales: 0, returns: 0, saleAmount: 0, returnAmount: 0, discountAmount: null, paymentCapture: { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 } }, coverage: { from: null, to: null } };
  const allVisibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false)).orderBy(stores.name);
  const requestedStoreIds = input.storeIds?.length ? new Set(input.storeIds) : null;
  const scopedStores = requestedStoreIds ? allVisibleStores.filter(store => requestedStoreIds.has(store.id)) : allVisibleStores;
  if (!scopedStores.length) return { stores: [], items: [], summary: { sales: 0, returns: 0, saleAmount: 0, returnAmount: 0, discountAmount: null, paymentCapture: { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 } }, coverage: { from: null, to: null } };
  const storeIds = scopedStores.map(store => store.id);
  const search = normalizedText(input.search ?? "").toLocaleLowerCase("ru-RU");
  // The register has one shared input. A human may know the store better than
  // the receipt number, so an exact scoped store-name match narrows the same
  // protected read-only query instead of exposing a second store picker.
  const storesMatchedBySearch = search
    ? scopedStores.filter(store => normalizedText(store.name).toLocaleLowerCase("ru-RU").includes(search))
    : [];
  const receiptStoreIds = storesMatchedBySearch.length ? storesMatchedBySearch.map(store => store.id) : storeIds;
  const amountSearch = search.replace(/\s+/g, "").replace(",", ".");
  const exactAmount = /^\d{1,14}(?:\.\d{1,2})?$/.test(amountSearch) ? amountSearch : null;
  // Evotor V2 persists UTC timestamps. Searching a raw ISO substring made an
  // entered Moscow time match a different displayed time; format in the same
  // fixed +03:00 business zone as the UI instead.
  const moscowTimeSearch = /^(?:[01]\d|2[0-3]):[0-5]\d(?:\:[0-5]\d)?$/.test(search) ? search.slice(0, 5) : null;
  const occurredAtMoscowTime = sql<string>`date_format(convert_tz(str_to_date(${operationalEvotorDocuments.occurredAt}, '%Y-%m-%dT%H:%i:%s.%f+0000'), '+00:00', '+03:00'), '%H:%i')`;
  const searchCondition = !search
    ? undefined
    : moscowTimeSearch
      ? eq(occurredAtMoscowTime, moscowTimeSearch)
      : or(
        like(operationalEvotorDocuments.receiptNumber, `%${search}%`),
        ...(exactAmount ? [eq(operationalEvotorDocuments.total, exactAmount)] : []),
      );
  const pageLimit = Math.min(Math.max(input.limit ?? 30, 1), 30);
  const offset = Math.min(Math.max(input.offset ?? 0, 0), 10_000);
  const receiptConditions = [
    inArray(operationalEvotorDocuments.storeId, receiptStoreIds),
    inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"]),
    isNotNull(operationalEvotorDocuments.occurredAt),
    gte(operationalEvotorDocuments.occurredAt, `${from}T00:00:00`),
    lte(operationalEvotorDocuments.occurredAt, `${input.to}T23:59:59.999`),
    ...(searchCondition ? [searchCondition] : []),
  ];
  const [coverageRows, summaryRows, pageRows, coverageByStoreRows] = await Promise.all([
    db.select({ occurredAt: operationalEvotorDocuments.occurredAt }).from(operationalEvotorDocuments).where(and(inArray(operationalEvotorDocuments.storeId, receiptStoreIds), inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"]), isNotNull(operationalEvotorDocuments.occurredAt), gte(operationalEvotorDocuments.occurredAt, `${EVOTOR_DOCUMENT_RETENTION_START}T00:00:00`))).orderBy(operationalEvotorDocuments.occurredAt).limit(1),
    db.select({
      documentType: operationalEvotorDocuments.documentType,
      paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus,
      documentCount: sql<number>`count(*)`,
      totalAmount: sql<string>`coalesce(sum(${operationalEvotorDocuments.total}), 0)`,
      explicitDiscounts: sql<number>`sum(case when ${operationalEvotorDocuments.discountAmount} is null then 0 else 1 end)`,
      discountTotal: sql<string>`coalesce(sum(${operationalEvotorDocuments.discountAmount}), 0)`,
    }).from(operationalEvotorDocuments).where(and(...receiptConditions.filter(condition => condition !== undefined))).groupBy(operationalEvotorDocuments.documentType, operationalEvotorDocuments.paymentCaptureStatus),
    db.select({ id: operationalEvotorDocuments.id, storeId: operationalEvotorDocuments.storeId, receiptNumber: operationalEvotorDocuments.receiptNumber, documentType: operationalEvotorDocuments.documentType, occurredAt: operationalEvotorDocuments.occurredAt, total: operationalEvotorDocuments.total, discountAmount: operationalEvotorDocuments.discountAmount, paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus }).from(operationalEvotorDocuments).where(and(...receiptConditions.filter(condition => condition !== undefined))).orderBy(desc(operationalEvotorDocuments.occurredAt), desc(operationalEvotorDocuments.id)).limit(pageLimit + 1).offset(offset),
    db.select({ storeId: operationalEvotorDocuments.storeId, latestOccurredAt: sql<string>`max(${operationalEvotorDocuments.occurredAt})`, documentsInPeriod: sql<number>`sum(case when ${operationalEvotorDocuments.occurredAt} >= ${`${from}T00:00:00`} and ${operationalEvotorDocuments.occurredAt} <= ${`${input.to}T23:59:59.999`} then 1 else 0 end)` }).from(operationalEvotorDocuments).where(and(inArray(operationalEvotorDocuments.storeId, receiptStoreIds), inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"]), isNotNull(operationalEvotorDocuments.occurredAt), gte(operationalEvotorDocuments.occurredAt, `${EVOTOR_DOCUMENT_RETENTION_START}T00:00:00`))).groupBy(operationalEvotorDocuments.storeId),
  ]);
  const latestCoverageRows = await db.select({ occurredAt: operationalEvotorDocuments.occurredAt }).from(operationalEvotorDocuments).where(and(inArray(operationalEvotorDocuments.storeId, storeIds), inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"]), isNotNull(operationalEvotorDocuments.occurredAt), gte(operationalEvotorDocuments.occurredAt, `${EVOTOR_DOCUMENT_RETENTION_START}T00:00:00`))).orderBy(desc(operationalEvotorDocuments.occurredAt)).limit(1);
  const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 };
  let sales = 0;
  let returns = 0;
  let saleAmount = 0;
  let returnAmount = 0;
  let explicitDiscounts = 0;
  let discountAmount = 0;
  for (const aggregate of summaryRows) {
    const count = Number(aggregate.documentCount ?? 0);
    const total = Number(aggregate.totalAmount ?? 0);
    if (receiptType(aggregate.documentType) === "sale") { sales += count; saleAmount += total; }
    else { returns += count; returnAmount += total; }
    explicitDiscounts += Number(aggregate.explicitDiscounts ?? 0);
    discountAmount += Number(aggregate.discountTotal ?? 0);
    paymentCapture[aggregate.paymentCaptureStatus] += count;
  }
  const storeNameById = new Map(scopedStores.map(store => [store.id, store.name]));
  const rows = pageRows.slice(0, pageLimit);
  const coverageByStore = new Map(coverageByStoreRows.map(row => [row.storeId, row]));
  return {
    stores: scopedStores,
    items: rows.map(row => ({ id: row.id, storeId: row.storeId, storeName: storeNameById.get(row.storeId) ?? "Магазин", receiptNumber: row.receiptNumber, type: receiptType(row.documentType), typeLabel: receiptTypeLabel(row.documentType), occurredAt: row.occurredAt, total: row.total === null ? null : Number(row.total), discountAmount: row.discountAmount === null ? null : Number(row.discountAmount), paymentCaptureStatus: row.paymentCaptureStatus })),
    summary: { sales, returns, saleAmount: Math.round(saleAmount * 100) / 100, returnAmount: Math.round(returnAmount * 100) / 100, discountAmount: explicitDiscounts ? Math.round(discountAmount * 100) / 100 : null, paymentCapture },
    coverage: { from: coverageRows[0]?.occurredAt?.slice(0, 10) ?? null, to: latestCoverageRows[0]?.occurredAt?.slice(0, 10) ?? null },
    page: { offset, limit: pageLimit, hasMore: pageRows.length > pageLimit },
    storeCoverage: scopedStores.map(store => ({ storeId: store.id, storeName: store.name, latestOccurredAt: coverageByStore.get(store.id)?.latestOccurredAt ?? null, documentsInPeriod: Number(coverageByStore.get(store.id)?.documentsInPeriod ?? 0) })),
  };
}

export async function getOperationalEvotorReceiptDetail(input: { receiptId: number; storeIds?: number[] | null; documentTypes?: Array<"SELL" | "PAYBACK" | "RETURN" | "SELL_RETURN"> }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const documentTypes = input.documentTypes?.length ? input.documentTypes : ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"];
  const conditions = [eq(operationalEvotorDocuments.id, input.receiptId), inArray(operationalEvotorDocuments.documentType, documentTypes), ...(Array.isArray(input.storeIds) ? [inArray(operationalEvotorDocuments.storeId, input.storeIds)] : [])];
  const [document] = await db.select({ id: operationalEvotorDocuments.id, storeId: operationalEvotorDocuments.storeId, storeName: stores.name, receiptNumber: operationalEvotorDocuments.receiptNumber, documentType: operationalEvotorDocuments.documentType, occurredAt: operationalEvotorDocuments.occurredAt, total: operationalEvotorDocuments.total, discountAmount: operationalEvotorDocuments.discountAmount, cashAmount: operationalEvotorDocuments.cashAmount, cashTenderedAmount: operationalEvotorDocuments.cashTenderedAmount, cashChangeAmount: operationalEvotorDocuments.cashChangeAmount, cashlessAmount: operationalEvotorDocuments.cashlessAmount, otherPaymentAmount: operationalEvotorDocuments.otherPaymentAmount, unknownPaymentAmount: operationalEvotorDocuments.unknownPaymentAmount, paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus, paymentReconciliationDelta: operationalEvotorDocuments.paymentReconciliationDelta }).from(operationalEvotorDocuments).innerJoin(stores, and(eq(stores.id, operationalEvotorDocuments.storeId), eq(stores.isHidden, false))).where(and(...conditions)).limit(1);
  if (!document) throw new Error("Чек Эвотор не найден или недоступен.");
  const positions = await db.select({ id: operationalEvotorDocumentPositions.id, productName: operationalEvotorDocumentPositions.productName, quantity: operationalEvotorDocumentPositions.quantity, unit: operationalEvotorDocumentPositions.unit, resultSum: operationalEvotorDocumentPositions.resultSum }).from(operationalEvotorDocumentPositions).where(eq(operationalEvotorDocumentPositions.documentId, document.id)).orderBy(operationalEvotorDocumentPositions.id).limit(500);
  return {
    id: document.id,
    storeId: document.storeId,
    storeName: document.storeName,
    receiptNumber: document.receiptNumber,
    type: receiptType(document.documentType),
    typeLabel: receiptTypeLabel(document.documentType),
    occurredAt: document.occurredAt,
    total: document.total === null ? null : Number(document.total),
    discountAmount: document.discountAmount === null ? null : Number(document.discountAmount),
    payments: { cashAmount: document.cashAmount === null ? null : Number(document.cashAmount), cashTenderedAmount: document.cashTenderedAmount === null ? null : Number(document.cashTenderedAmount), cashChangeAmount: document.cashChangeAmount === null ? null : Number(document.cashChangeAmount), cashlessAmount: document.cashlessAmount === null ? null : Number(document.cashlessAmount), otherPaymentAmount: document.otherPaymentAmount === null ? null : Number(document.otherPaymentAmount), unknownPaymentAmount: document.unknownPaymentAmount === null ? null : Number(document.unknownPaymentAmount), captureStatus: document.paymentCaptureStatus, reconciliationDelta: document.paymentReconciliationDelta === null ? null : Number(document.paymentReconciliationDelta) },
    positions: positions.map(position => ({ id: position.id, productName: position.productName ?? "Товар без названия", quantity: position.quantity === null ? null : Number(position.quantity), unit: position.unit, resultSum: position.resultSum === null ? null : Number(position.resultSum) })),
  };
}

/** Saves the confirmed Evotor catalog as read-only links to global products; similarity never merges real products. */
export async function confirmOperationalCatalogFromEvotor(input: { storeId: number; actorId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const preview = await listEvotorCatalogPreviewForOperationalStore(input.storeId);
  if (!preview.products.length) throw new Error("В каталоге выбранной точки Эвотор нет товарных позиций для сохранения.");
  const categoryIdByName = await ensureCatalogCategoriesFromEvotor(preview.products.map(product => product.categoryName), input.actorId);
  let nextNumber = await nextCatalogNumber();
  await forEachBoundedBatch(preview.products, 12, async product => {
    const baseUnit = catalogUnitFromEvotor(product.unit);
    const evotorQuantitySnapshot = product.quantity !== null && finiteThreeDecimals(product.quantity) ? product.quantity.toFixed(3) : null;
    const catalogCategoryId = product.categoryName ? categoryIdByName.get(normalizedKey(product.categoryName)) ?? null : null;
    const [link] = await db.select().from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, input.storeId), eq(operationalEvotorProductLinks.evotorProductId, product.id))).limit(1);
    if (link) {
      const [existing] = await db.select({
        baseUnit: operationalCatalogProducts.baseUnit,
        isActive: operationalCatalogProducts.isActive,
        metadataSource: operationalCatalogProducts.metadataSource,
        markingCategory: operationalCatalogProducts.markingCategory,
        alcoholCode: operationalCatalogProducts.alcoholCode,
        alcoholTypeCode: operationalCatalogProducts.alcoholTypeCode,
        alcoholStrengthPercent: operationalCatalogProducts.alcoholStrengthPercent,
        alcoholVolumeLiters: operationalCatalogProducts.alcoholVolumeLiters,
      }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, link.productId)).limit(1);
      const sourceMayRefreshMetadata = existing?.metadataSource !== "manual";
      const markingFromSource = markingFromEvotorCategory(product);
      const hasDocumentedType = ["NORMAL", "DIETARY_SUPPLEMENTS_MARKED", "CAVIAR_MARKED", "GROCERIES_MARKED", "CANNED_FISH_MARKED", "BEER_MARKED", "BEER_MARKED_KEG", "NOT_ALCOHOL_BEER_MARKED", "JUICE_MARKED", "WATER_MARKED", "DAIRY_MARKED", "MILK_MARKED", "ALCOHOL_MARKED", "ALCOHOL_NOT_MARKED", "ALCOHOL"].includes(product.type?.toUpperCase() ?? "");
      const existingAlcoholMarking = existing?.markingCategory === "alcohol" || existing?.markingCategory === "beer_marked";
      // One store may return NORMAL for a shared beer while the reference store
      // returns BEER_MARKED. Do not let an incomplete per-store answer downgrade
      // the common regulatory classification or erase its alcohol code.
      const resolvedMarkingCategory = !sourceMayRefreshMetadata ? existing!.markingCategory : markingFromSource === "none" && existingAlcoholMarking
        ? existing!.markingCategory
        : (hasDocumentedType ? markingFromSource : (existing?.markingCategory === "none" ? markingFromSource : existing?.markingCategory ?? "none"));
      const isAlcoholProduct = resolvedMarkingCategory === "alcohol" || resolvedMarkingCategory === "beer_marked";
      await db.update(operationalCatalogProducts).set({
        evotorCode: product.code,
        canonicalName: sourceMayRefreshMetadata ? product.name : undefined,
        evotorCategoryName: product.categoryName,
        catalogCategoryId: sourceMayRefreshMetadata ? catalogCategoryId : undefined,
        barcodes: product.barcodes,
        // Several historical V2 records omit measure_name. A blank source field
        // must not erase an administrator-confirmed local unit on later refreshes.
        baseUnit: sourceMayRefreshMetadata ? (baseUnit === "unknown" ? existing?.baseUnit ?? "unknown" : baseUnit) : undefined,
        vatRate: sourceMayRefreshMetadata ? product.vatRate : undefined,
        markingCategory: sourceMayRefreshMetadata ? resolvedMarkingCategory : undefined,
        // A partial catalog response must never erase alcohol details already known
        // locally; explicit source values still replace the previous values.
        alcoholCode: sourceMayRefreshMetadata ? (isAlcoholProduct ? product.alcoholCode ?? existing?.alcoholCode ?? null : null) : undefined,
        alcoholTypeCode: sourceMayRefreshMetadata ? (isAlcoholProduct ? product.alcoholTypeCode ?? existing?.alcoholTypeCode ?? null : null) : undefined,
        alcoholStrengthPercent: sourceMayRefreshMetadata ? (isAlcoholProduct ? (product.alcoholStrengthPercent !== null ? product.alcoholStrengthPercent.toFixed(2) : existing?.alcoholStrengthPercent ?? null) : null) : undefined,
        alcoholVolumeLiters: sourceMayRefreshMetadata ? (isAlcoholProduct ? (product.alcoholVolumeLiters !== null ? product.alcoholVolumeLiters.toFixed(3) : existing?.alcoholVolumeLiters ?? null) : null) : undefined,
        // A local archive is a deliberate operational decision. The periodic
        // read-only catalog snapshot may refresh source metadata, but must not
        // silently return an archived manual product to active work lists.
        isActive: existing?.metadataSource === "manual" ? existing.isActive : true,
        importedAt: new Date(),
      }).where(eq(operationalCatalogProducts.id, link.productId));
      // The confirmed all-store reset intentionally writes 999 as a synthetic
      // baseline. A subsequent catalog read that repeats 999 is not evidence
      // that sales were included, so it must not move the baseline past receipt
      // deltas. Any different source quantity restores normal catalog behavior.
      const retainsResetBaseline = link.evotorQuantitySource === "confirmed_reset" && evotorQuantitySnapshot === "999.000";
      await db.update(operationalEvotorProductLinks).set({
        evotorQuantitySnapshot,
        evotorQuantityUpdatedAt: retainsResetBaseline ? link.evotorQuantityUpdatedAt : new Date(),
        evotorQuantitySource: retainsResetBaseline ? "confirmed_reset" : "catalog",
      }).where(eq(operationalEvotorProductLinks.id, link.id));
      return;
    }
    const [sameCommonProduct] = await db.select({ id: operationalCatalogProducts.id }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.canonicalName, product.name)).orderBy(operationalCatalogProducts.catalogNumber).limit(1);
    if (sameCommonProduct) {
      await db.insert(operationalEvotorProductLinks).values({ storeId: input.storeId, evotorProductId: product.id, productId: sameCommonProduct.id, evotorQuantitySnapshot, evotorQuantityUpdatedAt: new Date(), linkedByAccountId: input.actorId });
      return;
    }
    const [inserted] = await db.insert(operationalCatalogProducts).values({
      catalogNumber: nextNumber++,
      storeId: input.storeId,
      evotorProductId: product.id,
      evotorCode: product.code,
      canonicalName: product.name,
      evotorCategoryName: product.categoryName,
      catalogCategoryId,
      barcodes: product.barcodes,
      baseUnit,
      vatRate: product.vatRate,
      markingCategory: markingFromEvotorCategory(product),
      evotorCostPrice: "0.00",
      importedByAccountId: input.actorId,
      alcoholCode: product.alcoholCode,
      alcoholTypeCode: product.alcoholTypeCode,
      alcoholStrengthPercent: product.alcoholStrengthPercent === null ? null : product.alcoholStrengthPercent.toFixed(2),
      alcoholVolumeLiters: product.alcoholVolumeLiters === null ? null : product.alcoholVolumeLiters.toFixed(3),
    }).$returningId();
    await db.insert(operationalEvotorProductLinks).values({ storeId: input.storeId, evotorProductId: product.id, productId: inserted.id, evotorQuantitySnapshot, evotorQuantityUpdatedAt: new Date(), linkedByAccountId: input.actorId });
  });
  return { storeId: input.storeId, evotorStoreName: preview.mapping.evotorStoreName, imported: preview.products.length };
}

export async function updateOperationalCatalogCost(input: { id: number; internalCostPrice: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (input.internalCostPrice !== null && (!Number.isFinite(input.internalCostPrice) || input.internalCostPrice < 0)) throw new Error("Внутренняя себестоимость должна быть неотрицательным числом.");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  await db.update(operationalCatalogProducts).set({ metadataSource: "manual", internalCostPrice: input.internalCostPrice === null ? null : input.internalCostPrice.toFixed(2) }).where(eq(operationalCatalogProducts.id, input.id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  return { before, after: after! };
}

export async function createOperationalCatalogProduct(input: { canonicalName: string; evotorCategoryName?: string | null; catalogCategoryId?: number | null; baseUnit: EditableCatalogUnit; vatRate?: InventoryVatRate; internalCostPrice?: number | null; isEvotorCostExportEnabled?: boolean; markingCategory?: InventoryMarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: number | null; alcoholVolumeLiters?: number | null; manualBarcodes?: string | null; isVisibleInRequests?: boolean; isEvotorExportEnabled?: boolean; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  const [duplicate] = await db
    .select({ id: operationalCatalogProducts.id, catalogNumber: operationalCatalogProducts.catalogNumber })
    .from(operationalCatalogProducts)
    .where(and(
      eq(operationalCatalogProducts.canonicalName, canonicalName),
      eq(operationalCatalogProducts.isActive, true),
    ))
    .limit(1);
  if (duplicate) throw new Error(`Товар «${canonicalName}» уже есть в рабочем справочнике (№ ${duplicate.catalogNumber}). Откройте существующую карточку вместо создания дубля.`);
  if (input.internalCostPrice !== undefined && input.internalCostPrice !== null && (!Number.isFinite(input.internalCostPrice) || input.internalCostPrice < 0)) throw new Error("Внутренняя себестоимость должна быть неотрицательным числом.");
  if (input.alcoholStrengthPercent !== undefined && input.alcoholStrengthPercent !== null && (!Number.isFinite(input.alcoholStrengthPercent) || input.alcoholStrengthPercent < 0 || input.alcoholStrengthPercent > 100)) throw new Error("Крепость должна быть числом от 0 до 100%.");
  const isAlcohol = input.markingCategory === "alcohol" || input.markingCategory === "beer_marked";
  const alcoholTypeCode = normalizeAlcoholProductKindCode(input.alcoholTypeCode, isAlcohol);
  const category = await requireActiveCatalogCategory(input.catalogCategoryId);
  const [inserted] = await db.insert(operationalCatalogProducts).values({
    catalogNumber: await nextCatalogNumber(),
    storeId: null,
    evotorProductId: `manual:${randomUUID()}`,
    metadataSource: "manual",
    canonicalName,
    evotorCategoryName: normalizedText(input.evotorCategoryName ?? "").slice(0, 512) || null,
    catalogCategoryId: category?.id ?? null,
    barcodes: [],
    baseUnit: input.baseUnit,
    vatRate: input.vatRate ?? "VAT_10",
    evotorCostPrice: "0.00",
    internalCostPrice: input.internalCostPrice === null || input.internalCostPrice === undefined ? null : input.internalCostPrice.toFixed(2),
    isEvotorCostExportEnabled: input.isEvotorCostExportEnabled ?? false,
    markingCategory: input.markingCategory ?? "none",
    alcoholCode: isAlcohol ? normalizedText(input.alcoholCode ?? "").slice(0, 255) || null : null,
    alcoholTypeCode,
    alcoholStrengthPercent: isAlcohol && input.alcoholStrengthPercent !== null && input.alcoholStrengthPercent !== undefined ? input.alcoholStrengthPercent.toFixed(2) : null,
    alcoholVolumeLiters: isAlcohol && input.alcoholVolumeLiters !== null && input.alcoholVolumeLiters !== undefined ? input.alcoholVolumeLiters.toFixed(3) : null,
    manualBarcodes: normalizedManualBarcodes(input.manualBarcodes),
    isVisibleInRequests: input.isVisibleInRequests ?? true,
    isEvotorExportEnabled: input.isEvotorExportEnabled ?? true,
    importedByAccountId: input.actorId,
  }).$returningId();
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, inserted.id)).limit(1);
  return after!;
}

export async function updateOperationalCatalogProduct(input: { id: number; canonicalName: string; evotorCategoryName?: string | null; catalogCategoryId?: number | null; baseUnit: EditableCatalogUnit; vatRate: InventoryVatRate; internalCostPrice?: number | null; isEvotorCostExportEnabled?: boolean; markingCategory: InventoryMarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: number | null; alcoholVolumeLiters?: number | null; manualBarcodes?: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  if (input.internalCostPrice !== undefined && input.internalCostPrice !== null && (!Number.isFinite(input.internalCostPrice) || input.internalCostPrice < 0)) throw new Error("Внутренняя себестоимость должна быть неотрицательным числом.");
  if (input.alcoholStrengthPercent !== undefined && input.alcoholStrengthPercent !== null && (!Number.isFinite(input.alcoholStrengthPercent) || input.alcoholStrengthPercent < 0 || input.alcoholStrengthPercent > 100)) throw new Error("Крепость должна быть числом от 0 до 100%.");
  const isAlcohol = input.markingCategory === "alcohol" || input.markingCategory === "beer_marked";
  const alcoholTypeCode = normalizeAlcoholProductKindCode(input.alcoholTypeCode, isAlcohol);
  const category = await requireActiveCatalogCategory(input.catalogCategoryId);
  await db.update(operationalCatalogProducts).set({ canonicalName, metadataSource: "manual", evotorCategoryName: input.evotorCategoryName === undefined ? before.evotorCategoryName : normalizedText(input.evotorCategoryName ?? "").slice(0, 512) || null, catalogCategoryId: input.catalogCategoryId === undefined ? before.catalogCategoryId : category?.id ?? null, baseUnit: input.baseUnit, vatRate: input.vatRate, internalCostPrice: input.internalCostPrice === undefined ? before.internalCostPrice : input.internalCostPrice === null ? null : input.internalCostPrice.toFixed(2), isEvotorCostExportEnabled: input.isEvotorCostExportEnabled ?? before.isEvotorCostExportEnabled, markingCategory: input.markingCategory, alcoholCode: isAlcohol ? normalizedText(input.alcoholCode ?? "").slice(0, 255) || null : null, alcoholTypeCode, alcoholStrengthPercent: isAlcohol && input.alcoholStrengthPercent !== null && input.alcoholStrengthPercent !== undefined ? input.alcoholStrengthPercent.toFixed(2) : null, alcoholVolumeLiters: isAlcohol && input.alcoholVolumeLiters !== null && input.alcoholVolumeLiters !== undefined ? input.alcoholVolumeLiters.toFixed(3) : null, manualBarcodes: normalizedManualBarcodes(input.manualBarcodes), isVisibleInRequests: input.isVisibleInRequests, isEvotorExportEnabled: input.isEvotorExportEnabled }).where(eq(operationalCatalogProducts.id, input.id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  return { before, after: after! };
}

/**
 * Marks a bounded selection of shared products for the future outbound queue.
 * This is a local configuration action: it neither calls Evotor nor changes an
 * external product before an administrator sees a store-and-payload preview.
 */
export async function setOperationalCatalogEvotorExportEnabled(input: { productIds: number[]; isEvotorExportEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const productIds = Array.from(new Set(input.productIds.filter(Number.isInteger))).filter(id => id > 0);
  if (!productIds.length) throw new Error("Выберите хотя бы один товар.");
  if (productIds.length > 2_000) throw new Error("За один раз можно настроить не более 2 000 товаров.");
  const before = await db.select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName, isEvotorExportEnabled: operationalCatalogProducts.isEvotorExportEnabled })
    .from(operationalCatalogProducts)
    .where(inArray(operationalCatalogProducts.id, productIds));
  if (before.length !== productIds.length) throw new Error("Часть выбранных товаров не найдена.");
  await db.update(operationalCatalogProducts)
    .set({ isEvotorExportEnabled: input.isEvotorExportEnabled })
    .where(inArray(operationalCatalogProducts.id, productIds));
  return {
    changed: before.filter(row => row.isEvotorExportEnabled !== input.isEvotorExportEnabled).length,
    productCount: before.length,
    isEvotorExportEnabled: input.isEvotorExportEnabled,
    productNames: before.slice(0, 25).map(row => row.canonicalName),
  };
}

/** Archive instead of deleting: historic counted lines and audit records remain reproducible. */
export async function archiveOperationalCatalogProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  await db.update(operationalCatalogProducts).set({ isActive: false }).where(eq(operationalCatalogProducts.id, id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id)).limit(1);
  return { before, after: after! };
}

/** Restores a previously archived record without altering its history or prices. */
export async function restoreOperationalCatalogProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  await db.update(operationalCatalogProducts).set({ isActive: true }).where(eq(operationalCatalogProducts.id, id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id)).limit(1);
  return { before, after: after! };
}

/** Permanent removal is legal only when it cannot erase operational history. */
export async function permanentlyDeleteUnusedOperationalCatalogProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id)).limit(1);
  if (!product) throw new Error("Позиция рабочего справочника не найдена.");
  if (product.isActive) throw new Error("Сначала удалите товар из активной номенклатуры. Окончательное удаление доступно только для архивной позиции.");
  const count = async (table: any) => {
    const [row] = await db.select({ total: sql<number>`count(*)` }).from(table).where(eq(table.productId, id));
    return Number(row?.total ?? 0);
  };
  const checks = await Promise.all([
    count(operationalInventoryLines), count(operationalStockMovements), count(operationalStockTransferLines), count(operationalStoreRequestLines),
    count(operationalOnecProductLinks), count(operationalOnecPurchaseCosts), count(operationalOnecWarehouseSnapshots), count(operationalOnecShipmentLines), count(operationalOnecShipmentReceiptLines),
    count(operationalEvotorProductLinks), count(operationalEvotorOutboundJobs),
  ]);
  if (checks.some(Boolean)) throw new Error("Товар уже участвует в пересчёте, движении, заявке, импорте или обмене Эвотор. Он сохранён в архиве, потому что безвозвратное удаление разрушило бы историю.");
  await db.delete(operationalProductSalePrices).where(eq(operationalProductSalePrices.productId, id));
  await db.delete(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, id));
  return { id, catalogNumber: product.catalogNumber, canonicalName: product.canonicalName };
}

export async function listOperationalPriceTypes(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationalPriceTypes).where(includeInactive ? undefined : eq(operationalPriceTypes.isActive, true)).orderBy(desc(operationalPriceTypes.isDefault), operationalPriceTypes.name).limit(100);
}

export async function listOperationalPrintGroups(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationalPrintGroups).where(includeInactive ? undefined : eq(operationalPrintGroups.isActive, true)).orderBy(operationalPrintGroups.name).limit(100);
}

const supportedOnecWarehouseCodes = new Set(["BM", "SRS"]);

/** Lists only the two declared 1С warehouses and their explicit operating-group mapping. */
export async function listOperationalOnecWarehouseGroupMappings() {
  const db = await getDb();
  if (!db) return [];
  const mappings = await db.select({ warehouseCode: operationalOnecWarehouseGroupMappings.warehouseCode, printGroupId: operationalOnecWarehouseGroupMappings.printGroupId, printGroupName: operationalPrintGroups.name })
    .from(operationalOnecWarehouseGroupMappings)
    .innerJoin(operationalPrintGroups, eq(operationalOnecWarehouseGroupMappings.printGroupId, operationalPrintGroups.id));
  const byCode = new Map(mappings.map(mapping => [mapping.warehouseCode, mapping]));
  return ["BM", "SRS"].map(warehouseCode => ({ warehouseCode, printGroupId: byCode.get(warehouseCode)?.printGroupId ?? null, printGroupName: byCode.get(warehouseCode)?.printGroupName ?? null }));
}

/** Changing a source mapping is configuration only; it never moves stock or alters documents. */
export async function setOperationalOnecWarehouseGroupMapping(input: { warehouseCode: string; printGroupId: number | null; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const warehouseCode = normalizedText(input.warehouseCode).toUpperCase();
  if (!supportedOnecWarehouseCodes.has(warehouseCode)) throw new Error("Для связи доступны только склады 1С БМ и СРС.");
  const [before] = await db.select().from(operationalOnecWarehouseGroupMappings).where(eq(operationalOnecWarehouseGroupMappings.warehouseCode, warehouseCode)).limit(1);
  if (input.printGroupId === null) {
    if (before) await db.delete(operationalOnecWarehouseGroupMappings).where(eq(operationalOnecWarehouseGroupMappings.warehouseCode, warehouseCode));
    return { before: before ?? null, after: null };
  }
  const [group] = await db.select({ id: operationalPrintGroups.id, isActive: operationalPrintGroups.isActive }).from(operationalPrintGroups).where(eq(operationalPrintGroups.id, input.printGroupId)).limit(1);
  if (!group || !group.isActive) throw new Error("Выберите активную группу магазинов.");
  if (before) await db.update(operationalOnecWarehouseGroupMappings).set({ printGroupId: input.printGroupId, mappedByAccountId: input.actorId }).where(eq(operationalOnecWarehouseGroupMappings.id, before.id));
  else await db.insert(operationalOnecWarehouseGroupMappings).values({ warehouseCode, printGroupId: input.printGroupId, mappedByAccountId: input.actorId });
  const [after] = await db.select().from(operationalOnecWarehouseGroupMappings).where(eq(operationalOnecWarehouseGroupMappings.warehouseCode, warehouseCode)).limit(1);
  return { before: before ?? null, after: after! };
}

export type RequestPrintZebraMode = "none" | "rows" | "columns";
export type RequestPrintTypography = {
  headingFontSize: number;
  bodyFontSize: number;
  totalFontSize: number;
  headingBold: boolean;
  bodyBold: boolean;
  totalBold: boolean;
};
export type RequestPrintRecommendationSettings = {
  showStoreQuantity: boolean;
  showAverageDailySales: boolean;
  showSalesCover: boolean;
  showOverstockSignal: boolean;
  recommendationFontSize: number;
  recommendationTone: "muted" | "dark";
};
const requestPrintTypographyDefaults: RequestPrintTypography = {
  headingFontSize: 10,
  bodyFontSize: 9,
  totalFontSize: 9,
  headingBold: true,
  bodyBold: false,
  totalBold: true,
};
const requestPrintRecommendationDefaults: RequestPrintRecommendationSettings = {
  showStoreQuantity: true,
  showAverageDailySales: true,
  showSalesCover: true,
  showOverstockSignal: true,
  recommendationFontSize: 7,
  recommendationTone: "muted",
};
const validRequestPrintFontSize = (value: number) => Number.isInteger(value) && value >= 7 && value <= 14;
const validRequestPrintRecommendationFontSize = (value: number) => Number.isInteger(value) && value >= 6 && value <= 10;

/** The singleton deliberately defaults to blank paper until an admin chooses a neutral zebra. */
export async function getOperationalRequestPrintSettings() {
  const db = await getDb();
  if (!db) return { zebraMode: "none" as const, ...requestPrintTypographyDefaults, ...requestPrintRecommendationDefaults };
  const [settings] = await db.select().from(operationalRequestPrintSettings)
    .orderBy(desc(operationalRequestPrintSettings.id)).limit(1);
  return settings ?? { zebraMode: "none" as const, ...requestPrintTypographyDefaults, ...requestPrintRecommendationDefaults };
}

export async function updateOperationalRequestPrintSettings(input: { zebraMode: RequestPrintZebraMode; actorId: number } & RequestPrintTypography & RequestPrintRecommendationSettings) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (![input.headingFontSize, input.bodyFontSize, input.totalFontSize].every(validRequestPrintFontSize)) throw new Error("Размер шрифта печати должен быть целым числом от 7 до 14 пунктов.");
  if (!validRequestPrintRecommendationFontSize(input.recommendationFontSize)) throw new Error("Размер данных под товаром должен быть целым числом от 6 до 10 пунктов.");
  const [before] = await db.select().from(operationalRequestPrintSettings)
    .orderBy(desc(operationalRequestPrintSettings.id)).limit(1);
  const settings = {
    zebraMode: input.zebraMode,
    headingFontSize: input.headingFontSize,
    bodyFontSize: input.bodyFontSize,
    totalFontSize: input.totalFontSize,
    headingBold: input.headingBold,
    bodyBold: input.bodyBold,
    totalBold: input.totalBold,
    showStoreQuantity: input.showStoreQuantity,
    showAverageDailySales: input.showAverageDailySales,
    showSalesCover: input.showSalesCover,
    showOverstockSignal: input.showOverstockSignal,
    recommendationFontSize: input.recommendationFontSize,
    recommendationTone: input.recommendationTone,
    updatedByAccountId: input.actorId,
  };
  if (before) {
    await db.update(operationalRequestPrintSettings)
      .set(settings)
      .where(eq(operationalRequestPrintSettings.id, before.id));
  } else {
    await db.insert(operationalRequestPrintSettings).values(settings);
  }
  const [after] = await db.select().from(operationalRequestPrintSettings)
    .orderBy(desc(operationalRequestPrintSettings.id)).limit(1);
  return { before: before ?? null, after: after! };
}

export async function createOperationalPrintGroup(input: { name: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const name = normalizedText(input.name);
  if (!name) throw new Error("Укажите название группы печати.");
  const normalizedName = normalizedKey(name);
  const [existing] = await db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.normalizedName, normalizedName)).limit(1);
  if (existing) throw new Error("Такая группа печати уже существует.");
  await db.insert(operationalPrintGroups).values({ name, normalizedName, isActive: true });
  const [after] = await db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.normalizedName, normalizedName)).limit(1);
  return after!;
}

export async function updateOperationalPrintGroup(input: { id: number; name: string; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.id, input.id)).limit(1);
  if (!before) throw new Error("Группа печати не найдена.");
  const name = normalizedText(input.name);
  const normalizedName = normalizedKey(name);
  if (!name) throw new Error("Укажите название группы печати.");
  const [sameName] = await db.select().from(operationalPrintGroups).where(and(eq(operationalPrintGroups.normalizedName, normalizedName), ne(operationalPrintGroups.id, input.id))).limit(1);
  if (sameName) throw new Error("Такая группа печати уже существует.");
  await db.update(operationalPrintGroups).set({ name, normalizedName, isActive: input.isActive }).where(eq(operationalPrintGroups.id, input.id));
  const [after] = await db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.id, input.id)).limit(1);
  return { before, after: after! };
}

/** Deleting a configuration-only group first detaches warehouses; goods, prices, documents and print history remain intact. */
export async function deleteOperationalPrintGroup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPrintGroups).where(eq(operationalPrintGroups.id, id)).limit(1);
  if (!before) throw new Error("Группа печати не найдена.");
  const assignments = await db.select({ storeId: operationalWarehouseSettings.storeId }).from(operationalWarehouseSettings).where(eq(operationalWarehouseSettings.printGroupId, id));
  await db.transaction(async tx => {
    await tx.update(operationalWarehouseSettings).set({ printGroupId: null }).where(eq(operationalWarehouseSettings.printGroupId, id));
    await tx.delete(operationalPrintGroups).where(eq(operationalPrintGroups.id, id));
  });
  return { before, detachedWarehouses: assignments.length };
}

export async function listOperationalCatalogCategories(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationalCatalogCategories)
    .where(includeInactive ? undefined : eq(operationalCatalogCategories.isActive, true))
    .orderBy(operationalCatalogCategories.name)
    .limit(2_000);
}

/** Compatibility projection for older controls; managed categories always take priority. */
export async function listOperationalCatalogCategoryNames() {
  const [categories, legacyRows] = await Promise.all([
    listOperationalCatalogCategories(),
    (async () => {
      const db = await getDb();
      if (!db) return [] as Array<{ category: string | null }>;
      return db.select({ category: operationalCatalogProducts.evotorCategoryName }).from(operationalCatalogProducts)
        .where(and(eq(operationalCatalogProducts.isActive, true), isNotNull(operationalCatalogProducts.evotorCategoryName)))
        .limit(20_000);
    })(),
  ]);
  return Array.from(new Set([
    ...categories.map(category => category.name),
    ...legacyRows.map(row => row.category).filter((category): category is string => Boolean(category)),
  ])).sort((left, right) => left.localeCompare(right, "ru"));
}

async function requireActiveCatalogCategory(categoryId: number | null | undefined) {
  if (categoryId === null || categoryId === undefined) return null;
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [category] = await db.select().from(operationalCatalogCategories)
    .where(eq(operationalCatalogCategories.id, categoryId)).limit(1);
  if (!category || !category.isActive) throw new Error("Выберите активную категорию номенклатуры.");
  return category;
}

/**
 * Remote product groups are the source for ordinary catalog categories.
 * A deliberate local archive wins: a remote refresh never reactivates it.
 */
async function ensureCatalogCategoriesFromEvotor(names: Array<string | null | undefined>, actorId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const uniqueNames = Array.from(new Set(names.map(name => normalizedText(name ?? "")).filter(Boolean))).sort((left, right) => left.localeCompare(right, "ru"));
  if (!uniqueNames.length) return new Map<string, number>();
  const existing = await db.select({ id: operationalCatalogCategories.id, normalizedName: operationalCatalogCategories.normalizedName, isActive: operationalCatalogCategories.isActive })
    .from(operationalCatalogCategories)
    .where(inArray(operationalCatalogCategories.normalizedName, uniqueNames.map(normalizedKey)));
  const activeByNormalizedName = new Map(existing.filter(category => category.isActive).map(category => [category.normalizedName, category.id]));
  for (const name of uniqueNames) {
    const normalizedName = normalizedKey(name);
    if (activeByNormalizedName.has(normalizedName) || existing.some(category => category.normalizedName === normalizedName) || actorId === null) continue;
    const [inserted] = await db.insert(operationalCatalogCategories).values({ name, normalizedName, createdByAccountId: actorId }).$returningId();
    activeByNormalizedName.set(normalizedName, inserted.id);
  }
  return activeByNormalizedName;
}

export async function createOperationalCatalogCategory(input: { name: string; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const name = normalizedText(input.name);
  const normalizedName = normalizedKey(name);
  if (!name || name.length > 512) throw new Error("Укажите название категории до 512 символов.");
  const [existing] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.normalizedName, normalizedName)).limit(1);
  if (existing) throw new Error("Такая категория уже существует.");
  const [inserted] = await db.insert(operationalCatalogCategories).values({ name, normalizedName, createdByAccountId: input.actorId }).$returningId();
  const [after] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, inserted.id)).limit(1);
  return after!;
}

export async function updateOperationalCatalogCategory(input: { id: number; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, input.id)).limit(1);
  if (!before) throw new Error("Категория номенклатуры не найдена.");
  const name = normalizedText(input.name);
  const normalizedName = normalizedKey(name);
  if (!name || name.length > 512) throw new Error("Укажите название категории до 512 символов.");
  const [sameName] = await db.select({ id: operationalCatalogCategories.id }).from(operationalCatalogCategories)
    .where(and(eq(operationalCatalogCategories.normalizedName, normalizedName), ne(operationalCatalogCategories.id, input.id))).limit(1);
  if (sameName) throw new Error("Такая категория уже существует.");
  await db.update(operationalCatalogCategories).set({ name, normalizedName }).where(eq(operationalCatalogCategories.id, input.id));
  const [after] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, input.id)).limit(1);
  return { before, after: after! };
}

/** Archive a local category without deleting products, history or the remote source label. */
export async function archiveOperationalCatalogCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, id)).limit(1);
  if (!before) throw new Error("Категория номенклатуры не найдена.");
  if (!before.isActive) return { before, after: before, detachedProducts: 0, detachedPrintMembers: 0 };
  const [products, printMembers] = await Promise.all([
    db.select({ id: operationalCatalogProducts.id }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.catalogCategoryId, id)),
    db.select({ id: operationalPrintCategoryGroupMembers.id }).from(operationalPrintCategoryGroupMembers).where(eq(operationalPrintCategoryGroupMembers.catalogCategoryId, id)),
  ]);
  await db.transaction(async tx => {
    await tx.update(operationalCatalogProducts).set({ catalogCategoryId: null }).where(eq(operationalCatalogProducts.catalogCategoryId, id));
    await tx.delete(operationalPrintCategoryGroupMembers).where(eq(operationalPrintCategoryGroupMembers.catalogCategoryId, id));
    await tx.update(operationalCatalogCategories).set({ isActive: false }).where(eq(operationalCatalogCategories.id, id));
  });
  const [after] = await db.select().from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, id)).limit(1);
  return { before, after: after!, detachedProducts: products.length, detachedPrintMembers: printMembers.length };
}

export async function listOperationalPrintCategoryGroups() {
  const db = await getDb();
  if (!db) return [];
  const [groups, members, categories] = await Promise.all([
    db.select().from(operationalPrintCategoryGroups).orderBy(operationalPrintCategoryGroups.name).limit(200),
    db.select().from(operationalPrintCategoryGroupMembers).orderBy(operationalPrintCategoryGroupMembers.sortOrder, operationalPrintCategoryGroupMembers.id).limit(2_000),
    db.select({ id: operationalCatalogCategories.id, name: operationalCatalogCategories.name }).from(operationalCatalogCategories).limit(2_000),
  ]);
  const names = new Map(groups.map(group => [group.id, group.name]));
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  return groups.map(group => ({ ...group, members: members.filter(member => member.groupId === group.id).map(member => ({ id: member.id, memberType: member.memberType, catalogCategoryId: member.catalogCategoryId, catalogCategory: member.catalogCategoryId ? categoryNames.get(member.catalogCategoryId) ?? member.catalogCategory : member.catalogCategory, childGroupId: member.childGroupId, childGroupName: member.childGroupId ? names.get(member.childGroupId) ?? null : null })) }));
}

function normalizeMaxStoreCoverDays(value: number | undefined) {
  const days = value ?? 2;
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error("Норму запаса задайте целым числом от 1 до 14 дней.");
  return days;
}

export async function createOperationalPrintCategoryGroup(input: { name: string; actorId: number; printMode?: PrintCategoryMode; supplyPrintGroupId?: number | null; requestCommentSlot?: "slot_1" | "slot_2" | null; maxStoreCoverDays?: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const name = normalizedText(input.name);
  if (!name) throw new Error("Укажите название категории печати.");
  const normalizedName = normalizedKey(name);
  const [existing] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.normalizedName, normalizedName)).limit(1);
  if (existing) throw new Error("Такая категория печати уже существует.");
  if (input.requestCommentSlot) {
    const [slotAlreadyUsed] = await db.select({ id: operationalPrintCategoryGroups.id }).from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.requestCommentSlot, input.requestCommentSlot)).limit(1);
    if (slotAlreadyUsed) throw new Error("Этот комментарий уже назначен другой категории печати.");
  }
  await db.insert(operationalPrintCategoryGroups).values({ name, normalizedName, printMode: input.printMode ?? "per_store", supplyPrintGroupId: input.supplyPrintGroupId ?? null, requestCommentSlot: input.requestCommentSlot ?? null, maxStoreCoverDays: normalizeMaxStoreCoverDays(input.maxStoreCoverDays), createdByAccountId: input.actorId });
  const [after] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.normalizedName, normalizedName)).limit(1);
  return after!;
}

/** Print-category groups are user-managed configuration, separate from immutable order history. */
export async function updateOperationalPrintCategoryGroup(input: { id: number; name: string; printMode: PrintCategoryMode; supplyPrintGroupId: number | null; requestCommentSlot: "slot_1" | "slot_2" | null; maxStoreCoverDays: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.id)).limit(1);
  if (!before) throw new Error("Категория печати не найдена.");
  const name = normalizedText(input.name);
  if (!name) throw new Error("Укажите название категории печати.");
  const normalizedName = normalizedKey(name);
  const [sameName] = await db.select().from(operationalPrintCategoryGroups).where(and(eq(operationalPrintCategoryGroups.normalizedName, normalizedName), ne(operationalPrintCategoryGroups.id, input.id))).limit(1);
  if (sameName) throw new Error("Такая категория печати уже существует.");
  if (input.requestCommentSlot) {
    const [slotAlreadyUsed] = await db.select({ id: operationalPrintCategoryGroups.id }).from(operationalPrintCategoryGroups).where(and(eq(operationalPrintCategoryGroups.requestCommentSlot, input.requestCommentSlot), ne(operationalPrintCategoryGroups.id, input.id))).limit(1);
    if (slotAlreadyUsed) throw new Error("Этот комментарий уже назначен другой категории печати.");
  }
  await db.update(operationalPrintCategoryGroups).set({ name, normalizedName, printMode: input.printMode, supplyPrintGroupId: input.supplyPrintGroupId, requestCommentSlot: input.requestCommentSlot, maxStoreCoverDays: normalizeMaxStoreCoverDays(input.maxStoreCoverDays) }).where(eq(operationalPrintCategoryGroups.id, input.id));
  const [after] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.id)).limit(1);
  return { before, after: after! };
}

/** Assigns the two request-comment slots in one independent print-settings control. */
export async function setOperationalRequestCommentCategory(input: { slot: "slot_1" | "slot_2"; categoryGroupId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await db.select({ id: operationalPrintCategoryGroups.id, name: operationalPrintCategoryGroups.name, requestCommentSlot: operationalPrintCategoryGroups.requestCommentSlot })
    .from(operationalPrintCategoryGroups)
    .where(eq(operationalPrintCategoryGroups.requestCommentSlot, input.slot))
    .limit(1);
  if (input.categoryGroupId !== null) {
    const [target] = await db.select({ id: operationalPrintCategoryGroups.id, isActive: operationalPrintCategoryGroups.isActive })
      .from(operationalPrintCategoryGroups)
      .where(eq(operationalPrintCategoryGroups.id, input.categoryGroupId))
      .limit(1);
    if (!target || !target.isActive) throw new Error("Выберите активную категорию печати для комментария.");
  }
  await db.update(operationalPrintCategoryGroups)
    .set({ requestCommentSlot: null })
    .where(eq(operationalPrintCategoryGroups.requestCommentSlot, input.slot));
  if (input.categoryGroupId !== null) {
    await db.update(operationalPrintCategoryGroups)
      .set({ requestCommentSlot: input.slot })
      .where(eq(operationalPrintCategoryGroups.id, input.categoryGroupId));
  }
  const after = await db.select({ id: operationalPrintCategoryGroups.id, name: operationalPrintCategoryGroups.name, requestCommentSlot: operationalPrintCategoryGroups.requestCommentSlot })
    .from(operationalPrintCategoryGroups)
    .where(eq(operationalPrintCategoryGroups.requestCommentSlot, input.slot))
    .limit(1);
  return { before: before[0] ?? null, after: after[0] ?? null };
}

/** Deleting a configuration group detaches its membership from all parents, never touches goods or documents. */
export async function deleteOperationalPrintCategoryGroup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, id)).limit(1);
  if (!before) throw new Error("Категория печати не найдена.");
  const members = await db.select({ id: operationalPrintCategoryGroupMembers.id }).from(operationalPrintCategoryGroupMembers).where(or(eq(operationalPrintCategoryGroupMembers.groupId, id), eq(operationalPrintCategoryGroupMembers.childGroupId, id))).limit(2_000);
  if (members.length) await db.delete(operationalPrintCategoryGroupMembers).where(or(eq(operationalPrintCategoryGroupMembers.groupId, id), eq(operationalPrintCategoryGroupMembers.childGroupId, id)));
  await db.delete(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, id));
  return { before, detachedMembers: members.length };
}

export async function setOperationalPrintCategoryGroupMember(input: { groupId: number; memberType: "catalog_category" | "category_group"; catalogCategoryId?: number; catalogCategory?: string; childGroupId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [group] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.groupId)).limit(1);
  if (!group) throw new Error("Категория печати не найдена.");
  if (input.memberType === "catalog_category") {
    const managedCategory = input.catalogCategoryId ? await requireActiveCatalogCategory(input.catalogCategoryId) : null;
    const catalogCategory = managedCategory?.name ?? normalizedText(input.catalogCategory ?? "");
    if (!catalogCategory) throw new Error("Выберите категорию номенклатуры.");
    const [existing] = await db.select().from(operationalPrintCategoryGroupMembers).where(and(
      eq(operationalPrintCategoryGroupMembers.groupId, input.groupId),
      eq(operationalPrintCategoryGroupMembers.memberType, "catalog_category"),
      managedCategory ? eq(operationalPrintCategoryGroupMembers.catalogCategoryId, managedCategory.id) : eq(operationalPrintCategoryGroupMembers.catalogCategory, catalogCategory),
    )).limit(1);
    if (existing) return { created: false, member: existing };
    await db.insert(operationalPrintCategoryGroupMembers).values({ groupId: input.groupId, memberType: "catalog_category", catalogCategoryId: managedCategory?.id ?? null, catalogCategory, sortOrder: 0 });
  } else {
    if (!input.childGroupId || input.childGroupId === input.groupId) throw new Error("Выберите другую категорию печати.");
    const links = await db.select({ groupId: operationalPrintCategoryGroupMembers.groupId, childGroupId: operationalPrintCategoryGroupMembers.childGroupId }).from(operationalPrintCategoryGroupMembers).where(eq(operationalPrintCategoryGroupMembers.memberType, "category_group")).limit(2_000);
    const descendants = new Set<number>();
    const stack = [input.childGroupId];
    while (stack.length) {
      const current = stack.pop()!;
      if (descendants.has(current)) continue;
      descendants.add(current);
      for (const link of links) if (link.groupId === current && link.childGroupId) stack.push(link.childGroupId);
    }
    if (descendants.has(input.groupId)) throw new Error("Нельзя создать циклическое включение категорий печати.");
    const [existing] = await db.select().from(operationalPrintCategoryGroupMembers).where(and(eq(operationalPrintCategoryGroupMembers.groupId, input.groupId), eq(operationalPrintCategoryGroupMembers.memberType, "category_group"), eq(operationalPrintCategoryGroupMembers.childGroupId, input.childGroupId))).limit(1);
    if (existing) return { created: false, member: existing };
    await db.insert(operationalPrintCategoryGroupMembers).values({ groupId: input.groupId, memberType: "category_group", childGroupId: input.childGroupId, sortOrder: 0 });
  }
  const [member] = await db.select().from(operationalPrintCategoryGroupMembers).where(eq(operationalPrintCategoryGroupMembers.groupId, input.groupId)).orderBy(desc(operationalPrintCategoryGroupMembers.id)).limit(1);
  return { created: true, member: member! };
}

export async function removeOperationalPrintCategoryGroupMember(input: { groupId: number; memberId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [member] = await db.select().from(operationalPrintCategoryGroupMembers).where(and(eq(operationalPrintCategoryGroupMembers.id, input.memberId), eq(operationalPrintCategoryGroupMembers.groupId, input.groupId))).limit(1);
  if (!member) throw new Error("Связь категории печати не найдена.");
  await db.delete(operationalPrintCategoryGroupMembers).where(eq(operationalPrintCategoryGroupMembers.id, member.id));
  return member;
}

export async function setOperationalWarehousePrintGroup(input: { storeId: number; printGroupId: number | null; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [store] = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!store || store.isHidden) throw new Error("Рабочий склад не найден.");
  if (input.printGroupId) {
    const [group] = await db.select({ id: operationalPrintGroups.id, isActive: operationalPrintGroups.isActive }).from(operationalPrintGroups).where(eq(operationalPrintGroups.id, input.printGroupId)).limit(1);
    if (!group || !group.isActive) throw new Error("Активная группа печати не найдена.");
  }
  const [before] = await db.select().from(operationalWarehouseSettings).where(eq(operationalWarehouseSettings.storeId, input.storeId)).limit(1);
  if (before) await db.update(operationalWarehouseSettings).set({ printGroupId: input.printGroupId }).where(eq(operationalWarehouseSettings.id, before.id));
  else await db.insert(operationalWarehouseSettings).values({ storeId: input.storeId, printGroupId: input.printGroupId, createdByAccountId: input.actorId });
  const [after] = await db.select().from(operationalWarehouseSettings).where(eq(operationalWarehouseSettings.storeId, input.storeId)).limit(1);
  return { before: before ?? null, after: after!, store };
}

/** Visibility controls whether an operational point participates in ordinary selectors and print projections. */
export async function setOperationalWarehouseVisibility(input: { storeId: number; isHidden: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!before) throw new Error("Рабочий склад не найден.");
  if (before.isHidden === input.isHidden) return { before, after: before, unchanged: true };
  await db.update(stores).set({ isHidden: input.isHidden }).where(eq(stores.id, input.storeId));
  const [after] = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  return { before, after: after!, unchanged: false };
}

export async function listOperationalSalePrices(priceTypeId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ productId: operationalProductSalePrices.productId, priceTypeId: operationalProductSalePrices.priceTypeId, salePrice: operationalProductSalePrices.salePrice, updatedAt: operationalProductSalePrices.updatedAt })
    .from(operationalProductSalePrices)
    .where(priceTypeId ? eq(operationalProductSalePrices.priceTypeId, priceTypeId) : undefined)
    .orderBy(operationalProductSalePrices.productId)
    .limit(20_000);
}

export async function createOperationalPriceType(input: { name: string; isDefault?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const name = normalizedText(input.name);
  const normalizedName = normalizedKey(name);
  if (!name || name.length > 128) throw new Error("Укажите название вида цены до 128 символов.");
  const existing = await db.select({ id: operationalPriceTypes.id }).from(operationalPriceTypes).where(eq(operationalPriceTypes.normalizedName, normalizedName)).limit(1);
  if (existing.length) throw new Error("Такой вид цены уже существует.");
  if (input.isDefault) await db.update(operationalPriceTypes).set({ isDefault: false }).where(eq(operationalPriceTypes.isDefault, true));
  const [inserted] = await db.insert(operationalPriceTypes).values({ name, normalizedName, isDefault: Boolean(input.isDefault), isActive: true }).$returningId();
  const [after] = await db.select().from(operationalPriceTypes).where(eq(operationalPriceTypes.id, inserted.id)).limit(1);
  return after!;
}

export async function updateOperationalPriceType(input: { id: number; name: string; isDefault: boolean; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPriceTypes).where(eq(operationalPriceTypes.id, input.id)).limit(1);
  if (!before) throw new Error("Вид цены не найден.");
  const name = normalizedText(input.name);
  const normalizedName = normalizedKey(name);
  if (!name || name.length > 128) throw new Error("Укажите название вида цены до 128 символов.");
  const duplicate = await db.select({ id: operationalPriceTypes.id }).from(operationalPriceTypes).where(eq(operationalPriceTypes.normalizedName, normalizedName)).limit(1);
  if (duplicate.length && duplicate[0].id !== input.id) throw new Error("Такой вид цены уже существует.");
  if (before.isDefault && (!input.isDefault || !input.isActive)) throw new Error("Сначала назначьте другой активный вид цены основным.");
  if (input.isDefault) await db.update(operationalPriceTypes).set({ isDefault: false }).where(eq(operationalPriceTypes.isDefault, true));
  await db.update(operationalPriceTypes).set({ name, normalizedName, isDefault: input.isDefault, isActive: input.isActive }).where(eq(operationalPriceTypes.id, input.id));
  const [after] = await db.select().from(operationalPriceTypes).where(eq(operationalPriceTypes.id, input.id)).limit(1);
  return { before, after: after! };
}

/** Deletion is allowed only for an unused, non-default price type; history and assignment stay protected. */
export async function deleteOperationalPriceType(id: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPriceTypes).where(eq(operationalPriceTypes.id, id)).limit(1);
  if (!before) throw new Error("Вид цены не найден.");
  if (before.isDefault) throw new Error("Основной вид цены нельзя удалить.");
  const [assignment] = await db.select({ id: operationalStorePriceTypes.id }).from(operationalStorePriceTypes).where(eq(operationalStorePriceTypes.priceTypeId, id)).limit(1);
  const [price] = await db.select({ id: operationalProductSalePrices.id }).from(operationalProductSalePrices).where(eq(operationalProductSalePrices.priceTypeId, id)).limit(1);
  if (assignment || price) throw new Error("Вид цены уже используется магазином или товаром; сначала переназначьте или удалите цены.");
  await db.delete(operationalPriceTypes).where(eq(operationalPriceTypes.id, id));
  return { before };
}

export async function setOperationalStorePriceType(input: { storeId: number; priceTypeId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalStorePriceTypes).where(eq(operationalStorePriceTypes.storeId, input.storeId)).limit(1);
  const [priceType] = await db.select().from(operationalPriceTypes).where(and(eq(operationalPriceTypes.id, input.priceTypeId), eq(operationalPriceTypes.isActive, true))).limit(1);
  if (!priceType) throw new Error("Выберите активный вид цены.");
  if (before) await db.update(operationalStorePriceTypes).set({ priceTypeId: input.priceTypeId, assignedByAccountId: input.actorId }).where(eq(operationalStorePriceTypes.id, before.id));
  else await db.insert(operationalStorePriceTypes).values({ storeId: input.storeId, priceTypeId: input.priceTypeId, assignedByAccountId: input.actorId });
  const [after] = await db.select().from(operationalStorePriceTypes).where(eq(operationalStorePriceTypes.storeId, input.storeId)).limit(1);
  return { before: before ?? null, after: after! };
}

export async function setOperationalProductSalePrice(input: { productId: number; priceTypeId: number; salePrice: number | null; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.productId)).limit(1);
  const [priceType] = await db.select({ id: operationalPriceTypes.id, name: operationalPriceTypes.name, isActive: operationalPriceTypes.isActive }).from(operationalPriceTypes).where(eq(operationalPriceTypes.id, input.priceTypeId)).limit(1);
  if (!product || !priceType || !priceType.isActive) throw new Error("Товар или активный вид цены не найден.");
  if (input.salePrice !== null && (!Number.isFinite(input.salePrice) || input.salePrice < 0 || input.salePrice > 10_000_000)) throw new Error("Продажная цена должна быть неотрицательной.");
  const [before] = await db.select().from(operationalProductSalePrices).where(and(eq(operationalProductSalePrices.productId, input.productId), eq(operationalProductSalePrices.priceTypeId, input.priceTypeId))).limit(1);
  if (input.salePrice === null) {
    if (before) await db.delete(operationalProductSalePrices).where(eq(operationalProductSalePrices.id, before.id));
    return { before: before ?? null, after: null, product, priceType };
  }
  if (before) await db.update(operationalProductSalePrices).set({ salePrice: input.salePrice.toFixed(2), updatedByAccountId: input.actorId }).where(eq(operationalProductSalePrices.id, before.id));
  else await db.insert(operationalProductSalePrices).values({ productId: input.productId, priceTypeId: input.priceTypeId, salePrice: input.salePrice.toFixed(2), updatedByAccountId: input.actorId });
  const [after] = await db.select().from(operationalProductSalePrices).where(and(eq(operationalProductSalePrices.productId, input.productId), eq(operationalProductSalePrices.priceTypeId, input.priceTypeId))).limit(1);
  return { before: before ?? null, after: after!, product, priceType };
}

/** The administrator warehouse screen may show the explicitly requested Evotor UID, but never the address. */
export async function listOperationalWarehouses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ storeId: stores.id, storeName: stores.name, isHidden: stores.isHidden, priceTypeId: operationalStorePriceTypes.priceTypeId, priceTypeName: operationalPriceTypes.name, printGroupId: operationalWarehouseSettings.printGroupId, printGroupName: operationalPrintGroups.name, evotorStoreName: operationalStoreMappings.evotorStoreName, evotorTerminalUuid: operationalStoreMappings.evotorTerminalUuid })
    .from(stores)
    .leftJoin(operationalStorePriceTypes, eq(operationalStorePriceTypes.storeId, stores.id))
    .leftJoin(operationalPriceTypes, eq(operationalStorePriceTypes.priceTypeId, operationalPriceTypes.id))
    .leftJoin(operationalWarehouseSettings, eq(operationalWarehouseSettings.storeId, stores.id))
    .leftJoin(operationalPrintGroups, eq(operationalWarehouseSettings.printGroupId, operationalPrintGroups.id))
    .leftJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .orderBy(stores.name)
    .limit(200);
  const links = await db.select({ storeId: operationalEvotorProductLinks.storeId }).from(operationalEvotorProductLinks).limit(20_000);
  const linkCount = new Map<number, number>();
  for (const link of links) linkCount.set(link.storeId, (linkCount.get(link.storeId) ?? 0) + 1);
  return rows.map(row => ({ ...row, evotorLinkedProductCount: linkCount.get(row.storeId) ?? 0, hasEvotorMapping: Boolean(row.evotorStoreName) }));
}

/** Candidate display names are safe for the administrator UI; technical IDs stay server-side until selected. */
export async function listOperationalEvotorStoreChoices() {
  const stores = await listEvotorCatalogStoresPreview();
  return stores.map(store => ({ id: store.id, name: store.name }));
}

/** Establishes one explicit internal-store → Evotor-store mapping. No catalog or external data is changed. */
export async function setOperationalWarehouseEvotorMapping(input: { storeId: number; evotorStoreId: string; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const evotorStore = (await listEvotorCatalogStoresPreview()).find(store => store.id === input.evotorStoreId);
  if (!evotorStore) throw new Error("Выбранный магазин Эвотор больше недоступен.");
  const [before] = await db.select().from(operationalStoreMappings).where(eq(operationalStoreMappings.storeId, input.storeId)).limit(1);
  const next = { evotorStoreName: evotorStore.name, evotorAddress: evotorStore.address ?? "", evotorTerminalUuid: evotorStore.id, configuredByAccountId: input.actorId };
  if (before) await db.update(operationalStoreMappings).set(next).where(eq(operationalStoreMappings.id, before.id));
  else await db.insert(operationalStoreMappings).values({ storeId: input.storeId, ...next });
  return { before: before ? { evotorStoreName: before.evotorStoreName } : null, after: { evotorStoreName: evotorStore.name } };
}

export async function createInventoryDraft(input: { storeId: number; businessDate: string; createdByAccountId: number; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const businessDate = validateInventoryDate(input.businessDate);
  const note = normalizedText(input.note ?? "").slice(0, 1_000) || null;
  const [existing] = await db
    .select()
    .from(operationalInventories)
    .where(and(eq(operationalInventories.storeId, input.storeId), eq(operationalInventories.businessDate, businessDate)))
    .limit(1);
  if (existing) {
    if (existing.status === "closed") throw new Error("Инвентаризация за эту дату уже закрыта и неизменяема");
    return { inventory: existing, created: false };
  }
  const [inserted] = await db
    .insert(operationalInventories)
    .values({ storeId: input.storeId, businessDate, createdByAccountId: input.createdByAccountId, note })
    .$returningId();
  const inventory = await requireInventory(inserted.id);
  return { inventory, created: true };
}

/** A draft has produced no stock movement yet, so it may be removed as one audited action. */
export async function deleteInventoryDraft(inventoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireInventory(inventoryId);
  if (before.status !== "draft") throw new Error("Удалить можно только черновик инвентаризации");
  const lines = await db
    .select({ id: operationalInventoryLines.id })
    .from(operationalInventoryLines)
    .where(eq(operationalInventoryLines.inventoryId, before.id));
  if (lines.length) {
    await db.delete(operationalInventoryLines).where(eq(operationalInventoryLines.inventoryId, before.id));
  }
  await db.delete(operationalInventories).where(eq(operationalInventories.id, before.id));
  return { before: inventoryState(before), lineCount: lines.length };
}

/**
 * Hides an already closed recount from the operating history without touching
 * its immutable lines or the stock movements created at close. This is an
 * archive operation, not a physical delete.
 */
export async function archiveClosedInventory(inventoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireInventory(inventoryId);
  if (before.status !== "closed") throw new Error("Архивировать можно только закрытую инвентаризацию");
  if (before.isArchived) throw new Error("Инвентаризация уже архивирована");
  const [movementCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(operationalStockMovements)
    .where(eq(operationalStockMovements.inventoryId, inventoryId));
  await db.update(operationalInventories)
    .set({ isArchived: true })
    .where(eq(operationalInventories.id, inventoryId));
  const after = await requireInventory(inventoryId);
  return {
    before: inventoryState(before),
    after: inventoryState(after),
    movementCount: Number(movementCount?.count ?? 0),
  };
}

export async function updateInventoryNote(input: { inventoryId: number; note: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireInventory(input.inventoryId);
  if (before.status !== "draft") throw new Error("Закрытую инвентаризацию нельзя изменять");
  const note = normalizedText(input.note).slice(0, 1_000) || null;
  await db.update(operationalInventories).set({ note }).where(eq(operationalInventories.id, before.id));
  return { before: inventoryState(before), after: inventoryState(await requireInventory(before.id)) };
}

export async function upsertInventoryLine(input: { inventoryId: number; productId: number; countedQuantity: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const inventory = await requireInventory(input.inventoryId);
  if (inventory.status !== "draft") throw new Error("Закрытую инвентаризацию нельзя изменять");
  const [product] = await db.select().from(operationalCatalogProducts).where(and(eq(operationalCatalogProducts.id, input.productId), eq(operationalCatalogProducts.isActive, true))).limit(1);
  if (!product) throw new Error("Товар не найден или скрыт из рабочего справочника");
  const unit = inventoryUnitFromCatalogUnit(product.baseUnit);
  const countedQuantity = validateCountedQuantity(input.countedQuantity);
  const [before] = await db
    .select()
    .from(operationalInventoryLines)
    .where(and(eq(operationalInventoryLines.inventoryId, input.inventoryId), eq(operationalInventoryLines.productId, input.productId)))
    .limit(1);
  if (before) {
    await db.update(operationalInventoryLines).set({ countedQuantity: countedQuantity.toFixed(3), unit }).where(eq(operationalInventoryLines.id, before.id));
  } else {
    await db.insert(operationalInventoryLines).values({ inventoryId: input.inventoryId, productId: input.productId, countedQuantity: countedQuantity.toFixed(3), unit });
  }
  const [after] = await db
    .select()
    .from(operationalInventoryLines)
    .where(and(eq(operationalInventoryLines.inventoryId, input.inventoryId), eq(operationalInventoryLines.productId, input.productId)))
    .limit(1);
  if (!after) throw new Error("Не удалось сохранить строку пересчета");
  return {
    inventory,
    product: { id: product.id, internalCode: String(product.catalogNumber), canonicalName: product.canonicalName, unit },
    before: before ? { productId: before.productId, countedQuantity: Number(before.countedQuantity), unit: before.unit } : null,
    after: { productId: after.productId, countedQuantity: Number(after.countedQuantity), unit: after.unit },
  };
}

/** Pre-fills only missing draft rows with known accounting balances; manually entered facts are never overwritten. */
export async function fillInventoryLinesFromAccounting(inventoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const inventory = await requireInventory(inventoryId);
  if (inventory.status !== "draft") throw new Error("Закрытую инвентаризацию нельзя заполнять учетными остатками");
  const [existingRows, products] = await Promise.all([
    db.select({ productId: operationalInventoryLines.productId }).from(operationalInventoryLines).where(eq(operationalInventoryLines.inventoryId, inventoryId)),
    listInventoryProducts({ storeId: inventory.storeId, includeAccounting: true }),
  ]);
  const existingProductIds = new Set(existingRows.map(row => row.productId));
  const rows = products
    .filter(product => product.accountingQuantity !== null && !existingProductIds.has(product.id))
    .map(product => ({ inventoryId, productId: product.id, countedQuantity: product.accountingQuantity!.toFixed(3), unit: inventoryUnitFromCatalogUnit(product.baseUnit) }));
  if (rows.length) await db.insert(operationalInventoryLines).values(rows);
  return { inventory, added: rows.length, preserved: existingRows.length, unavailable: products.length - rows.length - existingRows.length };
}

export async function removeInventoryLine(input: { inventoryId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const inventory = await requireInventory(input.inventoryId);
  if (inventory.status !== "draft") throw new Error("Закрытую инвентаризацию нельзя изменять");
  const [before] = await db
    .select()
    .from(operationalInventoryLines)
    .where(and(eq(operationalInventoryLines.inventoryId, input.inventoryId), eq(operationalInventoryLines.productId, input.productId)))
    .limit(1);
  if (!before) throw new Error("Строка пересчета не найдена");
  await db.delete(operationalInventoryLines).where(eq(operationalInventoryLines.id, before.id));
  return { inventory, before: { productId: before.productId, countedQuantity: Number(before.countedQuantity), unit: before.unit } };
}

export async function getInventoryDetail(inventoryId: number, options?: { includeAccounting?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  const inventory = await requireInventory(inventoryId);
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, inventory.storeId)).limit(1);
  const [creator] = await db.select({ displayName: localAccounts.displayName }).from(localAccounts).where(eq(localAccounts.id, inventory.createdByAccountId)).limit(1);
  const [closer] = inventory.closedByAccountId ? await db.select({ displayName: localAccounts.displayName }).from(localAccounts).where(eq(localAccounts.id, inventory.closedByAccountId)).limit(1) : [undefined];
  const lines = await db
    .select({
      id: operationalInventoryLines.id,
      productId: operationalInventoryLines.productId,
      countedQuantity: operationalInventoryLines.countedQuantity,
      unit: operationalInventoryLines.unit,
      internalCode: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      category: operationalCatalogProducts.evotorCategoryName,
    })
    .from(operationalInventoryLines)
    .innerJoin(operationalCatalogProducts, eq(operationalInventoryLines.productId, operationalCatalogProducts.id))
    .where(eq(operationalInventoryLines.inventoryId, inventoryId))
    .orderBy(operationalCatalogProducts.canonicalName);
  const accountingAtClose = options?.includeAccounting && inventory.status === "closed"
    ? new Map((await db.select({ productId: operationalStockMovements.productId, previousQuantity: operationalStockMovements.previousQuantity }).from(operationalStockMovements).where(eq(operationalStockMovements.inventoryId, inventoryId))).map(movement => [movement.productId, Number(movement.previousQuantity)]))
    : null;
  return {
    ...inventoryState(inventory),
    storeName: store?.name ?? `Магазин #${inventory.storeId}`,
    createdByName: creator?.displayName ?? `Пользователь #${inventory.createdByAccountId}`,
    closedByName: closer?.displayName ?? null,
    lines: lines.map(line => ({ ...line, internalCode: String(line.internalCode), variant: null, countedQuantity: Number(line.countedQuantity), ...(accountingAtClose ? { accountingQuantity: accountingAtClose.get(line.productId) ?? null } : {}) })),
  };
}

export async function listStoreInventories(input: { storeIds?: number[] | null; storeId?: number; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const conditions = [
    input.storeId ? eq(operationalInventories.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalInventories.storeId, input.storeIds) : undefined,
    eq(operationalInventories.isArchived, false),
  ].filter(Boolean);
  const rows = await db
    .select({
      id: operationalInventories.id,
      storeId: operationalInventories.storeId,
      storeName: stores.name,
      businessDate: operationalInventories.businessDate,
      status: operationalInventories.status,
      createdByAccountId: operationalInventories.createdByAccountId,
      createdByName: localAccounts.displayName,
      closedByAccountId: operationalInventories.closedByAccountId,
      closedAt: operationalInventories.closedAt,
      note: operationalInventories.note,
      createdAt: operationalInventories.createdAt,
      updatedAt: operationalInventories.updatedAt,
    })
    .from(operationalInventories)
    .innerJoin(stores, eq(operationalInventories.storeId, stores.id))
    .innerJoin(localAccounts, eq(operationalInventories.createdByAccountId, localAccounts.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(operationalInventories.businessDate), desc(operationalInventories.id))
    .limit(Math.min(Math.max(input.limit ?? 5, 1), 30));
  return rows;
}

/** Close a draft and materialize non-editable stock adjustments. A later closed count protects chronology. */
export async function closeInventory(input: { inventoryId: number; closedByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const before = await requireInventory(input.inventoryId);
  if (before.status !== "draft") throw new Error("Инвентаризация уже закрыта");
  const [laterInventory] = await db
    .select({ id: operationalInventories.id })
    .from(operationalInventories)
    .where(and(eq(operationalInventories.storeId, before.storeId), eq(operationalInventories.status, "closed"), gt(operationalInventories.businessDate, before.businessDate)))
    .limit(1);
  if (laterInventory) throw new Error("Нельзя закрыть инвентаризацию раньше уже закрытого пересчета этой точки");
  const lines = await db.select().from(operationalInventoryLines).where(eq(operationalInventoryLines.inventoryId, before.id));
  if (!lines.length) throw new Error("Добавьте хотя бы одну фактически посчитанную позицию перед закрытием");
  const productIds = lines.map(line => line.productId);
  const [snapshots, localPriorMovements, receiptPriorMovements] = await Promise.all([
    db.select({
      storeId: operationalEvotorProductLinks.storeId,
      productId: operationalEvotorProductLinks.productId,
      quantity: operationalEvotorProductLinks.evotorQuantitySnapshot,
      updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt,
    }).from(operationalEvotorProductLinks).where(and(
      eq(operationalEvotorProductLinks.storeId, before.storeId),
      inArray(operationalEvotorProductLinks.productId, productIds),
    )),
    db.select({
      storeId: operationalStockMovements.storeId,
      productId: operationalStockMovements.productId,
      quantityDelta: operationalStockMovements.quantityDelta,
      createdAt: operationalStockMovements.createdAt,
    }).from(operationalStockMovements).where(and(
      eq(operationalStockMovements.storeId, before.storeId),
      inArray(operationalStockMovements.productId, productIds),
    )),
    listEvotorReceiptStockProjectionMovements({ storeIds: [before.storeId], productIds }),
  ]);
  // The previous fact is the same snapshot-aware balance shown in «Остатки»:
  // a later source snapshot replaces an already reflected movement, while a
  // later local movement is applied above it. Summing deltas alone turns a
  // transfer out of 1 000 000 into a fictitious balance of −1.
  const priorProjection = projectSnapshotAwareStock(snapshots, [...localPriorMovements, ...receiptPriorMovements]);
  const movements = lines.map(line => {
    const key = `${before.storeId}:${line.productId}`;
    const previousQuantity = Math.round((priorProjection.values.get(key) ?? 0) * 1000) / 1000;
    const countedQuantity = Number(line.countedQuantity);
    const quantityDelta = calculateInventoryAdjustment(previousQuantity, countedQuantity);
    return {
      storeId: before.storeId,
      productId: line.productId,
      inventoryId: before.id,
      kind: priorProjection.known.has(key) ? "inventory_adjustment" as const : "first_count" as const,
      previousQuantity: previousQuantity.toFixed(3),
      countedQuantity: countedQuantity.toFixed(3),
      quantityDelta: quantityDelta.toFixed(3),
      unit: line.unit,
      createdByAccountId: input.closedByAccountId,
    };
  });
  await db.insert(operationalStockMovements).values(movements);
  await db.update(operationalInventories).set({ status: "closed", closedByAccountId: input.closedByAccountId, closedAt: new Date() }).where(eq(operationalInventories.id, before.id));
  const after = await requireInventory(before.id);
  return {
    before: inventoryState(before),
    after: inventoryState(after),
    movements: movements.map(movement => ({ ...movement, previousQuantity: Number(movement.previousQuantity), countedQuantity: Number(movement.countedQuantity), quantityDelta: Number(movement.quantityDelta) })),
  };
}

export async function getInventoryAuditState(inventoryId: number) {
  const detail = await getInventoryDetail(inventoryId);
  if (!detail) return null;
  return {
    id: detail.id,
    storeId: detail.storeId,
    storeName: detail.storeName,
    businessDate: detail.businessDate,
    status: detail.status,
    note: detail.note,
    lines: detail.lines.map(line => ({ productId: line.productId, product: line.canonicalName, quantity: line.countedQuantity, unit: line.unit })),
  };
}
