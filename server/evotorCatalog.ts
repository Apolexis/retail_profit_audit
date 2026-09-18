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
  unit: string | null;
  tax: string | null;
  vatRate: "VAT_10" | "VAT_22";
  type: string | null;
  parentId: string | null;
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
    unit: text(record.measure_name),
    tax: text(record.tax),
    vatRate: vatRateFromEvotorTax(record.tax),
    type: text(record.type),
    parentId: text(record.parent_id),
  };
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
  const products = (await readEvotorPages(`/stores/${encodedStoreId}/products`))
    .map(normalizeEvotorCatalogPreviewItem)
    .filter((product): product is EvotorCatalogPreviewItem => Boolean(product));
  return Array.from(new Map(products.map(product => [product.id, product])).values())
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
