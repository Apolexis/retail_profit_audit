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
  type: string | null;
  parentId: string | null;
};

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
  return stores.sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export async function listEvotorCatalogPreview(storeId: string): Promise<EvotorCatalogPreviewItem[]> {
  const encodedStoreId = encodeURIComponent(storeId);
  const products = (await readEvotorPages(`/stores/${encodedStoreId}/products`))
    .map(normalizeEvotorCatalogPreviewItem)
    .filter((product): product is EvotorCatalogPreviewItem => Boolean(product));
  return products.sort((left, right) => left.name.localeCompare(right.name, "ru"));
}
