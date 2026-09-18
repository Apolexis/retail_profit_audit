import { and, desc, eq, gt, gte, inArray, isNotNull, lte, ne, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  localAccounts,
  operationalCatalogProducts,
  operationalEvotorDocumentPositions,
  operationalEvotorDocuments,
  operationalEvotorDocumentSyncs,
  operationalEvotorProductLinks,
  operationalInventories,
  operationalInventoryLines,
  operationalPriceTypes,
  operationalPrintCategoryGroupMembers,
  operationalPrintCategoryGroups,
  operationalPrintGroups,
  operationalProductSalePrices,
  operationalStockMovements,
  operationalStoreMappings,
  operationalStorePriceTypes,
  operationalWarehouseSettings,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listEvotorCatalogPreviewForOperationalStore, listEvotorCatalogStoresPreview, listEvotorDocumentsPreviewForOperationalStore } from "./evotorCatalog";

export type InventoryUnit = "kg" | "l" | "piece";
export type InventoryStatus = "draft" | "closed";
export type InventoryVatRate = "VAT_10" | "VAT_22";
export type InventoryMarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";

const isoDate = /^20\d{2}-\d{2}-\d{2}$/;
const finiteThreeDecimals = (value: number) => Number.isFinite(value) && value >= 0 && Math.round(value * 1000) === value * 1000;
const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ");
const normalizedKey = (value: string) => normalizedText(value).toLocaleLowerCase("ru-RU");
const normalizedManualBarcodes = (value: string | null | undefined) => {
  const unique = Array.from(new Set((value ?? "").split(";").map(item => item.trim()).filter(Boolean)));
  if (unique.some(item => item.length > 128)) throw new Error("Каждый ручной штрихкод не должен быть длиннее 128 символов.");
  return unique.join(";") || null;
};

async function nextCatalogNumber() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [last] = await db.select({ catalogNumber: operationalCatalogProducts.catalogNumber }).from(operationalCatalogProducts).orderBy(desc(operationalCatalogProducts.catalogNumber)).limit(1);
  return (last?.catalogNumber ?? 0) + 1;
}
const markingFromEvotorCategory = (product: { name: string; categoryName: string | null; type?: string | null }): InventoryMarkingCategory => {
  /**
   * Cloud V2 exposes the marking class as the product `type`; it is more reliable
   * than a category name. The textual fallback keeps manually created and legacy
   * catalog entries readable without fabricating a marking class.
   */
  switch (product.type?.toUpperCase()) {
    case "DIETARY_SUPPLEMENTS_MARKED": return "supplement";
    case "CAVIAR_MARKED": return "seafood_caviar";
    case "CANNED_FISH_MARKED": return "seafood_canned";
    case "BEER_MARKED": return "beer_marked";
    case "NOT_ALCOHOL_BEER_MARKED": return "beer_non_alcoholic";
    case "JUICE_MARKED": return "soft_drinks";
    case "WATER_MARKED": return "water";
    case "MILK_MARKED": return "dairy";
    case "ALCOHOL": return "alcohol";
  }
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

export function calculateInventoryAdjustment(previousQuantity: number, countedQuantity: number) {
  const previous = validateCountedQuantity(previousQuantity);
  const counted = validateCountedQuantity(countedQuantity);
  return Math.round((counted - previous) * 1000) / 1000;
}

function unitFromProduct(unit: string): InventoryUnit {
  if (unit === "kg" || unit === "l" || unit === "piece") return unit;
  throw new Error("Для товара не задана рабочая единица. Сначала уточните карточку товара.");
}

function unitFromEvotor(value: string | null): InventoryUnit | "unknown" {
  const unit = String(value ?? "").toLocaleLowerCase("ru-RU");
  if (/кг|кил|дроб|вес/.test(unit)) return "kg";
  if (/\bл\b|лит/.test(unit)) return "l";
  if (/шт|штук|упак|бутыл|бан/.test(unit)) return "piece";
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
  const snapshots = await db.select({ productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot }).from(operationalEvotorProductLinks).where(and(...snapshotConditions));
  const conditions = [eq(operationalStockMovements.storeId, storeId), productIds?.length ? inArray(operationalStockMovements.productId, productIds) : undefined].filter(Boolean);
  const rows = await db.select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta }).from(operationalStockMovements).where(and(...conditions));
  const quantities = new Map<number, number>(snapshots.filter(row => row.quantity !== null).map(row => [row.productId, Number(row.quantity)]));
  for (const row of rows) quantities.set(row.productId, Math.round(((quantities.get(row.productId) ?? 0) + Number(row.quantityDelta)) * 1000) / 1000);
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
    unit: unitFromProduct(product.baseUnit),
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
      barcodes: operationalCatalogProducts.barcodes,
      // Keep the source name stable for the card editor. The stock projection
      // independently exposes the same field under the shorter `category` key.
      evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
      category: operationalCatalogProducts.evotorCategoryName,
      baseUnit: operationalCatalogProducts.baseUnit,
      vatRate: operationalCatalogProducts.vatRate,
      evotorCostPrice: operationalCatalogProducts.evotorCostPrice,
      internalCostPrice: operationalCatalogProducts.internalCostPrice,
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
    .where(input?.includeInactive ? undefined : eq(operationalCatalogProducts.isActive, true))
    .orderBy(operationalCatalogProducts.catalogNumber)
    .limit(2_000);
  const products = rows
    .filter(row => input?.includeUnknown || row.baseUnit !== "unknown")
    .map(row => ({ ...row, baseUnit: row.baseUnit as InventoryUnit, internalCode: String(row.catalogNumber), variant: null }));
  const quantities = input?.includeAccounting && input.storeId ? await getInventoryAccountingQuantities(input.storeId, products.map(product => product.id)) : null;
  return products.map(product => ({ ...product, accountingQuantity: quantities?.get(product.id) ?? null }));
}

/**
 * Current operational stock is a projection of closed inventory movements.
 * A null quantity means that the product has not yet been counted, rather than
 * a fictitious zero. This is intentionally separate from the inventory draft.
 */
export async function listOperationalStock(input: { storeIds?: number[] | null; storeId?: number; query?: string; category?: string; offset?: number; limit?: number }) {
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
    .select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot })
    .from(operationalEvotorProductLinks)
    .where(and(inArray(operationalEvotorProductLinks.productId, productIds), inArray(operationalEvotorProductLinks.storeId, storeIds)));
  const snapshotByStoreProduct = new Map(snapshots.filter(row => row.quantity !== null).map(row => [`${row.storeId}:${row.productId}`, Number(row.quantity)]));
  const movements = await db
    .select({ storeId: operationalStockMovements.storeId, productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
    .from(operationalStockMovements)
    .where(and(inArray(operationalStockMovements.productId, productIds), inArray(operationalStockMovements.storeId, storeIds)));
  const balanceByStoreProduct = new Map<string, { quantity: number; lastCountedAt: Date | null }>();
  for (const movement of movements) {
    const key = `${movement.storeId}:${movement.productId}`;
    const current = balanceByStoreProduct.get(key) ?? { quantity: 0, lastCountedAt: null };
    current.quantity = Math.round((current.quantity + Number(movement.quantityDelta)) * 1_000) / 1_000;
    if (!current.lastCountedAt || movement.createdAt > current.lastCountedAt) current.lastCountedAt = movement.createdAt;
    balanceByStoreProduct.set(key, current);
  }
  const query = normalizedText(input.query ?? "").toLocaleLowerCase("ru-RU");
  const matchedProducts = query
    ? catalog.filter(product => `${product.canonicalName} ${product.internalCode ?? ""}`.toLocaleLowerCase("ru-RU").includes(query))
    : catalog;
  const normalizedCategory = normalizedText(input.category ?? "").toLocaleLowerCase("ru-RU");
  const categorizedProducts = normalizedCategory ? matchedProducts.filter(product => (product.category ?? "").toLocaleLowerCase("ru-RU") === normalizedCategory) : matchedProducts;
  const filtered = storeRows.flatMap(store => categorizedProducts.map(product => ({ ...product, storeId: store.storeId, storeName: store.storeName })));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? 50)), 2_000);
  return {
    total: filtered.length,
    items: filtered.slice(offset, offset + limit).map(product => {
      const key = `${product.storeId}:${product.productId}`;
      const movementBalance = balanceByStoreProduct.get(key);
      const snapshot = snapshotByStoreProduct.get(key);
      const salePrice = priceTypeByStore.get(product.storeId) ? salePriceByProductType.get(`${product.productId}:${priceTypeByStore.get(product.storeId)}`) ?? null : null;
      const accountingQuantity = snapshot === undefined && !movementBalance ? null : Math.round(((snapshot ?? 0) + (movementBalance?.quantity ?? 0)) * 1_000) / 1_000;
      return {
        ...product,
        internalCode: product.internalCode || `Эвотор #${product.productId}`,
        accountingQuantity,
        salePrice,
        stockValue: accountingQuantity === null || salePrice === null ? null : Math.round(accountingQuantity * salePrice * 100) / 100,
        lastCountedAt: movementBalance?.lastCountedAt ?? null,
      };
    }),
  };
}

/**
 * Imports exactly one cursor page on each call. This keeps the external request bounded,
 * retains no raw or fiscal payload and never writes back to Evotor.
 */
export async function syncOperationalEvotorDocumentPage(input: { storeId: number; actorId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [activeSync] = await db
    .select()
    .from(operationalEvotorDocumentSyncs)
    .where(and(eq(operationalEvotorDocumentSyncs.storeId, input.storeId), eq(operationalEvotorDocumentSyncs.status, "running")))
    .orderBy(desc(operationalEvotorDocumentSyncs.id))
    .limit(1);
  const sync = activeSync ?? (await db.insert(operationalEvotorDocumentSyncs).values({ storeId: input.storeId, startedByAccountId: input.actorId }).$returningId()).map(({ id }) => ({ id, documentsRead: 0, positionsRead: 0, cursor: null }))[0];
  const page = await listEvotorDocumentsPreviewForOperationalStore({ storeId: input.storeId, cursor: sync.cursor ?? undefined });
  let insertedDocuments = 0;
  let insertedPositions = 0;
  await forEachBoundedBatch(page.documents, 4, async document => {
    const [existing] = await db
      .select({ id: operationalEvotorDocuments.id })
      .from(operationalEvotorDocuments)
      .where(and(eq(operationalEvotorDocuments.storeId, input.storeId), eq(operationalEvotorDocuments.evotorDocumentId, document.id)))
      .limit(1);
    if (existing) return;
    const [inserted] = await db.insert(operationalEvotorDocuments).values({
      storeId: input.storeId,
      syncId: sync.id,
      evotorDocumentId: document.id,
      documentType: document.type,
      occurredAt: document.closedAt ?? document.createdAt,
      total: document.total === null ? null : document.total.toFixed(2),
    }).$returningId();
    insertedDocuments += 1;
    const positions = document.positions.filter(position => position.productId || position.productName).map(position => ({
      documentId: inserted.id,
      evotorProductId: position.productId,
      productName: position.productName,
      quantity: position.quantity === null ? null : position.quantity.toFixed(3),
      initialQuantity: position.initialQuantity === null ? null : position.initialQuantity.toFixed(3),
      unit: position.unit,
      settlementMethod: position.settlementMethod,
      resultSum: position.resultSum === null ? null : position.resultSum.toFixed(2),
    }));
    if (positions.length) {
      await db.insert(operationalEvotorDocumentPositions).values(positions);
      insertedPositions += positions.length;
    }
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
  return { syncId: sync.id, storeId: input.storeId, readDocuments: page.documents.length, readPositions: page.documents.reduce((total, document) => total + document.positions.length, 0), insertedDocuments, insertedPositions, completed };
}

async function forEachBoundedBatch<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
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
  if (granularity === "hour") return { key: `${dateKey}T${String(hour).padStart(2, "0")}`, label: `${dateLabel} · ${String(hour).padStart(2, "0")}:00` };
  if (granularity === "day") return { key: dateKey, label: dateLabel };
  if (granularity === "month") return { key: dateKey.slice(0, 7), label: new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "Europe/Moscow" }).format(date) };
  const weekStart = new Date(Date.UTC(year, month - 1, day));
  const weekday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - weekday);
  const weekKey = `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;
  return { key: weekKey, label: `Неделя с ${String(weekStart.getUTCDate()).padStart(2, "0")}.${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}.${weekStart.getUTCFullYear()}` };
}

export const __evotorSalesTestUtils = { evotorSalesInterval };

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
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const allVisibleStores = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(eq(stores.isHidden, false))
    .orderBy(stores.name);
  const requestedStoreIds = input.storeIds?.length ? new Set(input.storeIds) : null;
  const scopedStores = requestedStoreIds ? allVisibleStores.filter(store => requestedStoreIds.has(store.id)) : allVisibleStores;
  if (!scopedStores.length) return { stores: [], timeline: [], products: [], summary: { checks: 0, amount: 0, positions: 0, positionAmount: 0, quantity: 0 } };
  const storeIds = scopedStores.map(store => store.id);
  const storeNameById = new Map(scopedStores.map(store => [store.id, store.name]));
  const documents = await db
    .select({
      id: operationalEvotorDocuments.id,
      storeId: operationalEvotorDocuments.storeId,
      occurredAt: operationalEvotorDocuments.occurredAt,
      total: operationalEvotorDocuments.total,
    })
    .from(operationalEvotorDocuments)
    .where(and(
      inArray(operationalEvotorDocuments.storeId, storeIds),
      isNotNull(operationalEvotorDocuments.occurredAt),
      gte(operationalEvotorDocuments.occurredAt, `${input.from}T00:00:00`),
      lte(operationalEvotorDocuments.occurredAt, `${input.to}T23:59:59.999`),
    ));
  const timelineMap = new Map<string, { key: string; label: string; storeId: number; storeName: string; checks: number; amount: number; positions: number; positionAmount: number; quantity: number }>();
  const documentById = new Map<number, { storeId: number; storeName: string; timelineKey: string }>();
  let checks = 0;
  let amount = 0;
  for (const document of documents) {
    const interval = document.occurredAt ? evotorSalesInterval(document.occurredAt, input.granularity) : null;
    const storeName = storeNameById.get(document.storeId);
    if (!interval || !storeName) continue;
    const aggregateKey = `${interval.key}:${document.storeId}`;
    const aggregate = timelineMap.get(aggregateKey) ?? { key: interval.key, label: interval.label, storeId: document.storeId, storeName, checks: 0, amount: 0, positions: 0, positionAmount: 0, quantity: 0 };
    aggregate.checks += 1;
    aggregate.amount += Number(document.total ?? 0);
    timelineMap.set(aggregateKey, aggregate);
    documentById.set(document.id, { storeId: document.storeId, storeName, timelineKey: aggregateKey });
    checks += 1;
    amount += Number(document.total ?? 0);
  }
  const documentIds = documents.map(document => document.id);
  const positions = [] as Array<{ documentId: number; productName: string | null; unit: string | null; quantity: string | null; resultSum: string | null }>;
  for (let start = 0; start < documentIds.length; start += 500) {
    positions.push(...await db
      .select({ documentId: operationalEvotorDocumentPositions.documentId, productName: operationalEvotorDocumentPositions.productName, unit: operationalEvotorDocumentPositions.unit, quantity: operationalEvotorDocumentPositions.quantity, resultSum: operationalEvotorDocumentPositions.resultSum })
      .from(operationalEvotorDocumentPositions)
      .where(inArray(operationalEvotorDocumentPositions.documentId, documentIds.slice(start, start + 500))));
  }
  const productMap = new Map<string, { productName: string; unit: string | null; amount: number; quantity: number; positions: number; stores: Set<number> }>();
  let quantity = 0;
  let positionAmount = 0;
  for (const position of positions) {
    const document = documentById.get(position.documentId);
    if (!document) continue;
    const productName = normalizedText(position.productName ?? "") || "Товар без названия";
    const key = `${productName}\u0000${position.unit ?? ""}`;
    const product = productMap.get(key) ?? { productName, unit: position.unit, amount: 0, quantity: 0, positions: 0, stores: new Set<number>() };
    const lineQuantity = Number(position.quantity ?? 0);
    product.amount += Number(position.resultSum ?? 0);
    product.quantity += lineQuantity;
    product.positions += 1;
    if (document) product.stores.add(document.storeId);
    productMap.set(key, product);
    quantity += lineQuantity;
    positionAmount += Number(position.resultSum ?? 0);
    const timeline = document ? timelineMap.get(document.timelineKey) : undefined;
    if (timeline) {
      timeline.positions += 1;
      timeline.positionAmount += Number(position.resultSum ?? 0);
      timeline.quantity += lineQuantity;
    }
  }
  return {
    stores: scopedStores,
    timeline: Array.from(timelineMap.values()).map(row => ({ ...row, amount: Math.round(row.amount * 100) / 100, positionAmount: Math.round(row.positionAmount * 100) / 100, quantity: Math.round(row.quantity * 1_000) / 1_000 })).sort((left, right) => left.key.localeCompare(right.key) || left.storeName.localeCompare(right.storeName, "ru")),
    products: Array.from(productMap.values()).map(product => ({ productName: product.productName, unit: product.unit, amount: Math.round(product.amount * 100) / 100, quantity: Math.round(product.quantity * 1_000) / 1_000, positions: product.positions, stores: product.stores.size })).sort((left, right) => right.amount - left.amount || left.productName.localeCompare(right.productName, "ru")),
    summary: { checks, amount: Math.round(amount * 100) / 100, positions: positions.length, positionAmount: Math.round(positionAmount * 100) / 100, quantity: Math.round(quantity * 1_000) / 1_000 },
  };
}

/** Saves the confirmed Evotor catalog as read-only links to global products; similarity never merges real products. */
export async function confirmOperationalCatalogFromEvotor(input: { storeId: number; actorId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const preview = await listEvotorCatalogPreviewForOperationalStore(input.storeId);
  if (!preview.products.length) throw new Error("В каталоге выбранной точки Эвотор нет товарных позиций для сохранения.");
  let nextNumber = await nextCatalogNumber();
  await forEachBoundedBatch(preview.products, 12, async product => {
    const baseUnit = unitFromEvotor(product.unit);
    const evotorQuantitySnapshot = product.quantity !== null && finiteThreeDecimals(product.quantity) ? product.quantity.toFixed(3) : null;
    const [link] = await db.select().from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, input.storeId), eq(operationalEvotorProductLinks.evotorProductId, product.id))).limit(1);
    if (link) {
      const [existing] = await db.select({ markingCategory: operationalCatalogProducts.markingCategory }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, link.productId)).limit(1);
      const markingFromSource = markingFromEvotorCategory(product);
      const hasExplicitMarking = product.type !== null && markingFromSource !== "none";
      const isAlcoholProduct = markingFromSource === "alcohol" || markingFromSource === "beer_marked";
      await db.update(operationalCatalogProducts).set({
        evotorCode: product.code,
        canonicalName: product.name,
        evotorCategoryName: product.categoryName,
        barcodes: product.barcodes,
        baseUnit,
        vatRate: product.vatRate,
        markingCategory: hasExplicitMarking ? markingFromSource : (existing?.markingCategory === "none" ? markingFromSource : existing?.markingCategory ?? "none"),
        alcoholCode: isAlcoholProduct ? product.alcoholCode : null,
        alcoholTypeCode: isAlcoholProduct ? product.alcoholTypeCode : null,
        alcoholStrengthPercent: isAlcoholProduct && product.alcoholStrengthPercent !== null ? product.alcoholStrengthPercent.toFixed(2) : null,
        alcoholVolumeLiters: isAlcoholProduct && product.alcoholVolumeLiters !== null ? product.alcoholVolumeLiters.toFixed(3) : null,
        isActive: true,
        importedAt: new Date(),
      }).where(eq(operationalCatalogProducts.id, link.productId));
      await db.update(operationalEvotorProductLinks).set({ evotorQuantitySnapshot, evotorQuantityUpdatedAt: new Date() }).where(eq(operationalEvotorProductLinks.id, link.id));
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
  await db.update(operationalCatalogProducts).set({ internalCostPrice: input.internalCostPrice === null ? null : input.internalCostPrice.toFixed(2) }).where(eq(operationalCatalogProducts.id, input.id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  return { before, after: after! };
}

export async function createOperationalCatalogProduct(input: { canonicalName: string; evotorCategoryName?: string | null; baseUnit: InventoryUnit; vatRate?: InventoryVatRate; internalCostPrice?: number | null; markingCategory?: InventoryMarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: number | null; alcoholVolumeLiters?: number | null; manualBarcodes?: string | null; isVisibleInRequests?: boolean; isEvotorExportEnabled?: boolean; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  if (input.internalCostPrice !== undefined && input.internalCostPrice !== null && (!Number.isFinite(input.internalCostPrice) || input.internalCostPrice < 0)) throw new Error("Внутренняя себестоимость должна быть неотрицательным числом.");
  if (input.alcoholStrengthPercent !== undefined && input.alcoholStrengthPercent !== null && (!Number.isFinite(input.alcoholStrengthPercent) || input.alcoholStrengthPercent < 0 || input.alcoholStrengthPercent > 100)) throw new Error("Крепость должна быть числом от 0 до 100%.");
  const isAlcohol = input.markingCategory === "alcohol" || input.markingCategory === "beer_marked";
  const [inserted] = await db.insert(operationalCatalogProducts).values({
    catalogNumber: await nextCatalogNumber(),
    storeId: null,
    evotorProductId: `manual:${randomUUID()}`,
    canonicalName,
    evotorCategoryName: normalizedText(input.evotorCategoryName ?? "").slice(0, 512) || null,
    barcodes: [],
    baseUnit: input.baseUnit,
    vatRate: input.vatRate ?? "VAT_10",
    evotorCostPrice: "0.00",
    internalCostPrice: input.internalCostPrice === null || input.internalCostPrice === undefined ? null : input.internalCostPrice.toFixed(2),
    markingCategory: input.markingCategory ?? "none",
    alcoholCode: isAlcohol ? normalizedText(input.alcoholCode ?? "").slice(0, 255) || null : null,
    alcoholTypeCode: isAlcohol ? normalizedText(input.alcoholTypeCode ?? "").slice(0, 64) || null : null,
    alcoholStrengthPercent: isAlcohol && input.alcoholStrengthPercent !== null && input.alcoholStrengthPercent !== undefined ? input.alcoholStrengthPercent.toFixed(2) : null,
    alcoholVolumeLiters: isAlcohol && input.alcoholVolumeLiters !== null && input.alcoholVolumeLiters !== undefined ? input.alcoholVolumeLiters.toFixed(3) : null,
    manualBarcodes: normalizedManualBarcodes(input.manualBarcodes),
    isVisibleInRequests: input.isVisibleInRequests ?? true,
    isEvotorExportEnabled: input.isEvotorExportEnabled ?? false,
    importedByAccountId: input.actorId,
  }).$returningId();
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, inserted.id)).limit(1);
  return after!;
}

export async function updateOperationalCatalogProduct(input: { id: number; canonicalName: string; evotorCategoryName?: string | null; baseUnit: InventoryUnit; vatRate: InventoryVatRate; markingCategory: InventoryMarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: number | null; alcoholVolumeLiters?: number | null; manualBarcodes?: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  if (input.alcoholStrengthPercent !== undefined && input.alcoholStrengthPercent !== null && (!Number.isFinite(input.alcoholStrengthPercent) || input.alcoholStrengthPercent < 0 || input.alcoholStrengthPercent > 100)) throw new Error("Крепость должна быть числом от 0 до 100%.");
  const isAlcohol = input.markingCategory === "alcohol" || input.markingCategory === "beer_marked";
  await db.update(operationalCatalogProducts).set({ canonicalName, evotorCategoryName: normalizedText(input.evotorCategoryName ?? "").slice(0, 512) || null, baseUnit: input.baseUnit, vatRate: input.vatRate, markingCategory: input.markingCategory, alcoholCode: isAlcohol ? normalizedText(input.alcoholCode ?? "").slice(0, 255) || null : null, alcoholTypeCode: isAlcohol ? normalizedText(input.alcoholTypeCode ?? "").slice(0, 64) || null : null, alcoholStrengthPercent: isAlcohol && input.alcoholStrengthPercent !== null && input.alcoholStrengthPercent !== undefined ? input.alcoholStrengthPercent.toFixed(2) : null, alcoholVolumeLiters: isAlcohol && input.alcoholVolumeLiters !== null && input.alcoholVolumeLiters !== undefined ? input.alcoholVolumeLiters.toFixed(3) : null, manualBarcodes: normalizedManualBarcodes(input.manualBarcodes), isVisibleInRequests: input.isVisibleInRequests, isEvotorExportEnabled: input.isEvotorExportEnabled }).where(eq(operationalCatalogProducts.id, input.id));
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  return { before, after: after! };
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

export async function listOperationalCatalogCategoryNames() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ category: operationalCatalogProducts.evotorCategoryName }).from(operationalCatalogProducts).where(and(eq(operationalCatalogProducts.isActive, true), isNotNull(operationalCatalogProducts.evotorCategoryName))).limit(20_000);
  return Array.from(new Set(rows.map(row => row.category).filter((category): category is string => Boolean(category)))).sort((left, right) => left.localeCompare(right, "ru"));
}

export async function listOperationalPrintCategoryGroups() {
  const db = await getDb();
  if (!db) return [];
  const [groups, members] = await Promise.all([
    db.select().from(operationalPrintCategoryGroups).orderBy(operationalPrintCategoryGroups.name).limit(200),
    db.select().from(operationalPrintCategoryGroupMembers).orderBy(operationalPrintCategoryGroupMembers.sortOrder, operationalPrintCategoryGroupMembers.id).limit(2_000),
  ]);
  const names = new Map(groups.map(group => [group.id, group.name]));
  return groups.map(group => ({ ...group, members: members.filter(member => member.groupId === group.id).map(member => ({ id: member.id, memberType: member.memberType, catalogCategory: member.catalogCategory, childGroupId: member.childGroupId, childGroupName: member.childGroupId ? names.get(member.childGroupId) ?? null : null })) }));
}

export async function createOperationalPrintCategoryGroup(input: { name: string; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const name = normalizedText(input.name);
  if (!name) throw new Error("Укажите название категории печати.");
  const normalizedName = normalizedKey(name);
  const [existing] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.normalizedName, normalizedName)).limit(1);
  if (existing) throw new Error("Такая категория печати уже существует.");
  await db.insert(operationalPrintCategoryGroups).values({ name, normalizedName, createdByAccountId: input.actorId });
  const [after] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.normalizedName, normalizedName)).limit(1);
  return after!;
}

/** Print-category groups are user-managed configuration, separate from immutable order history. */
export async function updateOperationalPrintCategoryGroup(input: { id: number; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.id)).limit(1);
  if (!before) throw new Error("Категория печати не найдена.");
  const name = normalizedText(input.name);
  if (!name) throw new Error("Укажите название категории печати.");
  const normalizedName = normalizedKey(name);
  const [sameName] = await db.select().from(operationalPrintCategoryGroups).where(and(eq(operationalPrintCategoryGroups.normalizedName, normalizedName), ne(operationalPrintCategoryGroups.id, input.id))).limit(1);
  if (sameName) throw new Error("Такая категория печати уже существует.");
  await db.update(operationalPrintCategoryGroups).set({ name, normalizedName }).where(eq(operationalPrintCategoryGroups.id, input.id));
  const [after] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.id)).limit(1);
  return { before, after: after! };
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

export async function setOperationalPrintCategoryGroupMember(input: { groupId: number; memberType: "catalog_category" | "category_group"; catalogCategory?: string; childGroupId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [group] = await db.select().from(operationalPrintCategoryGroups).where(eq(operationalPrintCategoryGroups.id, input.groupId)).limit(1);
  if (!group) throw new Error("Категория печати не найдена.");
  if (input.memberType === "catalog_category") {
    const catalogCategory = normalizedText(input.catalogCategory ?? "");
    if (!catalogCategory) throw new Error("Выберите категорию номенклатуры.");
    const [existing] = await db.select().from(operationalPrintCategoryGroupMembers).where(and(eq(operationalPrintCategoryGroupMembers.groupId, input.groupId), eq(operationalPrintCategoryGroupMembers.memberType, "catalog_category"), eq(operationalPrintCategoryGroupMembers.catalogCategory, catalogCategory))).limit(1);
    if (existing) return { created: false, member: existing };
    await db.insert(operationalPrintCategoryGroupMembers).values({ groupId: input.groupId, memberType: "catalog_category", catalogCategory, sortOrder: 0 });
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

/** Store list deliberately omits Evotor address and terminal identifiers. */
export async function listOperationalWarehouses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ storeId: stores.id, storeName: stores.name, isHidden: stores.isHidden, priceTypeId: operationalStorePriceTypes.priceTypeId, priceTypeName: operationalPriceTypes.name, printGroupId: operationalWarehouseSettings.printGroupId, printGroupName: operationalPrintGroups.name, evotorStoreName: operationalStoreMappings.evotorStoreName })
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
  const unit = unitFromProduct(product.baseUnit);
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
    product: { id: product.id, internalCode: product.evotorCode || `Эвотор #${product.id}`, canonicalName: product.canonicalName, unit },
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
    .map(product => ({ inventoryId, productId: product.id, countedQuantity: product.accountingQuantity!.toFixed(3), unit: product.baseUnit }));
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
      internalCode: operationalCatalogProducts.evotorCode,
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
    lines: lines.map(line => ({ ...line, internalCode: line.internalCode || `Эвотор #${line.productId}`, variant: null, countedQuantity: Number(line.countedQuantity), ...(accountingAtClose ? { accountingQuantity: accountingAtClose.get(line.productId) ?? null } : {}) })),
  };
}

export async function listStoreInventories(input: { storeIds?: number[] | null; storeId?: number; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const conditions = [
    input.storeId ? eq(operationalInventories.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalInventories.storeId, input.storeIds) : undefined,
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
  const priorMovements = await db
    .select()
    .from(operationalStockMovements)
    .where(and(eq(operationalStockMovements.storeId, before.storeId), inArray(operationalStockMovements.productId, productIds)));
  const priorByProduct = new Map<number, number>();
  for (const movement of priorMovements) priorByProduct.set(movement.productId, (priorByProduct.get(movement.productId) ?? 0) + Number(movement.quantityDelta));
  const movements = lines.map(line => {
    const previousQuantity = Math.round((priorByProduct.get(line.productId) ?? 0) * 1000) / 1000;
    const countedQuantity = Number(line.countedQuantity);
    const quantityDelta = calculateInventoryAdjustment(previousQuantity, countedQuantity);
    return {
      storeId: before.storeId,
      productId: line.productId,
      inventoryId: before.id,
      kind: priorByProduct.has(line.productId) ? "inventory_adjustment" as const : "first_count" as const,
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
