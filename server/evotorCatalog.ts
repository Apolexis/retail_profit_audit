import { eq } from "drizzle-orm";
import { operationalStoreMappings, stores } from "../drizzle/schema";
import { getDb } from "./db";

const EVOTOR_API_BASE_URL = "https://api.evotor.ru";
const EVOTOR_MEDIA_TYPE = "application/vnd.evotor.v2+json";
const MAX_PAGES_PER_PREVIEW = 5;

type EvotorPage = {
  items?: unknown[];
  paging?: { next_cursor?: unknown };
};

type EvotorRecord = Record<string, unknown>;
type EvotorProductGroup = { id: string; name: string; parentId: string | null };

export type EvotorCatalogStore = {
  id: string;
  name: string;
  address: string | null;
};

export type EvotorCatalogPreviewItem = {
  id: string;
  code: string | null;
  name: string;
  barcodes: string[];
  quantity: number | null;
  unit: string | null;
  tax: string | null;
  vatRate: "VAT_10" | "VAT_22";
  type: string | null;
  parentId: string | null;
  categoryName: string | null;
};

/** Minimal read-only document projection: no fiscal IDs, customer details or payment requisites leave the server. */
export type EvotorDocumentPreview = {
  id: string;
  type: string;
  createdAt: string | null;
  closedAt: string | null;
  total: number | null;
  positions: Array<{
    productId: string | null;
    productName: string | null;
    quantity: number | null;
    initialQuantity: number | null;
    unit: string | null;
    settlementMethod: string | null;
    resultSum: number | null;
  }>;
};

function vatRateFromEvotorTax(value: unknown): "VAT_10" | "VAT_22" {
  const normalized = text(value)?.toUpperCase() ?? "";
  return normalized.includes("22") ? "VAT_22" : "VAT_10";
}

function asRecord(value: unknown): EvotorRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as EvotorRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function barcodeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(text).filter((barcode): barcode is string => Boolean(barcode))));
}

export function normalizeEvotorStore(value: unknown): EvotorCatalogStore | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const name = text(record.name);
  if (!id || !name) return null;
  return { id, name, address: text(record.address) };
}

export function normalizeEvotorCatalogPreviewItem(value: unknown): EvotorCatalogPreviewItem | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const name = text(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    code: text(record.code),
    barcodes: barcodeList(record.barcodes),
    // Cloud API marks an untracked/unlimited balance with one million. It is not a physical stock fact.
    quantity: (() => { const value = finiteNumber(record.quantity); return value !== null && value >= 999_999 ? null : value; })(),
    unit: text(record.measure_name),
    tax: text(record.tax),
    vatRate: vatRateFromEvotorTax(record.tax),
    type: text(record.type),
    parentId: text(record.parent_id),
    categoryName: null,
  };
}

function normalizeEvotorProductGroup(value: unknown): EvotorProductGroup | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const name = text(record.name);
  if (!id || !name) return null;
  return { id, name, parentId: text(record.parent_id) };
}

function evotorHeaders() {
  const token = process.env.EVOTOR_API_TOKEN?.trim();
  if (!token) throw new Error("Не настроен серверный доступ Эвотор для preview каталога.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: EVOTOR_MEDIA_TYPE,
    "Content-Type": EVOTOR_MEDIA_TYPE,
  };
}

async function fetchEvotorPage(path: string, cursor?: string): Promise<EvotorPage> {
  const url = new URL(path, EVOTOR_API_BASE_URL);
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { headers: evotorHeaders() });
  if (!response.ok) throw new Error(`Эвотор не отдал preview каталога (HTTP ${response.status}).`);
  return response.json() as Promise<EvotorPage>;
}

export function normalizeEvotorDocumentPreview(value: unknown): EvotorDocumentPreview | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const type = text(record.type);
  if (!id || !type) return null;
  const body = asRecord(record.body);
  const positions = Array.isArray(body?.positions) ? body.positions.flatMap(position => {
    const line = asRecord(position);
    if (!line) return [];
    const settlement = asRecord(line.settlement_method);
    return [{
      productId: text(line.uuid) ?? text(line.id),
      productName: text(line.product_name),
      quantity: finiteNumber(line.quantity),
      initialQuantity: finiteNumber(line.initial_quantity),
      unit: text(line.measure_name),
      settlementMethod: text(settlement?.type),
      resultSum: finiteNumber(line.result_sum),
    }];
  }) : [];
  return {
    id,
    type,
    createdAt: text(record.created_at),
    closedAt: text(record.close_date),
    total: finiteNumber(body?.result_sum) ?? finiteNumber(body?.sum),
    positions,
  };
}

async function readEvotorPages(path: string): Promise<unknown[]> {
  const items: unknown[] = [];
  let cursor: string | undefined;
  for (let pageNumber = 0; pageNumber < MAX_PAGES_PER_PREVIEW; pageNumber += 1) {
    const page = await fetchEvotorPage(path, cursor);
    if (Array.isArray(page.items)) items.push(...page.items);
    const nextCursor = text(page.paging?.next_cursor);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return items;
}

export async function listEvotorCatalogStoresPreview(): Promise<EvotorCatalogStore[]> {
  const stores = (await readEvotorPages("/stores"))
    .map(normalizeEvotorStore)
    .filter((store): store is EvotorCatalogStore => Boolean(store));
  return Array.from(new Map(stores.map(store => [store.id, store])).values())
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export async function listEvotorCatalogPreview(storeId: string): Promise<EvotorCatalogPreviewItem[]> {
  const encodedStoreId = encodeURIComponent(storeId);
  const [rawProducts, rawGroups] = await Promise.all([
    readEvotorPages(`/stores/${encodedStoreId}/products`),
    readEvotorPages(`/stores/${encodedStoreId}/product-groups`),
  ]);
  const products = rawProducts
    .map(normalizeEvotorCatalogPreviewItem)
    .filter((product): product is EvotorCatalogPreviewItem => Boolean(product));
  const groups = rawGroups.map(normalizeEvotorProductGroup).filter((group): group is EvotorProductGroup => Boolean(group));
  const all = Array.from(new Map(products.map(product => [product.id, product])).values());
  const groupsById = new Map(groups.map(group => [group.id, group]));
  return all.map(product => ({ ...product, categoryName: product.parentId ? groupsById.get(product.parentId)?.name ?? null : null }))
    .filter(product => !/^(group|folder|category)$/i.test(product.type ?? ""))
    .sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

function normalizedStoreName(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/[\W_]+/g, "").trim();
}

/** Resolves only the human-confirmed store mapping; no arbitrary Evotor store ID reaches the UI. */
export async function getOperationalEvotorMapping(storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [mapping] = await db
    .select({ internalStoreName: stores.name, evotorStoreName: operationalStoreMappings.evotorStoreName, terminalUuid: operationalStoreMappings.evotorTerminalUuid })
    .from(operationalStoreMappings)
    .innerJoin(stores, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(operationalStoreMappings.storeId, storeId))
    .limit(1);
  if (!mapping) throw new Error("Для выбранной точки еще не задано соответствие с магазином Эвотор.");
  return { storeId, internalStoreName: mapping.internalStoreName, evotorStoreName: mapping.evotorStoreName, terminalUuid: mapping.terminalUuid };
}

export async function listEvotorCatalogPreviewForOperationalStore(storeId: number) {
  const mapping = await getOperationalEvotorMapping(storeId);
  const evotorStores = await listEvotorCatalogStoresPreview();
  const matched = mapping.terminalUuid
    ? evotorStores.filter(store => store.id === mapping.terminalUuid)
    : evotorStores.filter(store => normalizedStoreName(store.name) === normalizedStoreName(mapping.evotorStoreName));
  if (matched.length !== 1) throw new Error(matched.length ? "Соответствие магазина Эвотор неоднозначно: требуется его ID." : "Магазин Эвотор из сохраненного соответствия не найден.");
  const evotorStore = matched[0];
  return {
    mapping: { storeId, internalStoreName: mapping.internalStoreName, evotorStoreName: evotorStore.name },
    products: await listEvotorCatalogPreview(evotorStore.id),
  };
}

/** Reads one cursor page only, so a human-triggered preview cannot fan out or mutate external data. */
export async function listEvotorDocumentsPreviewForOperationalStore(input: { storeId: number; cursor?: string }) {
  const mapping = await getOperationalEvotorMapping(input.storeId);
  const evotorStores = await listEvotorCatalogStoresPreview();
  const matched = mapping.terminalUuid
    ? evotorStores.filter(store => store.id === mapping.terminalUuid)
    : evotorStores.filter(store => normalizedStoreName(store.name) === normalizedStoreName(mapping.evotorStoreName));
  if (matched.length !== 1) throw new Error(matched.length ? "Соответствие магазина Эвотор неоднозначно: требуется его ID." : "Магазин Эвотор из сохраненного соответствия не найден.");
  const page = await fetchEvotorPage(`/stores/${encodeURIComponent(matched[0].id)}/documents`, input.cursor);
  return {
    storeId: input.storeId,
    documents: (page.items ?? []).map(normalizeEvotorDocumentPreview).filter((item): item is EvotorDocumentPreview => Boolean(item)),
    nextCursor: text(page.paging?.next_cursor),
  };
}
