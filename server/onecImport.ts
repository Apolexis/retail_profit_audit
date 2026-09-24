import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  operationalCatalogProducts,
  operationalOnecImportBatches,
  operationalOnecPurchaseCosts,
  operationalOnecProductLinks,
  operationalOnecShipmentLines,
  operationalOnecShipmentReceiptLines,
  operationalOnecShipmentReceipts,
  operationalOnecStoreLinks,
  operationalOnecStoreShipments,
  operationalOnecWarehouseSnapshots,
  operationalStockMovements,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { getInventoryAccountingQuantities, inventoryUnitFromCatalogUnit, validateCountedQuantity } from "./inventoryRegistry";

export type OnecUnit = "kg" | "l" | "piece";
export type OnecSnapshotRecord = {
  source_record_id: string;
  location_code?: string;
  location_source_id?: string;
  product_source_id: string;
  product_name?: string | null;
  quantity_on_hand: number;
  quantity_available?: number | null;
  /** ISO date supplied by 1С for a concrete lot; omitted means the source did not supply it. */
  expiration_date?: string | null;
  business_date: string;
  as_of: string;
};
export type OnecShipmentLine = {
  line_id: string;
  product_source_id: string;
  product_name?: string | null;
  quantity: number;
  unit: OnecUnit;
  /** ISO date of the concrete lot sent from a main warehouse to a shop. */
  expiration_date?: string | null;
};
export type OnecShipmentRecord = {
  shipment_id: string;
  source_record_id: string;
  revision_id: string;
  business_date: string;
  origin_warehouse_code?: string;
  origin_location_source_id?: string;
  destination_store_reference: string;
  document_number?: string | null;
  status: "posted" | "cancelled" | "corrected";
  lines: OnecShipmentLine[];
};
export type OnecPurchaseCostRecord = {
  source_record_id: string;
  product_source_id: string;
  product_name?: string | null;
  unit: OnecUnit;
  /** Contract price for one accounting unit, without an implicit warehouse priority. */
  purchase_price: number;
  effective_date: string;
  warehouse_code?: string | null;
  basis?: string | null;
};
export type OnecPackage = {
  schema_version: string;
  source_system: string;
  entity: "inventory_snapshots" | "store_shipments" | "purchase_costs";
  batch_id: string;
  mode: "snapshot" | "delta";
  generated_at: string;
  business_timezone: "Europe/Moscow";
  as_of?: string | null;
  records: OnecSnapshotRecord[] | OnecShipmentRecord[] | OnecPurchaseCostRecord[];
};

const isoDate = /^20\d{2}-\d{2}-\d{2}$/;
const finiteThreeDecimals = (value: number) => Number.isFinite(value) && value >= 0 && Math.round(value * 1000) === value * 1000;
const clean = (value: string) => value.trim();
const warehouseCode = (value: string | undefined) => clean(value ?? "").toUpperCase();
const onecWarehouseCodes = new Set(["BM", "SRS"]);
const normalizedExpirationDate = (value: string | null | undefined, label: string) => {
  const date = clean(value ?? "");
  if (!date) return null;
  if (!isoDate.test(date)) throw new Error(`${label} должен быть датой ГГГГ-ММ-ДД или не передаваться.`);
  return date;
};
const utcDay = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const daysUntilExpiration = (expirationDate: string, businessDate: string) => Math.round((utcDay(expirationDate) - utcDay(businessDate)) / 86_400_000);
const subtractCalendarDays = (businessDate: string, days: number) => {
  const date = new Date(`${businessDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

function assertBasePackage(input: OnecPackage) {
  if (!/^1\.\d+$/.test(clean(input.schema_version))) throw new Error("Поддерживается только schema_version 1.x.");
  if (!clean(input.source_system) || clean(input.source_system).length > 128) throw new Error("Укажите source_system длиной до 128 символов.");
  if (!clean(input.batch_id) || clean(input.batch_id).length > 191) throw new Error("Укажите стабильный batch_id длиной до 191 символа.");
  if (input.business_timezone !== "Europe/Moscow") throw new Error("Для первого контура 1С допускается только бизнес-часовой пояс Europe/Moscow.");
  if (!Array.isArray(input.records) || input.records.length === 0 || input.records.length > 10_000) throw new Error("Пакет должен содержать от 1 до 10 000 записей.");
  if (Number.isNaN(Date.parse(input.generated_at))) throw new Error("generated_at должен быть корректной датой RFC 3339.");
  if (input.entity === "inventory_snapshots" && input.mode !== "snapshot") throw new Error("Остатки 1С принимаются только полным срезом (mode=snapshot).");
  if (input.entity === "store_shipments" && input.mode !== "delta") throw new Error("Расходные накладные 1С принимаются только изменениями (mode=delta).");
  if (input.entity === "purchase_costs" && input.mode !== "delta") throw new Error("Закупочные цены 1С принимаются только изменениями (mode=delta).");
}

async function knownProductLinks(sourceSystem: string, sourceIds: string[]) {
  const db = await getDb();
  if (!db || sourceIds.length === 0) return new Map<string, number>();
  const rows = await db.select({ sourceProductId: operationalOnecProductLinks.sourceProductId, productId: operationalOnecProductLinks.productId })
    .from(operationalOnecProductLinks)
    .where(and(eq(operationalOnecProductLinks.sourceSystem, sourceSystem), inArray(operationalOnecProductLinks.sourceProductId, Array.from(new Set(sourceIds)))));
  return new Map(rows.map(row => [row.sourceProductId, row.productId]));
}

async function knownStoreLinks(sourceSystem: string, references: string[]) {
  const db = await getDb();
  if (!db || references.length === 0) return new Map<string, number>();
  const rows = await db.select({ destinationReference: operationalOnecStoreLinks.destinationReference, storeId: operationalOnecStoreLinks.storeId })
    .from(operationalOnecStoreLinks)
    .where(and(eq(operationalOnecStoreLinks.sourceSystem, sourceSystem), inArray(operationalOnecStoreLinks.destinationReference, Array.from(new Set(references)))));
  return new Map(rows.map(row => [row.destinationReference, row.storeId]));
}

export async function importOnecPackage(input: { packet: OnecPackage; actorId: number }) {
  const { packet, actorId } = input;
  assertBasePackage(packet);
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const sourceSystem = clean(packet.source_system);
  const batchId = clean(packet.batch_id);
  const existing = await db.select().from(operationalOnecImportBatches)
    .where(and(eq(operationalOnecImportBatches.sourceSystem, sourceSystem), eq(operationalOnecImportBatches.entity, packet.entity), eq(operationalOnecImportBatches.batchId, batchId))).limit(1);
  if (existing[0]) return { created: false, batch: existing[0], message: "Этот пакет уже принят ранее; повтор не создаёт дубликаты." };

  if (packet.entity === "inventory_snapshots") {
    const records = packet.records as OnecSnapshotRecord[];
    const sourceIds = records.map(row => clean(row.product_source_id));
    const links = await knownProductLinks(sourceSystem, sourceIds);
    const seen = new Set<string>();
    const prepared = records.map(row => {
      const recordId = clean(row.source_record_id);
      const code = warehouseCode(row.location_code ?? row.location_source_id);
      const productSourceId = clean(row.product_source_id);
      if (!recordId || !productSourceId) throw new Error("Каждая строка snapshot должна иметь source_record_id и product_source_id.");
      if (!onecWarehouseCodes.has(code)) throw new Error("Срез 1С допускается только для складов BM или SRS.");
      if (!isoDate.test(row.business_date) || Number.isNaN(Date.parse(row.as_of))) throw new Error("Укажите business_date и as_of для каждой строки snapshot.");
      if (!finiteThreeDecimals(row.quantity_on_hand) || (row.quantity_available !== null && row.quantity_available !== undefined && !finiteThreeDecimals(row.quantity_available))) throw new Error("Количество в snapshot должно быть неотрицательным числом с точностью до 0,001.");
      if (seen.has(recordId)) throw new Error("source_record_id не должен повторяться внутри snapshot-пакета.");
      seen.add(recordId);
      const productId = links.get(productSourceId) ?? null;
      return { sourceRecordId: recordId, warehouseCode: code, productId, productSourceId, productName: clean(row.product_name ?? "") || null, quantityOnHand: String(row.quantity_on_hand), quantityAvailable: row.quantity_available === null || row.quantity_available === undefined ? null : String(row.quantity_available), expirationDate: normalizedExpirationDate(row.expiration_date, "expiration_date snapshot"), businessDate: row.business_date, asOf: row.as_of, mappingState: productId ? "mapped" as const : "quarantined" as const };
    });
    const accepted = prepared.filter(row => row.mappingState === "mapped").length;
    const quarantined = prepared.length - accepted;
    const status = quarantined === 0 ? "applied" as const : accepted === 0 ? "quarantined" as const : "mixed" as const;
    const result = await db.transaction(async tx => {
      const inserted = await tx.insert(operationalOnecImportBatches).values({ sourceSystem, entity: packet.entity, batchId, schemaVersion: clean(packet.schema_version), generatedAt: packet.generated_at, asOf: packet.as_of ?? null, status, totalRecords: prepared.length, acceptedRecords: accepted, quarantinedRecords: quarantined, createdByAccountId: actorId });
      const importId = Number(inserted[0].insertId);
      await tx.insert(operationalOnecWarehouseSnapshots).values(prepared.map(row => ({ ...row, batchImportId: importId })));
      return (await tx.select().from(operationalOnecImportBatches).where(eq(operationalOnecImportBatches.id, importId)).limit(1))[0]!;
    });
    return { created: true, batch: result, message: quarantined ? `Принято строк: ${accepted}; в карантине без явного сопоставления товара: ${quarantined}.` : `Принят полный срез ${prepared.length} строк.` };
  }

  if (packet.entity === "purchase_costs") {
    const records = packet.records as OnecPurchaseCostRecord[];
    const sourceIds = records.map(row => clean(row.product_source_id));
    const links = await knownProductLinks(sourceSystem, sourceIds);
    const seen = new Set<string>();
    const prepared = records.map(row => {
      const sourceRecordId = clean(row.source_record_id);
      const productSourceId = clean(row.product_source_id);
      const code = warehouseCode(row.warehouse_code ?? undefined);
      if (!sourceRecordId || !productSourceId) throw new Error("Каждая строка закупочной цены должна иметь source_record_id и product_source_id.");
      if (seen.has(sourceRecordId)) throw new Error("source_record_id не должен повторяться внутри пакета закупочных цен.");
      if (!Number.isFinite(row.purchase_price) || row.purchase_price < 0 || Math.round(row.purchase_price * 100) !== row.purchase_price * 100) throw new Error("purchase_price должен быть неотрицательным числом с точностью до 0,01.");
      if (!isoDate.test(row.effective_date)) throw new Error("effective_date должен быть датой ГГГГ-ММ-ДД.");
      if (code && !onecWarehouseCodes.has(code)) throw new Error("warehouse_code закупочной цены может быть только BM, SRS или не передаваться.");
      seen.add(sourceRecordId);
      const productId = links.get(productSourceId) ?? null;
      return {
        sourceRecordId,
        productSourceId,
        productId,
        productName: clean(row.product_name ?? "") || null,
        unit: row.unit,
        purchasePrice: row.purchase_price.toFixed(2),
        effectiveDate: row.effective_date,
        warehouseCode: code || null,
        basis: clean(row.basis ?? "").slice(0, 512) || null,
        mappingState: productId ? "mapped" as const : "quarantined" as const,
      };
    });
    const accepted = prepared.filter(row => row.mappingState === "mapped").length;
    const quarantined = prepared.length - accepted;
    const status = quarantined === 0 ? "applied" as const : accepted === 0 ? "quarantined" as const : "mixed" as const;
    const result = await db.transaction(async tx => {
      const inserted = await tx.insert(operationalOnecImportBatches).values({ sourceSystem, entity: packet.entity, batchId, schemaVersion: clean(packet.schema_version), generatedAt: packet.generated_at, asOf: packet.as_of ?? null, status, totalRecords: prepared.length, acceptedRecords: accepted, quarantinedRecords: quarantined, createdByAccountId: actorId });
      const importId = Number(inserted[0].insertId);
      await tx.insert(operationalOnecPurchaseCosts).values(prepared.map(row => ({ ...row, batchImportId: importId })));
      return (await tx.select().from(operationalOnecImportBatches).where(eq(operationalOnecImportBatches.id, importId)).limit(1))[0]!;
    });
    return { created: true, batch: result, message: quarantined ? `Принято цен: ${accepted}; в карантине без явного сопоставления товара: ${quarantined}. Себестоимость справочника не изменялась.` : `Принято ${prepared.length} закупочных цен. Себестоимость справочника не изменялась до явного применения.` };
  }

  const records = packet.records as OnecShipmentRecord[];
  const productSourceIds = records.flatMap(record => record.lines.map(line => clean(line.product_source_id)));
  const storeReferences = records.map(record => clean(record.destination_store_reference));
  const productLinks = await knownProductLinks(sourceSystem, productSourceIds);
  const storeLinks = await knownStoreLinks(sourceSystem, storeReferences);
  const shipmentIds = new Set<string>();
  const prepared = records.map(record => {
    const shipmentId = clean(record.shipment_id);
    const revisionId = clean(record.revision_id);
    const sourceRecordId = clean(record.source_record_id);
    const originWarehouseCode = warehouseCode(record.origin_warehouse_code ?? record.origin_location_source_id);
    const destinationReference = clean(record.destination_store_reference);
    if (!shipmentId || !revisionId || !sourceRecordId || !destinationReference) throw new Error("Накладная 1С должна иметь shipment_id, revision_id, source_record_id и destination_store_reference.");
    if (!onecWarehouseCodes.has(originWarehouseCode)) throw new Error("Отправитель накладной должен быть BM или SRS.");
    if (!isoDate.test(record.business_date) || record.lines.length === 0) throw new Error("Накладная должна иметь business_date и хотя бы одну строку.");
    const shipmentKey = `${shipmentId}:${revisionId}`;
    if (shipmentIds.has(shipmentKey)) throw new Error("shipment_id + revision_id не должны повторяться внутри пакета.");
    shipmentIds.add(shipmentKey);
    const destinationStoreId = storeLinks.get(destinationReference) ?? null;
    const lineIds = new Set<string>();
    const lines = record.lines.map(line => {
      const sourceLineId = clean(line.line_id);
      const productSourceId = clean(line.product_source_id);
      if (!sourceLineId || !productSourceId || lineIds.has(sourceLineId)) throw new Error("Каждая строка накладной должна иметь уникальные line_id и product_source_id.");
      lineIds.add(sourceLineId);
      if (!finiteThreeDecimals(line.quantity) || line.quantity === 0) throw new Error("Количество в накладной должно быть положительным с точностью до 0,001.");
      const productId = productLinks.get(productSourceId) ?? null;
      return { sourceLineId, productSourceId, productId, productName: clean(line.product_name ?? "") || null, quantity: String(line.quantity), unit: line.unit, expirationDate: normalizedExpirationDate(line.expiration_date, "expiration_date строки накладной"), mappingState: productId ? "mapped" as const : "quarantined" as const };
    });
    const fullyMapped = Boolean(destinationStoreId) && lines.every(line => line.mappingState === "mapped");
    return { shipmentId, revisionId, sourceRecordId, businessDate: record.business_date, originWarehouseCode, destinationReference, destinationStoreId, documentNumber: clean(record.document_number ?? "") || null, sourceStatus: record.status, mappingState: fullyMapped ? "mapped" as const : destinationStoreId ? "quarantined" as const : "unmapped" as const, lines };
  });
  const accepted = prepared.filter(row => row.mappingState === "mapped").length;
  const quarantined = prepared.length - accepted;
  const status = quarantined === 0 ? "applied" as const : accepted === 0 ? "quarantined" as const : "mixed" as const;
  const result = await db.transaction(async tx => {
    const inserted = await tx.insert(operationalOnecImportBatches).values({ sourceSystem, entity: packet.entity, batchId, schemaVersion: clean(packet.schema_version), generatedAt: packet.generated_at, asOf: packet.as_of ?? null, status, totalRecords: prepared.length, acceptedRecords: accepted, quarantinedRecords: quarantined, createdByAccountId: actorId });
    const importId = Number(inserted[0].insertId);
    for (const shipment of prepared) {
      const { lines, ...header } = shipment;
      const insertedShipment = await tx.insert(operationalOnecStoreShipments).values({ ...header, batchImportId: importId });
      const shipmentRowId = Number(insertedShipment[0].insertId);
      await tx.insert(operationalOnecShipmentLines).values(lines.map(line => ({ ...line, shipmentId: shipmentRowId })));
    }
    return (await tx.select().from(operationalOnecImportBatches).where(eq(operationalOnecImportBatches.id, importId)).limit(1))[0]!;
  });
  return { created: true, batch: result, message: quarantined ? `Принято накладных: ${accepted}; требуют явного сопоставления: ${quarantined}. Остатки магазинов не менялись.` : `Принято ${prepared.length} накладных. Остатки магазинов не менялись.` };
}

export async function listOnecImportBatches(limit = 60) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.select().from(operationalOnecImportBatches).orderBy(desc(operationalOnecImportBatches.createdAt)).limit(limit);
}

export async function listOnecWarehouseSnapshots(limit = 120) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.select({
    id: operationalOnecWarehouseSnapshots.id,
    warehouseCode: operationalOnecWarehouseSnapshots.warehouseCode,
    productId: operationalOnecWarehouseSnapshots.productId,
    productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecWarehouseSnapshots.productName})`,
    quantityOnHand: operationalOnecWarehouseSnapshots.quantityOnHand,
    quantityAvailable: operationalOnecWarehouseSnapshots.quantityAvailable,
    expirationDate: operationalOnecWarehouseSnapshots.expirationDate,
    businessDate: operationalOnecWarehouseSnapshots.businessDate,
    asOf: operationalOnecWarehouseSnapshots.asOf,
    mappingState: operationalOnecWarehouseSnapshots.mappingState,
    batchImportId: operationalOnecWarehouseSnapshots.batchImportId,
  }).from(operationalOnecWarehouseSnapshots)
    .leftJoin(operationalCatalogProducts, eq(operationalOnecWarehouseSnapshots.productId, operationalCatalogProducts.id))
    .orderBy(desc(operationalOnecWarehouseSnapshots.businessDate), desc(operationalOnecWarehouseSnapshots.id)).limit(limit);
}

/** Incoming costs remain read-only until an administrator explicitly chooses one for management accounting. */
export async function listOnecPurchaseCosts(limit = 160) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.select({
    id: operationalOnecPurchaseCosts.id,
    productId: operationalOnecPurchaseCosts.productId,
    productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecPurchaseCosts.productName})`,
    unit: operationalOnecPurchaseCosts.unit,
    purchasePrice: operationalOnecPurchaseCosts.purchasePrice,
    effectiveDate: operationalOnecPurchaseCosts.effectiveDate,
    warehouseCode: operationalOnecPurchaseCosts.warehouseCode,
    basis: operationalOnecPurchaseCosts.basis,
    mappingState: operationalOnecPurchaseCosts.mappingState,
    appliedToCatalogAt: operationalOnecPurchaseCosts.appliedToCatalogAt,
    batchImportId: operationalOnecPurchaseCosts.batchImportId,
  }).from(operationalOnecPurchaseCosts)
    .leftJoin(operationalCatalogProducts, eq(operationalOnecPurchaseCosts.productId, operationalCatalogProducts.id))
    .orderBy(desc(operationalOnecPurchaseCosts.effectiveDate), desc(operationalOnecPurchaseCosts.id)).limit(limit);
}

/**
 * Applies exactly one already-mapped 1С cost after a human has chosen it.
 * This never picks BM over SRS and never changes an external catalog by itself.
 */
export async function applyOnecPurchaseCostToCatalog(input: { costId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.transaction(async tx => {
    const [cost] = await tx.select().from(operationalOnecPurchaseCosts).where(eq(operationalOnecPurchaseCosts.id, input.costId)).limit(1);
    if (!cost || !cost.productId || cost.mappingState !== "mapped") throw new Error("Сначала сопоставьте строку закупочной цены с действующим товаром.");
    const [product] = await tx.select().from(operationalCatalogProducts).where(and(eq(operationalCatalogProducts.id, cost.productId), eq(operationalCatalogProducts.isActive, true))).limit(1);
    if (!product) throw new Error("Товар закупочной цены недоступен в действующем справочнике.");
    if (inventoryUnitFromCatalogUnit(product.baseUnit) !== cost.unit) throw new Error("Единица закупочной цены 1С не совпадает с единицей учёта товара. Исправьте сопоставление или пакет 1С.");
    const before = { internalCostPrice: product.internalCostPrice, isEvotorCostExportEnabled: product.isEvotorCostExportEnabled };
    await tx.update(operationalCatalogProducts).set({ internalCostPrice: cost.purchasePrice }).where(eq(operationalCatalogProducts.id, product.id));
    await tx.update(operationalOnecPurchaseCosts).set({ appliedToCatalogAt: new Date(), appliedToCatalogByAccountId: input.actorId }).where(eq(operationalOnecPurchaseCosts.id, cost.id));
    const [after] = await tx.select().from(operationalCatalogProducts).where(eq(operationalCatalogProducts.id, product.id)).limit(1);
    return {
      cost: { id: cost.id, productId: product.id, productName: product.canonicalName, purchasePrice: cost.purchasePrice, effectiveDate: cost.effectiveDate, warehouseCode: cost.warehouseCode },
      before,
      after: { internalCostPrice: after!.internalCostPrice, isEvotorCostExportEnabled: after!.isEvotorCostExportEnabled, isEvotorExportEnabled: after!.isEvotorExportEnabled },
    };
  });
}

/** Latest mapped 1С snapshot by BM/SRS, deliberately separate from shop accounting balances. */
export async function listOnecWarehouseSummary() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const rows = await db.select({
    warehouseCode: operationalOnecWarehouseSnapshots.warehouseCode,
    quantityOnHand: operationalOnecWarehouseSnapshots.quantityOnHand,
    businessDate: operationalOnecWarehouseSnapshots.businessDate,
    asOf: operationalOnecWarehouseSnapshots.asOf,
  }).from(operationalOnecWarehouseSnapshots)
    .where(eq(operationalOnecWarehouseSnapshots.mappingState, "mapped"))
    .orderBy(desc(operationalOnecWarehouseSnapshots.asOf), desc(operationalOnecWarehouseSnapshots.id)).limit(10_000);
  return ["BM", "SRS"].map(warehouseCode => {
    const latestAsOf = rows.find(row => row.warehouseCode === warehouseCode)?.asOf ?? null;
    const current = latestAsOf ? rows.filter(row => row.warehouseCode === warehouseCode && row.asOf === latestAsOf) : [];
    return { warehouseCode, asOf: latestAsOf, businessDate: current[0]?.businessDate ?? null, positions: current.length, quantityOnHand: current.reduce((sum, row) => sum + Number(row.quantityOnHand), 0) };
  });
}

export async function listOnecStoreShipments(limit = 120) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.select({
    id: operationalOnecStoreShipments.id,
    shipmentId: operationalOnecStoreShipments.shipmentId,
    revisionId: operationalOnecStoreShipments.revisionId,
    businessDate: operationalOnecStoreShipments.businessDate,
    originWarehouseCode: operationalOnecStoreShipments.originWarehouseCode,
    destinationReference: operationalOnecStoreShipments.destinationReference,
    destinationStoreId: operationalOnecStoreShipments.destinationStoreId,
    destinationStoreName: stores.name,
    documentNumber: operationalOnecStoreShipments.documentNumber,
    sourceStatus: operationalOnecStoreShipments.sourceStatus,
    mappingState: operationalOnecStoreShipments.mappingState,
    batchImportId: operationalOnecStoreShipments.batchImportId,
  }).from(operationalOnecStoreShipments)
    .leftJoin(stores, eq(operationalOnecStoreShipments.destinationStoreId, stores.id))
    .orderBy(desc(operationalOnecStoreShipments.businessDate), desc(operationalOnecStoreShipments.id)).limit(limit);
}

/** Read-only detail of a shipment's mapped lots; source IDs and warehouse references stay server-side. */
export async function listOnecShipmentLines(shipmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  return db.select({
    id: operationalOnecShipmentLines.id,
    productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecShipmentLines.productName})`,
    quantity: operationalOnecShipmentLines.quantity,
    unit: operationalOnecShipmentLines.unit,
    expirationDate: operationalOnecShipmentLines.expirationDate,
    mappingState: operationalOnecShipmentLines.mappingState,
  }).from(operationalOnecShipmentLines)
    .leftJoin(operationalCatalogProducts, eq(operationalOnecShipmentLines.productId, operationalCatalogProducts.id))
    .where(eq(operationalOnecShipmentLines.shipmentId, shipmentId))
    .orderBy(desc(operationalOnecShipmentLines.expirationDate), desc(operationalOnecShipmentLines.id));
}

/**
 * Expiry candidates use only explicit 1С lot dates. Shipment lots are limited
 * to the previous 14 days because later stock ownership cannot be inferred;
 * warehouse candidates use the latest full BM/SRS snapshot only.
 */
export async function listOperationalExpiryFindings(input: { businessDate: string; lookbackDays?: number; alertDays?: number }) {
  const db = await getDb();
  if (!db) return { shipmentFindings: [], warehouseFindings: [] };
  const lookbackDays = input.lookbackDays ?? 14;
  const alertDays = input.alertDays ?? 7;
  const earliestShipmentDate = subtractCalendarDays(input.businessDate, lookbackDays - 1);
  const [shipmentRows, snapshotRows] = await Promise.all([
    db.select({
      shipmentId: operationalOnecStoreShipments.id,
      lineId: operationalOnecShipmentLines.id,
      storeId: stores.id,
      storeName: stores.name,
      productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecShipmentLines.productName})`,
      expirationDate: operationalOnecShipmentLines.expirationDate,
      businessDate: operationalOnecStoreShipments.businessDate,
    }).from(operationalOnecShipmentLines)
      .innerJoin(operationalOnecStoreShipments, eq(operationalOnecShipmentLines.shipmentId, operationalOnecStoreShipments.id))
      .innerJoin(stores, eq(operationalOnecStoreShipments.destinationStoreId, stores.id))
      .leftJoin(operationalCatalogProducts, eq(operationalOnecShipmentLines.productId, operationalCatalogProducts.id))
      .where(and(eq(operationalOnecStoreShipments.sourceStatus, "posted"), eq(operationalOnecStoreShipments.mappingState, "mapped"), eq(operationalOnecShipmentLines.mappingState, "mapped"), eq(stores.isHidden, false)))
      .limit(10_000),
    db.select({
      sourceRecordId: operationalOnecWarehouseSnapshots.sourceRecordId,
      warehouseCode: operationalOnecWarehouseSnapshots.warehouseCode,
      productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecWarehouseSnapshots.productName})`,
      expirationDate: operationalOnecWarehouseSnapshots.expirationDate,
      asOf: operationalOnecWarehouseSnapshots.asOf,
    }).from(operationalOnecWarehouseSnapshots)
      .leftJoin(operationalCatalogProducts, eq(operationalOnecWarehouseSnapshots.productId, operationalCatalogProducts.id))
      .where(eq(operationalOnecWarehouseSnapshots.mappingState, "mapped"))
      .orderBy(desc(operationalOnecWarehouseSnapshots.asOf), desc(operationalOnecWarehouseSnapshots.id))
      .limit(10_000),
  ]);
  const toExpiry = <T extends { expirationDate: string | null }>(row: T) => ({ ...row, expirationDate: row.expirationDate!, daysUntilExpiration: daysUntilExpiration(row.expirationDate!, input.businessDate) });
  const shipmentFindings = shipmentRows
    .filter(row => row.expirationDate && row.businessDate >= earliestShipmentDate && row.businessDate <= input.businessDate)
    .map(toExpiry)
    .filter(row => row.daysUntilExpiration <= alertDays);
  const latestAsOfByWarehouse = new Map<string, string>();
  for (const row of snapshotRows) if (!latestAsOfByWarehouse.has(row.warehouseCode)) latestAsOfByWarehouse.set(row.warehouseCode, row.asOf);
  const warehouseFindings = snapshotRows
    .filter(row => row.expirationDate && latestAsOfByWarehouse.get(row.warehouseCode) === row.asOf)
    .map(toExpiry)
    .filter(row => row.daysUntilExpiration <= alertDays);
  return { shipmentFindings, warehouseFindings };
}

export async function listOnecQuarantine(limit = 120) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [snapshotRows, shipmentRows, costRows] = await Promise.all([
    db.select({ id: operationalOnecWarehouseSnapshots.id, productName: operationalOnecWarehouseSnapshots.productName, kind: sql<string>`'snapshot'`, batchImportId: operationalOnecWarehouseSnapshots.batchImportId })
      .from(operationalOnecWarehouseSnapshots).where(eq(operationalOnecWarehouseSnapshots.mappingState, "quarantined")).limit(limit),
    db.select({ id: operationalOnecShipmentLines.id, productName: operationalOnecShipmentLines.productName, kind: sql<string>`'shipment'`, batchImportId: operationalOnecStoreShipments.batchImportId })
      .from(operationalOnecShipmentLines).innerJoin(operationalOnecStoreShipments, eq(operationalOnecShipmentLines.shipmentId, operationalOnecStoreShipments.id))
      .where(eq(operationalOnecShipmentLines.mappingState, "quarantined")).limit(limit),
    db.select({ id: operationalOnecPurchaseCosts.id, productName: operationalOnecPurchaseCosts.productName, kind: sql<string>`'purchase_cost'`, batchImportId: operationalOnecPurchaseCosts.batchImportId })
      .from(operationalOnecPurchaseCosts).where(eq(operationalOnecPurchaseCosts.mappingState, "quarantined")).limit(limit),
  ]);
  const batchIds = Array.from(new Set([...snapshotRows, ...shipmentRows, ...costRows].map(row => row.batchImportId)));
  const batches = batchIds.length ? await db.select({ id: operationalOnecImportBatches.id, sourceSystem: operationalOnecImportBatches.sourceSystem }).from(operationalOnecImportBatches).where(inArray(operationalOnecImportBatches.id, batchIds)) : [];
  const sourceByBatch = new Map(batches.map(row => [row.id, row.sourceSystem]));
  return [...snapshotRows, ...shipmentRows, ...costRows].map(row => ({ ...row, sourceSystem: sourceByBatch.get(row.batchImportId) ?? "" }));
}

export async function listOnecMappingOptions() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [products, visibleStores] = await Promise.all([
    db.select({ id: operationalCatalogProducts.id, catalogNumber: operationalCatalogProducts.catalogNumber, canonicalName: operationalCatalogProducts.canonicalName }).from(operationalCatalogProducts).where(eq(operationalCatalogProducts.isActive, true)).orderBy(operationalCatalogProducts.catalogNumber),
    db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false)).orderBy(stores.name),
  ]);
  return { products, stores: visibleStores };
}

export async function setOnecProductLink(input: { sourceSystem: string; sourceProductId: string; productId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const sourceSystem = clean(input.sourceSystem);
  const sourceProductId = clean(input.sourceProductId);
  const [product] = await db.select({ id: operationalCatalogProducts.id, canonicalName: operationalCatalogProducts.canonicalName }).from(operationalCatalogProducts).where(and(eq(operationalCatalogProducts.id, input.productId), eq(operationalCatalogProducts.isActive, true))).limit(1);
  if (!product) throw new Error("Выберите действующий товар общего справочника.");
  await db.insert(operationalOnecProductLinks).values({ sourceSystem, sourceProductId, productId: product.id, mappedByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { productId: product.id, mappedByAccountId: input.actorId } });
  const batches = await db.select({ id: operationalOnecImportBatches.id }).from(operationalOnecImportBatches).where(eq(operationalOnecImportBatches.sourceSystem, sourceSystem));
  const batchIds = batches.map(batch => batch.id);
  if (batchIds.length) {
    await db.update(operationalOnecWarehouseSnapshots).set({ productId: product.id, mappingState: "mapped" }).where(and(inArray(operationalOnecWarehouseSnapshots.batchImportId, batchIds), eq(operationalOnecWarehouseSnapshots.productSourceId, sourceProductId)));
    const shipments = await db.select({ id: operationalOnecStoreShipments.id }).from(operationalOnecStoreShipments).where(inArray(operationalOnecStoreShipments.batchImportId, batchIds));
    const shipmentIds = shipments.map(shipment => shipment.id);
    if (shipmentIds.length) {
      await db.update(operationalOnecShipmentLines).set({ productId: product.id, mappingState: "mapped" }).where(and(inArray(operationalOnecShipmentLines.shipmentId, shipmentIds), eq(operationalOnecShipmentLines.productSourceId, sourceProductId)));
      await refreshShipmentStates(db, shipmentIds);
    }
    await db.update(operationalOnecPurchaseCosts).set({ productId: product.id, mappingState: "mapped" })
      .where(and(inArray(operationalOnecPurchaseCosts.batchImportId, batchIds), eq(operationalOnecPurchaseCosts.productSourceId, sourceProductId)));
  }
  return { product };
}

export async function setOnecStoreLink(input: { sourceSystem: string; destinationReference: string; storeId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const sourceSystem = clean(input.sourceSystem);
  const destinationReference = clean(input.destinationReference);
  const [store] = await db.select({ id: stores.id, name: stores.name, isHidden: stores.isHidden }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
  if (!store || store.isHidden) throw new Error("Выберите видимую операционную точку.");
  await db.insert(operationalOnecStoreLinks).values({ sourceSystem, destinationReference, storeId: store.id, mappedByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { storeId: store.id, mappedByAccountId: input.actorId } });
  const batches = await db.select({ id: operationalOnecImportBatches.id }).from(operationalOnecImportBatches).where(eq(operationalOnecImportBatches.sourceSystem, sourceSystem));
  const batchIds = batches.map(batch => batch.id);
  if (batchIds.length) {
    await db.update(operationalOnecStoreShipments).set({ destinationStoreId: store.id, mappingState: "quarantined" }).where(and(inArray(operationalOnecStoreShipments.batchImportId, batchIds), eq(operationalOnecStoreShipments.destinationReference, destinationReference), eq(operationalOnecStoreShipments.mappingState, "unmapped")));
    const shipments = await db.select({ id: operationalOnecStoreShipments.id }).from(operationalOnecStoreShipments).where(and(inArray(operationalOnecStoreShipments.batchImportId, batchIds), eq(operationalOnecStoreShipments.destinationReference, destinationReference)));
    await refreshShipmentStates(db, shipments.map(shipment => shipment.id));
  }
  return { store };
}

async function refreshShipmentStates(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, shipmentIds: number[]) {
  for (const shipmentId of shipmentIds) {
    const [header] = await db.select({ destinationStoreId: operationalOnecStoreShipments.destinationStoreId }).from(operationalOnecStoreShipments).where(eq(operationalOnecStoreShipments.id, shipmentId)).limit(1);
    const unresolved = await db.select({ id: operationalOnecShipmentLines.id }).from(operationalOnecShipmentLines).where(and(eq(operationalOnecShipmentLines.shipmentId, shipmentId), eq(operationalOnecShipmentLines.mappingState, "quarantined"))).limit(1);
    const mappingState = header?.destinationStoreId && !unresolved[0] ? "mapped" as const : header?.destinationStoreId ? "quarantined" as const : "unmapped" as const;
    await db.update(operationalOnecStoreShipments).set({ mappingState }).where(eq(operationalOnecStoreShipments.id, shipmentId));
  }
}

/** Maps a quarantine record by its local id; source IDs are not sent to the client or displayed. */
export async function resolveOnecQuarantineProduct(input: { kind: "snapshot" | "shipment" | "purchase_cost"; id: number; productId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (input.kind === "snapshot") {
    const [row] = await db.select({ productSourceId: operationalOnecWarehouseSnapshots.productSourceId, sourceSystem: operationalOnecImportBatches.sourceSystem })
      .from(operationalOnecWarehouseSnapshots).innerJoin(operationalOnecImportBatches, eq(operationalOnecWarehouseSnapshots.batchImportId, operationalOnecImportBatches.id))
      .where(eq(operationalOnecWarehouseSnapshots.id, input.id)).limit(1);
    if (!row) throw new Error("Карантинная строка остатка не найдена.");
    return setOnecProductLink({ sourceSystem: row.sourceSystem, sourceProductId: row.productSourceId, productId: input.productId, actorId: input.actorId });
  }
  if (input.kind === "purchase_cost") {
    const [row] = await db.select({ productSourceId: operationalOnecPurchaseCosts.productSourceId, sourceSystem: operationalOnecImportBatches.sourceSystem })
      .from(operationalOnecPurchaseCosts).innerJoin(operationalOnecImportBatches, eq(operationalOnecPurchaseCosts.batchImportId, operationalOnecImportBatches.id))
      .where(eq(operationalOnecPurchaseCosts.id, input.id)).limit(1);
    if (!row) throw new Error("Карантинная строка закупочной цены не найдена.");
    return setOnecProductLink({ sourceSystem: row.sourceSystem, sourceProductId: row.productSourceId, productId: input.productId, actorId: input.actorId });
  }
  const [row] = await db.select({ productSourceId: operationalOnecShipmentLines.productSourceId, sourceSystem: operationalOnecImportBatches.sourceSystem })
    .from(operationalOnecShipmentLines).innerJoin(operationalOnecStoreShipments, eq(operationalOnecShipmentLines.shipmentId, operationalOnecStoreShipments.id)).innerJoin(operationalOnecImportBatches, eq(operationalOnecStoreShipments.batchImportId, operationalOnecImportBatches.id))
    .where(eq(operationalOnecShipmentLines.id, input.id)).limit(1);
  if (!row) throw new Error("Карантинная строка накладной не найдена.");
  return setOnecProductLink({ sourceSystem: row.sourceSystem, sourceProductId: row.productSourceId, productId: input.productId, actorId: input.actorId });
}

/** Maps a quarantine invoice recipient by its local id; the received reference stays server-side. */
export async function resolveOnecShipmentDestination(input: { shipmentId: number; storeId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select({ destinationReference: operationalOnecStoreShipments.destinationReference, sourceSystem: operationalOnecImportBatches.sourceSystem })
    .from(operationalOnecStoreShipments).innerJoin(operationalOnecImportBatches, eq(operationalOnecStoreShipments.batchImportId, operationalOnecImportBatches.id))
    .where(eq(operationalOnecStoreShipments.id, input.shipmentId)).limit(1);
  if (!row) throw new Error("Накладная 1С не найдена.");
  return setOnecStoreLink({ sourceSystem: row.sourceSystem, destinationReference: row.destinationReference, storeId: input.storeId, actorId: input.actorId });
}

type ShipmentReceiptStatus = "awaiting_store" | "reported" | "confirmed";
const receiptNote = (value: string | undefined) => {
  const note = clean(value ?? "").replace(/\s+/g, " ");
  if (note.length > 512) throw new Error("Комментарий к приёмке не должен превышать 512 символов.");
  return note || null;
};

function receiptSummary(row: typeof operationalOnecShipmentReceipts.$inferSelect | null, expectedLines: Array<{ expectedQuantity: number; actualQuantity: number | null }>) {
  const differences = expectedLines.filter(line => line.actualQuantity !== null && Math.abs(line.expectedQuantity - line.actualQuantity) > 0.0005).length;
  return {
    receiptId: row?.id ?? null,
    receiptStatus: (row?.status ?? "awaiting_store") as ShipmentReceiptStatus,
    receiptNote: row?.storeNote ?? null,
    reportedAt: row?.reportedAt ?? null,
    confirmedAt: row?.confirmedAt ?? null,
    differenceCount: differences,
  };
}

/** Store-safe queue: only mapped, posted invoices for assigned shops, with no 1С source keys exposed. */
export async function listOnecShipmentReceipts(input: { storeIds?: number[] | null; limit?: number }) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const candidates = await db.select({
    id: operationalOnecStoreShipments.id,
    businessDate: operationalOnecStoreShipments.businessDate,
    destinationStoreId: operationalOnecStoreShipments.destinationStoreId,
    destinationStoreName: stores.name,
    documentNumber: operationalOnecStoreShipments.documentNumber,
    sourceStatus: operationalOnecStoreShipments.sourceStatus,
    mappingState: operationalOnecStoreShipments.mappingState,
    receiptId: operationalOnecShipmentReceipts.id,
    receiptStatus: operationalOnecShipmentReceipts.status,
    reportedAt: operationalOnecShipmentReceipts.reportedAt,
    confirmedAt: operationalOnecShipmentReceipts.confirmedAt,
  }).from(operationalOnecStoreShipments)
    .innerJoin(stores, eq(operationalOnecStoreShipments.destinationStoreId, stores.id))
    .leftJoin(operationalOnecShipmentReceipts, eq(operationalOnecShipmentReceipts.shipmentId, operationalOnecStoreShipments.id))
    .where(and(eq(operationalOnecStoreShipments.sourceStatus, "posted"), eq(operationalOnecStoreShipments.mappingState, "mapped"), eq(stores.isHidden, false)))
    .orderBy(desc(operationalOnecStoreShipments.businessDate), desc(operationalOnecStoreShipments.id)).limit(Math.min(Math.max(input.limit ?? 80, 1), 200));
  const allowed = input.storeIds ? new Set(input.storeIds) : null;
  const rows = candidates.filter(row => row.destinationStoreId !== null && (!allowed || allowed.has(row.destinationStoreId)));
  if (!rows.length) return [];
  const shipmentIds = rows.map(row => row.id);
  const lines = await db.select({ shipmentId: operationalOnecShipmentLines.shipmentId, receiptId: operationalOnecShipmentReceiptLines.receiptId, expectedQuantity: operationalOnecShipmentReceiptLines.expectedQuantity, actualQuantity: operationalOnecShipmentReceiptLines.actualQuantity })
    .from(operationalOnecShipmentLines)
    .leftJoin(operationalOnecShipmentReceiptLines, eq(operationalOnecShipmentReceiptLines.shipmentLineId, operationalOnecShipmentLines.id))
    .where(and(inArray(operationalOnecShipmentLines.shipmentId, shipmentIds), eq(operationalOnecShipmentLines.mappingState, "mapped")));
  const grouped = new Map<number, Array<{ expectedQuantity: number; actualQuantity: number | null }>>();
  for (const line of lines) grouped.set(line.shipmentId, [...(grouped.get(line.shipmentId) ?? []), { expectedQuantity: Number(line.expectedQuantity ?? 0), actualQuantity: line.actualQuantity === null ? null : Number(line.actualQuantity) }]);
  return rows.map(row => ({
    id: row.id,
    businessDate: row.businessDate,
    storeId: row.destinationStoreId!,
    storeName: row.destinationStoreName ?? "Магазин не найден",
    documentNumber: row.documentNumber,
    lineCount: grouped.get(row.id)?.length ?? 0,
    ...receiptSummary(row.receiptId === null ? null : { id: row.receiptId, shipmentId: row.id, storeId: row.destinationStoreId!, status: row.receiptStatus!, storeNote: null, reportedByAccountId: null, reportedAt: row.reportedAt, confirmedByAccountId: null, confirmedAt: row.confirmedAt, createdAt: new Date(), updatedAt: new Date() }, grouped.get(row.id) ?? []),
  }));
}

/** Detail intentionally contains business labels and quantities only, never 1С source IDs or destination references. */
export async function getOnecShipmentReceiptDetail(input: { shipmentId: number }) {
  const db = await getDb();
  if (!db) return null;
  const [shipment] = await db.select({
    id: operationalOnecStoreShipments.id, businessDate: operationalOnecStoreShipments.businessDate,
    storeId: operationalOnecStoreShipments.destinationStoreId, storeName: stores.name,
    documentNumber: operationalOnecStoreShipments.documentNumber, sourceStatus: operationalOnecStoreShipments.sourceStatus,
    mappingState: operationalOnecStoreShipments.mappingState,
    receiptId: operationalOnecShipmentReceipts.id, receiptStatus: operationalOnecShipmentReceipts.status,
    receiptNote: operationalOnecShipmentReceipts.storeNote, reportedAt: operationalOnecShipmentReceipts.reportedAt,
    confirmedAt: operationalOnecShipmentReceipts.confirmedAt,
  }).from(operationalOnecStoreShipments).innerJoin(stores, eq(operationalOnecStoreShipments.destinationStoreId, stores.id))
    .leftJoin(operationalOnecShipmentReceipts, eq(operationalOnecShipmentReceipts.shipmentId, operationalOnecStoreShipments.id))
    .where(eq(operationalOnecStoreShipments.id, input.shipmentId)).limit(1);
  if (!shipment || shipment.storeId === null || shipment.sourceStatus !== "posted" || shipment.mappingState !== "mapped") return null;
  const lines = await db.select({
    shipmentLineId: operationalOnecShipmentLines.id, productId: operationalOnecShipmentLines.productId,
    productName: sql<string | null>`coalesce(${operationalCatalogProducts.canonicalName}, ${operationalOnecShipmentLines.productName})`,
    expectedQuantity: operationalOnecShipmentLines.quantity, unit: operationalOnecShipmentLines.unit,
    expirationDate: operationalOnecShipmentLines.expirationDate, actualQuantity: operationalOnecShipmentReceiptLines.actualQuantity,
  }).from(operationalOnecShipmentLines).leftJoin(operationalCatalogProducts, eq(operationalOnecShipmentLines.productId, operationalCatalogProducts.id))
    .leftJoin(operationalOnecShipmentReceiptLines, eq(operationalOnecShipmentReceiptLines.shipmentLineId, operationalOnecShipmentLines.id))
    .where(and(eq(operationalOnecShipmentLines.shipmentId, shipment.id), eq(operationalOnecShipmentLines.mappingState, "mapped")))
    .orderBy(desc(operationalOnecShipmentLines.expirationDate), desc(operationalOnecShipmentLines.id));
  if (!lines.length || lines.some(line => line.productId === null)) return null;
  const normalizedLines = lines.map(line => ({ shipmentLineId: line.shipmentLineId, productId: line.productId!, productName: line.productName ?? "Позиция накладной", expectedQuantity: Number(line.expectedQuantity), actualQuantity: line.actualQuantity === null ? null : Number(line.actualQuantity), unit: line.unit, expirationDate: line.expirationDate }));
  return {
    id: shipment.id, businessDate: shipment.businessDate, storeId: shipment.storeId, storeName: shipment.storeName ?? "Магазин не найден", documentNumber: shipment.documentNumber,
    ...receiptSummary(shipment.receiptId === null ? null : { id: shipment.receiptId, shipmentId: shipment.id, storeId: shipment.storeId, status: shipment.receiptStatus!, storeNote: shipment.receiptNote, reportedByAccountId: null, reportedAt: shipment.reportedAt, confirmedByAccountId: null, confirmedAt: shipment.confirmedAt, createdAt: new Date(), updatedAt: new Date() }, normalizedLines),
    lines: normalizedLines,
  };
}

/** Exact receipt is accepted by the shop; a variance remains a report until management confirms it. */
export async function reportOnecShipmentReceipt(input: { shipmentId: number; actorId: number; storeNote?: string; lines: Array<{ shipmentLineId: number; actualQuantity: number }> }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const detail = await getOnecShipmentReceiptDetail({ shipmentId: input.shipmentId });
  if (!detail) throw new Error("Накладная недоступна для приёмки: проверьте сопоставление магазина и товаров.");
  if (detail.receiptStatus === "confirmed") throw new Error("Подтвержденную приёмку нельзя изменить.");
  if (input.lines.length !== detail.lines.length || new Set(input.lines.map(line => line.shipmentLineId)).size !== detail.lines.length) throw new Error("Передайте фактическое количество по каждой строке накладной.");
  const quantities = new Map(input.lines.map(line => [line.shipmentLineId, validateCountedQuantity(line.actualQuantity)]));
  if (detail.lines.some(line => !quantities.has(line.shipmentLineId))) throw new Error("В приёмке отсутствует одна из строк накладной.");
  const note = receiptNote(input.storeNote);
  const isExact = detail.lines.every(line => Math.abs(line.expectedQuantity - (quantities.get(line.shipmentLineId) ?? NaN)) <= 0.0005);
  const receipt = await db.transaction(async tx => {
    let receiptId = detail.receiptId;
    const now = new Date();
    if (receiptId === null) {
      const inserted = await tx.insert(operationalOnecShipmentReceipts).values({ shipmentId: detail.id, storeId: detail.storeId, status: "reported", storeNote: note, reportedByAccountId: input.actorId, reportedAt: now, confirmedByAccountId: null, confirmedAt: null });
      receiptId = Number(inserted[0].insertId);
    } else {
      await tx.update(operationalOnecShipmentReceipts).set({ status: "reported", storeNote: note, reportedByAccountId: input.actorId, reportedAt: now, confirmedByAccountId: null, confirmedAt: null }).where(eq(operationalOnecShipmentReceipts.id, receiptId));
      await tx.delete(operationalOnecShipmentReceiptLines).where(eq(operationalOnecShipmentReceiptLines.receiptId, receiptId));
    }
    await tx.insert(operationalOnecShipmentReceiptLines).values(detail.lines.map(line => ({ receiptId: receiptId!, shipmentLineId: line.shipmentLineId, productId: line.productId, expectedQuantity: line.expectedQuantity.toFixed(3), actualQuantity: (quantities.get(line.shipmentLineId) ?? 0).toFixed(3), unit: line.unit })));
    return { receiptId: receiptId!, differenceCount: detail.lines.filter(line => Math.abs(line.expectedQuantity - (quantities.get(line.shipmentLineId) ?? 0)) > 0.0005).length };
  });
  const applied = isExact ? await applyConfirmedShipmentReceipt({ receiptId: receipt.receiptId, detail, actorId: input.actorId }) : { appliedMovements: 0 };
  if (isExact) {
    await db.update(operationalOnecShipmentReceipts).set({ status: "confirmed", confirmedByAccountId: input.actorId, confirmedAt: new Date() }).where(eq(operationalOnecShipmentReceipts.id, receipt.receiptId));
  }
  return {
    ...receipt,
    status: isExact ? "confirmed" as const : "reported" as const,
    stockPolicy: isExact ? "confirmed_shipment_receipt_movement" as const : "reconciliation_pending_management_confirmation" as const,
    appliedMovements: applied.appliedMovements,
  };
}

async function applyConfirmedShipmentReceipt(input: { receiptId: number; detail: NonNullable<Awaited<ReturnType<typeof getOnecShipmentReceiptDetail>>>; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const receiptLines = await db.select({ shipmentLineId: operationalOnecShipmentReceiptLines.shipmentLineId, productId: operationalOnecShipmentReceiptLines.productId, actualQuantity: operationalOnecShipmentReceiptLines.actualQuantity, unit: operationalOnecShipmentReceiptLines.unit })
    .from(operationalOnecShipmentReceiptLines)
    .where(eq(operationalOnecShipmentReceiptLines.receiptId, input.receiptId));
  if (receiptLines.length !== input.detail.lines.length) throw new Error("Перед проведением приёмки проверьте фактические строки накладной.");
  const productIds = receiptLines.map(line => line.productId);
  const currentQuantities = await getInventoryAccountingQuantities(input.detail.storeId, productIds);
  const existingMovements = await db.select({ shipmentReceiptLineId: operationalStockMovements.shipmentReceiptLineId })
    .from(operationalStockMovements)
    .where(inArray(operationalStockMovements.shipmentReceiptLineId, receiptLines.map(line => line.shipmentLineId)))
    .limit(receiptLines.length);
  const existingLineIds = new Set(existingMovements.map(row => row.shipmentReceiptLineId).filter((value): value is number => value !== null));
  const detailLineById = new Map(input.detail.lines.map(line => [line.shipmentLineId, line]));
  const pendingDeltaByProduct = new Map<number, number>();
  const movements = receiptLines.flatMap(line => {
    if (existingLineIds.has(line.shipmentLineId)) return [];
    const detailLine = detailLineById.get(line.shipmentLineId);
    if (!detailLine) throw new Error("Строка приёмки не найдена в накладной.");
    const actualQuantity = validateCountedQuantity(Number(line.actualQuantity));
    const previousQuantity = (currentQuantities.get(line.productId) ?? 0) + (pendingDeltaByProduct.get(line.productId) ?? 0);
    pendingDeltaByProduct.set(line.productId, (pendingDeltaByProduct.get(line.productId) ?? 0) + actualQuantity);
    return [{
      storeId: input.detail.storeId,
      productId: line.productId,
      inventoryId: null,
      transferId: null,
      shipmentReceiptLineId: line.shipmentLineId,
      relatedStoreId: null,
      kind: "shipment_receipt" as const,
      previousQuantity: previousQuantity.toFixed(3),
      countedQuantity: (previousQuantity + actualQuantity).toFixed(3),
      quantityDelta: actualQuantity.toFixed(3),
      unit: inventoryUnitFromCatalogUnit(detailLine.unit === "kg" ? "fraction" : detailLine.unit === "piece" ? "piece" : "l"),
      adjustmentReason: `Приёмка 1С${input.detail.documentNumber ? ` № ${input.detail.documentNumber}` : ""}`.slice(0, 512),
      createdByAccountId: input.actorId,
    }];
  });
  if (movements.length) await db.insert(operationalStockMovements).values(movements);
  return { appliedMovements: movements.length };
}

/** Management confirmation conducts accepted lots exactly once; receipt lines stay idempotent. */
export async function confirmOnecShipmentReceipt(input: { shipmentId: number; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const detail = await getOnecShipmentReceiptDetail({ shipmentId: input.shipmentId });
  if (!detail || detail.receiptId === null) throw new Error("Накладная ещё не передана магазином.");
  if (detail.receiptStatus !== "reported") throw new Error("Подтверждение требуется только для приёмки с расхождениями.");
  if (detail.lines.some(line => line.actualQuantity === null)) throw new Error("Магазин должен указать фактическое количество по каждой строке.");
  const applied = await applyConfirmedShipmentReceipt({ receiptId: detail.receiptId, detail, actorId: input.actorId });
  await db.update(operationalOnecShipmentReceipts).set({ status: "confirmed", confirmedByAccountId: input.actorId, confirmedAt: new Date() }).where(eq(operationalOnecShipmentReceipts.id, detail.receiptId));
  return { receiptId: detail.receiptId, status: "confirmed" as const, differenceCount: detail.differenceCount, stockPolicy: "confirmed_shipment_receipt_movement" as const, appliedMovements: applied.appliedMovements };
}

export const __onecImportTestUtils = { assertBasePackage, warehouseCode, onecWarehouseCodes, normalizedExpirationDate, daysUntilExpiration, subtractCalendarDays };
