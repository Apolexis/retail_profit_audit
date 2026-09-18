import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  localAccounts,
  operationalCatalogProducts,
  operationalInventories,
  operationalInventoryLines,
  operationalStockMovements,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listEvotorCatalogPreviewForOperationalStore } from "./evotorCatalog";

export type InventoryUnit = "kg" | "l" | "piece";
export type InventoryStatus = "draft" | "closed";
export type InventoryVatRate = "VAT_10" | "VAT_22";

const isoDate = /^20\d{2}-\d{2}-\d{2}$/;
const finiteThreeDecimals = (value: number) => Number.isFinite(value) && value >= 0 && Math.round(value * 1000) === value * 1000;
const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ");

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
  const conditions = [eq(operationalStockMovements.storeId, storeId), productIds?.length ? inArray(operationalStockMovements.productId, productIds) : undefined].filter(Boolean);
  const rows = await db.select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta }).from(operationalStockMovements).where(and(...conditions));
  const quantities = new Map<number, number>();
  for (const row of rows) quantities.set(row.productId, Math.round(((quantities.get(row.productId) ?? 0) + Number(row.quantityDelta)) * 1000) / 1000);
  return quantities;
}

export async function listInventoryProducts(input?: { storeId?: number; includeAccounting?: boolean; includeInactive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: operationalCatalogProducts.id,
      internalCode: operationalCatalogProducts.evotorCode,
      canonicalName: operationalCatalogProducts.canonicalName,
      baseUnit: operationalCatalogProducts.baseUnit,
      vatRate: operationalCatalogProducts.vatRate,
      evotorCostPrice: operationalCatalogProducts.evotorCostPrice,
      internalCostPrice: operationalCatalogProducts.internalCostPrice,
      isActive: operationalCatalogProducts.isActive,
    })
    .from(operationalCatalogProducts)
    .where(and(eq(operationalCatalogProducts.storeId, input?.storeId ?? 0), input?.includeInactive ? undefined : eq(operationalCatalogProducts.isActive, true)))
    .orderBy(operationalCatalogProducts.canonicalName)
    .limit(2_000);
  const products = rows.filter((row): row is typeof row & { baseUnit: InventoryUnit } => row.baseUnit !== "unknown").map(row => ({ ...row, internalCode: row.internalCode || `Эвотор #${row.id}`, category: null, variant: null }));
  const quantities = input?.includeAccounting && input.storeId ? await getInventoryAccountingQuantities(input.storeId, products.map(product => product.id)) : null;
  return products.map(product => ({ ...product, accountingQuantity: quantities?.get(product.id) ?? null }));
}

/**
 * Current operational stock is a projection of closed inventory movements.
 * A null quantity means that the product has not yet been counted, rather than
 * a fictitious zero. This is intentionally separate from the inventory draft.
 */
export async function listOperationalStock(input: { storeIds?: number[] | null; storeId?: number; query?: string; offset?: number; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return { items: [], total: 0 };
  const conditions = [
    input.storeId ? eq(operationalCatalogProducts.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalCatalogProducts.storeId, input.storeIds) : undefined,
    eq(operationalCatalogProducts.isActive, true),
  ].filter(Boolean);
  const catalog = await db
    .select({
      productId: operationalCatalogProducts.id,
      storeId: operationalCatalogProducts.storeId,
      storeName: stores.name,
      internalCode: operationalCatalogProducts.evotorCode,
      canonicalName: operationalCatalogProducts.canonicalName,
      baseUnit: operationalCatalogProducts.baseUnit,
      vatRate: operationalCatalogProducts.vatRate,
    })
    .from(operationalCatalogProducts)
    .innerJoin(stores, eq(operationalCatalogProducts.storeId, stores.id))
    .where(and(...conditions))
    .orderBy(stores.name, operationalCatalogProducts.canonicalName)
    .limit(20_000);
  if (!catalog.length) return { items: [], total: 0 };
  const productIds = catalog.map(product => product.productId);
  const movements = await db
    .select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt })
    .from(operationalStockMovements)
    .where(inArray(operationalStockMovements.productId, productIds));
  const balanceByProduct = new Map<number, { quantity: number; lastCountedAt: Date | null }>();
  for (const movement of movements) {
    const current = balanceByProduct.get(movement.productId) ?? { quantity: 0, lastCountedAt: null };
    current.quantity = Math.round((current.quantity + Number(movement.quantityDelta)) * 1_000) / 1_000;
    if (!current.lastCountedAt || movement.createdAt > current.lastCountedAt) current.lastCountedAt = movement.createdAt;
    balanceByProduct.set(movement.productId, current);
  }
  const query = normalizedText(input.query ?? "").toLocaleLowerCase("ru-RU");
  const filtered = query
    ? catalog.filter(product => `${product.canonicalName} ${product.internalCode ?? ""} ${product.storeName}`.toLocaleLowerCase("ru-RU").includes(query))
    : catalog;
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? 50)), 100);
  return {
    total: filtered.length,
    items: filtered.slice(offset, offset + limit).map(product => {
      const balance = balanceByProduct.get(product.productId);
      return {
        ...product,
        internalCode: product.internalCode || `Эвотор #${product.productId}`,
        accountingQuantity: balance?.quantity ?? null,
        lastCountedAt: balance?.lastCountedAt ?? null,
      };
    }),
  };
}

/** Saves the confirmed Evotor catalog into this application's isolated operational nomenclature. */
export async function confirmOperationalCatalogFromEvotor(input: { storeId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const preview = await listEvotorCatalogPreviewForOperationalStore(input.storeId);
  if (!preview.products.length) throw new Error("В каталоге выбранной точки Эвотор нет товарных позиций для сохранения.");
  for (const product of preview.products) {
    const baseUnit = unitFromEvotor(product.unit);
    await db.insert(operationalCatalogProducts).values({
      storeId: input.storeId,
      evotorProductId: product.id,
      evotorCode: product.code,
      canonicalName: product.name,
      barcodes: product.barcodes,
      baseUnit,
      vatRate: product.vatRate,
      evotorCostPrice: "0.00",
      importedByAccountId: input.actorId,
    }).onDuplicateKeyUpdate({ set: {
      evotorCode: product.code,
      canonicalName: product.name,
      barcodes: product.barcodes,
      baseUnit,
      vatRate: product.vatRate,
      isActive: true,
      importedByAccountId: input.actorId,
      importedAt: new Date(),
    } });
  }
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

export async function createOperationalCatalogProduct(input: { storeId: number; canonicalName: string; baseUnit: InventoryUnit; vatRate?: InventoryVatRate; internalCostPrice?: number | null; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  if (input.internalCostPrice !== undefined && input.internalCostPrice !== null && (!Number.isFinite(input.internalCostPrice) || input.internalCostPrice < 0)) throw new Error("Внутренняя себестоимость должна быть неотрицательным числом.");
  const [inserted] = await db.insert(operationalCatalogProducts).values({
    storeId: input.storeId,
    evotorProductId: `manual:${randomUUID()}`,
    canonicalName,
    barcodes: [],
    baseUnit: input.baseUnit,
    vatRate: input.vatRate ?? "VAT_10",
    evotorCostPrice: "0.00",
    internalCostPrice: input.internalCostPrice === null || input.internalCostPrice === undefined ? null : input.internalCostPrice.toFixed(2),
    importedByAccountId: input.actorId,
  }).$returningId();
  const [after] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, inserted.id)).limit(1);
  return after!;
}

export async function updateOperationalCatalogProduct(input: { id: number; canonicalName: string; baseUnit: InventoryUnit; vatRate: InventoryVatRate }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [before] = await db.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.id)).limit(1);
  if (!before) throw new Error("Позиция рабочего справочника не найдена.");
  const canonicalName = normalizedText(input.canonicalName);
  if (!canonicalName) throw new Error("Введите название товара.");
  if (canonicalName.length > 512) throw new Error("Название товара слишком длинное.");
  await db.update(operationalCatalogProducts).set({ canonicalName, baseUnit: input.baseUnit, vatRate: input.vatRate }).where(eq(operationalCatalogProducts.id, input.id));
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
  const [product] = await db.select().from(operationalCatalogProducts).where(and(eq(operationalCatalogProducts.id, input.productId), eq(operationalCatalogProducts.storeId, inventory.storeId), eq(operationalCatalogProducts.isActive, true))).limit(1);
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
    lines: lines.map(line => ({ ...line, internalCode: line.internalCode || `Эвотор #${line.productId}`, category: null, variant: null, countedQuantity: Number(line.countedQuantity), ...(accountingAtClose ? { accountingQuantity: accountingAtClose.get(line.productId) ?? null } : {}) })),
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
