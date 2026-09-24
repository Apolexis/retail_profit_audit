import { and, desc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import {
  operationalCatalogCategories,
  operationalCatalogProducts,
  operationalEvotorDocumentPositions,
  operationalEvotorDocuments,
  operationalEvotorProductLinks,
  operationalEvotorReceiptStockMovements,
  operationalStockMovements,
  operationalStockTransferLines,
  operationalStockTransfers,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  getInventoryAccountingQuantities,
  inventoryUnitFromCatalogUnit,
  projectSnapshotAwareStock,
  type CatalogUnit,
  validateInventoryDate,
  validateStockTransferQuantity,
} from "./inventoryRegistry";

const normalizedText = (value: string) => value.trim().replace(/\s+/g, " ");

function state(row: typeof operationalStockTransfers.$inferSelect) {
  return {
    id: row.id,
    transferNumber: row.transferNumber,
    sourceStoreId: row.sourceStoreId,
    destinationStoreId: row.destinationStoreId,
    businessDate: row.businessDate,
    status: row.status,
    reversalOfTransferId: row.reversalOfTransferId,
    note: row.note,
    createdByAccountId: row.createdByAccountId,
    postedByAccountId: row.postedByAccountId,
    postedAt: row.postedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireTransfer(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [transfer] = await db.select().from(operationalStockTransfers).where(eq(operationalStockTransfers.id, transferId)).limit(1);
  if (!transfer) throw new Error("Перемещение не найдено.");
  return transfer;
}

async function requireVisibleStores(sourceStoreId: number, destinationStoreId: number) {
  if (sourceStoreId === destinationStoreId) throw new Error("Склад-отправитель и склад-получатель должны различаться.");
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const rows = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden })
    .from(stores)
    .where(inArray(stores.id, [sourceStoreId, destinationStoreId]));
  const byId = new Map(rows.map(row => [row.id, row]));
  const source = byId.get(sourceStoreId);
  const destination = byId.get(destinationStoreId);
  if (!source || source.isHidden || !destination || destination.isHidden) {
    throw new Error("Для перемещения доступны только видимые рабочие склады.");
  }
  return { source, destination };
}

/** The human document number is separate from the legacy technical primary key. */
async function nextOperationalStockTransferNumber() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [last] = await db
    .select({ transferNumber: operationalStockTransfers.transferNumber })
    .from(operationalStockTransfers)
    .orderBy(desc(operationalStockTransfers.transferNumber))
    .limit(1);
  return (last?.transferNumber ?? 0) + 1;
}

const isTransferNumberConflict = (error: unknown) => String(error).includes("transferNumber");

/** The draft itself cannot alter either balance. */
export async function createOperationalStockTransfer(input: {
  sourceStoreId: number;
  destinationStoreId: number;
  businessDate: string;
  note?: string;
  createdByAccountId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const businessDate = validateInventoryDate(input.businessDate);
  const storesForTransfer = await requireVisibleStores(input.sourceStoreId, input.destinationStoreId);
  const note = normalizedText(input.note ?? "").slice(0, 512) || null;
  let insertedId: number | null = null;
  for (let attempt = 0; attempt < 3 && insertedId === null; attempt += 1) {
    try {
      const result = await db.insert(operationalStockTransfers).values({
        transferNumber: await nextOperationalStockTransferNumber(),
        sourceStoreId: input.sourceStoreId,
        destinationStoreId: input.destinationStoreId,
        businessDate,
        note,
        createdByAccountId: input.createdByAccountId,
      });
      insertedId = Number(result[0].insertId);
    } catch (error) {
      if (!isTransferNumberConflict(error) || attempt === 2) throw error;
    }
  }
  if (insertedId === null) throw new Error("Не удалось присвоить номер перемещению.");
  const transfer = await requireTransfer(insertedId);
  return {
    transfer: state(transfer),
    sourceStoreName: storesForTransfer.source.name,
    destinationStoreName: storesForTransfer.destination.name,
  };
}

/** A posted document is corrected only by a separate inverse draft; source facts stay immutable. */
export async function createOperationalStockTransferReversal(input: { transferId: number; createdByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async tx => {
        const [original] = await tx.select().from(operationalStockTransfers)
          .where(eq(operationalStockTransfers.id, input.transferId)).limit(1);
        if (!original) throw new Error("Перемещение не найдено.");
        if (original.status !== "posted") throw new Error("Сторно можно создать только для проведенного перемещения.");
        const [existing] = await tx.select({ id: operationalStockTransfers.id }).from(operationalStockTransfers)
          .where(eq(operationalStockTransfers.reversalOfTransferId, original.id)).limit(1);
        if (existing) throw new Error("Для этого перемещения уже создано сторно.");
        const storesForReversal = await requireVisibleStores(original.destinationStoreId, original.sourceStoreId);
        const lines = await tx.select().from(operationalStockTransferLines)
          .where(eq(operationalStockTransferLines.transferId, original.id));
        if (!lines.length) throw new Error("В проведенном перемещении нет строк для сторно.");
        const [last] = await tx.select({ transferNumber: operationalStockTransfers.transferNumber })
          .from(operationalStockTransfers).orderBy(desc(operationalStockTransfers.transferNumber)).limit(1);
        const inserted = await tx.insert(operationalStockTransfers).values({
          transferNumber: (last?.transferNumber ?? 0) + 1,
          sourceStoreId: original.destinationStoreId,
          destinationStoreId: original.sourceStoreId,
          businessDate: original.businessDate,
          reversalOfTransferId: original.id,
          note: `Сторно перемещения № ${original.transferNumber}`,
          createdByAccountId: input.createdByAccountId,
        });
        const reversalId = Number(inserted[0].insertId);
        await tx.insert(operationalStockTransferLines).values(lines.map(line => ({
          transferId: reversalId,
          productId: line.productId,
          quantity: line.quantity,
          unit: line.unit,
        })));
        const [reversal] = await tx.select().from(operationalStockTransfers)
          .where(eq(operationalStockTransfers.id, reversalId)).limit(1);
        return { original: state(original), transfer: state(reversal!), sourceStoreName: storesForReversal.source.name, destinationStoreName: storesForReversal.destination.name, lineCount: lines.length };
      });
    } catch (error) {
      if (String(error).includes("reversalOfTransferId")) throw new Error("Для этого перемещения уже создано сторно.");
      if (!isTransferNumberConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Не удалось присвоить номер сторно.");
}

export async function getOperationalStockTransferDetail(transferId: number) {
  const db = await getDb();
  if (!db) return null;
  const [transfer] = await db.select().from(operationalStockTransfers).where(eq(operationalStockTransfers.id, transferId)).limit(1);
  if (!transfer) return null;
  const [storeRows, lineRows] = await Promise.all([
    db.select({ id: stores.id, name: stores.name }).from(stores).where(inArray(stores.id, [transfer.sourceStoreId, transfer.destinationStoreId])),
    db.select({
      id: operationalStockTransferLines.id,
      productId: operationalStockTransferLines.productId,
      quantity: operationalStockTransferLines.quantity,
      unit: operationalStockTransferLines.unit,
      internalCode: operationalCatalogProducts.catalogNumber,
      canonicalName: operationalCatalogProducts.canonicalName,
      category: operationalCatalogCategories.name,
      fallbackCategory: operationalCatalogProducts.evotorCategoryName,
    })
      .from(operationalStockTransferLines)
      .innerJoin(operationalCatalogProducts, eq(operationalStockTransferLines.productId, operationalCatalogProducts.id))
      .leftJoin(operationalCatalogCategories, eq(operationalCatalogProducts.catalogCategoryId, operationalCatalogCategories.id))
      .where(eq(operationalStockTransferLines.transferId, transferId))
      .orderBy(operationalCatalogProducts.canonicalName),
  ]);
  const storeById = new Map(storeRows.map(store => [store.id, store.name]));
  const productIds = lineRows.map(line => line.productId);
  const [sourceQuantities, destinationQuantities] = productIds.length
    ? await Promise.all([
      getInventoryAccountingQuantities(transfer.sourceStoreId, productIds),
      getInventoryAccountingQuantities(transfer.destinationStoreId, productIds),
    ])
    : [new Map<number, number>(), new Map<number, number>()];
  return {
    ...state(transfer),
    sourceStoreName: storeById.get(transfer.sourceStoreId) ?? "Склад не найден",
    destinationStoreName: storeById.get(transfer.destinationStoreId) ?? "Склад не найден",
    lines: lineRows.map(line => ({
      id: line.id,
      productId: line.productId,
      quantity: Number(line.quantity),
      unit: line.unit,
      internalCode: String(line.internalCode),
      canonicalName: line.canonicalName,
      category: line.category ?? line.fallbackCategory,
      sourceQuantity: sourceQuantities.get(line.productId) ?? null,
      destinationQuantity: destinationQuantities.get(line.productId) ?? null,
    })),
  };
}

export async function upsertOperationalStockTransferLine(input: { transferId: number; productId: number; quantity: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const quantity = validateStockTransferQuantity(input.quantity);
  const transfer = await requireTransfer(input.transferId);
  if (transfer.status !== "draft") throw new Error("Проведенное перемещение нельзя изменять.");
  const [product] = await db.select({
    id: operationalCatalogProducts.id,
    canonicalName: operationalCatalogProducts.canonicalName,
    baseUnit: operationalCatalogProducts.baseUnit,
    isActive: operationalCatalogProducts.isActive,
  }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, input.productId)).limit(1);
  if (!product || !product.isActive) throw new Error("Товар больше недоступен для перемещения.");
  const sourceQuantities = await getInventoryAccountingQuantities(transfer.sourceStoreId, [input.productId]);
  if (!sourceQuantities.has(input.productId)) throw new Error("Для товара нет подтвержденного учетного остатка на складе-отправителе.");
  const sourceQuantity = sourceQuantities.get(input.productId) ?? 0;
  if (quantity > sourceQuantity) throw new Error(`Нельзя переместить больше подтвержденного остатка: доступно ${sourceQuantity}.`);
  const unit = inventoryUnitFromCatalogUnit(product.baseUnit as CatalogUnit);
  const [before] = await db.select().from(operationalStockTransferLines)
    .where(and(eq(operationalStockTransferLines.transferId, input.transferId), eq(operationalStockTransferLines.productId, input.productId)))
    .limit(1);
  if (before) {
    await db.update(operationalStockTransferLines).set({ quantity: quantity.toFixed(3), unit }).where(eq(operationalStockTransferLines.id, before.id));
  } else {
    await db.insert(operationalStockTransferLines).values({ transferId: input.transferId, productId: input.productId, quantity: quantity.toFixed(3), unit });
  }
  return {
    transfer: state(transfer),
    before: before ? { productId: before.productId, quantity: Number(before.quantity), unit: before.unit } : null,
    after: { productId: input.productId, quantity, unit, productName: product.canonicalName },
  };
}

export async function removeOperationalStockTransferLine(input: { transferId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const transfer = await requireTransfer(input.transferId);
  if (transfer.status !== "draft") throw new Error("Проведенное перемещение нельзя изменять.");
  const [line] = await db.select().from(operationalStockTransferLines)
    .where(and(eq(operationalStockTransferLines.transferId, input.transferId), eq(operationalStockTransferLines.productId, input.productId)))
    .limit(1);
  if (!line) throw new Error("Строка перемещения не найдена.");
  await db.delete(operationalStockTransferLines).where(eq(operationalStockTransferLines.id, line.id));
  return { transfer: state(transfer), before: { productId: line.productId, quantity: Number(line.quantity), unit: line.unit } };
}

/** Posting creates the paired outflow/inflow ledger events in one transaction. */
export async function postOperationalStockTransfer(input: { transferId: number; postedByAccountId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(operationalStockTransfers).where(eq(operationalStockTransfers.id, input.transferId)).limit(1);
    if (!transfer) throw new Error("Перемещение не найдено.");
    if (transfer.status !== "draft") throw new Error("Перемещение уже проведено или отменено сторно.");
    await requireVisibleStores(transfer.sourceStoreId, transfer.destinationStoreId);
    const lines = await tx.select().from(operationalStockTransferLines).where(eq(operationalStockTransferLines.transferId, transfer.id));
    if (!lines.length) throw new Error("Добавьте хотя бы одну позицию перед проведением.");
    const productIds = lines.map(line => line.productId);
    const products = await tx.select({ id: operationalCatalogProducts.id, baseUnit: operationalCatalogProducts.baseUnit, isActive: operationalCatalogProducts.isActive })
      .from(operationalCatalogProducts)
      .where(inArray(operationalCatalogProducts.id, productIds));
    if (products.length !== productIds.length || products.some(product => !product.isActive)) throw new Error("Одна из позиций перемещения больше недоступна.");
    const productById = new Map(products.map(product => [product.id, product]));
    const [sourceSnapshots, destinationSnapshots, sourceMovementRows, destinationMovementRows, sourceReceiptMovementRows, destinationReceiptMovementRows] = await Promise.all([
      tx.select({ productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt }).from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, transfer.sourceStoreId), inArray(operationalEvotorProductLinks.productId, productIds))),
      tx.select({ productId: operationalEvotorProductLinks.productId, quantity: operationalEvotorProductLinks.evotorQuantitySnapshot, updatedAt: operationalEvotorProductLinks.evotorQuantityUpdatedAt }).from(operationalEvotorProductLinks).where(and(eq(operationalEvotorProductLinks.storeId, transfer.destinationStoreId), inArray(operationalEvotorProductLinks.productId, productIds))),
      tx.select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt }).from(operationalStockMovements).where(and(eq(operationalStockMovements.storeId, transfer.sourceStoreId), inArray(operationalStockMovements.productId, productIds))),
      tx.select({ productId: operationalStockMovements.productId, quantityDelta: operationalStockMovements.quantityDelta, createdAt: operationalStockMovements.createdAt }).from(operationalStockMovements).where(and(eq(operationalStockMovements.storeId, transfer.destinationStoreId), inArray(operationalStockMovements.productId, productIds))),
      tx.select({ productId: operationalEvotorReceiptStockMovements.productId, quantityDelta: operationalEvotorReceiptStockMovements.quantityDelta, createdAt: operationalEvotorReceiptStockMovements.occurredAt }).from(operationalEvotorReceiptStockMovements).where(and(eq(operationalEvotorReceiptStockMovements.storeId, transfer.sourceStoreId), inArray(operationalEvotorReceiptStockMovements.productId, productIds))),
      tx.select({ productId: operationalEvotorReceiptStockMovements.productId, quantityDelta: operationalEvotorReceiptStockMovements.quantityDelta, createdAt: operationalEvotorReceiptStockMovements.occurredAt }).from(operationalEvotorReceiptStockMovements).where(and(eq(operationalEvotorReceiptStockMovements.storeId, transfer.destinationStoreId), inArray(operationalEvotorReceiptStockMovements.productId, productIds))),
    ]);
    const balance = (storeId: number, snapshots: Array<{ productId: number; quantity: string | null; updatedAt: Date | null }>, movements: Array<{ productId: number; quantityDelta: string; createdAt: Date }>) => {
      const projection = projectSnapshotAwareStock(
        snapshots.map(row => ({ ...row, storeId })),
        movements.map(row => ({ ...row, storeId })),
      );
      const known = new Set<number>();
      const values = new Map<number, number>();
      for (const productId of productIds) {
        const key = `${storeId}:${productId}`;
        if (projection.known.has(key)) known.add(productId);
        const value = projection.values.get(key);
        if (value !== undefined) values.set(productId, value);
      }
      return { known, values };
    };
    const source = balance(transfer.sourceStoreId, sourceSnapshots, [...sourceMovementRows, ...sourceReceiptMovementRows]);
    const destination = balance(transfer.destinationStoreId, destinationSnapshots, [...destinationMovementRows, ...destinationReceiptMovementRows]);
    const movements: Array<typeof operationalStockMovements.$inferInsert> = [];
    for (const line of lines) {
      const quantity = validateStockTransferQuantity(Number(line.quantity));
      const sourceBefore = Math.round((source.values.get(line.productId) ?? 0) * 1_000) / 1_000;
      if (!source.known.has(line.productId)) throw new Error("Для одной из позиций нет подтвержденного остатка на складе-отправителе.");
      if (quantity > sourceBefore) throw new Error("Остаток склада-отправителя изменился: скорректируйте количество перед проведением.");
      const destinationBefore = Math.round((destination.values.get(line.productId) ?? 0) * 1_000) / 1_000;
      const product = productById.get(line.productId)!;
      const unit = inventoryUnitFromCatalogUnit(product.baseUnit as CatalogUnit);
      movements.push(
        { storeId: transfer.sourceStoreId, productId: line.productId, inventoryId: null, transferId: transfer.id, relatedStoreId: transfer.destinationStoreId, kind: "transfer_out", previousQuantity: sourceBefore.toFixed(3), countedQuantity: (sourceBefore - quantity).toFixed(3), quantityDelta: (-quantity).toFixed(3), unit, adjustmentReason: transfer.note, createdByAccountId: input.postedByAccountId },
        { storeId: transfer.destinationStoreId, productId: line.productId, inventoryId: null, transferId: transfer.id, relatedStoreId: transfer.sourceStoreId, kind: "transfer_in", previousQuantity: destinationBefore.toFixed(3), countedQuantity: (destinationBefore + quantity).toFixed(3), quantityDelta: quantity.toFixed(3), unit, adjustmentReason: transfer.note, createdByAccountId: input.postedByAccountId },
      );
    }
    await tx.insert(operationalStockMovements).values(movements);
    await tx.update(operationalStockTransfers).set({ status: "posted", postedByAccountId: input.postedByAccountId, postedAt: new Date() }).where(eq(operationalStockTransfers.id, transfer.id));
    if (transfer.reversalOfTransferId) {
      const [original] = await tx.select().from(operationalStockTransfers)
        .where(eq(operationalStockTransfers.id, transfer.reversalOfTransferId)).limit(1);
      if (!original || original.status !== "posted") throw new Error("Исходное перемещение для сторно больше недоступно.");
      await tx.update(operationalStockTransfers).set({ status: "reversed" })
        .where(eq(operationalStockTransfers.id, original.id));
    }
    const [after] = await tx.select().from(operationalStockTransfers).where(eq(operationalStockTransfers.id, transfer.id)).limit(1);
    return { before: state(transfer), after: state(after!), lines: lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity), unit: line.unit })), movements };
  });
}

export async function deleteOperationalStockTransferDraft(transferId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.transaction(async tx => {
    const [transfer] = await tx.select().from(operationalStockTransfers).where(eq(operationalStockTransfers.id, transferId)).limit(1);
    if (!transfer) throw new Error("Перемещение не найдено.");
    if (transfer.status !== "draft") throw new Error("Проведенное перемещение нельзя удалить.");
    const lines = await tx.select({ productId: operationalStockTransferLines.productId, quantity: operationalStockTransferLines.quantity }).from(operationalStockTransferLines).where(eq(operationalStockTransferLines.transferId, transferId));
    await tx.delete(operationalStockTransferLines).where(eq(operationalStockTransferLines.transferId, transferId));
    await tx.delete(operationalStockTransfers).where(eq(operationalStockTransfers.id, transferId));
    return { before: state(transfer), lines: lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity) })) };
  });
}

export async function listOperationalStockTransfers(input: { storeIds?: number[] | null; from?: string; to?: string; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const from = input.from ? validateInventoryDate(input.from) : undefined;
  const to = input.to ? validateInventoryDate(input.to) : undefined;
  if (from && to && from > to) throw new Error("Начало периода не может быть позже конца.");
  const conditions = [
    from ? gte(operationalStockTransfers.businessDate, from) : undefined,
    to ? lte(operationalStockTransfers.businessDate, to) : undefined,
    input.storeIds ? inArray(operationalStockTransfers.sourceStoreId, input.storeIds) : undefined,
    input.storeIds ? inArray(operationalStockTransfers.destinationStoreId, input.storeIds) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  const transfers = await db.select().from(operationalStockTransfers).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(operationalStockTransfers.id)).limit(Math.min(Math.max(input.limit ?? 20, 1), 100));
  if (!transfers.length) return [];
  const [storeRows, lineRows] = await Promise.all([
    db.select({ id: stores.id, name: stores.name }).from(stores).where(inArray(stores.id, Array.from(new Set(transfers.flatMap(transfer => [transfer.sourceStoreId, transfer.destinationStoreId]))))),
    db.select({ transferId: operationalStockTransferLines.transferId }).from(operationalStockTransferLines).where(inArray(operationalStockTransferLines.transferId, transfers.map(transfer => transfer.id))),
  ]);
  const nameByStore = new Map(storeRows.map(store => [store.id, store.name]));
  const lineCountByTransfer = new Map<number, number>();
  for (const line of lineRows) lineCountByTransfer.set(line.transferId, (lineCountByTransfer.get(line.transferId) ?? 0) + 1);
  return transfers.map(transfer => ({
    ...state(transfer),
    sourceStoreName: nameByStore.get(transfer.sourceStoreId) ?? "Склад не найден",
    destinationStoreName: nameByStore.get(transfer.destinationStoreId) ?? "Склад не найден",
    lineCount: lineCountByTransfer.get(transfer.id) ?? 0,
  }));
}

/**
 * A conservative transfer hint: destination sales from the last seven days,
 * destination coverage and confirmed source balance. It never exposes source
 * balance to a seller because the transfer router is manager/admin only.
 */
export async function getOperationalStockTransferRecommendation(input: { sourceStoreId: number; destinationStoreId: number; productId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  await requireVisibleStores(input.sourceStoreId, input.destinationStoreId);
  const [sourceQuantities, destinationQuantities, links] = await Promise.all([
    getInventoryAccountingQuantities(input.sourceStoreId, [input.productId]),
    getInventoryAccountingQuantities(input.destinationStoreId, [input.productId]),
    db.select({ evotorProductId: operationalEvotorProductLinks.evotorProductId })
      .from(operationalEvotorProductLinks)
      .where(and(eq(operationalEvotorProductLinks.storeId, input.destinationStoreId), eq(operationalEvotorProductLinks.productId, input.productId))),
  ]);
  const sourceQuantity = sourceQuantities.get(input.productId) ?? null;
  const destinationQuantity = destinationQuantities.get(input.productId) ?? null;
  const productIds = links.map(link => link.evotorProductId);
  const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
  const documents = productIds.length
    ? await db.select({ id: operationalEvotorDocuments.id })
      .from(operationalEvotorDocuments)
      .where(and(
        eq(operationalEvotorDocuments.storeId, input.destinationStoreId),
        eq(operationalEvotorDocuments.documentType, "SELL"),
        isNotNull(operationalEvotorDocuments.occurredAt),
        gte(operationalEvotorDocuments.occurredAt, `${sevenDaysAgo}T00:00:00`),
      ))
      .limit(20_000)
    : [];
  let weeklySold = 0;
  const documentIds = documents.map(document => document.id);
  for (let index = 0; index < documentIds.length; index += 500) {
    const positions = await db.select({ quantity: operationalEvotorDocumentPositions.quantity })
      .from(operationalEvotorDocumentPositions)
      .where(and(
        inArray(operationalEvotorDocumentPositions.documentId, documentIds.slice(index, index + 500)),
        inArray(operationalEvotorDocumentPositions.evotorProductId, productIds),
      ));
    weeklySold += positions.reduce((total, position) => total + Math.max(0, Number(position.quantity ?? 0)), 0);
  }
  weeklySold = Math.round(weeklySold * 1_000) / 1_000;
  const dailySold = weeklySold > 0 ? Math.round((weeklySold / 7) * 1_000) / 1_000 : null;
  const destinationCoverDays = destinationQuantity !== null && dailySold ? Math.max(0, Math.round(destinationQuantity / dailySold * 10) / 10) : null;
  const requestedQuantity = dailySold === null || destinationQuantity === null
    ? null
    : Math.max(0, Math.ceil(Math.max(0, dailySold * 2 - destinationQuantity) * 1_000) / 1_000);
  const recommendedQuantity = requestedQuantity === null || sourceQuantity === null ? null : Math.min(requestedQuantity, Math.max(0, sourceQuantity));
  return {
    sourceQuantity,
    destinationQuantity,
    weeklySold,
    dailySold,
    destinationCoverDays,
    recommendedQuantity,
    state: sourceQuantity === null
      ? "source_unknown"
      : destinationQuantity === null
        ? "destination_unknown"
        : dailySold === null
          ? "no_sales_data"
          : destinationCoverDays !== null && destinationCoverDays >= 2
            ? "sufficient"
            : sourceQuantity <= 0
              ? "source_empty"
              : "recommended",
  };
}
