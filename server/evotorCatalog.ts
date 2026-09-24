import { eq } from "drizzle-orm";
import { operationalStoreMappings, stores } from "../drizzle/schema";
import { getDb } from "./db";
import { getEvotorApiToken } from "./evotorCredentials";

const EVOTOR_API_BASE_URL = "https://api.evotor.ru";
const EVOTOR_MEDIA_TYPE = "application/vnd.evotor.v2+json";
const MAX_PAGES_PER_PREVIEW = 5;

type EvotorPage = {
  items?: unknown[];
  paging?: { next_cursor?: unknown };
  /** Numeric response headers only; no token, terminal or request identity is retained. */
  rateLimit?: { limit: number | null; remaining: number | null; reset: string | null };
};

type EvotorRecord = Record<string, unknown>;
type EvotorProductGroup = { id: string; name: string; parentId: string | null };

export type EvotorCatalogStore = {
  id: string;
  name: string;
  address: string | null;
};

/**
 * A physical smart-terminal from the documented OFD endpoint. It is not a
 * Cloud store UUID: one store can have several cash registers.
 */
export type EvotorSmartTerminal = {
  id: string;
  name: string | null;
  storeId: string | null;
  storeName: string | null;
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
  /** Marked alcohol metadata supplied by the read-only V2 product payload. */
  alcoholCode: string | null;
  alcoholTypeCode: string | null;
  alcoholStrengthPercent: number | null;
  alcoholVolumeLiters: number | null;
};

/** Minimal read-only document projection: no fiscal IDs, customer details or payment requisites leave the server. */
export type EvotorDocumentPreview = {
  id: string;
  /** Human receipt number only when it is explicitly present in a V2 document. */
  receiptNumber: string | null;
  type: string;
  createdAt: string | null;
  closedAt: string | null;
  total: number | null;
  discountAmount: number | null;
  /** Aggregate-only payment projection. Individual instruments and requisites never leave the source payload. */
  paymentSummary: {
    /** Net cash payment after subtracting aggregate V2 cash change. */
    cashAmount: number | null;
    /** Aggregate tendered cash and aggregate change; no identifiers or requisites. */
    cashTenderedAmount: number | null;
    cashChangeAmount: number | null;
    cashlessAmount: number | null;
    otherPaymentAmount: number | null;
    unknownPaymentAmount: number | null;
    captureStatus: "unavailable" | "complete" | "unreconciled" | "malformed";
    reconciliationDelta: number | null;
  };
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

function finiteNumberLike(value: unknown): number | null {
  const direct = finiteNumber(value);
  if (direct !== null) return direct;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

const unavailablePaymentSummary = () => ({
  cashAmount: null,
  cashTenderedAmount: null,
  cashChangeAmount: null,
  cashlessAmount: null,
  otherPaymentAmount: null,
  unknownPaymentAmount: null,
  captureStatus: "unavailable" as const,
  reconciliationDelta: null,
});

/**
 * Keeps only safe payment totals. It deliberately discards ids, payment-system
 * names, parts and every payment requisite from the V2 response. The safe
 * numeric `change` aggregate is retained only to derive a net cash payment.
 */
function normalizeEvotorPaymentSummary(value: unknown, documentTotal: number | null) {
  if (!Array.isArray(value)) return unavailablePaymentSummary();
  let cashCents = 0;
  let cashTenderedCents = 0;
  let cashChangeCents = 0;
  let cashlessCents = 0;
  let otherCents = 0;
  let unknownCents = 0;
  let hasCashPayment = false;
  let hasExplicitCashChange = false;
  for (const rawPayment of value) {
    const payment = asRecord(rawPayment);
    const type = text(payment?.type)?.toUpperCase();
    const amount = finiteNumberLike(payment?.sum);
    if (!payment || !type || amount === null || amount < 0) {
      return { ...unavailablePaymentSummary(), captureStatus: "malformed" as const };
    }
    const cents = Math.round(amount * 100);
    if (type === "CASH") {
      const rawChange = payment.change;
      hasCashPayment = true;
      if (rawChange !== undefined && rawChange !== null) hasExplicitCashChange = true;
      const change = rawChange === undefined || rawChange === null ? 0 : finiteNumberLike(rawChange);
      if (change === null || change < 0 || change > amount) {
        return { ...unavailablePaymentSummary(), captureStatus: "malformed" as const };
      }
      const changeCents = Math.round(change * 100);
      cashTenderedCents += cents;
      cashChangeCents += changeCents;
      cashCents += cents - changeCents;
    }
    else if (type === "ELECTRON") cashlessCents += cents;
    else if (type === "UNKNOWN") unknownCents += cents;
    else otherCents += cents;
  }
  const totalCents = documentTotal === null ? null : Math.round(documentTotal * 100);
  let paymentsCents = cashCents + cashlessCents + otherCents + unknownCents;
  let deltaCents = totalCents === null ? null : paymentsCents - totalCents;
  // `change` is optional in the V2 schema, while payment `sum` is the amount
  // tendered by this method. When every payment is numeric and the only missing
  // balancing value can be cash change, it is mathematically safe to derive the
  // aggregate: cash + cashless + other + unknown − receipt total. Never infer
  // over an explicit `change`, a negative result or more cash than was tendered.
  if (totalCents !== null && hasCashPayment && !hasExplicitCashChange && deltaCents !== null && deltaCents > 0 && deltaCents <= cashTenderedCents) {
    cashChangeCents += deltaCents;
    cashCents -= deltaCents;
    paymentsCents -= deltaCents;
    deltaCents = paymentsCents - totalCents;
  }
  return {
    cashAmount: cashCents / 100,
    cashTenderedAmount: cashTenderedCents / 100,
    cashChangeAmount: cashChangeCents / 100,
    cashlessAmount: cashlessCents / 100,
    otherPaymentAmount: otherCents / 100,
    unknownPaymentAmount: unknownCents / 100,
    captureStatus: deltaCents === null || Math.abs(deltaCents) <= 1 ? "complete" as const : "unreconciled" as const,
    reconciliationDelta: deltaCents === null ? null : deltaCents / 100,
  };
}

function codeValue(value: unknown): string | null {
  const direct = text(value);
  if (direct) return direct;
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function firstCodeValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.map(codeValue).find((item): item is string => Boolean(item)) ?? null;
  const record = asRecord(value);
  if (record) return Object.values(record).map(codeValue).find((item): item is string => Boolean(item)) ?? null;
  return codeValue(value);
}

/**
 * A receipt number is a user-facing serial, not an external document id. Only a
 * small scalar supplied under the documented display-number aliases is retained;
 * UUIDs, fiscal fields, terminal data and arbitrary nested values stay excluded.
 */
function receiptNumber(value: unknown): string | null {
  const candidate = codeValue(value);
  if (!candidate || candidate.length > 64) return null;
  return /^[A-Za-z0-9][A-Za-z0-9./_-]*$/.test(candidate) ? candidate : null;
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

/** Keeps only operational terminal fields; source addresses and fiscal data are excluded. */
export function normalizeEvotorSmartTerminal(value: unknown): EvotorSmartTerminal | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.uuid) ?? text(record.device_uuid) ?? text(record.deviceUuid) ?? text(record.id);
  if (!id) return null;
  return {
    id,
    name: text(record.name) ?? text(record.device_name) ?? text(record.deviceName),
    storeId: text(record.store_uuid) ?? text(record.storeUuid) ?? text(record.store_id) ?? text(record.storeId),
    storeName: text(record.store_name) ?? text(record.storeName),
  };
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
    // Display the quantity exactly as the fixed Evotor store reports it, including an unlimited-balance sentinel.
    quantity: finiteNumber(record.quantity),
    unit: text(record.measure_name),
    tax: text(record.tax),
    vatRate: vatRateFromEvotorTax(record.tax),
    type: text(record.type),
    parentId: text(record.parent_id),
    categoryName: null,
    alcoholCode: firstCodeValue(record.alcocodes) ?? codeValue(record.alcocode),
    alcoholTypeCode: codeValue(record.alcohol_product_kind_code),
    alcoholStrengthPercent: finiteNumberLike(record.alcohol_by_volume),
    alcoholVolumeLiters: finiteNumberLike(record.tare_volume),
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

async function evotorHeaders() {
  const token = await getEvotorApiToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: EVOTOR_MEDIA_TYPE,
    "Content-Type": EVOTOR_MEDIA_TYPE,
  };
}

type EvotorDocumentWindow = { since?: string | Date; until?: string | Date };

/** Cloud API V2 accepts Unix milliseconds; dates are interpreted as Moscow day bounds. */
function evotorDocumentWindowMillis(value: string | Date, edge: "start" | "end") {
  if (value instanceof Date) return value.getTime();
  if (/^20\d{2}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}+03:00`).getTime();
  }
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new Error("Некорректная временная граница запроса документов Эвотор.");
  return parsed;
}

async function fetchEvotorPage(path: string, cursor?: string, documentWindow?: EvotorDocumentWindow): Promise<EvotorPage> {
  const url = new URL(path, EVOTOR_API_BASE_URL);
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  } else if (documentWindow?.since || documentWindow?.until) {
    // Cloud API V2 accepts the initial document window as Unix milliseconds.
    // Subsequent calls deliberately use only the opaque cursor returned by it.
    if (documentWindow.since) url.searchParams.set("since", String(evotorDocumentWindowMillis(documentWindow.since, "start")));
    if (documentWindow.until) url.searchParams.set("until", String(evotorDocumentWindowMillis(documentWindow.until, "end")));
  }
  const response = await fetch(url, { headers: await evotorHeaders(), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Эвотор не отдал preview каталога (HTTP ${response.status}).`);
  const page = await response.json() as EvotorPage;
  const numberHeader = (name: string) => {
    const parsed = Number(response.headers.get(name));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    ...page,
    rateLimit: {
      limit: numberHeader("X-RateLimit-Limit"),
      remaining: numberHeader("X-RateLimit-Remaining"),
      reset: response.headers.get("X-RateLimit-Reset"),
    },
  };
}

export function normalizeEvotorDocumentPreview(value: unknown): EvotorDocumentPreview | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const type = text(record.type);
  if (!id || !type) return null;
  const body = asRecord(record.body);
  const receiptNumberValue = receiptNumber(record.receipt_number)
    ?? receiptNumber(record.receiptNumber)
    ?? receiptNumber(record.number)
    ?? receiptNumber(body?.receipt_number)
    ?? receiptNumber(body?.receiptNumber)
    ?? receiptNumber(body?.number);
  const total = finiteNumberLike(body?.result_sum) ?? finiteNumberLike(body?.sum);
  const discountAmount = finiteNumberLike(body?.discount_amount)
    ?? finiteNumberLike(body?.discount_total)
    ?? finiteNumberLike(body?.discount_sum)
    ?? finiteNumberLike(body?.discount);
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
    receiptNumber: receiptNumberValue,
    type,
    createdAt: text(record.created_at),
    closedAt: text(record.close_date),
    total,
    discountAmount: discountAmount !== null && discountAmount >= 0 ? discountAmount : null,
    paymentSummary: normalizeEvotorPaymentSummary(body?.payments, total),
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

/** Reads all physical terminals in a bounded, read-only request. */
export async function listEvotorSmartTerminals(): Promise<EvotorSmartTerminal[]> {
  const items = await readEvotorPages("/devices");
  return Array.from(new Map(items
    .map(normalizeEvotorSmartTerminal)
    .filter((terminal): terminal is EvotorSmartTerminal => Boolean(terminal))
    .map(terminal => [terminal.id, terminal])).values())
    .sort((left, right) => (left.name ?? left.id).localeCompare(right.name ?? right.id, "ru"));
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

/**
 * A confirmed terminal identifier is available only server-side. Prefer it to a
 * full /stores traversal so automated reads stay within the callback window.
 */
async function resolveMappedEvotorStore(storeId: number) {
  const mapping = await getOperationalEvotorMapping(storeId);
  if (mapping.terminalUuid) {
    return { mapping, evotorStore: { id: mapping.terminalUuid, name: mapping.evotorStoreName } };
  }
  const evotorStores = await listEvotorCatalogStoresPreview();
  const matched = evotorStores.filter(store => normalizedStoreName(store.name) === normalizedStoreName(mapping.evotorStoreName));
  if (matched.length !== 1) throw new Error(matched.length ? "Соответствие магазина Эвотор неоднозначно: требуется его ID." : "Магазин Эвотор из сохраненного соответствия не найден.");
  return { mapping, evotorStore: matched[0] };
}

export async function listEvotorCatalogPreviewForOperationalStore(storeId: number) {
  const { mapping, evotorStore } = await resolveMappedEvotorStore(storeId);
  return {
    mapping: { storeId, internalStoreName: mapping.internalStoreName, evotorStoreName: evotorStore.name },
    products: await listEvotorCatalogPreview(evotorStore.id),
  };
}

/**
 * Deletes one exact remote product only after a human-approved reconciliation.
 * It is deliberately not exposed through tRPC or the UI: callers must retain a
 * durable local audit of the exact external IDs and remove their local links
 * only after the Cloud V2 DELETE succeeds.
 */
export async function deleteEvotorCatalogProductForOperationalStore(input: { storeId: number; productId: string }) {
  const { evotorStore } = await resolveMappedEvotorStore(input.storeId);
  const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodeURIComponent(evotorStore.id)}/products/${encodeURIComponent(input.productId)}`, {
    method: "DELETE",
    headers: await evotorHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Эвотор не удалил подтверждённый дубль (HTTP ${response.status}).`);
  return {
    status: response.status,
    rateLimit: {
      limit: Number(response.headers.get("X-RateLimit-Limit")) || null,
      remaining: Number(response.headers.get("X-RateLimit-Remaining")) || null,
      reset: response.headers.get("X-RateLimit-Reset"),
    },
  };
}

/** Reads one cursor page only, so a human-triggered preview cannot fan out or mutate external data. */
export async function listEvotorDocumentsPreviewForOperationalStore(input: { storeId: number; cursor?: string; since?: string | Date; until?: string | Date }) {
  const { evotorStore } = await resolveMappedEvotorStore(input.storeId);
  const page = await fetchEvotorPage(
    `/stores/${encodeURIComponent(evotorStore.id)}/documents`,
    input.cursor,
    input.cursor ? undefined : { since: input.since, until: input.until },
  );
  return {
    storeId: input.storeId,
    documents: (page.items ?? []).map(normalizeEvotorDocumentPreview).filter((item): item is EvotorDocumentPreview => Boolean(item)),
    nextCursor: text(page.paging?.next_cursor),
    rateLimit: page.rateLimit ?? { limit: null, remaining: null, reset: null },
  };
}

/**
 * Re-reads one already persisted Cloud V2 document. This is strictly a bounded,
 * read-only repair path: the server resolves its fixed store mapping itself and
 * returns the same minimal projection as the rolling document page.
 */
export async function getEvotorDocumentPreviewForOperationalStore(input: { storeId: number; documentId: string }) {
  const { evotorStore } = await resolveMappedEvotorStore(input.storeId);
  const encodedStoreId = encodeURIComponent(evotorStore.id);
  const encodedDocumentId = encodeURIComponent(input.documentId);
  const response = await fetch(`${EVOTOR_API_BASE_URL}/stores/${encodedStoreId}/documents/${encodedDocumentId}`, {
    headers: await evotorHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Эвотор не отдал документ для сверки (HTTP ${response.status}).`);
  const document = normalizeEvotorDocumentPreview(await response.json());
  if (!document || document.id !== input.documentId) throw new Error("Эвотор вернул неполный документ для сверки оплат.");
  return document;
}
