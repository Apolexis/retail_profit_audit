import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
  operationalCatalogCategories,
  operationalCatalogProducts,
  operationalEvotorReceiptStockMovements,
  operationalEvotorOutboundJobs,
  operationalEvotorProductLinks,
  operationalProductSalePrices,
  operationalStockMovements,
  operationalStoreMappings,
  operationalStorePriceTypes,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { buildEvotorProductPayload, stableEvotorProductId, type EvotorProductPayload } from "./evotorCatalogExport";
import { getEvotorApiToken } from "./evotorCredentials";
import { recordChange } from "./localAuth";

const EVOTOR_API_BASE_URL = "https://api.evotor.ru";
const EVOTOR_MEDIA_TYPE = "application/vnd.evotor.v2+json";
const EVOTOR_BULK_MEDIA_TYPE = "application/vnd.evotor.v2+bulk+json";
const MAX_ATTEMPTS = 12;
const STALE_PROCESSING_MS = 5 * 60_000;
const MAX_BULK_PRODUCTS = 5_000;
const DEFAULT_STORE_BATCH = 33;
/** Four concurrent store requests keep an initial 33-store submission fast without a burst of 33 external calls. */
const BULK_SUBMISSION_CONCURRENCY = 4;
/** Reserved only for a human-confirmed, separately audit-logged all-store catalog reset. */
const CONFIRMED_RESET_SOURCE_PREFIX = "evotor-reset-999:";

type OutboundJob = typeof operationalEvotorOutboundJobs.$inferSelect;
export type EvotorOutboundReason = "catalog_create" | "catalog_update" | "catalog_enable" | "catalog_archive" | "full_catalog_export" | "price_update" | "warehouse_mapping" | "inventory_close" | "stock_adjustment" | "transfer" | "shipment_receipt";

type QueueInput = {
  storeIds: number[];
  productIds: number[];
  reason: EvotorOutboundReason;
  sourceKey: string;
};

type ProductForOutbound = {
  id: number;
  catalogNumber: number;
  canonicalName: string;
  baseUnit: "fraction" | "l" | "piece" | "unknown";
  vatRate: "VAT_10" | "VAT_22";
  markingCategory: "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";
  alcoholCode: string | null;
  alcoholTypeCode: string | null;
  alcoholStrengthPercent: string | number | null;
  alcoholVolumeLiters: string | number | null;
  manualBarcodes: string | null;
  barcodes: unknown;
  internalCostPrice: string | number | null;
  isEvotorCostExportEnabled: boolean;
  catalogCategoryId: number | null;
  evotorCategoryName: string | null;
  isActive: boolean;
  isEvotorExportEnabled: boolean;
};

type PreparedJob = {
  job: OutboundJob;
  storeUuid: string;
  storeName: string;
  product: ProductForOutbound;
  externalProductId: string;
  quantity: number;
  price: number | undefined;
  hasExistingLink: boolean;
  parentId?: string;
};

/** A catalog archive deletes only a known, explicitly managed remote identity. */
type PreparedArchiveJob = {
  job: OutboundJob;
  storeUuid: string;
  storeName: string;
  externalProductId: string;
  productName: string;
};

type EvotorRateLimit = { limit: string | null; remaining: string | null; reset: string | null };
type EvotorProductGroup = { id: string; name: string };
type EvotorExistingProduct = { id: string; name: string; barcodes: string[]; parentId: string | null };

function russianOutboundError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  return /[А-Яа-яЁё]/.test(message) ? message.slice(0, 512) : "Эвотор не принял изменение. Очередь повторит отправку автоматически.";
}

function normalizedIds(values: number[]) {
  return Array.from(new Set(values.filter(Number.isInteger))).filter(value => value > 0);
}

function isConfirmedResetJob(job: Pick<OutboundJob, "reason" | "sourceKey">) {
  return job.reason === "full_catalog_export" && job.sourceKey.startsWith(CONFIRMED_RESET_SOURCE_PREFIX);
}

function rateLimitFrom(response: Response): EvotorRateLimit {
  return {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
  };
}

function normalizedCategoryName(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function normalizedProductName(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function productBarcodes(product: Pick<ProductForOutbound, "barcodes" | "manualBarcodes">) {
  const source = Array.isArray(product.barcodes)
    ? product.barcodes.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim())
    : [];
  const manual = product.manualBarcodes?.split(/[;,\n\r]+/).map(value => value.trim()).filter(Boolean) ?? [];
  return Array.from(new Set([...source, ...manual]));
}

function exactExistingProductMatch(product: ProductForOutbound, candidates: EvotorExistingProduct[]) {
  const name = normalizedProductName(product.canonicalName);
  const sameName = candidates.filter(candidate => normalizedProductName(candidate.name) === name);
  const localBarcodes = productBarcodes(product);
  if (!localBarcodes.length) return sameName.length === 1 ? sameName[0] : null;
  const barcodeSet = new Set(localBarcodes);
  const sameBarcode = sameName.filter(candidate => candidate.barcodes.some(barcode => barcodeSet.has(barcode)));
  return sameBarcode.length === 1 ? sameBarcode[0] : null;
}

/** Reads only the small product identity projection needed to avoid duplicate creates. */
async function listEvotorExistingProducts(storeUuid: string, token: string) {
  const products: EvotorExistingProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 30; page += 1) {
    const url = new URL(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(storeUuid)}/products`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: EVOTOR_MEDIA_TYPE }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Не удалось сверить номенклатуру Эвотор перед выгрузкой.");
    const body = await response.json() as { items?: Array<{ id?: unknown; name?: unknown; barcodes?: unknown; parent_id?: unknown }>; paging?: { next_cursor?: unknown } };
    for (const item of body.items ?? []) {
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const parentId = typeof item.parent_id === "string" && item.parent_id.trim() ? item.parent_id.trim() : null;
      if (!id || !name) continue;
      const barcodes = Array.isArray(item.barcodes)
        ? item.barcodes.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim())
        : [];
      products.push({ id, name, barcodes, parentId });
    }
    const nextCursor = typeof body.paging?.next_cursor === "string" ? body.paging.next_cursor.trim() : "";
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return products;
}

async function listEvotorProductGroups(storeUuid: string, token: string) {
  const groups: EvotorProductGroup[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(storeUuid)}/product-groups`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: EVOTOR_MEDIA_TYPE }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Не удалось прочитать категории Эвотор перед выгрузкой товара.");
    const body = await response.json() as { items?: EvotorProductGroup[]; paging?: { next_cursor?: string } };
    groups.push(...(Array.isArray(body.items) ? body.items.filter(group => group.id && group.name) : []));
    cursor = body.paging?.next_cursor ?? null;
    if (!cursor) break;
  }
  return groups;
}

/** Returns a concrete per-store product-group ID and creates only categories absent in that store. */
async function ensureEvotorProductGroups(storeUuid: string, categoryRows: Array<{ id: number; name: string }>) {
  const token = await getEvotorApiToken();
  const byName = new Map((await listEvotorProductGroups(storeUuid, token)).map(group => [normalizedCategoryName(group.name), group.id]));
  for (const category of categoryRows) {
    const key = normalizedCategoryName(category.name);
    if (byName.has(key)) continue;
    const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(storeUuid)}/product-groups`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: EVOTOR_MEDIA_TYPE, "Content-Type": EVOTOR_MEDIA_TYPE },
      body: JSON.stringify({ name: category.name }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok || !body?.id) throw new Error(`Эвотор не создал категорию «${category.name}».`);
    byName.set(key, body.id);
  }
  return new Map(categoryRows.map(category => {
    const parentId = byName.get(normalizedCategoryName(category.name));
    if (!parentId) throw new Error(`Для товара не найдена категория Эвотор «${category.name}».`);
    return [category.id, parentId];
  }));
}

function bulkTaskId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["id", "bulk_id", "bulkId", "task_id", "taskId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  const task = record.task;
  return task && typeof task === "object" ? bulkTaskId(task) : null;
}

function bulkTaskState(body: unknown): "pending" | "succeeded" | "failed" {
  if (!body || typeof body !== "object") return "pending";
  const record = body as Record<string, unknown>;
  const nested = record.task && typeof record.task === "object" ? record.task as Record<string, unknown> : null;
  const state = [record.status, record.state, record.result, nested?.status, nested?.state, nested?.result]
    .find((value): value is string => typeof value === "string")?.trim().toLowerCase();
  if (state && ["failed", "error", "cancelled", "canceled", "rejected"].includes(state)) return "failed";
  if (state && ["completed", "complete", "succeeded", "success", "done", "finished"].includes(state)) return "succeeded";
  // A response commonly contains an `errors` key even when the list is empty.
  // Treat it as failure only when the server actually supplied an error element.
  const errors = record.errors ?? nested?.errors;
  if (Array.isArray(errors) && errors.length) return "failed";
  if (typeof errors === "string" && errors.trim()) return "failed";
  if (errors && typeof errors === "object" && Object.keys(errors as Record<string, unknown>).length) return "failed";
  return "pending";
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as unknown; } catch { return { raw: text.slice(0, 1_000) }; }
}

/**
 * Creates durable work only for active products explicitly enabled for Evotor and
 * only for visible stores with a real mapped terminal. It never calls Evotor.
 */
export async function enqueueOperationalEvotorOutbound(input: QueueInput) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const storeIds = normalizedIds(input.storeIds);
  const productIds = normalizedIds(input.productIds);
  if (!storeIds.length || !productIds.length) return { queued: 0, eligibleProducts: 0, stores: 0 };

  const [eligibleProducts, mappedStores] = await Promise.all([
    db.select({ id: operationalCatalogProducts.id })
      .from(operationalCatalogProducts)
      .where(and(
        inArray(operationalCatalogProducts.id, productIds),
        eq(operationalCatalogProducts.isActive, true),
        eq(operationalCatalogProducts.isEvotorExportEnabled, true),
      )),
    db.select({ storeId: stores.id })
      .from(stores)
      .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
      .where(and(inArray(stores.id, storeIds), eq(stores.isHidden, false))),
  ]);
  const eligibleIds = eligibleProducts.map(row => row.id);
  const mappedIds = mappedStores.map(row => row.storeId);
  if (!eligibleIds.length || !mappedIds.length) return { queued: 0, eligibleProducts: eligibleIds.length, stores: mappedIds.length };

  let queued = 0;
  for (const storeId of mappedIds) {
    for (const productId of eligibleIds) {
      const sourceKey = `${input.sourceKey}:${storeId}:${productId}`;
      const [existing] = await db.select({ id: operationalEvotorOutboundJobs.id })
        .from(operationalEvotorOutboundJobs)
        .where(eq(operationalEvotorOutboundJobs.sourceKey, sourceKey))
        .limit(1);
      if (existing) continue;
      await db.insert(operationalEvotorOutboundJobs).values({ storeId, productId, sourceKey, reason: input.reason, status: "pending" });
      queued += 1;
    }
  }
  return { queued, eligibleProducts: eligibleIds.length, stores: mappedIds.length };
}

/** Enqueues a shared product for every mapped point where the product already exists or has a factual movement. */
export async function enqueueOperationalEvotorOutboundForMappedStores(input: Omit<QueueInput, "storeIds">) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const productIds = normalizedIds(input.productIds);
  if (!productIds.length) return { queued: 0, eligibleProducts: 0, stores: 0 };
  const [linkedRows, movedRows] = await Promise.all([
    db.select({ storeId: operationalEvotorProductLinks.storeId, productId: operationalEvotorProductLinks.productId })
      .from(operationalEvotorProductLinks)
      .innerJoin(stores, eq(stores.id, operationalEvotorProductLinks.storeId))
      .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, operationalEvotorProductLinks.storeId))
      .where(and(inArray(operationalEvotorProductLinks.productId, productIds), eq(stores.isHidden, false))),
    db.select({ storeId: operationalStockMovements.storeId, productId: operationalStockMovements.productId })
      .from(operationalStockMovements)
      .innerJoin(stores, eq(stores.id, operationalStockMovements.storeId))
      .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, operationalStockMovements.storeId))
      .where(and(inArray(operationalStockMovements.productId, productIds), eq(stores.isHidden, false))),
  ]);
  const pairs = new Map<string, { storeId: number; productId: number }>();
  for (const row of [...linkedRows, ...movedRows]) pairs.set(`${row.storeId}:${row.productId}`, row);
  let queued = 0;
  const pairList = Array.from(pairs.values());
  for (const pair of pairList) queued += (await enqueueOperationalEvotorOutbound({ storeIds: [pair.storeId], productIds: [pair.productId], reason: input.reason, sourceKey: input.sourceKey })).queued;
  return { queued, eligibleProducts: new Set(pairList.map(pair => pair.productId)).size, stores: new Set(pairList.map(pair => pair.storeId)).size };
}

/** A deliberately enabled shared item is published to every currently mapped working store. */
export async function enqueueOperationalEvotorOutboundToAllMappedStores(input: Omit<QueueInput, "storeIds">) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const mapped = await db.select({ storeId: stores.id })
    .from(stores)
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(stores.isHidden, false));
  return enqueueOperationalEvotorOutbound({ ...input, storeIds: mapped.map(row => row.storeId) });
}

/**
 * Archives are deliberately different from stock/catalog updates: after the
 * local record becomes inactive, its external product must be removed only
 * where an exact retained product link proves the remote identity. No name or
 * barcode lookup is used for deletion.
 */
export async function enqueueOperationalEvotorCatalogArchive(input: { productId: number; sourceKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select({ id: operationalCatalogProducts.id, isEvotorExportEnabled: operationalCatalogProducts.isEvotorExportEnabled })
    .from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.productId)).limit(1);
  if (!product?.isEvotorExportEnabled) return { queued: 0, linkedStores: 0, exportEnabled: Boolean(product?.isEvotorExportEnabled) };
  const linkedStores = await db.select({ storeId: operationalEvotorProductLinks.storeId })
    .from(operationalEvotorProductLinks)
    .innerJoin(stores, eq(stores.id, operationalEvotorProductLinks.storeId))
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, operationalEvotorProductLinks.storeId))
    .where(and(eq(operationalEvotorProductLinks.productId, input.productId), eq(stores.isHidden, false)));
  let queued = 0;
  for (const { storeId } of linkedStores) {
    const sourceKey = `${input.sourceKey}:${storeId}:${input.productId}`;
    const [existing] = await db.select({ id: operationalEvotorOutboundJobs.id }).from(operationalEvotorOutboundJobs).where(eq(operationalEvotorOutboundJobs.sourceKey, sourceKey)).limit(1);
    if (existing) continue;
    await db.insert(operationalEvotorOutboundJobs).values({ storeId, productId: input.productId, sourceKey, reason: "catalog_archive", status: "pending" });
    queued += 1;
  }
  return { queued, linkedStores: linkedStores.length, exportEnabled: true };
}

/** A newly connected store receives every enabled shared product as bulk work. */
export async function queueOperationalEvotorStoreCatalog(input: { storeId: number; reason: EvotorOutboundReason; sourceKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const products = await db.select({ id: operationalCatalogProducts.id })
    .from(operationalCatalogProducts)
    .where(and(eq(operationalCatalogProducts.isActive, true), eq(operationalCatalogProducts.isEvotorExportEnabled, true)));
  return queueAndDispatchOperationalEvotorOutbound({ storeIds: [input.storeId], productIds: products.map(row => row.id), reason: input.reason, sourceKey: input.sourceKey });
}

/** A changed sale price is sent only to mapped stores assigned to that exact price type. */
export async function queueOperationalEvotorPriceChange(input: { productId: number; priceTypeId: number; sourceKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const assignments = await db.select({ storeId: operationalStorePriceTypes.storeId })
    .from(operationalStorePriceTypes)
    .innerJoin(stores, eq(stores.id, operationalStorePriceTypes.storeId))
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, operationalStorePriceTypes.storeId))
    .where(and(eq(operationalStorePriceTypes.priceTypeId, input.priceTypeId), eq(stores.isHidden, false)));
  return queueAndDispatchOperationalEvotorOutbound({ storeIds: assignments.map(row => row.storeId), productIds: [input.productId], reason: "price_update", sourceKey: input.sourceKey });
}

async function currentAccountingQuantity(storeId: number, productId: number, snapshot: { quantity: string | null; updatedAt: Date | null } | null) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [stockRows, receiptRows] = await Promise.all([
    db.select({ quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
      .from(operationalStockMovements)
      .where(and(eq(operationalStockMovements.storeId, storeId), eq(operationalStockMovements.productId, productId))),
    db.select({ quantityDelta: operationalEvotorReceiptStockMovements.quantityDelta, createdAt: operationalEvotorReceiptStockMovements.occurredAt })
      .from(operationalEvotorReceiptStockMovements)
      .where(and(eq(operationalEvotorReceiptStockMovements.storeId, storeId), eq(operationalEvotorReceiptStockMovements.productId, productId))),
  ]);
  const baseline = snapshot?.quantity === null || snapshot?.quantity === undefined ? 0 : Number(snapshot.quantity);
  const snapshotAt = snapshot?.updatedAt ?? null;
  const quantity = [...stockRows, ...receiptRows].reduce((total, row) => snapshotAt && row.createdAt <= snapshotAt ? total : total + Number(row.quantityDelta), baseline);
  return Math.round(quantity * 1_000) / 1_000;
}

async function prepareJob(job: OutboundJob): Promise<PreparedJob | null> {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [mapping] = await db.select({ storeUuid: operationalStoreMappings.evotorTerminalUuid, storeName: operationalStoreMappings.evotorStoreName })
    .from(operationalStoreMappings).where(eq(operationalStoreMappings.storeId, job.storeId)).limit(1);
  if (!mapping?.storeUuid) throw new Error("Для склада не задана связь с Эвотор.");
  const [product] = await db.select({
    id: operationalCatalogProducts.id,
    catalogNumber: operationalCatalogProducts.catalogNumber,
    canonicalName: operationalCatalogProducts.canonicalName,
    baseUnit: operationalCatalogProducts.baseUnit,
    vatRate: operationalCatalogProducts.vatRate,
    markingCategory: operationalCatalogProducts.markingCategory,
    alcoholCode: operationalCatalogProducts.alcoholCode,
    alcoholTypeCode: operationalCatalogProducts.alcoholTypeCode,
    alcoholStrengthPercent: operationalCatalogProducts.alcoholStrengthPercent,
    alcoholVolumeLiters: operationalCatalogProducts.alcoholVolumeLiters,
    manualBarcodes: operationalCatalogProducts.manualBarcodes,
    barcodes: operationalCatalogProducts.barcodes,
    internalCostPrice: operationalCatalogProducts.internalCostPrice,
    isEvotorCostExportEnabled: operationalCatalogProducts.isEvotorCostExportEnabled,
    catalogCategoryId: operationalCatalogProducts.catalogCategoryId,
    evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
    isActive: operationalCatalogProducts.isActive,
    isEvotorExportEnabled: operationalCatalogProducts.isEvotorExportEnabled,
  }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, job.productId)).limit(1);
  if (!product || !product.isActive || !product.isEvotorExportEnabled) return null;
  const [linkRows, assignmentRows] = await Promise.all([
    db.select({ id: operationalEvotorProductLinks.id, externalProductId: operationalEvotorProductLinks.evotorProductId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt })
      .from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, job.storeId), eq(operationalEvotorProductLinks.productId, job.productId)))
      .orderBy(desc(operationalEvotorProductLinks.evotorQuantitySource), desc(operationalEvotorProductLinks.evotorQuantityUpdatedAt)).limit(1),
    db.select({ priceTypeId: operationalStorePriceTypes.priceTypeId }).from(operationalStorePriceTypes).where(eq(operationalStorePriceTypes.storeId, job.storeId)).limit(1),
  ]);
  const link = linkRows[0] ?? null;
  const assignment = assignmentRows[0] ?? null;
  const [priceRow] = assignment?.priceTypeId
    ? await db.select({ salePrice: operationalProductSalePrices.salePrice }).from(operationalProductSalePrices)
      .where(and(eq(operationalProductSalePrices.productId, product.id), eq(operationalProductSalePrices.priceTypeId, assignment.priceTypeId))).limit(1)
    : [];
  const quantity = await currentAccountingQuantity(job.storeId, job.productId, link ? { quantity: link.quantity, updatedAt: link.updatedAt } : null);
  let parentId: string | undefined;
  if (product.catalogCategoryId !== null) {
    const [category] = await db.select({ id: operationalCatalogCategories.id, name: operationalCatalogCategories.name, isActive: operationalCatalogCategories.isActive })
      .from(operationalCatalogCategories).where(eq(operationalCatalogCategories.id, product.catalogCategoryId)).limit(1);
    if (!category?.isActive) throw new Error("Для выгружаемого товара не найдена активная категория номенклатуры.");
    parentId = (await ensureEvotorProductGroups(mapping.storeUuid, [category])).get(category.id);
  } else {
    const sourceCategoryName = product.evotorCategoryName?.trim();
    if (sourceCategoryName) parentId = (await listEvotorProductGroups(mapping.storeUuid, await getEvotorApiToken()))
      .find(group => normalizedCategoryName(group.name) === normalizedCategoryName(sourceCategoryName))?.id;
    else {
      const remoteProducts = await listEvotorExistingProducts(mapping.storeUuid, await getEvotorApiToken());
      const remoteProduct = link?.externalProductId
        ? remoteProducts.find(candidate => candidate.id === link.externalProductId)
        : exactExistingProductMatch(product as ProductForOutbound, remoteProducts);
      parentId = remoteProduct?.parentId ?? undefined;
    }
    if (!parentId) throw new Error(`У товара «${product.canonicalName}» нет проверяемой категории Эвотор для сохранения при выгрузке.`);
  }
  return {
    job,
    storeUuid: mapping.storeUuid,
    storeName: mapping.storeName,
    product: product as ProductForOutbound,
    externalProductId: link?.externalProductId ?? stableEvotorProductId(mapping.storeUuid, product.id),
    quantity,
    price: priceRow ? Number(priceRow.salePrice) : undefined,
    hasExistingLink: Boolean(link),
    parentId,
  };
}

/**
 * Prepares one store's full catalog in five bounded database reads rather than
 * issuing a query per product. This keeps a 33×816 initial delivery a real
 * bulk operation instead of turning its local preparation into 26k round trips.
 */
async function prepareStoreJobs(jobs: OutboundJob[]): Promise<PreparedJob[]> {
  if (!jobs.length) return [];
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const storeId = jobs[0].storeId;
  const productIds = normalizedIds(jobs.map(job => job.productId));
  const [mappingRows, products, linkRows, assignmentRows, stockMovements, receiptMovements] = await Promise.all([
    db.select({ storeUuid: operationalStoreMappings.evotorTerminalUuid, storeName: operationalStoreMappings.evotorStoreName })
      .from(operationalStoreMappings).where(eq(operationalStoreMappings.storeId, storeId)).limit(1),
    db.select({
      id: operationalCatalogProducts.id, catalogNumber: operationalCatalogProducts.catalogNumber, canonicalName: operationalCatalogProducts.canonicalName,
      baseUnit: operationalCatalogProducts.baseUnit, vatRate: operationalCatalogProducts.vatRate, markingCategory: operationalCatalogProducts.markingCategory,
      alcoholCode: operationalCatalogProducts.alcoholCode, alcoholTypeCode: operationalCatalogProducts.alcoholTypeCode,
      alcoholStrengthPercent: operationalCatalogProducts.alcoholStrengthPercent, alcoholVolumeLiters: operationalCatalogProducts.alcoholVolumeLiters,
      manualBarcodes: operationalCatalogProducts.manualBarcodes, barcodes: operationalCatalogProducts.barcodes, internalCostPrice: operationalCatalogProducts.internalCostPrice, isEvotorCostExportEnabled: operationalCatalogProducts.isEvotorCostExportEnabled, catalogCategoryId: operationalCatalogProducts.catalogCategoryId, evotorCategoryName: operationalCatalogProducts.evotorCategoryName,
      isActive: operationalCatalogProducts.isActive, isEvotorExportEnabled: operationalCatalogProducts.isEvotorExportEnabled,
    }).from(operationalCatalogProducts).where(and(inArray(operationalCatalogProducts.id, productIds), eq(operationalCatalogProducts.isActive, true), eq(operationalCatalogProducts.isEvotorExportEnabled, true))),
    db.select({ productId: operationalEvotorProductLinks.productId, externalProductId: operationalEvotorProductLinks.evotorProductId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt, source: operationalEvotorProductLinks.evotorQuantitySource })
      .from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, storeId), inArray(operationalEvotorProductLinks.productId, productIds)))
      .orderBy(desc(operationalEvotorProductLinks.evotorQuantitySource), desc(operationalEvotorProductLinks.evotorQuantityUpdatedAt)),
    db.select({ priceTypeId: operationalStorePriceTypes.priceTypeId }).from(operationalStorePriceTypes).where(eq(operationalStorePriceTypes.storeId, storeId)).limit(1),
    db.select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
      .from(operationalStockMovements).where(and(eq(operationalStockMovements.storeId, storeId), inArray(operationalStockMovements.productId, productIds))),
    db.select({ productId: operationalEvotorReceiptStockMovements.productId, quantityDelta: operationalEvotorReceiptStockMovements.quantityDelta, createdAt: operationalEvotorReceiptStockMovements.occurredAt })
      .from(operationalEvotorReceiptStockMovements).where(and(eq(operationalEvotorReceiptStockMovements.storeId, storeId), inArray(operationalEvotorReceiptStockMovements.productId, productIds))),
  ]);
  const mapping = mappingRows[0];
  if (!mapping?.storeUuid) throw new Error("Для склада не задана связь с Эвотор.");
  const categoryIds = Array.from(new Set(products.map(product => product.catalogCategoryId).filter((id): id is number => Number.isInteger(id))));
  const archivedSourceCategoryNames = Array.from(new Set(products.filter(product => product.catalogCategoryId === null).map(product => product.evotorCategoryName?.trim() ?? "").filter(Boolean)));
  const productsWithoutAnyCategory = products.filter(product => product.catalogCategoryId === null && !product.evotorCategoryName?.trim());
  const categories = await db.select({ id: operationalCatalogCategories.id, name: operationalCatalogCategories.name })
    .from(operationalCatalogCategories).where(and(inArray(operationalCatalogCategories.id, categoryIds), eq(operationalCatalogCategories.isActive, true)));
  if (categories.length !== categoryIds.length) throw new Error("Для выгружаемого товара не найдена активная категория номенклатуры.");
  const parentIdByCategory = await ensureEvotorProductGroups(mapping.storeUuid, categories);
  const archivedParentIdByName = new Map((await listEvotorProductGroups(mapping.storeUuid, await getEvotorApiToken()))
    .filter(group => archivedSourceCategoryNames.includes(group.name))
    .map(group => [normalizedCategoryName(group.name), group.id]));
  const linkedRemoteParentByProductId = new Map<number, string>();
  if (productsWithoutAnyCategory.length) {
    const remoteById = new Map((await listEvotorExistingProducts(mapping.storeUuid, await getEvotorApiToken())).map(product => [product.id, product]));
    for (const product of productsWithoutAnyCategory) {
      const externalProductId = linkRows.find(link => link.productId === product.id)?.externalProductId;
      const remoteProduct = externalProductId ? remoteById.get(externalProductId) : exactExistingProductMatch(product as ProductForOutbound, Array.from(remoteById.values()));
      const parentId = remoteProduct?.parentId ?? null;
      if (!parentId) throw new Error(`У товара «${product.canonicalName}» нет проверяемой категории Эвотор для сохранения при выгрузке.`);
      linkedRemoteParentByProductId.set(product.id, parentId);
    }
  }
  const priceRows = assignmentRows[0]
    ? await db.select({ productId: operationalProductSalePrices.productId, salePrice: operationalProductSalePrices.salePrice }).from(operationalProductSalePrices)
      .where(and(eq(operationalProductSalePrices.priceTypeId, assignmentRows[0].priceTypeId), inArray(operationalProductSalePrices.productId, productIds)))
    : [];
  const productById = new Map(products.map(product => [product.id, product as ProductForOutbound]));
  const linkByProductId = new Map<number, typeof linkRows[number]>();
  for (const link of linkRows) if (!linkByProductId.has(link.productId)) linkByProductId.set(link.productId, link);
  const priceByProductId = new Map(priceRows.map(row => [row.productId, Number(row.salePrice)]));
  const movementsByProductId = new Map<number, Array<{ productId: number; quantityDelta: string; createdAt: Date }>>();
  for (const movement of [...stockMovements, ...receiptMovements]) movementsByProductId.set(movement.productId, [...(movementsByProductId.get(movement.productId) ?? []), movement]);
  return jobs.flatMap(job => {
    const product = productById.get(job.productId);
    if (!product) return [];
    const link = linkByProductId.get(job.productId);
    const baseline = link?.quantity === null || link?.quantity === undefined ? 0 : Number(link.quantity);
    const ledgerQuantity = Math.round((baseline + (movementsByProductId.get(job.productId) ?? [])
      .filter(movement => !link?.updatedAt || movement.createdAt > link.updatedAt)
      .reduce((total, movement) => total + Number(movement.quantityDelta), 0)) * 1_000) / 1_000;
    // The one-off reset is impossible to trigger through normal catalog, price or
    // stock flows: it requires the reserved source key created after explicit
    // confirmation, and preserves the local ledger instead of rewriting it.
    const quantity = isConfirmedResetJob(job) ? 999 : ledgerQuantity;
    const parentId = product.catalogCategoryId === null
      ? (product.evotorCategoryName ? archivedParentIdByName.get(normalizedCategoryName(product.evotorCategoryName)) : linkedRemoteParentByProductId.get(product.id))
      : parentIdByCategory.get(product.catalogCategoryId);
    if (!parentId) throw new Error("Для выгружаемого товара не сопоставлена категория Эвотор.");
    return [{ job, storeUuid: mapping.storeUuid!, storeName: mapping.storeName, product, externalProductId: link?.externalProductId ?? stableEvotorProductId(mapping.storeUuid!, product.id), quantity, price: priceByProductId.get(product.id), hasExistingLink: Boolean(link), parentId }];
  });
}

/** Prepares a deletion only from a retained exact store/product link. */
async function prepareStoreArchiveJobs(jobs: OutboundJob[]): Promise<PreparedArchiveJob[]> {
  if (!jobs.length) return [];
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const storeId = jobs[0].storeId;
  const productIds = normalizedIds(jobs.map(job => job.productId));
  const [mappingRows, productRows, linkRows] = await Promise.all([
    db.select({ storeUuid: operationalStoreMappings.evotorTerminalUuid, storeName: operationalStoreMappings.evotorStoreName })
      .from(operationalStoreMappings).where(eq(operationalStoreMappings.storeId, storeId)).limit(1),
    db.select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName })
      .from(operationalCatalogProducts).where(inArray(operationalCatalogProducts.id, productIds)),
    db.select({ productId: operationalEvotorProductLinks.productId, externalProductId: operationalEvotorProductLinks.evotorProductId })
      .from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, storeId), inArray(operationalEvotorProductLinks.productId, productIds))),
  ]);
  const mapping = mappingRows[0];
  if (!mapping?.storeUuid) throw new Error("Для склада не задана связь с Эвотор.");
  const productNameById = new Map(productRows.map(product => [product.id, product.canonicalName]));
  const linkByProductId = new Map(linkRows.map(link => [link.productId, link.externalProductId]));
  return jobs.flatMap(job => {
    const externalProductId = linkByProductId.get(job.productId);
    const productName = productNameById.get(job.productId);
    return externalProductId && productName ? [{ job, storeUuid: mapping.storeUuid!, storeName: mapping.storeName, externalProductId, productName }] : [];
  });
}

function fullProductPayload(prepared: PreparedJob): EvotorProductPayload {
  if (!prepared.parentId) throw new Error("Для полного обновления товара не сопоставлена категория Эвотор.");
  return buildEvotorProductPayload({
    ...prepared.product,
    alcoholStrengthPercent: prepared.product.alcoholStrengthPercent === null ? null : String(prepared.product.alcoholStrengthPercent),
    alcoholVolumeLiters: prepared.product.alcoholVolumeLiters === null ? null : String(prepared.product.alcoholVolumeLiters),
    price: prepared.price,
    quantity: prepared.quantity,
    parentId: prepared.parentId,
  }, prepared.externalProductId);
}

function patchPayload(prepared: PreparedJob) {
  // V2 PATCH is deliberately limited to price, cost and quantity. Product card
  // fields (name, barcode, category, unit, article and marking) must use the
  // documented single-object PUT replacement below.
  return { quantity: prepared.quantity, price: prepared.price ?? 0 };
}

function needsBulk(prepared: PreparedJob) {
  // A pre-existing Evotor link must retain its platform product data. All local
  // stock/price actions are safe partial PATCHes; only a truly new linked item
  // receives a full client-ID PUT bulk object.
  return prepared.job.reason === "full_catalog_export" || !prepared.hasExistingLink;
}

function needsProductReplace(prepared: PreparedJob) {
  return prepared.job.reason === "catalog_update" || prepared.job.reason === "catalog_enable";
}

async function ensureProductLinks(prepared: PreparedJob[]) {
  const db = await getDb();
  if (!db) return;
  for (const item of prepared) {
    if (item.hasExistingLink) continue;
    const [existing] = await db.select({ id: operationalEvotorProductLinks.id }).from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, item.job.storeId), eq(operationalEvotorProductLinks.productId, item.job.productId))).limit(1);
    const resetValues = isConfirmedResetJob(item.job)
      ? { evotorQuantitySnapshot: "999.000", evotorQuantityUpdatedAt: new Date(), evotorQuantitySource: "confirmed_reset" as const }
      : {};
    if (existing) {
      // The full V2 PUT created a new remote UUID after a prior local pointer was
      // absent from the prepared job. Retain exactly one current identity instead
      // of silently leaving that stale pointer beside the newly created product.
      await db.update(operationalEvotorProductLinks).set({ evotorProductId: item.externalProductId, ...resetValues })
        .where(eq(operationalEvotorProductLinks.id, existing.id));
    } else {
      await db.insert(operationalEvotorProductLinks).values({
        storeId: item.job.storeId,
        evotorProductId: item.externalProductId,
        productId: item.job.productId,
        evotorQuantitySnapshot: isConfirmedResetJob(item.job) ? "999.000" : null,
        evotorQuantityUpdatedAt: isConfirmedResetJob(item.job) ? new Date() : null,
        evotorQuantitySource: isConfirmedResetJob(item.job) ? "confirmed_reset" : "catalog",
        linkedByAccountId: null,
      });
    }
  }
}

/**
 * A bulk PUT replaces only the exact client-side UUID. Before creating a UUID for
 * a local item without a usable link, read the target store and recover a single
 * unambiguous existing identity by canonical name plus barcode. This prevents a
 * second product after an Evotor restore or a legacy catalog import. Ambiguity is
 * deliberately retried, never "solved" by creating another product.
 */
async function recoverExistingEvotorProductLinks(prepared: PreparedJob[]) {
  if (!prepared.length) return { recovered: 0 };
  // A retained exact store/product link is already the identity proof required
  // for PUT/PATCH. Do not reread the whole external catalogue just to rediscover
  // it: on a large point this wastes the request budget and can time out an
  // otherwise safe one-item metadata repair.
  if (prepared.every(item => item.hasExistingLink)) return { recovered: 0 };
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const token = await getEvotorApiToken();
  const remoteProducts = await listEvotorExistingProducts(prepared[0].storeUuid, token);
  const remoteIds = new Set(remoteProducts.map(product => product.id));
  let recovered = 0;
  const recoveredProductIds: number[] = [];
  for (const item of prepared) {
    if (remoteIds.has(item.externalProductId)) continue;
    const sameName = remoteProducts.filter(candidate => normalizedProductName(candidate.name) === normalizedProductName(item.product.canonicalName));
    const candidate = exactExistingProductMatch(item.product, remoteProducts);
    if (!candidate) {
      if (sameName.length) throw new Error(`В Эвоторе найдено несколько вариантов товара «${item.product.canonicalName}»; автоматическое создание остановлено до однозначного сопоставления.`);
      continue;
    }
    const [collision] = await db.select({ productId: operationalEvotorProductLinks.productId })
      .from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, item.job.storeId), eq(operationalEvotorProductLinks.evotorProductId, candidate.id)))
      .limit(1);
    if (collision && collision.productId !== item.job.productId) throw new Error(`Товар Эвотор «${item.product.canonicalName}» уже связан с другой позицией справочника; внешняя запись остановлена.`);
    const [local] = await db.select({ id: operationalEvotorProductLinks.id })
      .from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, item.job.storeId), eq(operationalEvotorProductLinks.productId, item.job.productId)))
      .limit(1);
    if (local) {
      await db.update(operationalEvotorProductLinks).set({ evotorProductId: candidate.id }).where(eq(operationalEvotorProductLinks.id, local.id));
    } else if (!collision) {
      await db.insert(operationalEvotorProductLinks).values({ storeId: item.job.storeId, productId: item.job.productId, evotorProductId: candidate.id, linkedByAccountId: null });
    }
    item.externalProductId = candidate.id;
    item.hasExistingLink = true;
    recovered += 1;
    recoveredProductIds.push(item.job.productId);
  }
  if (recovered) {
    await recordChange({
      action: "operational_evotor.outbound.link_recovered",
      entityType: "operational_evotor_product_link",
      entityId: `${prepared[0].job.storeId}:bulk-link-recovery:${recovered}`,
      afterState: { storeId: prepared[0].job.storeId, recovered, productIdsSample: recoveredProductIds.slice(0, 25), truncatedProductIds: Math.max(0, recoveredProductIds.length - 25), rule: "exact canonical name plus barcode; no automatic ambiguous merge" },
    });
  }
  return { recovered };
}

async function markJobsSucceeded(prepared: PreparedJob[], detail: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const ids = prepared.map(item => item.job.id);
  if (!ids.length) return;
  await db.update(operationalEvotorOutboundJobs).set({ status: "succeeded", completedAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null }).where(inArray(operationalEvotorOutboundJobs.id, ids));
  await ensureProductLinks(prepared);
  const resetItems = prepared.filter(item => isConfirmedResetJob(item.job));
  if (resetItems.length) {
    const resetAt = new Date();
    for (const item of resetItems) {
      await db.update(operationalEvotorProductLinks).set({
        evotorQuantitySnapshot: "999.000",
        evotorQuantityUpdatedAt: resetAt,
        evotorQuantitySource: "confirmed_reset",
      }).where(and(
        eq(operationalEvotorProductLinks.storeId, item.job.storeId),
        eq(operationalEvotorProductLinks.productId, item.job.productId),
      ));
    }
  }
  await recordChange({
    action: "operational_evotor.outbound.succeeded",
    entityType: "operational_evotor_outbound",
    entityId: ids.join(","),
    afterState: detail,
  });
}

async function markArchiveJobsSucceeded(prepared: PreparedArchiveJob[], detail: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  const ids = prepared.map(item => item.job.id);
  if (!ids.length) return;
  await db.transaction(async tx => {
    await tx.update(operationalEvotorOutboundJobs).set({ status: "succeeded", completedAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null }).where(inArray(operationalEvotorOutboundJobs.id, ids));
    for (const item of prepared) {
      await tx.delete(operationalEvotorProductLinks).where(and(
        eq(operationalEvotorProductLinks.storeId, item.job.storeId),
        eq(operationalEvotorProductLinks.productId, item.job.productId),
        eq(operationalEvotorProductLinks.evotorProductId, item.externalProductId),
      ));
    }
  });
  await recordChange({
    action: "operational_evotor.outbound.catalog_archive_succeeded",
    entityType: "operational_evotor_outbound",
    entityId: ids.join(","),
    afterState: detail,
  });
}

async function submitBulk(prepared: PreparedJob[]) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const first = prepared[0];
  const startedAt = Date.now();
  const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(first.storeUuid)}/products`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${await getEvotorApiToken()}`,
      Accept: EVOTOR_MEDIA_TYPE,
      "Content-Type": EVOTOR_BULK_MEDIA_TYPE,
    },
    body: JSON.stringify(prepared.map(fullProductPayload)),
    signal: AbortSignal.timeout(55_000),
  });
  const requestDurationMs = Date.now() - startedAt;
  const rateLimit = rateLimitFrom(response);
  const body = await responseBody(response);
  if (!response.ok) throw new Error(`Эвотор не принял bulk-выгрузку (HTTP ${response.status}).`);
  const taskId = bulkTaskId(body);
  if (!taskId) {
    await markJobsSucceeded(prepared, { mode: "bulk-immediate", storeId: first.job.storeId, store: first.storeName, products: prepared.length, requestDurationMs, rateLimit, priceIncluded: prepared.filter(item => item.price !== undefined).length });
    return { mode: "bulk-immediate" as const, requestDurationMs, rateLimit, taskId: null };
  }
  await db.update(operationalEvotorOutboundJobs).set({ status: "submitted", externalBulkId: taskId, bulkSubmittedAt: new Date(), lastAttemptAt: new Date(), lastError: null })
    .where(inArray(operationalEvotorOutboundJobs.id, prepared.map(item => item.job.id)));
  await recordChange({
    action: "operational_evotor.outbound.bulk_submitted",
    entityType: "operational_evotor_bulk",
    entityId: taskId,
    afterState: { storeId: first.job.storeId, store: first.storeName, products: prepared.length, jobIds: prepared.map(item => item.job.id), requestDurationMs, rateLimit, priceIncluded: prepared.filter(item => item.price !== undefined).length },
  });
  return { mode: "bulk-submitted" as const, requestDurationMs, rateLimit, taskId };
}

async function sendPatch(prepared: PreparedJob) {
  const startedAt = Date.now();
  const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(prepared.storeUuid)}/products/${encodeURIComponent(prepared.externalProductId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await getEvotorApiToken()}`, Accept: EVOTOR_MEDIA_TYPE, "Content-Type": EVOTOR_MEDIA_TYPE },
    body: JSON.stringify(patchPayload(prepared)),
    signal: AbortSignal.timeout(20_000),
  });
  const requestDurationMs = Date.now() - startedAt;
  const rateLimit = rateLimitFrom(response);
  if (!response.ok) throw new Error(`Эвотор не принял изменение остатка (HTTP ${response.status}).`);
  await markJobsSucceeded([prepared], { mode: "patch", storeId: prepared.job.storeId, store: prepared.storeName, productId: prepared.job.productId, product: prepared.product.canonicalName, quantity: prepared.quantity, priceIncluded: prepared.price !== undefined, requestDurationMs, rateLimit });
  return { requestDurationMs, rateLimit };
}

/** Replaces one retained external product when a real card field changed. */
async function replaceProduct(prepared: PreparedJob) {
  const startedAt = Date.now();
  const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(prepared.storeUuid)}/products/${encodeURIComponent(prepared.externalProductId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${await getEvotorApiToken()}`, Accept: EVOTOR_MEDIA_TYPE, "Content-Type": EVOTOR_MEDIA_TYPE },
    body: JSON.stringify(fullProductPayload(prepared)),
    signal: AbortSignal.timeout(20_000),
  });
  const requestDurationMs = Date.now() - startedAt;
  const rateLimit = rateLimitFrom(response);
  if (!response.ok) throw new Error(`Эвотор не принял замену карточки номенклатуры (HTTP ${response.status}).`);
  await markJobsSucceeded([prepared], {
    mode: "put",
    storeId: prepared.job.storeId,
    store: prepared.storeName,
    productId: prepared.job.productId,
    product: prepared.product.canonicalName,
    quantity: prepared.quantity,
    priceIncluded: prepared.price !== undefined,
    requestDurationMs,
    rateLimit,
  });
  return { requestDurationMs, rateLimit };
}

/** Deletes up to 1,000 exact IDs in the documented V2 request shape. */
async function deleteCatalogArchive(prepared: PreparedArchiveJob[]) {
  const startedAt = Date.now();
  let rateLimit: EvotorRateLimit = { limit: null, remaining: null, reset: null };
  for (let index = 0; index < prepared.length; index += 1_000) {
    const chunk = prepared.slice(index, index + 1_000);
    const url = new URL(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(chunk[0].storeUuid)}/products`);
    url.searchParams.set("id", chunk.map(item => item.externalProductId).join(","));
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${await getEvotorApiToken()}`, Accept: EVOTOR_MEDIA_TYPE },
      signal: AbortSignal.timeout(20_000),
    });
    rateLimit = rateLimitFrom(response);
    if (!response.ok) throw new Error(`Эвотор не принял удаление товара (HTTP ${response.status}).`);
  }
  return { requestDurationMs: Date.now() - startedAt, rateLimit };
}

async function reconcileSubmittedBulkTasks(limit = 80) {
  const db = await getDb();
  if (!db) return { checked: 0, succeeded: 0, failed: 0, pending: 0 };
  // Limit task IDs, not rows: one 816-product bulk must not crowd the other
  // 32 store tasks out of a status pass.
  const taskRows = await db.select({ externalBulkId: operationalEvotorOutboundJobs.externalBulkId, submittedAt: sql<Date>`min(${operationalEvotorOutboundJobs.bulkSubmittedAt})` })
    .from(operationalEvotorOutboundJobs)
    .where(and(eq(operationalEvotorOutboundJobs.status, "submitted"), isNotNull(operationalEvotorOutboundJobs.externalBulkId)))
    .groupBy(operationalEvotorOutboundJobs.externalBulkId)
    .orderBy(asc(sql`min(${operationalEvotorOutboundJobs.bulkSubmittedAt})`))
    .limit(limit);
  const taskIds = taskRows.map(row => row.externalBulkId).filter((id): id is string => Boolean(id));
  const jobs = taskIds.length ? await db.select().from(operationalEvotorOutboundJobs)
    .where(and(eq(operationalEvotorOutboundJobs.status, "submitted"), inArray(operationalEvotorOutboundJobs.externalBulkId, taskIds))) : [];
  const grouped = new Map<string, OutboundJob[]>();
  for (const job of jobs) if (job.externalBulkId) grouped.set(job.externalBulkId, [...(grouped.get(job.externalBulkId) ?? []), job]);
  let succeeded = 0;
  let failed = 0;
  let pending = 0;
  const reconcileOne = async (entry: [string, OutboundJob[]]) => {
    const taskId = entry[0];
    const taskJobs: OutboundJob[] = entry[1];
    try {
      const response = await fetch(`${EVOTOR_API_BASE_URL}/bulks/${encodeURIComponent(taskId)}`, { headers: { Authorization: `Bearer ${await getEvotorApiToken()}`, Accept: EVOTOR_MEDIA_TYPE }, signal: AbortSignal.timeout(20_000) });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(`Не удалось получить статус bulk-задачи Эвотор (HTTP ${response.status}).`);
      const state = bulkTaskState(body);
      if (state === "pending") { pending += 1; return; }
      if (state === "failed") {
        failed += 1;
        for (const job of taskJobs) {
          const status = job.attemptCount + 1 >= MAX_ATTEMPTS ? "failed" : "retry";
          await db.update(operationalEvotorOutboundJobs).set({ status, lastError: "Bulk-задача Эвотор завершилась ошибкой; запись будет повторена автоматически." }).where(eq(operationalEvotorOutboundJobs.id, job.id));
        }
        await recordChange({ action: "operational_evotor.outbound.bulk_failed", entityType: "operational_evotor_bulk", entityId: taskId, afterState: { jobs: taskJobs.map(job => job.id), status: "retry" } });
        return;
      }
      const prepared = await prepareStoreJobs(taskJobs);
      await markJobsSucceeded(prepared, { mode: "bulk-confirmed", bulkTaskId: taskId, products: prepared.length });
      succeeded += 1;
    } catch (error) {
      pending += 1;
      const message = russianOutboundError(error);
      await db.update(operationalEvotorOutboundJobs).set({ lastError: message }).where(inArray(operationalEvotorOutboundJobs.id, taskJobs.map(job => job.id)));
    }
  };
  const entries = Array.from(grouped.entries());
  for (let index = 0; index < entries.length; index += BULK_SUBMISSION_CONCURRENCY) {
    await Promise.all(entries.slice(index, index + BULK_SUBMISSION_CONCURRENCY).map(reconcileOne));
  }
  return { checked: grouped.size, succeeded, failed, pending };
}

/**
 * Sends stock and price updates with PATCH, card replacements with single-object PUT,
 * and initial/mapping work with one bulk PUT
 * per store (up to 5,000 products). The remote task ID is retained until GET /bulks/{id}
 * confirms success, so response acceptance never masquerades as completed delivery.
 */
export async function dispatchOperationalEvotorOutbound(input?: { limit?: number; storeIds?: number[]; productIds?: number[]; storeLimit?: number }) {
  const db = await getDb();
  if (!db) return { attempted: 0, submitted: 0, sent: 0, skipped: 0, failed: 0, bulk: { checked: 0, succeeded: 0, failed: 0, pending: 0 } };
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  await db.update(operationalEvotorOutboundJobs).set({ status: "retry", lastError: "Предыдущая попытка не завершилась; отправка повторена автоматически." })
    .where(and(eq(operationalEvotorOutboundJobs.status, "processing"), lt(operationalEvotorOutboundJobs.lastAttemptAt, staleBefore)));
  const bulk = await reconcileSubmittedBulkTasks();
  const conditions = [
    inArray(operationalEvotorOutboundJobs.status, ["pending", "retry"]),
    input?.storeIds?.length ? inArray(operationalEvotorOutboundJobs.storeId, normalizedIds(input.storeIds)) : undefined,
    input?.productIds?.length ? inArray(operationalEvotorOutboundJobs.productId, normalizedIds(input.productIds)) : undefined,
  ].filter(Boolean);
  const rawJobs = await db.select().from(operationalEvotorOutboundJobs).where(and(...conditions))
    .orderBy(asc(operationalEvotorOutboundJobs.createdAt), asc(operationalEvotorOutboundJobs.id)).limit(Math.max(input?.limit ?? MAX_BULK_PRODUCTS * DEFAULT_STORE_BATCH, MAX_BULK_PRODUCTS));
  const byStoreProduct = new Map<string, OutboundJob>();
  for (const job of rawJobs) byStoreProduct.set(`${job.storeId}:${job.productId}`, job);
  const storesInOrder = Array.from(new Set(Array.from(byStoreProduct.values()).map(job => job.storeId))).slice(0, input?.storeLimit ?? DEFAULT_STORE_BATCH);
  const jobs = Array.from(byStoreProduct.values()).filter(job => storesInOrder.includes(job.storeId));
  let submitted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const byStore = new Map<number, OutboundJob[]>();
  for (const job of jobs) byStore.set(job.storeId, [...(byStore.get(job.storeId) ?? []), job]);

  const sendStoreJobs = async (storeJobs: OutboundJob[]) => {
    const archiveJobs = storeJobs.filter(job => job.reason === "catalog_archive");
    if (archiveJobs.length) {
      const archivePrepared = await prepareStoreArchiveJobs(archiveJobs);
      const archiveSkippedIds = archiveJobs.filter(job => !archivePrepared.some(item => item.job.id === job.id)).map(job => job.id);
      if (archiveSkippedIds.length) {
        await db.update(operationalEvotorOutboundJobs).set({ status: "succeeded", completedAt: new Date(), lastError: "Связь с товаром Эвотор уже отсутствует; внешнее удаление не требовалось." }).where(inArray(operationalEvotorOutboundJobs.id, archiveSkippedIds));
        skipped += archiveSkippedIds.length;
      }
      if (archivePrepared.length) {
        await db.update(operationalEvotorOutboundJobs).set({ status: "processing", attemptCount: sql`${operationalEvotorOutboundJobs.attemptCount} + 1`, lastAttemptAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null })
          .where(inArray(operationalEvotorOutboundJobs.id, archivePrepared.map(item => item.job.id)));
        try {
          const result = await deleteCatalogArchive(archivePrepared);
          await markArchiveJobsSucceeded(archivePrepared, { mode: "catalog-archive-delete", storeId: archivePrepared[0].job.storeId, store: archivePrepared[0].storeName, products: archivePrepared.length, productIds: archivePrepared.map(item => item.job.productId), requestDurationMs: result.requestDurationMs, rateLimit: result.rateLimit });
          sent += archivePrepared.length;
        } catch (error) {
          failed += archivePrepared.length;
          const message = russianOutboundError(error);
          for (const item of archivePrepared) {
            const status = item.job.attemptCount + 1 >= MAX_ATTEMPTS ? "failed" : "retry";
            await db.update(operationalEvotorOutboundJobs).set({ status, lastError: message }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
          }
        }
      }
    }
    const writeJobs = storeJobs.filter(job => job.reason !== "catalog_archive");
    if (!writeJobs.length) return;
    const prepared = await prepareStoreJobs(writeJobs);
    const skippedIds = writeJobs.filter(job => !prepared.some(item => item.job.id === job.id)).map(job => job.id);
    if (skippedIds.length) {
      await db.update(operationalEvotorOutboundJobs).set({ status: "succeeded", completedAt: new Date(), lastError: "Товар выключен из выгрузки до отправки; внешняя запись не выполнялась." }).where(inArray(operationalEvotorOutboundJobs.id, skippedIds));
      skipped += skippedIds.length;
    }
    await recoverExistingEvotorProductLinks(prepared);
    const bulkItems = prepared.filter(needsBulk).slice(0, MAX_BULK_PRODUCTS);
    const replaceItems = prepared.filter(item => !needsBulk(item) && needsProductReplace(item));
    const patchItems = prepared.filter(item => !needsBulk(item) && !needsProductReplace(item));
    if (bulkItems.length) {
      await db.update(operationalEvotorOutboundJobs).set({ status: "processing", attemptCount: sql`${operationalEvotorOutboundJobs.attemptCount} + 1`, lastAttemptAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null })
        .where(inArray(operationalEvotorOutboundJobs.id, bulkItems.map(item => item.job.id)));
      try {
        const result = await submitBulk(bulkItems);
        if (result.mode === "bulk-submitted") submitted += bulkItems.length;
        else sent += bulkItems.length;
      } catch (error) {
        failed += bulkItems.length;
        const message = russianOutboundError(error);
        for (const item of bulkItems) {
          const status = item.job.attemptCount + 1 >= MAX_ATTEMPTS ? "failed" : "retry";
          await db.update(operationalEvotorOutboundJobs).set({ status, lastError: message }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
        }
      }
    }
    for (const item of replaceItems) {
      await db.update(operationalEvotorOutboundJobs).set({ status: "processing", attemptCount: sql`${operationalEvotorOutboundJobs.attemptCount} + 1`, lastAttemptAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
      try { await replaceProduct(item); sent += 1; }
      catch (error) {
        failed += 1;
        const message = russianOutboundError(error);
        const status = item.job.attemptCount + 1 >= MAX_ATTEMPTS ? "failed" : "retry";
        await db.update(operationalEvotorOutboundJobs).set({ status, lastError: message }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
      }
    }
    for (const item of patchItems) {
      await db.update(operationalEvotorOutboundJobs).set({ status: "processing", attemptCount: sql`${operationalEvotorOutboundJobs.attemptCount} + 1`, lastAttemptAt: new Date(), lastError: null, externalBulkId: null, bulkSubmittedAt: null }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
      try { await sendPatch(item); sent += 1; }
      catch (error) {
        failed += 1;
        const message = russianOutboundError(error);
        const status = item.job.attemptCount + 1 >= MAX_ATTEMPTS ? "failed" : "retry";
        await db.update(operationalEvotorOutboundJobs).set({ status, lastError: message }).where(eq(operationalEvotorOutboundJobs.id, item.job.id));
      }
    }
  };
  const storeGroups = Array.from(byStore.values());
  for (let index = 0; index < storeGroups.length; index += BULK_SUBMISSION_CONCURRENCY) {
    await Promise.all(storeGroups.slice(index, index + BULK_SUBMISSION_CONCURRENCY).map(sendStoreJobs));
  }
  return { attempted: jobs.length, submitted, sent, skipped, failed, bulk };
}

/** Queue first; initial changes use one bulk request per affected store, then the minute callback confirms tasks. */
export async function queueAndDispatchOperationalEvotorOutbound(input: QueueInput | (Omit<QueueInput, "storeIds"> & { storeIds?: undefined })) {
  const queued = "storeIds" in input && input.storeIds ? await enqueueOperationalEvotorOutbound(input as QueueInput) : await enqueueOperationalEvotorOutboundForMappedStores(input as Omit<QueueInput, "storeIds">);
  const dispatch = queued.queued ? await dispatchOperationalEvotorOutbound({ storeIds: "storeIds" in input && input.storeIds ? input.storeIds : undefined, productIds: input.productIds, storeLimit: DEFAULT_STORE_BATCH }) : { attempted: 0, submitted: 0, sent: 0, skipped: 0, failed: 0, bulk: { checked: 0, succeeded: 0, failed: 0, pending: 0 } };
  return { ...queued, dispatch };
}

/** Archive delivery follows the same durable-first rule, then dispatches exact linked deletes now. */
export async function queueAndDispatchOperationalEvotorCatalogArchive(input: { productId: number; sourceKey: string }) {
  const queued = await enqueueOperationalEvotorCatalogArchive(input);
  const dispatch = queued.queued
    ? await dispatchOperationalEvotorOutbound({ productIds: [input.productId], storeLimit: DEFAULT_STORE_BATCH })
    : { attempted: 0, submitted: 0, sent: 0, skipped: 0, failed: 0, bulk: { checked: 0, succeeded: 0, failed: 0, pending: 0 } };
  return { ...queued, dispatch };
}

/** Same durable delivery rule, with an explicit all-mapped-store scope for a newly enabled item. */
export async function queueAndDispatchOperationalEvotorBroadcast(input: Omit<QueueInput, "storeIds">) {
  const queued = await enqueueOperationalEvotorOutboundToAllMappedStores(input);
  const dispatch = queued.queued ? await dispatchOperationalEvotorOutbound({ productIds: input.productIds, storeLimit: DEFAULT_STORE_BATCH }) : { attempted: 0, submitted: 0, sent: 0, skipped: 0, failed: 0, bulk: { checked: 0, succeeded: 0, failed: 0, pending: 0 } };
  return { ...queued, dispatch };
}

export const __evotorOutboundInternals = { normalizedIds, russianOutboundError, bulkTaskId, bulkTaskState, needsBulk, needsProductReplace, patchPayload };
