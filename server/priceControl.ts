import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { and, desc, eq, inArray } from "drizzle-orm";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as XLSX from "xlsx";
import { priceCategories, priceImports, priceImportRows, priceOfferPrices, priceProductCharacteristics, priceProducts, priceSupplierAliases, priceSuppliers } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";

export type PriceBasis = "kg" | "l" | "piece" | "package" | "unknown";
export type NormalizedUnit = "kg" | "l" | "piece" | "unknown";
export type PriceMode = "standard" | "cash" | "cashless_no_vat" | "cashless_vat" | "spb" | "moscow" | "special" | "threshold";
export type PriceMarket = "unknown" | "spb" | "moscow";
export type PriceCharacteristicKind = "variant" | "size" | "place_contents" | "manufacturer";
export type ParsedPriceOption = { priceAmount: number | null; priceBasis: PriceBasis; normalizedPrice: number | null; normalizedUnit: NormalizedUnit; priceMode: PriceMode; market: PriceMarket; minimumQuantityKg: number | null; includesVat: boolean | null; sourcePriceText: string };
export type ParsedPriceRow = { sourceSheet: string; sourceRowNumber: number; sourceSku: string | null; rawName: string; normalizedName: string; canonicalHint: string; normalizedSignature: string; category: string | null; packaging: string | null; packagingSignature: string; manufacturer: string | null; placeContents: string | null; manufacturedOn: string | null; shelfLifeMonths: number | null; expiresOn: string | null; availability: string | null; variant: string | null; sizeText: string | null; priceOptions: ParsedPriceOption[]; rawPayload: Record<string, string> };
export type PriceImportPreview = { fileName: string; sourceType: "xls" | "xlsx" | "pdf" | "docx"; detectedSupplierName: string | null; detectedSourceDate: string | null; rows: ParsedPriceRow[]; warningCount: number; warnings: string[] };
export type PriceChange = { previousPrice: number; previousDate: string | null; delta: number; percent: number; direction: "up" | "down" | "same" };
export type PriceImportCategorySelection = { rowIndex: number; categoryId: number };
export type PriceImportPriceEdit = { rowIndex: number; optionIndex: number; priceAmount: number; priceBasis?: PriceBasis; priceMode?: PriceMode; market?: PriceMarket };
export type PriceImportPriceAddition = { rowIndex: number; priceAmount: number; priceBasis: PriceBasis; priceMode: PriceMode; market: PriceMarket };
export type PriceImportPriceRemoval = { rowIndex: number; optionIndex: number };
export type PriceImportRowEdit = { rowIndex: number; rawName: string };
export type PriceImportMetadataEdit = { rowIndex: number; manufacturer: string | null; placeContents: string | null; manufacturedOn: string | null; shelfLifeMonths: number | null; expiresOn: string | null };
export type PriceImportProductLink = { rowIndex: number; productId: number };
export type PreparedPriceImportRows = {
  rows: Array<{ rowIndex: number; row: ParsedPriceRow }>;
  excludedRowIndexes: number[];
  editedPriceOptions: number;
  addedPriceOptions: number;
  removedPriceOptions: number;
  editedNames: number;
  editedMetadata: number;
};
type PriceChangeSource = { priceId: number; importId: number; productId: number | null; supplierId: number; priceMode: string | null; market: string | null; normalizedUnit: string | null; normalizedPrice: string | number | null; sourceDate: string | null; importedAt: Date | string };
export const SIGNIFICANT_PRICE_INCREASE_PERCENT = 10;

const MAX_IMPORT_ROWS = 3000;
export const PRICE_SHELF_LIFE_MONTHS = [1, 2, 3, 6, 12, 18, 24] as const;
const supplierHints: Array<[RegExp, string]> = [[/moreodor|мореодор/i, "Мореодор"], [/lucky\s*fish/i, "Lucky Fish"], [/купеческ/i, "Купеческий"], [/атлантид/i, "Атлантида"], [/вкус\s*север/i, "Вкус Севера"], [/mir\s*delicatesov|мир\s*деликатес/i, "Mir Delicatesov"], [/redgm|красн(?:ый|ого)\s+жемчуг/i, "Красный Жемчуг"], [/арктическ.*вкус/i, "Арктический Вкус"], [/даллос/i, "Даллос"]];
const synonymTokens: Record<string, string> = { "семга": "лосось", "сёмга": "лосось", "лососевая": "лосось", "лососевые": "лосось" };
const mammothInternalRequire = createRequire(import.meta.url);
const mammothUnzip = mammothInternalRequire("mammoth/lib/unzip") as { openZip(input: { buffer: Buffer }): Promise<unknown> };
const mammothDocxReader = mammothInternalRequire("mammoth/lib/docx/docx-reader") as { read(archive: unknown): Promise<{ value: DocxNode }> };

type DocxNode = { type?: string; value?: string; children?: DocxNode[] };

function text(value: unknown) { return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
function fold(value: string) { return text(value).toLowerCase().replace(/ё/g, "е"); }
export function normalizeProductDisplayName(value: string) {
  return text(value)
    .replace(/(^|[^а-яё])б\s+ез(?=$|[^а-яё])/gi, "$1без")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|gr|g|л|литр(?:а|ов|ы)?|l|мл|ml|шт|pcs?|штук|уп\.?)(?![a-zа-я])/gi, (_match, amount: string, rawUnit: string) => {
      const unit = /^(?:кг|kg)$/i.test(rawUnit) ? "кг" : /^(?:г|гр|gr|g)$/i.test(rawUnit) ? "гр" : /^(?:л|литр(?:а|ов|ы)?|l)$/i.test(rawUnit) ? "л" : /^(?:мл|ml)$/i.test(rawUnit) ? "мл" : "шт";
      return `${amount}${unit}`;
    })
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?:\s*[,.;:!?])+/g, "$1")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function canonicalPriceMode(mode: PriceMode | null | undefined): PriceMode {
  return mode === "cash" || mode === "cashless_no_vat" || mode === "cashless_vat" ? mode : "cashless_vat";
}
function priceMarketFromText(value: string): PriceMarket {
  const source = fold(value);
  return /(?:^|[^а-яё])спб(?:$|[^а-яё])|санкт[ -]?петербург/i.test(source)
    ? "spb"
    : /(?:^|[^а-яё])мск(?:$|[^а-яё])|(?:^|[^а-яё])москва(?:$|[^а-яё])/i.test(source)
      ? "moscow"
      : "unknown";
}
function resolvePriceMarket(market: string | null | undefined, legacyMode: string | null | undefined): PriceMarket {
  if (market === "spb" || market === "moscow") return market;
  return legacyMode === "spb" || legacyMode === "moscow" ? legacyMode : "unknown";
}
function normalizeCharacteristicValue(value: string) { return fold(value).replace(/\s+/g, " ").trim(); }
function normalizeCharacteristicDisplay(kind: PriceCharacteristicKind, value: string) {
  return kind === "place_contents" ? normalizePlaceContents(value) : kind === "size" ? normalizeProductDisplayName(value) : kind === "manufacturer" ? cleanPdfManufacturer(value) : text(value);
}
function normalizeIsoDate(value: string | null | undefined) {
  const normalized = text(value || "");
  return /^20\d{2}-\d{2}-\d{2}$/.test(normalized) && !Number.isNaN(Date.parse(`${normalized}T12:00:00Z`)) ? normalized : null;
}
export function calculatePriceOfferExpiry(manufacturedOn: string | null | undefined, shelfLifeMonths: number | null | undefined) {
  const date = normalizeIsoDate(manufacturedOn);
  const months = Number(shelfLifeMonths);
  if (!date || !PRICE_SHELF_LIFE_MONTHS.includes(months as typeof PRICE_SHELF_LIFE_MONTHS[number])) return null;
  const [year, month, day] = date.split("-").map(Number);
  const totalMonths = month - 1 + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const targetLastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, targetLastDay)).padStart(2, "0")}`;
}
function normalizePlaceUnit(value: string | undefined, fallback: "кг" | "шт") {
  if (!value) return fallback;
  if (/^(?:кг|kg)$/i.test(value)) return "кг";
  if (/^(?:г|гр|gr|g)$/i.test(value)) return "гр";
  if (/^(?:л|l)$/i.test(value)) return "л";
  if (/^(?:мл|ml)$/i.test(value)) return "мл";
  return "шт";
}
function placeContentsFallbackUnit(context: string | null | undefined): "кг" | "шт" {
  return pdfPackagingFromText(context || "") ? "шт" : "кг";
}
/** Normalizes supplier case notation into a compact canonical form, e.g. 1/4кг/500гр or 1/24шт. */
export function normalizePlaceContents(value: string | null | undefined, context?: string | null) {
  const source = normalizeProductDisplayName(text(value)
    .replace(/\((?:\s*(?:короб(?:ка)?|ящик|упак(?:овка)?|место|куб)\s*)+\)/gi, " ")
    .replace(/\b(?:короб(?:ка)?|ящик|упак(?:овка)?|место|куб)\b/gi, " ")
    .replace(/(^|\s)уп\.?(?=\s|$|\()/gi, "$1шт")
    .replace(/\s*([/×x])\s*/gi, "/")
    .replace(/,/g, "."));
  if (!source) return "";
  const prefix = /^(\d+)\//.exec(source);
  const placeCount = prefix?.[1] ?? "1";
  const contents = prefix ? source.slice(prefix[0].length) : source;
  const fallbackUnit = placeContentsFallbackUnit(context);
  const parts = Array.from(contents.matchAll(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук)?/gi));
  if (!parts.length) return source;
  const normalizedParts = parts.map(match => `${match[1]}${normalizePlaceUnit(match[2], fallbackUnit)}`);
  return `${placeCount}/${normalizedParts.join("/")}`;
}
/** Keeps manually corrected case contents in the same unit context as its price basis. */
export function synchronizePlaceContentsBasis(value: string | null | undefined, priceBasis: PriceBasis, context?: string | null) {
  const normalized = normalizePlaceContents(value, context);
  if (!normalized || !["kg", "l", "piece"].includes(priceBasis)) return normalized;
  const unit = priceBasis === "kg" ? "кг" : priceBasis === "l" ? "л" : "шт";
  const simplePlace = /^(\d+)\/(\d+(?:\.\d+)?)(?:кг|гр|л|мл|шт)$/i.exec(normalized);
  return simplePlace ? `${simplePlace[1]}/${simplePlace[2]}${unit}` : normalized;
}
/** Keeps the same compact case notation at all offer display points. */
export function formatPlaceContents(value: string | null | undefined, context?: string | null) {
  return normalizePlaceContents(value, context) || null;
}

function hasExplicitPlaceUnit(value: string | null | undefined) {
  return /\d+(?:[.,]\d+)?\s*(?:кг|kg|г|гр|gr|g|л|ml|мл|шт|pcs?|штук)(?![a-zа-я])/i.test(text(value));
}

/** Accepts a supplier case cell only when it really conveys a quantity, never merely «короб, эл. вес». */
function placePartFromText(value: string | null | undefined, context?: string | null, fallbackUnit?: "кг" | "шт") {
  const source = text(value);
  if (!source || !/\d/.test(source)) return null;
  const cartonMultiplier = /фас(?:овка)?\s*(\d+(?:[.,]\d+)?)\s*[*×xх]\s*(\d+(?:[.,]\d+)?)/i.exec(source);
  if (cartonMultiplier && /(?:^|[\s,;])короб(?:ка)?(?:[\s,;]|$)/i.test(source)) {
    const count = Number(cartonMultiplier[1].replace(",", "."));
    const innerWeight = Number(cartonMultiplier[2].replace(",", "."));
    const total = count * innerWeight;
    if (Number.isFinite(total) && total > 0) {
      const normalizedTotal = Number(total.toFixed(3));
      const normalizedInnerWeight = Number(innerWeight.toFixed(3));
      return count > 1 ? `1/${normalizedTotal}кг/${normalizedInnerWeight}кг` : `1/${normalizedTotal}кг`;
    }
  }
  const numericStart = source.search(/\d/);
  const candidate = numericStart >= 0 ? source.slice(numericStart) : source;
  const directPlace = /^\s*(\d+\s*\/\s*\d+(?:[.,]\d+)?(?:\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук)(?![a-zа-я]))?)(?=\s|$)/i.exec(candidate);
  if (directPlace) {
    return normalizePlaceContents(directPlace[1], context || directPlace[1]) || null;
  }
  const withUnit = hasExplicitPlaceUnit(candidate)
    ? candidate
    : fallbackUnit && /^\s*\d+(?:[.,]\d+)?\s*$/.test(candidate) ? `${candidate}${fallbackUnit}` : "";
  if (!withUnit) return null;
  const range = /^(\d+(?:[.,]\d+)?)\s*(?:-|–|—)\s*(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук)(?![a-zа-я])/i.exec(withUnit);
  if (range) return `1/${range[1].replace(",", ".")}-${range[2].replace(",", ".")}${normalizePlaceUnit(range[3], "кг")}`;
  const sharedUnit = /^(\d+(?:[.,]\d+)?(?:\s*(?:и|\/)\s*\d+(?:[.,]\d+)?)+)\s*(кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук)(?![a-zа-я])/i.exec(withUnit);
  if (sharedUnit) {
    const unit = normalizePlaceUnit(sharedUnit[2], "кг");
    return `1/${sharedUnit[1].split(/\s*(?:и|\/)\s*/).map(amount => `${amount.replace(",", ".")}${unit}`).join("/")}`;
  }
  return normalizePlaceContents(withUnit, context || withUnit) || null;
}

/** Combines a carton/quant with consumer packing: 8кг + 250гр → 1/8кг/250гр. */
function mergePlaceContents(parts: Array<string | null | undefined>) {
  const unique = Array.from(new Set(parts.filter((part): part is string => Boolean(part))));
  if (!unique.length) return null;
  const [first, ...rest] = unique;
  return `${first}${rest.map(part => `/${part.replace(/^1\//, "")}`).join("")}`;
}

/** Finds case quantities written inside a supplier product name, e.g. «тара 21кг» or «5 и 7кг». */
function placeContentsFromProductName(rawName: string) {
  const source = text(rawName);
  const labeled = Array.from(source.matchAll(/(?:тара|короб(?:ка)?|ящик|мешок|упак(?:овка)?|место)\s*(\d+(?:[.,]\d+)?(?:\s*(?:и|\/)\s*\d+(?:[.,]\d+)?)?\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук))(?![a-zа-я])/gi))
    .map(match => match[1]);
  const trailing = Array.from(source.matchAll(/(?:^|[,;(])\s*(\d+(?:[.,]\d+)?(?:\s*(?:и|\/)\s*\d+(?:[.,]\d+)?)?\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук))(?![a-zа-я])/gi))
    .map(match => match[1]);
  return placePartFromText(labeled.at(-1) ?? trailing.at(-1) ?? null, rawName);
}

/** Removes only a comma/semicolon-delimited tail that was already recognized as case contents. */
function stripRecognizedPlaceContentsFromName(rawName: string, placeContents: string | null) {
  const source = normalizeProductDisplayName(rawName);
  if (!placeContents) return source;
  const caseSuffix = /(?:[,;(]\s*(?:(?:тара|короб(?:ка)?|ящик|мешок|упак(?:овка)?|место)\s*)?\d+(?:[.,]\d+)?(?:\s*(?:и|\/)\s*\d+(?:[.,]\d+)?)*\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук))\s*$/i;
  return normalizeProductDisplayName(source.replace(caseSuffix, ""));
}

function isVariableWeightRange(value: string | null | undefined) {
  const normalized = text(value);
  return /\d+(?:[.,]\d+)?\s*(?:-|–|—)\s*\d+(?:[.,]\d+)?\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml)(?![a-zа-я])/i.test(normalized)
    || /\d+\s*\+\s*(?:кг|kg|г|гр|gr|g|л|l|мл|ml)(?![a-zа-я])/i.test(normalized);
}

function normalizeCategoryName(value: string) { return fold(value).replace(/[^a-zа-я0-9]+/g, " ").trim(); }
function sourceTimestamp(source: Pick<PriceChangeSource, "sourceDate" | "importedAt">) {
  const dated = source.sourceDate ? Date.parse(`${source.sourceDate}T12:00:00`) : Number.NaN;
  if (Number.isFinite(dated)) return dated;
  const imported = source.importedAt instanceof Date ? source.importedAt.getTime() : Date.parse(source.importedAt);
  return Number.isFinite(imported) ? imported : 0;
}
/** Compares only like-for-like offers of the same supplier and internal product. */
export function calculatePriceChanges<T extends PriceChangeSource>(offers: T[]) {
  const changes = new Map<number, PriceChange>();
  const previousByKey = new Map<string, T>();
  const ordered = offers
    .filter(offer => offer.productId !== null && offer.normalizedPrice !== null && offer.normalizedUnit && Number(offer.normalizedPrice) > 0)
    .slice()
    .sort((left, right) => sourceTimestamp(left) - sourceTimestamp(right) || sourceTimestamp({ sourceDate: null, importedAt: left.importedAt }) - sourceTimestamp({ sourceDate: null, importedAt: right.importedAt }));
  for (const offer of ordered) {
    const key = `${offer.productId}:${offer.supplierId}:${resolvePriceMarket(offer.market, offer.priceMode)}:${canonicalPriceMode(offer.priceMode as PriceMode)}:${offer.normalizedUnit}`;
    const previous = previousByKey.get(key);
    const currentPrice = Number(offer.normalizedPrice);
    if (previous && previous.importId !== offer.importId) {
      const previousPrice = Number(previous.normalizedPrice);
      const delta = Number((currentPrice - previousPrice).toFixed(2));
      const percent = Number(((delta / previousPrice) * 100).toFixed(1));
      changes.set(offer.priceId, { previousPrice, previousDate: previous.sourceDate, delta, percent, direction: delta > 0 ? "up" : delta < 0 ? "down" : "same" });
    }
    previousByKey.set(key, offer);
  }
  return changes;
}
function numberFromText(value: unknown) {
  const raw = text(value);
  if (!raw || /дог|запрос|уточн|нет\s*цен|n\/a|узнай\s*цен|тел(?:ефон)?|менеджер|\+7\s*\(|\b8\s*\(/i.test(raw)) return null;
  const match = raw.match(/-?(?:\d{1,3}(?:[\s.,]\d{3})+|\d+)(?:[.,]\d{1,2})?/);
  if (!match) return null;
  const numeric = match[0].replace(/\s/g, "");
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const decimalSeparator = lastComma >= 0 && lastDot >= 0
    ? (lastComma > lastDot ? "," : ".")
    : (lastComma >= 0 ? "," : lastDot >= 0 ? "." : null);
  const decimalTail = decimalSeparator === null ? "" : numeric.slice(numeric.lastIndexOf(decimalSeparator) + 1);
  const hasDecimalPart = decimalSeparator !== null && decimalTail.length > 0 && decimalTail.length <= 2;
  const compact = hasDecimalPart
    ? `${numeric.slice(0, numeric.lastIndexOf(decimalSeparator)).replace(/[.,]/g, "")}.${decimalTail}`
    : numeric.replace(/[.,]/g, "");
  const parsed = Number(compact);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 10_000_000 ? parsed : null;
}

export function normalizeSupplierName(value: string) { return fold(value).replace(/[^a-zа-я0-9]+/g, " ").trim(); }
export function normalizeProductName(value: string) {
  return fold(value).replace(/[()[\]{}]/g, " ").replace(/[–—]/g, "-").replace(/[^a-zа-я0-9.%\-+/]+/g, " ").split(" ").filter(Boolean).map(token => synonymTokens[token] ?? token).join(" ");
}
export function extractSizeText(value: string) {
  const match = normalizeProductName(value).match(/\b(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\b/);
  return match ? `${match[1].replace(",", ".")}-${match[2].replace(",", ".")}` : null;
}
export function extractVariant(value: string) {
  const match = normalizeProductName(value).match(/\b(sup|super|premium|prem|ord|ordinary|iqf|экстра|премиум)\b/);
  if (!match) return null;
  return ({ super: "sup", premium: "premium", prem: "premium", iqf: "IQF", "премиум": "premium", "экстра": "premium", ordinary: "ord" } as Record<string, string>)[match[1]] ?? match[1];
}
export function productSignature(value: string) {
  const name = normalizeProductName(value).replace(/\b(sup|super|premium|prem|ord|ordinary|iqf|экстра|премиум)\b/g, " ").replace(/\b\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?\b/g, " ").replace(/\s+/g, " ").trim();
  return [name, extractSizeText(value)].filter(Boolean).join("|") || normalizeProductName(value);
}
export function parsePackaging(value: string) {
  const normalized = fold(value).replace(/(^|\s)уп\.?(?=\s|$|\()/g, "$1шт");
  const weight = normalized.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|gr|g)(?![a-zа-я])/);
  const volume = normalized.match(/(\d+(?:[.,]\d+)?)\s*(л|литр|l|мл|ml)(?![a-zа-я])/);
  const count = normalized.match(/(\d+)\s*(шт|pcs?|штук)(?![a-zа-я])/);
  if (weight) { const amount = Number(weight[1].replace(",", ".")); return { grams: Math.round(amount * (["кг", "kg"].includes(weight[2]) ? 1000 : 1)), volumeMl: null, pieces: count ? Number(count[1]) : null }; }
  if (volume) { const amount = Number(volume[1].replace(",", ".")); return { grams: null, volumeMl: Math.round(amount * (["л", "литр", "l"].includes(volume[2]) ? 1000 : 1)), pieces: count ? Number(count[1]) : null }; }
  return { grams: null, volumeMl: null, pieces: count ? Number(count[1]) : null };
}
export function normalizePackagingDisplay(value: string | null | undefined) {
  return normalizeProductDisplayName(text(value)).replace(/(?:[.,]\s*)?\+\s*$/, "").trim();
}
export function packagingSignature(value: string | null | undefined) {
  const packaging = parsePackaging(value ?? "");
  return [packaging.grams ? `g${packaging.grams}` : "", packaging.volumeMl ? `ml${packaging.volumeMl}` : "", packaging.pieces ? `pc${packaging.pieces}` : ""].filter(Boolean).join("|");
}
function priceModeFromHeader(header: string): PriceMode {
  const title = fold(header);
  if (/налич/.test(title)) return "cash";
  if (/безнал.*без.*ндс/.test(title)) return "cashless_no_vat";
  if (/безнал/.test(title)) return "cashless_vat";
  if (/моск|мск/.test(title)) return "moscow";
  if (/спб|санкт/.test(title)) return "spb";
  if (/спец|акци/.test(title)) return "special";
  if (/от\s*\d+|порог|опт/.test(title)) return "threshold";
  return "standard";
}
function priceBasisFromText(header: string, name: string, packaging: string | null): PriceBasis {
  const source = fold(`${header} ${name}`);
  if (/\/\s*кг|за\s*кг|(?:^|\s)кг(?:\s|$)/.test(source)) return "kg";
  if (/\/\s*л|за\s*л|(?:^|\s)литр(?:а|ов|ы)?(?:\s|$)/.test(source)) return "l";
  if (/\/\s*шт|за\s*шт|(?:^|\s)(?:штук|уп\.?)\b/.test(source)) return "piece";
  if (/(?:за\s*)?(?:бан(?:ка|ку)|бутыл(?:ка|ку)|пачк(?:а|у)|упаковк(?:а|у))/i.test(source)) return "package";
  const pack = parsePackaging(packaging ?? name);
  if (pack.grams || pack.volumeMl) return "package";
  return "kg";
}
export function normalizePrice(priceAmount: number, priceBasis: PriceBasis, packing: string | null) {
  const packaging = parsePackaging(packing ?? "");
  if (priceBasis === "kg") return { normalizedPrice: priceAmount, normalizedUnit: "kg" as const };
  if (priceBasis === "l") return { normalizedPrice: priceAmount, normalizedUnit: "l" as const };
  if (priceBasis === "piece") return { normalizedPrice: priceAmount, normalizedUnit: "piece" as const };
  if (priceBasis === "package" && packaging.grams) return { normalizedPrice: Number((priceAmount * 1000 / packaging.grams).toFixed(2)), normalizedUnit: "kg" as const };
  if (priceBasis === "package" && packaging.volumeMl) return { normalizedPrice: Number((priceAmount * 1000 / packaging.volumeMl).toFixed(2)), normalizedUnit: "l" as const };
  return { normalizedPrice: null, normalizedUnit: "unknown" as const };
}

const editablePriceBases: PriceBasis[] = ["kg", "l", "piece", "package", "unknown"];
const editablePriceModes: PriceMode[] = ["cash", "cashless_no_vat", "cashless_vat"];

/** Applies explicit user corrections only to the in-memory preview that will be committed. */
export function preparePriceImportRows(
  rows: ParsedPriceRow[],
  priceEdits: PriceImportPriceEdit[] = [],
  excludedRowIndexes: number[] = [],
  rowEdits: PriceImportRowEdit[] = [],
  metadataEdits: PriceImportMetadataEdit[] = [],
  priceAdditions: PriceImportPriceAddition[] = [],
  priceRemovals: PriceImportPriceRemoval[] = []
): PreparedPriceImportRows {
  if (priceEdits.length > MAX_IMPORT_ROWS * 12) throw new Error("Слишком много ручных правок цен для одного прайс‑листа.");
  if (priceAdditions.length > MAX_IMPORT_ROWS * 12 || priceRemovals.length > MAX_IMPORT_ROWS * 12) throw new Error("Слишком много изменений вариантов цены для одного прайс‑листа.");
  if (excludedRowIndexes.length > MAX_IMPORT_ROWS) throw new Error("Слишком много исключенных строк прайс‑листа.");
  if (rowEdits.length > MAX_IMPORT_ROWS) throw new Error("Слишком много ручных правок названий для одного прайс‑листа.");
  if (metadataEdits.length > MAX_IMPORT_ROWS) throw new Error("Слишком много правок характеристик предложения для одного прайс‑листа.");

  const excluded = new Set<number>();
  excludedRowIndexes.forEach(rowIndex => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rows.length || excluded.has(rowIndex)) {
      throw new Error("Передан некорректный список исключенных строк прайс‑листа.");
    }
    excluded.add(rowIndex);
  });

  const editsByRow = new Map<number, Map<number, PriceImportPriceEdit>>();
  priceEdits.forEach(edit => {
    if (!Number.isInteger(edit.rowIndex) || edit.rowIndex < 0 || edit.rowIndex >= rows.length ||
      !Number.isInteger(edit.optionIndex) || edit.optionIndex < 0 ||
      !Number.isFinite(edit.priceAmount) || edit.priceAmount <= 0 || edit.priceAmount >= 10_000_000 ||
      (edit.priceBasis !== undefined && !editablePriceBases.includes(edit.priceBasis)) ||
      (edit.priceMode !== undefined && !editablePriceModes.includes(edit.priceMode)) ||
      (edit.market !== undefined && !["unknown", "spb", "moscow"].includes(edit.market))) {
      throw new Error("Передана некорректная ручная правка цены прайс‑листа.");
    }
    if (excluded.has(edit.rowIndex)) throw new Error("Нельзя менять цену у исключенной из импорта строки.");
    const row = rows[edit.rowIndex];
    if (!row || edit.optionIndex >= row.priceOptions.length) throw new Error("Передана некорректная цена для строки прайс‑листа.");
    const rowEdits = editsByRow.get(edit.rowIndex) ?? new Map<number, PriceImportPriceEdit>();
    if (rowEdits.has(edit.optionIndex)) throw new Error("Одна цена прайс‑листа изменена повторно.");
    rowEdits.set(edit.optionIndex, edit);
    editsByRow.set(edit.rowIndex, rowEdits);
  });

  const removedByRow = new Map<number, Set<number>>();
  priceRemovals.forEach(removal => {
    if (!Number.isInteger(removal.rowIndex) || removal.rowIndex < 0 || removal.rowIndex >= rows.length ||
      !Number.isInteger(removal.optionIndex) || removal.optionIndex < 0 || removal.optionIndex >= rows[removal.rowIndex]!.priceOptions.length) {
      throw new Error("Передан некорректный вариант цены для удаления.");
    }
    if (excluded.has(removal.rowIndex)) throw new Error("Нельзя удалять цену у исключенной из импорта строки.");
    const removed = removedByRow.get(removal.rowIndex) ?? new Set<number>();
    if (removed.has(removal.optionIndex)) throw new Error("Вариант цены уже удален из предпросмотра.");
    if (editsByRow.get(removal.rowIndex)?.has(removal.optionIndex)) throw new Error("Нельзя одновременно изменить и удалить один вариант цены.");
    removed.add(removal.optionIndex);
    removedByRow.set(removal.rowIndex, removed);
  });

  const additionsByRow = new Map<number, PriceImportPriceAddition[]>();
  priceAdditions.forEach(addition => {
    if (!Number.isInteger(addition.rowIndex) || addition.rowIndex < 0 || addition.rowIndex >= rows.length ||
      !Number.isFinite(addition.priceAmount) || addition.priceAmount <= 0 || addition.priceAmount >= 10_000_000 ||
      !editablePriceBases.includes(addition.priceBasis) || !editablePriceModes.includes(addition.priceMode) ||
      !["unknown", "spb", "moscow"].includes(addition.market)) {
      throw new Error("Передан некорректный добавленный вариант цены прайс‑листа.");
    }
    if (excluded.has(addition.rowIndex)) throw new Error("Нельзя добавлять цену к исключенной из импорта строке.");
    additionsByRow.set(addition.rowIndex, [...(additionsByRow.get(addition.rowIndex) ?? []), addition]);
  });

  const nameEditsByRow = new Map<number, string>();
  rowEdits.forEach(edit => {
    const rawName = normalizeProductDisplayName(edit.rawName);
    if (!Number.isInteger(edit.rowIndex) || edit.rowIndex < 0 || edit.rowIndex >= rows.length || rawName.length < 2 || rawName.length > 255) {
      throw new Error("Передана некорректная правка названия позиции прайс‑листа.");
    }
    if (excluded.has(edit.rowIndex)) throw new Error("Нельзя менять название исключенной из импорта строки.");
    if (nameEditsByRow.has(edit.rowIndex)) throw new Error("Название позиции прайс‑листа изменено повторно.");
    nameEditsByRow.set(edit.rowIndex, rawName);
  });

  const metadataEditsByRow = new Map<number, Pick<ParsedPriceRow, "manufacturer" | "placeContents" | "manufacturedOn" | "shelfLifeMonths" | "expiresOn">>();
  metadataEdits.forEach(edit => {
    const manufacturer = text(edit.manufacturer || "") || null;
    const placeContents = normalizePlaceContents(edit.placeContents) || null;
    const manufacturedOn = normalizeIsoDate(edit.manufacturedOn);
    const shelfLifeMonths = edit.shelfLifeMonths === null || edit.shelfLifeMonths === undefined ? null : Number(edit.shelfLifeMonths);
    const expiresOn = calculatePriceOfferExpiry(manufacturedOn, shelfLifeMonths);
    if (!Number.isInteger(edit.rowIndex) || edit.rowIndex < 0 || edit.rowIndex >= rows.length ||
      (manufacturer !== null && manufacturer.length > 255) ||
      (placeContents !== null && placeContents.length > 255) ||
      (edit.manufacturedOn !== null && edit.manufacturedOn !== undefined && !manufacturedOn) ||
      (shelfLifeMonths !== null && !PRICE_SHELF_LIFE_MONTHS.includes(shelfLifeMonths as typeof PRICE_SHELF_LIFE_MONTHS[number])) ||
      (edit.expiresOn !== null && edit.expiresOn !== undefined && normalizeIsoDate(edit.expiresOn) !== expiresOn)) {
      throw new Error("Передана некорректная характеристика предложения прайс‑листа.");
    }
    if (excluded.has(edit.rowIndex)) throw new Error("Нельзя менять характеристику у исключенной из импорта строки.");
    if (metadataEditsByRow.has(edit.rowIndex)) throw new Error("Характеристика предложения изменена повторно.");
    metadataEditsByRow.set(edit.rowIndex, { manufacturer, placeContents, manufacturedOn, shelfLifeMonths, expiresOn });
  });

  const preparedRows = rows.flatMap((sourceRow, rowIndex) => {
    if (excluded.has(rowIndex)) return [];
    const rowPriceEdits = editsByRow.get(rowIndex);
    const rawName = nameEditsByRow.get(rowIndex);
    const metadata = metadataEditsByRow.get(rowIndex);
    const removals = removedByRow.get(rowIndex) ?? new Set<number>();
    const additions = additionsByRow.get(rowIndex) ?? [];
    if (!rowPriceEdits?.size && !removals.size && !additions.length && !rawName && !metadata) return [{ rowIndex, row: sourceRow }];
    const priceOptions = sourceRow.priceOptions.flatMap((option, optionIndex) => {
      if (removals.has(optionIndex)) return [];
      const edit = rowPriceEdits?.get(optionIndex);
      if (!edit) return [option];
      const priceBasis = edit.priceBasis ?? option.priceBasis;
      const normalized = normalizePrice(edit.priceAmount, priceBasis, sourceRow.packaging || sourceRow.rawName);
      return [{
        ...option,
        priceAmount: Number(edit.priceAmount.toFixed(2)),
        priceBasis,
        priceMode: canonicalPriceMode(edit.priceMode ?? option.priceMode),
        market: edit.market ?? option.market,
        ...normalized,
        sourcePriceText: String(Number(edit.priceAmount.toFixed(2))),
      }];
    }).concat(additions.map(addition => {
      const normalized = normalizePrice(addition.priceAmount, addition.priceBasis, sourceRow.packaging || sourceRow.rawName);
      return {
        priceAmount: Number(addition.priceAmount.toFixed(2)),
        priceBasis: addition.priceBasis,
        priceMode: canonicalPriceMode(addition.priceMode),
        market: addition.market,
        ...normalized,
        minimumQuantityKg: null,
        includesVat: addition.priceMode === "cashless_vat" ? true : addition.priceMode === "cashless_no_vat" ? false : null,
        sourcePriceText: "Введено вручную",
      };
    }));
    if (!priceOptions.length) throw new Error("В позиции должна остаться хотя бы одна цена. Исключите всю позицию, если она не нужна.");
    const nextName = rawName ?? sourceRow.rawName;
    const nextPlaceContents = metadata?.placeContents ?? (
      synchronizePlaceContentsBasis(
        sourceRow.placeContents,
        priceOptions[0]?.priceBasis ?? sourceRow.priceOptions[0]?.priceBasis ?? "unknown",
        `${nextName} ${sourceRow.packaging || ""}`
      ) || null
    );
    return [{
      rowIndex,
      row: {
        ...sourceRow,
        rawName: nextName,
        normalizedName: rawName ? normalizeProductName(nextName) : sourceRow.normalizedName,
        canonicalHint: rawName ? nextName : sourceRow.canonicalHint,
        normalizedSignature: rawName ? productSignature(nextName) : sourceRow.normalizedSignature,
        variant: rawName ? extractVariant(nextName) : sourceRow.variant,
        sizeText: rawName ? extractSizeText(nextName) : sourceRow.sizeText,
        ...(metadata ?? {}),
        placeContents: nextPlaceContents,
        priceOptions,
      },
    }];
  });

  return {
    rows: preparedRows,
    excludedRowIndexes: Array.from(excluded).sort((left, right) => left - right),
    editedPriceOptions: priceEdits.length,
    addedPriceOptions: priceAdditions.length,
    removedPriceOptions: priceRemovals.length,
    editedNames: rowEdits.length,
    editedMetadata: metadataEdits.length,
  };
}

function makeOption(raw: unknown, header: string, rawName: string, packaging: string | null): ParsedPriceOption | null {
  const priceAmount = numberFromText(raw);
  if (priceAmount === null) return null;
  const priceBasis = priceBasisFromText(header, rawName, packaging);
  const normalized = normalizePrice(priceAmount, priceBasis, packaging);
  const threshold = fold(header).match(/(?:от|с)\s*(\d+(?:[.,]\d+)?)\s*кг/);
  const rawMode = priceModeFromHeader(header);
  return { priceAmount, priceBasis, ...normalized, priceMode: canonicalPriceMode(rawMode), market: priceMarketFromText(`${header} ${text(raw)}`), minimumQuantityKg: threshold ? Number(threshold[1].replace(",", ".")) : null, includesVat: /с\s*ндс|ндс\s*\d+/.test(fold(header)) ? true : /без\s*ндс/.test(fold(header)) ? false : null, sourcePriceText: text(raw) };
}
function priceOptionPriority(option: ParsedPriceOption) {
  return ({ cashless_vat: 0, cashless_no_vat: 1, cash: 2 } as Record<PriceMode, number>)[canonicalPriceMode(option.priceMode)];
}
function prioritizePriceOptions(options: ParsedPriceOption[]) {
  return options.slice().sort((left, right) => priceOptionPriority(left) - priceOptionPriority(right));
}
function isProductHeader(value: unknown) { return /^(наименовани\w*|товар\w*|номенклатур\w*|позици\w*|продукт\w*)/i.test(text(value)); }
function isPriceSurchargeHeader(value: unknown) {
  const title = fold(text(value));
  return /(?:плюс\s+к\s+цен|надбавк|доплат)|(?:мелк\w*\s+опт.*(?:\+|плюс|к\s+цен))|спец(?:иальн\w*)?\s*(?:предлож|цен)|акци|цена\s+(?:на\s+)?об[ъеё]м/i.test(title);
}
function isPriceHeader(value: unknown) { return !isPriceSurchargeHeader(value) && /цен|стоим|прайс|опт|налич|безнал/i.test(text(value)); }
function findHeaderIndex(rows: unknown[][]) {
  return rows.slice(0, 90).findIndex(row => row.some(isProductHeader) && row.some(isPriceHeader));
}
function columnIndex(headers: string[], expression: RegExp) { return headers.findIndex(value => expression.test(fold(value))); }
export function parseExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const rows: ParsedPriceRow[] = [];
  workbook.SheetNames.forEach(sheetName => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    const headerRow = findHeaderIndex(matrix);
    if (headerRow < 0) return;
    const headers = matrix[headerRow].map(cell => text(cell));
    const nameIndex = headers.findIndex(isProductHeader);
    const priceIndexes = headers.map((header, index) => ({ header, index })).filter(({ header }) => isPriceHeader(header));
    const skuIndex = columnIndex(headers, /артикул|код\s*(товара)?|^код$/);
    const categoryIndex = columnIndex(headers, /катег|раздел|групп/);
    const packagingIndex = columnIndex(headers, /фас|навес|упак|нетто/);
    const caseContentsIndex = columnIndex(headers, /короб|тара|квант|(?:вес|состав|кол).*(?:мест|короб|упак)|(?:мест|короб|упак).*(?:вес|состав|кол)/);
    const manufacturerIndex = columnIndex(headers, /производител|изготовител|бренд/);
    const availabilityIndex = columnIndex(headers, /налич|остат|склад/);
    matrix.slice(headerRow + 1).forEach((cells, offset) => {
      const sourceName = normalizeProductDisplayName(text(cells[nameIndex]));
      if (!sourceName || sourceName.length < 2 || isAdministrativeText(sourceName)) return;
      const packaging = normalizePackagingDisplay(text(cells[packagingIndex])) || null;
      const caseContents = placePartFromText(text(cells[caseContentsIndex]), sourceName);
      const namedContents = placeContentsFromProductName(sourceName);
      const rawName = stripRecognizedPlaceContentsFromName(sourceName, namedContents);
      if (!rawName || rawName.length < 2) return;
      const consumerPacking = isVariableWeightRange(packaging) ? null : placePartFromText(packaging, sourceName);
      const placeContents = mergePlaceContents([caseContents, namedContents, consumerPacking]);
      const options = prioritizePriceOptions(priceIndexes.map(({ header, index }) => {
        const context = /(?:налич|безнал)/i.test(header) && !/(?:за\s*|\/\s*)(?:кг|л|шт)/i.test(header)
          ? `${header} за кг`
          : header;
        return makeOption(cells[index], context, rawName, packaging || rawName);
      }).filter((value): value is ParsedPriceOption => Boolean(value)));
      if (!options.length) return;
      const rowNumber = headerRow + offset + 2;
      const rawPayload = Object.fromEntries(headers.map((header, index) => [header || `Колонка ${index + 1}`, text(cells[index])]).filter(([, value]) => value));
      rows.push({ sourceSheet: sheetName, sourceRowNumber: rowNumber, sourceSku: text(cells[skuIndex]) || null, rawName, normalizedName: normalizeProductName(rawName), canonicalHint: rawName, normalizedSignature: productSignature(rawName), category: text(cells[categoryIndex]) || null, packaging, packagingSignature: packagingSignature(packaging || rawName), manufacturer: text(cells[manufacturerIndex]) || null, placeContents, manufacturedOn: null, shelfLifeMonths: null, expiresOn: null, availability: text(cells[availabilityIndex]) || null, variant: extractVariant(rawName), sizeText: extractSizeText(rawName), priceOptions: options, rawPayload });
    });
  });
  return rows;
}
function extractExcelText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  return workbook.SheetNames.flatMap(sheetName => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" }).slice(0, 32).flat()).map(text).filter(Boolean).join("\n").slice(0, 12000);
}
function isAdministrativeText(value: string) {
  return /(?:https?:|www\.|@|\+7\s*\(|\b8\s*\(|\d{3}\s*[-)]\s*\d{2}\s*[-)]\s*\d{2}|тел(?:ефон)?|e-?mail|инн|кпп|огрн|адрес|ул\.?|пр-?кт|стоимость|прр|эвсд|доставка|коммерческое предложение|прайс(?:[- ]?лист)?|страниц|обновлен|^цена\s+за|^склад[^\n:]{0,48}:)/i.test(value);
}
function bestPriceMatch(line: string) {
  const currency = Array.from(line.matchAll(/\b\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей)?|р\.)/gi)).at(-1);
  if (currency?.[0] && currency.index !== undefined) {
    const amount = numberFromText(currency[0]);
    if (amount && amount >= 20) return { text: currency[0], index: currency.index, amount };
  }
  const candidates = Array.from(line.matchAll(/\b\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\b/g)).map(match => ({ text: match[0], index: match.index ?? 0, amount: numberFromText(match[0]) ?? 0 }));
  for (const candidate of candidates.reverse()) {
    const following = line.slice(candidate.index + candidate.text.length, candidate.index + candidate.text.length + 12);
    if (candidate.amount >= 50 && !/^\s*(?:кг|г|гр|мл|л|шт)\b/i.test(following)) return candidate;
  }
  return null;
}
function parseExtractedText(documentText: string) {
  const rows: ParsedPriceRow[] = [];
  const lines = documentText.replace(/\r/g, "").split("\n").map(text).filter(Boolean);
  lines.forEach((line, index) => {
    if (/^(итого|всего|страница|прайс|коммерческое предложение)/i.test(line) || isAdministrativeText(line)) return;
    const candidate = bestPriceMatch(line);
    if (!candidate) return;
    const rawName = normalizeProductDisplayName(text(line.slice(0, candidate.index)));
    const price = candidate.amount;
    if (!price || rawName.length < 3 || /^(цена|руб|код|артикул)$/i.test(rawName) || isAdministrativeText(rawName)) return;
    const packingMatch = line.match(/\d+(?:[.,]\d+)?\s*(?:кг|г|гр|л|мл|шт)(?![a-zа-я])/i);
    const packaging = normalizePackagingDisplay(packingMatch?.[0]) || null;
    const option = makeOption(candidate.text, "цена", rawName, packaging || rawName);
    if (!option) return;
    rows.push({ sourceSheet: "Документ", sourceRowNumber: index + 1, sourceSku: null, rawName, normalizedName: normalizeProductName(rawName), canonicalHint: rawName, normalizedSignature: productSignature(rawName), category: null, packaging, packagingSignature: packagingSignature(packaging || rawName), manufacturer: null, placeContents: null, manufacturedOn: null, shelfLifeMonths: null, expiresOn: null, availability: null, variant: extractVariant(rawName), sizeText: extractSizeText(rawName), priceOptions: [option], rawPayload: { line } });
  });
  return rows;
}

function docxNodeText(node: DocxNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "tab") return "\t";
  return (node.children ?? []).map(docxNodeText).join("");
}

function collectDocxTables(node: DocxNode, tables: string[][][]) {
  if (node.type === "table") {
    tables.push((node.children ?? [])
      .filter(row => row.type === "tableRow")
      .map(row => (row.children ?? [])
        .filter(cell => cell.type === "tableCell")
        .map(cell => text(docxNodeText(cell)))));
  }
  (node.children ?? []).forEach(child => collectDocxTables(child, tables));
}

function manualPriceOption(header: string, rawName: string, packaging: string | null, sourcePriceText: string): ParsedPriceOption {
  const priceBasis = priceBasisFromText(header, rawName, packaging);
  return {
    priceAmount: null,
    priceBasis,
    normalizedPrice: null,
    normalizedUnit: "unknown",
    priceMode: canonicalPriceMode(priceModeFromHeader(header)),
    market: priceMarketFromText(header),
    minimumQuantityKg: null,
    includesVat: /с\s*ндс|ндс\s*\d+/.test(fold(header)) ? true : /без\s*ндс/.test(fold(header)) ? false : null,
    sourcePriceText,
  };
}

function isManualPriceText(value: string) {
  return /(?:дог\.?|запрос|уточн|нет\s*цен|n\/a)/i.test(value);
}

function isWordPriceHeader(value: string) {
  const title = fold(value);
  return /(?:^|\s)(?:цена|стоимость|прайс)(?:\s|$)/i.test(title) &&
    (/за\s*\d+|руб|опт/i.test(title) || /^(?:цена|стоимость|прайс)$/i.test(title));
}

function wordPackagingFromRow(cells: string[], nameIndex: number, priceIndex: number, rawName: string) {
  const following = cells.slice(nameIndex + 1, priceIndex).map(text).filter(Boolean);
  const descriptiveCell = following.find(value => /(?:короб|мешок|ящик|упак|фас|бан(?:ка|ку)|бутыл|пачк|вес|\d\s*(?:кг|г|гр|л|мл|шт))/i.test(value));
  const fromName = rawName.match(/\d+(?:[.,]\d+)?\s*(?:кг|г|гр|л|мл|шт)(?![a-zа-я])/i)?.[0] ?? "";
  return normalizePackagingDisplay(descriptiveCell || fromName) || null;
}

/** Reads product rows from Word tables without confusing a weight in the product name with the price cell. */
export function parseDocxTableRows(tables: string[][][]) {
  const rows: ParsedPriceRow[] = [];
  let sourceRowNumber = 0;
  tables.forEach(table => {
    // Fish price tables often omit a column title but quote a wholesale price per kg.
    // A specific Word header such as «Цена за банку» below always takes precedence.
    let priceHeader = "Цена за кг";
    table.forEach(cells => {
      const normalizedCells = cells.map(text);
      const nonEmpty = normalizedCells.map((value, index) => ({ value, index })).filter(cell => Boolean(cell.value));
      const lastCell = nonEmpty.at(-1);
      if (!lastCell || nonEmpty.length < 2) return;
      if (isWordPriceHeader(lastCell.value)) {
        priceHeader = lastCell.value;
        return;
      }

      const hasAmount = numberFromText(lastCell.value) !== null;
      if (!hasAmount && !isManualPriceText(lastCell.value)) return;
      const nameCell = nonEmpty
        .filter(cell => cell.index < lastCell.index)
        .find(cell => !/^\d+$/.test(cell.value) && !isProductHeader(cell.value));
      const sourceName = normalizeProductDisplayName(nameCell?.value ?? "");
      if (!sourceName || sourceName.length < 2 || isAdministrativeText(sourceName)) return;

      const packaging = wordPackagingFromRow(normalizedCells, nameCell!.index, lastCell.index, sourceName);
      const namedContents = placeContentsFromProductName(sourceName);
      const rawName = stripRecognizedPlaceContentsFromName(sourceName, namedContents);
      if (!rawName || rawName.length < 2) return;
      const placeContents = mergePlaceContents([
        placePartFromText(packaging, sourceName),
        namedContents,
      ]);
      const option = hasAmount
        ? makeOption(lastCell.value, priceHeader, rawName, packaging || rawName)
        : manualPriceOption(priceHeader, rawName, packaging || rawName, lastCell.value);
      if (!option) return;

      sourceRowNumber += 1;
      rows.push({
        sourceSheet: "Word",
        sourceRowNumber,
        sourceSku: null,
        rawName,
        normalizedName: normalizeProductName(rawName),
        canonicalHint: rawName,
        normalizedSignature: productSignature(rawName),
        category: null,
        packaging,
        packagingSignature: packagingSignature(packaging || rawName),
        manufacturer: null,
        placeContents,
        manufacturedOn: null,
        shelfLifeMonths: null,
        expiresOn: null,
        availability: null,
        variant: extractVariant(rawName),
        sizeText: extractSizeText(rawName),
        priceOptions: [option],
        rawPayload: Object.fromEntries(normalizedCells.map((value, index) => [`Колонка ${index + 1}`, value]).filter(([, value]) => Boolean(value))),
      });
    });
  });
  return rows;
}

async function parseDocxTables(buffer: Buffer) {
  const archive = await mammothUnzip.openZip({ buffer });
  const documentResult = await mammothDocxReader.read(archive);
  const tables: string[][][] = [];
  collectDocxTables(documentResult.value, tables);
  return parseDocxTableRows(tables);
}

const pdfPricePattern = /\b\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:₽|руб(?:\.|лей)?|р\.)/gi;
const pdfPageMarker = /^--\s*(?:\{?\d+\}?|page\s+\d+)\s+(?:of|из)\s+(?:\{?\d+\}?|\d+)\s*--$/i;

function isPdfHeaderLine(line: string) {
  return /^(?:наименовани[a-zа-яё]*|производител[a-zа-яё]*|упаковк[a-zа-яё]*|цен[аы]?|с\s*ндс|без\s*ндс|изменени[a-zа-яё]*|остат[a-zа-яё]*|медиа)/i.test(line);
}
function isPdfSectionLine(line: string) {
  return /^\|\s*.+/.test(line) || /^(?:оперативная\s+сводка|хиты\s+недели|новые\s+поступления|условия\s+доставки|бесплатная\s+доставка|платная\s+доставка)/i.test(line) || (line === line.toUpperCase() && /[А-ЯЁ]/.test(line));
}
function isPdfServiceLine(line: string) {
  return /^(?:тм\s+|ооо\s+|ао\s+|ип\s+|производитель\b|дата\s+(?:производ|изготов)|изготовлен|вылов\b|срок\s+(?:годн|хран)|годн\.?\b|при\s+темп|вакуу?м\b|пл\.?\s*б\b|ст\.?\s*б\b|ключ\b|ожидаем\b|по\s+запросу\b|tg\b|max\b|−$|\d{1,2}\.\d{2}\s*-\s*\d{1,2}\.\d{2}\b)/i.test(line)
    || /^\(?\s*(?:пл\.?\s*б|ст\.?\s*б|вакуу?м|ключ)\b/i.test(line)
    || /^\d+(?:[.,]\d+)?\s*(?:кг|г|гр|шт|уп\.?)\s*\((?:короб|куб|мешок|ведро)\)/i.test(line);
}
function isPdfDeliveryOrContacts(line: string) {
  return /(?:условия\s+доставки|доставка\s+(?:в|до|по)|бесплатная\s+доставка|платная\s+доставка|подпишитесь|telegram|max$|московская\s+область|северная\s+промзона|г\.?видное|стр\.\s*\d)/i.test(line) || isAdministrativeText(line);
}
function normalizePdfName(value: string) {
  const cleaned = text(value)
    .replace(/[\uE000-\uF8FF]/g, " ")
    .replace(/^\s*(?:№|n)?\s*\d{1,4}\s+(?=[a-zа-яё])/i, "")
    .replace(/\bб\s+ез\b/gi, "без")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/(^|\s)(?:0+\s*(?:г|гр)|20\d{2}\s*(?:г|гр))(?![a-zа-яё])/gi, "$1")
    .replace(/(^|\s)20\d{2}(?=\s|$|[,:;.])/g, "$1")
    .replace(/\s+(?:с\s+ндс|без\s+ндс|срок\s+(?:годн|хран)|годн\.?(?![a-zа-яё])|изготовлен|дата\s+(?:производ|изготов)|при\s+темп|ндс(?![a-zа-яё])).*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalizeProductDisplayName(cleaned);
}
function pdfPackagingFromText(value: string) {
  const matches = Array.from(value.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:кг|г|гр|л|мл|шт|уп\.?)(?![a-zа-я])/gi))
    .filter(match => {
      const candidate = text(match[0]);
      const numeric = Number(candidate.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(",", "."));
      if (!Number.isFinite(numeric) || numeric <= 0) return false;
      return !/^20\d{2}\s*(?:г|гр)(?![a-zа-я])/i.test(candidate);
    });
  return normalizePackagingDisplay(matches.at(-1)?.[0]) || null;
}
function makePdfRow(rawName: string, priceText: string, priceContext: string, lineNumber: number, packaging: string | null): ParsedPriceRow | null {
  const name = normalizePdfName(rawName);
  if (name.length < 3 || isAdministrativeText(name) || isPdfHeaderLine(name) || /^\d+(?:[\s.,]\d+)?(?:\s*\(в\s*(?:спб|мск)\))?$/i.test(name)) return null;
  const option = makeOption(priceText, priceContext, name, packaging || name);
  if (!option) return null;
  return { sourceSheet: "PDF", sourceRowNumber: lineNumber, sourceSku: null, rawName: name, normalizedName: normalizeProductName(name), canonicalHint: name, normalizedSignature: productSignature(name), category: null, packaging, packagingSignature: packagingSignature(packaging || name), manufacturer: null, placeContents: null, manufacturedOn: null, shelfLifeMonths: null, expiresOn: null, availability: null, variant: extractVariant(name), sizeText: extractSizeText(name), priceOptions: [option], rawPayload: { line: priceContext } };
}

/** PDF catalogs often split a product cell across lines; only fragments preceding a currency price form the product name. */
export function parsePdfExtractedText(documentText: string) {
  const lines = documentText.replace(/\r/g, "").split("\n").map(text).filter(Boolean);
  if (lines.some(line => /redgm|икорн(?:ый|ого)\s+сомелье/i.test(line))) return parseRedgmPdfText(lines);
  const rows: ParsedPriceRow[] = [];
  let tableActive = false;
  let nameHeaderSeen = false;
  let fragments: string[] = [];
  lines.forEach((line, index) => {
    if (pdfPageMarker.test(line)) return;
    if (/^условия\s+доставки/i.test(line)) { tableActive = false; fragments = []; return; }
    if (/^наименовани/i.test(line)) { nameHeaderSeen = true; return; }
    if (/^(?:с\s*ндс|без\s*ндс)/i.test(line) && nameHeaderSeen) { tableActive = true; nameHeaderSeen = false; return; }
    if (isPdfHeaderLine(line)) return;
    if (isPdfSectionLine(line)) { fragments = []; return; }
    if (!tableActive) return;
    const priceMatch = Array.from(line.matchAll(pdfPricePattern)).at(-1);
    if (priceMatch?.[0] && priceMatch.index !== undefined) {
      const prefix = text(line.slice(0, priceMatch.index));
      const name = [...fragments, prefix].filter(Boolean).join(" ");
      const packaging = pdfPackagingFromText(`${fragments.join(" ")} ${prefix}`);
      const row = makePdfRow(name, priceMatch[0], line, index + 1, packaging);
      if (row) rows.push(row);
      fragments = [];
      return;
    }
    if (isPdfDeliveryOrContacts(line) || isPdfServiceLine(line)) return;
    if (/^(?:\d{1,3}(?:\s\d{3})?|\d{1,2}[./-]\d{1,2})\s*(?:\(в\s*(?:спб|мск)\))?/i.test(line)) return;
    fragments = [...fragments, line].slice(-6);
  });
  return rows;
}

/** RedGM extracts the product and city-price columns in separate document blocks. Pair only numbered products with city prices. */
function parseRedgmPdfText(lines: string[]) {
  const pages: string[][] = [[]];
  lines.forEach(line => { if (pdfPageMarker.test(line)) pages.push([]); else pages.at(-1)?.push(line); });
  const rows: ParsedPriceRow[] = [];
  let sourceRowNumber = 0;
  pages.forEach(page => {
    const entries: string[][] = [];
    const cityPrices: Array<{ text: string; context: string }> = [];
    let current: string[] | null = null;
    page.forEach(line => {
      sourceRowNumber += 1;
      const cityPrice = line.match(/\b\d{1,3}(?:\s\d{3})?(?:[.,]\d{1,2})?\s*\(в\s*(?:спб|мск)\)/i)?.[0];
      if (cityPrice) { cityPrices.push({ text: cityPrice, context: line }); return; }
      const numbered = line.match(/^\s*(\d{1,3})\s+(.+)$/);
      if (numbered && !/\(в\s*(?:спб|мск)\)/i.test(line)) {
        if (current?.length) entries.push(current);
        current = [numbered[2]];
        return;
      }
      if (current && !isPdfHeaderLine(line) && !isPdfSectionLine(line) && !isPdfServiceLine(line) && !isPdfDeliveryOrContacts(line)) current.push(line);
    });
    const trailingEntry = current as string[] | null;
    if (trailingEntry?.length) entries.push(trailingEntry);
    entries.slice(0, cityPrices.length).forEach((entry, index) => {
      const price = cityPrices[index];
      const name = entry.join(" ");
      const row = makePdfRow(name, price.text, price.context, sourceRowNumber - page.length + index + 1, pdfPackagingFromText(name));
      if (row) rows.push(row);
    });
  });
  return rows;
}

type PdfTextFragment = { x: number; y: number; value: string; width?: number };
type PdfPositionedLine = { y: number; items: PdfTextFragment[] };
type PdfColumnSection = {
  headerY: number;
  bottomY: number;
  nameX: number;
  specificationX: number | null;
  manufacturerX: number | null;
  packagingX: number | null;
  priceX: number;
  quantX: number | null;
  priceEnd: number;
  includesVat: boolean;
};

function pdfPositionedLines(items: PdfTextFragment[]) {
  const lines: PdfPositionedLine[] = [];
  items
    .filter(item => item.value.trim())
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .forEach(item => {
      const existing = lines.find(line => Math.abs(line.y - item.y) <= 3);
      if (existing) existing.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    });
  return lines.map(line => ({ ...line, items: line.items.sort((left, right) => left.x - right.x) }));
}

function joinPdfFragments(items: PdfTextFragment[]) {
  return items
    .slice()
    .sort((left, right) => right.y - left.y || left.x - right.x)
    .reduce<{ value: string; previous: PdfTextFragment | null }>((state, item) => {
      const previous = state.previous;
      const sameLine = previous !== null && Math.abs(previous.y - item.y) <= 3;
      const previousEnd = previous ? previous.x + (previous.width ?? 0) : Number.NEGATIVE_INFINITY;
      const touchesPreviousFragment = sameLine && previous?.width !== undefined && item.x - previousEnd <= 1.5;
      return { value: `${state.value}${state.value && !touchesPreviousFragment ? " " : ""}${item.value}`, previous: item };
    }, { value: "", previous: null }).value;
}
function pdfLineText(line: PdfPositionedLine) { return text(joinPdfFragments(line.items)); }
function pdfColumnText(items: PdfTextFragment[], start: number, end: number) {
  return text(joinPdfFragments(items.filter(item => item.x >= start && item.x < end)));
}
function isPdfPriceQuote(value: string) {
  if (/(?:уточняйте|по\s+запросу|(?:\d{1,3}(?:[\s.,]\d{3})*|\d{1,7})(?:[.,]\d{1,2})?\s*(?:₽|руб|р\.?|\(в\s*(?:спб|мск)\)|за\s*(?:1\s*)?(?:кг|л|шт)|\/(?:кг|л|шт)|с\s*ндс))/i.test(value)) return true;
  const bareAmount = numberFromText(value);
  return bareAmount !== null && bareAmount >= 20 && /^\s*\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\s*$/.test(value);
}
function stripPdfSpecification(value: string) {
  const normalized = normalizePdfName(value)
    .replace(/\s*\((?:пл\.?\s*б|ст\.?\s*б|вакуу?м|ключ|куб|короб)[^)]*\)/gi, " ")
    .replace(/\s*(?:qr\s*честный\s*знак|честный\s*знак|qr)\b.*$/i, " ")
    .replace(/\b!new!\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const words = normalized.split(" ");
  if (words.length >= 4 && fold(words[0]) === fold(words[2]) && fold(words[1]) === fold(words[3])) return words.slice(2).join(" ");
  return normalized;
}
function stripPdfServiceTail(value: string) {
  const serviceStart = /(?:^|[\s,;·])(?:условия\s+доставки|бесплатная\s+доставка|платная\s+доставка|холодная\s+доставка|доставка\s+в\s+регионы|стоимость\s+выписки|услуги\s+прр)(?=\s|[.,;:!?]|$)/i.exec(value);
  return text((serviceStart?.index === undefined ? value : value.slice(0, serviceStart.index)).replace(/[\s,;·-]+$/g, ""));
}
function cleanPdfManufacturer(value: string) {
  return text(stripPdfServiceTail(value).replace(/^[\s,;·-]+|[\s,;·-]+$/g, ""));
}
function pdfPriceOptionsFromQuote(quote: string, priceContext: string, rawName: string, packaging: string | null, includesVat: boolean) {
  const cleanedQuote = text(quote)
    .replace(/[\uE000-\uF8FF]/g, " ")
    .replace(/(?<!\d)([\d\s]+)(?=\s*(?:₽|руб|р\.))/g, (_match, amount) => amount.replace(/\s+/g, ""))
    .replace(/\s{2,}/g, " ");
  const context = `${priceContext} ${includesVat ? "с НДС" : ""}`;
  if (/(?:спец(?:предлож|цен)|акци|от\s+(?:объем|\d+\s*(?:кг|шт))|при\s+заказе)/i.test(context)) return [];
  const matches = Array.from(cleanedQuote.matchAll(/(?:\d{1,3}(?:[\s.,]\d{3})+|\d{1,7})(?:[.,]\d{1,2})?(?:\s*\(в\s*(?:спб|мск)\))?(?:\s*с\s*ндс)?(?:\s*(?:(?:за\s*(?:1\s*)?|\/)\s*)?(?:кг|л|шт))?/gi));
  const options = matches
    .filter(match => {
      const value = match[0];
      const offset = match.index ?? 0;
      const nearbySuffix = cleanedQuote.slice(offset + value.length, offset + value.length + 16);
      const market = /\(в\s*(?:спб|мск)\)/i.test(value);
      const labeled = /(?:₽|руб|р\.?|(?:за\s*(?:1\s*)?|\/)\s*(?:кг|л|шт))/i.test(`${value}${nearbySuffix}`);
      const singleBareQuote = /^\s*\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?\s*$/.test(cleanedQuote);
      return market || labeled || singleBareQuote;
    })
    .map(match => {
      const trailing = cleanedQuote.slice((match.index ?? 0) + match[0].length);
      const nextAmountAt = trailing.search(/\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?/);
      const localContext = nextAmountAt >= 0 ? trailing.slice(0, nextAmountAt) : trailing;
      const optionContext = /за упаковку/i.test(priceContext)
        ? `${match[0]} за упаковку ${includesVat ? "с НДС" : ""}`
        : `${match[0]} ${localContext} ${includesVat ? "с НДС" : ""}`;
      return makeOption(match[0], optionContext, rawName, packaging || rawName);
    })
    .filter((option): option is ParsedPriceOption => option !== null)
    .map(option => ({ ...option, includesVat: includesVat || option.includesVat }));
  if (options.length) {
    const explicitlyLabeled = /(?:за\s*(?:1\s*)?|\/)\s*(?:кг|л|шт)/i.test(cleanedQuote);
    if (options.length === 1 && !explicitlyLabeled && !/за упаковку/i.test(priceContext)) {
      const [option] = options;
      const priceBasis: PriceBasis = "kg";
      return [{ ...option, priceBasis, ...normalizePrice(option.priceAmount!, priceBasis, packaging || rawName) }];
    }
    return options;
  }
  if (!/(?:уточняйте|по\s+запросу)/i.test(quote)) return [];
  return [{
    priceAmount: null,
    priceBasis: packaging ? "package" as const : "unknown" as const,
    normalizedPrice: null,
    normalizedUnit: "unknown" as const,
    priceMode: canonicalPriceMode(priceModeFromHeader(context)),
    market: priceMarketFromText(context),
    minimumQuantityKg: null,
    includesVat: includesVat || null,
    sourcePriceText: cleanedQuote,
  }];
}

/**
 * Parses ordinary column-based PDF price lists by coordinates. The algorithm is
 * supplier-agnostic: it finds repeated product/price headers, then combines text
 * from one vertical row while excluding the specification and manufacturer columns.
 */
export function parsePdfPositionedPages(pages: PdfTextFragment[][]) {
  const rows: ParsedPriceRow[] = [];
  let sourceRowNumber = 0;
  let continuationColumns: Array<Omit<PdfColumnSection, "headerY" | "bottomY">> = [];
  pages.forEach(pageItems => {
    const previousContinuationColumns = continuationColumns;
    const lines = pdfPositionedLines(pageItems);
    const allItems = lines.flatMap(line => line.items);
    const pageTop = Math.max(0, ...allItems.map(item => item.y)) + 6;
    const headerCandidates: Array<Omit<PdfColumnSection, "bottomY">> = [];
    lines.forEach(line => {
      const nameItem = line.items.find(item => /наименовани|товар|номенклатур|позици|продукт/i.test(item.value));
      if (!nameItem) return;
      const nearby = lines
        .filter(other => Math.abs(other.y - line.y) <= 18)
        .flatMap(other => other.items);
      const priceItem = nearby.find(item => /цен|стоим|прайс/i.test(item.value));
      if (!priceItem) return;
      const specificationItem = nearby.find(item => /специфик/i.test(item.value));
      const manufacturerItem = nearby.find(item => /производител/i.test(item.value));
      const packagingItem = nearby.find(item => /упаковк|нетто|фасовк|вес/i.test(item.value));
      const quantItem = nearby.find(item => /квант|шт\s*\/\s*кор|кор\s*\/\s*шт/i.test(item.value));
      const priceEnd = nearby
        .filter(item => item.x > priceItem.x && /изменени|остат|медиа|налич|статус/i.test(item.value))
        .map(item => item.x)
        .sort((left, right) => left - right)[0] ?? Infinity;
      const isSimpleTwoColumnTable = !specificationItem && !manufacturerItem && !packagingItem;
      const estimatedNameStart = isSimpleTwoColumnTable
        ? Math.max(0, nameItem.x - Math.max(40, (priceItem.x - nameItem.x) * 0.65))
        : nameItem.x;
      headerCandidates.push({
        headerY: Math.min(line.y, ...nearby.filter(item => /цен|стоим|прайс/i.test(item.value)).map(item => item.y)),
        nameX: estimatedNameStart,
        specificationX: specificationItem?.x ?? null,
        manufacturerX: manufacturerItem?.x ?? null,
        packagingX: packagingItem?.x ?? null,
        priceX: priceItem.x,
        quantX: quantItem?.x ?? null,
        priceEnd,
        includesVat: /с\s*ндс/i.test(text(nearby.map(item => item.value).join(" "))),
      });
    });
    const detectedSections = headerCandidates
      .sort((left, right) => right.headerY - left.headerY)
      .filter((header, index, list) => index === 0 || Math.abs(header.headerY - list[index - 1].headerY) > 24)
      .map((header, index, list) => ({ ...header, bottomY: list[index + 1]?.headerY ?? -Infinity }));
    const continuationSectionAboveHeader = detectedSections.length && previousContinuationColumns.length
      ? previousContinuationColumns.map(column => ({
          ...column,
          headerY: pageTop,
          bottomY: detectedSections[0]!.headerY,
        }))
      : [];
    const sections = detectedSections.length
      ? [...continuationSectionAboveHeader, ...detectedSections]
      : previousContinuationColumns.map(column => ({ ...column, headerY: pageTop, bottomY: -Infinity }));
    if (detectedSections.length) {
      continuationColumns = detectedSections.map(({ headerY: _headerY, bottomY: _bottomY, ...column }) => column);
    }

    sections.forEach(section => {
      const priceStart = section.packagingX !== null && section.quantX !== null ? section.priceX - 12 : section.priceX - 62;
      const quoteLines = lines
        .filter(line => line.y < section.headerY - 5 && line.y > section.bottomY + 5)
        .map(line => ({ line, quote: pdfColumnText(line.items, priceStart, section.priceEnd) }))
        .filter(({ quote }) => isPdfPriceQuote(quote))
        .sort((left, right) => right.line.y - left.line.y);
      quoteLines.forEach(({ line, quote }, quoteIndex) => {
        const above = quoteLines[quoteIndex - 1]?.line.y ?? section.headerY;
        const below = quoteLines[quoteIndex + 1]?.line.y ?? section.bottomY;
        const bandTop = (above + line.y) / 2;
        const bandBottom = (line.y + below) / 2;
        const rowItems = allItems.filter(item => item.y <= bandTop && item.y > bandBottom);
        const manufacturerStart = section.manufacturerX === null ? Infinity : section.manufacturerX - 12;
        const specificationStart = section.specificationX === null ? manufacturerStart : section.specificationX - 52;
        const packagingStart = section.packagingX === null ? priceStart : section.packagingX - 14;
        const quantStart = section.quantX === null ? Infinity : section.quantX - 14;
        const nameEnd = Math.min(specificationStart - 1, manufacturerStart, packagingStart, priceStart);
        const nameRowItems = section.quantX === null
          ? rowItems
          : rowItems.filter(item => Math.abs(item.y - line.y) <= 3);
        const rawName = stripPdfServiceTail(stripPdfSpecification(pdfColumnText(nameRowItems, section.nameX - 22, nameEnd)));
        const specification = section.specificationX === null ? "" : pdfColumnText(rowItems, specificationStart, manufacturerStart);
        const manufacturer = section.manufacturerX === null ? "" : cleanPdfManufacturer(pdfColumnText(rowItems, manufacturerStart, packagingStart));
        const quoteStartX = Math.min(...line.items.filter(item => item.x >= priceStart && item.x < section.priceEnd).map(item => item.x));
        const placeEnd = Number.isFinite(quoteStartX) ? Math.min(section.priceX - 16, quoteStartX - 10) : priceStart;
        const placeWeight = section.packagingX === null ? "" : pdfColumnText(rowItems, packagingStart, placeEnd);
        const quant = section.quantX === null ? "" : pdfColumnText(rowItems, quantStart, section.priceEnd);
        const packaging = pdfPackagingFromText(`${rawName} ${placeWeight}`);
        const priceContext = section.quantX !== null && section.packagingX !== null
          ? `${quote} за упаковку`
          : quote;
        const options = pdfPriceOptionsFromQuote(quote, priceContext, rawName, packaging, section.includesVat || /с\s*ндс/i.test(quote));
        if (!rawName || !options.length || isPdfSectionLine(rawName) || isPdfDeliveryOrContacts(rawName)) return;
        sourceRowNumber += 1;
        rows.push({
          sourceSheet: "PDF",
          sourceRowNumber,
          sourceSku: null,
          rawName,
          normalizedName: normalizeProductName(rawName),
          canonicalHint: rawName,
          normalizedSignature: productSignature(rawName),
          category: null,
          packaging,
          packagingSignature: packagingSignature(packaging || rawName),
          manufacturer: manufacturer || null,
          placeContents: section.quantX === null
            ? placePartFromText(placeWeight, `${rawName} ${packaging || ""}`)
            : placePartFromText(quant, `${rawName} ${packaging || ""}`),
          manufacturedOn: null,
          shelfLifeMonths: null,
          expiresOn: null,
          availability: null,
          variant: extractVariant(rawName),
          sizeText: extractSizeText(rawName),
          priceOptions: options,
          rawPayload: { specification, manufacturer, placeWeight, quant, priceText: quote },
        });
      });
    });
  });
  return rows;
}

function pdfPriceOptionKey(option: ParsedPriceOption) {
  return [option.priceAmount ?? "manual", option.priceBasis, canonicalPriceMode(option.priceMode), option.market, option.includesVat ? "vat" : "no-vat"].join("|");
}

/** Keeps a single PDF row for repeated cells while preserving every distinct supplier variant. */
export function deduplicatePdfRows(rows: ParsedPriceRow[]) {
  const unique = new Map<string, ParsedPriceRow>();
  rows.forEach(row => {
    // `normalizedSignature` deliberately removes Sup/Ord for cross-supplier matching,
    // but the source preview must not turn those distinct grades into two prices of one row.
    const key = [row.normalizedSignature, fold(row.variant ?? ""), row.packagingSignature, fold(row.manufacturer ?? ""), normalizePlaceContents(row.placeContents)].join("|");
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...row, priceOptions: [...row.priceOptions] });
      return;
    }
    const options = new Map(existing.priceOptions.map(option => [pdfPriceOptionKey(option), option]));
    row.priceOptions.forEach(option => options.set(pdfPriceOptionKey(option), option));
    existing.priceOptions = Array.from(options.values());
  });
  return Array.from(unique.values());
}

async function parsePdfByCoordinates(buffer: Buffer) {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    const pages: PdfTextFragment[][] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.flatMap(item => {
        if (!("str" in item) || !text(item.str)) return [];
        return [{ x: item.transform[4], y: item.transform[5], value: item.str, width: typeof item.width === "number" ? item.width : undefined }];
      }));
    }
    return parsePdfPositionedPages(pages);
  } finally {
    await document.destroy();
  }
}
async function extractPdfFirstPageHeader(buffer: Buffer) {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    const page = await document.getPage(1);
    const content = await page.getTextContent();
    const pageHeight = Number(page.view?.[3]) || 0;
    const headerFloor = pageHeight ? pageHeight * 0.65 : 0;
    return content.items
      .flatMap(item => "str" in item && text(item.str) ? [{ x: item.transform[4], y: item.transform[5], value: item.str }] : [])
      .filter(item => item.y >= headerFloor)
      .sort((left, right) => right.y - left.y || left.x - right.x)
      .map(item => item.value)
      .join(" ");
  } finally {
    await document.destroy();
  }
}
function sourceTypeFromName(fileName: string) {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === "xls" || extension === "xlsx" || extension === "pdf" || extension === "docx") return extension;
  throw new Error("Поддерживаются прайс‑листы Excel (.xls, .xlsx), PDF и Word (.docx).");
}
function findSupplierName(source: string) { return supplierHints.find(([expression]) => expression.test(source))?.[1] ?? null; }
export function sourceDateFromText(source: string) {
  const match = source.match(/\b(\d{1,2})[._\-/](\d{1,2})[._\-/](20\d{2})\b/);
  if (match) {
    const [, day, month, year] = match;
    const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return Number.isNaN(Date.parse(result)) ? null : result;
  }
  const months: Record<string, string> = { января: "01", февраля: "02", марта: "03", апреля: "04", мая: "05", июня: "06", июля: "07", августа: "08", сентября: "09", октября: "10", ноября: "11", декабря: "12" };
  const words = source.toLowerCase().match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(20\d{2})\b/);
  if (!words) return null;
  const [, day, monthName, year] = words;
  return `${year}-${months[monthName]}-${day.padStart(2, "0")}`;
}
export async function previewPriceImport(buffer: Buffer, fileName: string): Promise<PriceImportPreview> {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("Файл прайс‑листа не получен.");
  const sourceType = sourceTypeFromName(fileName);
  let documentText = "";
  let rows: ParsedPriceRow[] = [];
  if (sourceType === "xls" || sourceType === "xlsx") { documentText = extractExcelText(buffer); rows = parseExcel(buffer); }
  if (sourceType === "docx") {
    documentText = (await mammoth.extractRawText({ buffer })).value;
    rows = await parseDocxTables(buffer);
    if (!rows.length) rows = parseExtractedText(documentText);
  }
  let pdfFirstPageHeader = "";
  if (sourceType === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try { documentText = (await parser.getText()).text; } finally { await parser.destroy(); }
    const [positionedRows, firstPageHeader] = await Promise.all([parsePdfByCoordinates(buffer), extractPdfFirstPageHeader(buffer)]);
    pdfFirstPageHeader = firstPageHeader;
    rows = positionedRows.length ? positionedRows : parsePdfExtractedText(documentText);
  }
  const parsedRows = sourceType === "pdf" ? deduplicatePdfRows(rows) : rows;
  const trimmedRows = parsedRows.slice(0, MAX_IMPORT_ROWS);
  const warnings: string[] = [];
  if (!trimmedRows.length) warnings.push("Товарные строки с распознанной ценой не найдены. Проверьте документ и разметку прайс‑листа.");
  if (parsedRows.length > MAX_IMPORT_ROWS) warnings.push(`Обработаны первые ${MAX_IMPORT_ROWS} строк из ${parsedRows.length}.`);
  const manualPriceRows = trimmedRows.filter(row => row.priceOptions.some(option => option.priceAmount === null));
  if (manualPriceRows.length) warnings.push(`У ${manualPriceRows.length} поз. цена не указана поставщиком: заполните ее вручную перед сохранением.`);
  const source = sourceType === "pdf"
    ? `${fileName}\n${pdfFirstPageHeader}\n${documentText.slice(0, 6000)}`
    : `${fileName}\n${documentText.slice(0, 6000)}`;
  return { fileName, sourceType, detectedSupplierName: findSupplierName(source), detectedSourceDate: sourceDateFromText(source), rows: trimmedRows, warningCount: warnings.length + trimmedRows.filter(row => row.priceOptions.some(option => option.normalizedPrice === null)).length, warnings };
}

type Mapping = { productId: number | null; mappingStatus: "linked" | "suggested" | "unmapped"; matchedBy: "supplier_alias" | "signature" | "new_product" | "none"; matchConfidence: number | null };
export function resolvePriceMapping(row: ParsedPriceRow, supplierId: number, aliases: Array<{ supplierId: number; productId: number; normalizedName: string; packagingSignature: string | null }>, products: Array<{ id: number; normalizedSignature: string }>): Mapping {
  const aliasesWithSameName = aliases.filter(alias => alias.supplierId === supplierId && alias.normalizedName === row.normalizedName);
  const direct = aliasesWithSameName.find(alias => (alias.packagingSignature || "") === row.packagingSignature)
    ?? (new Set(aliasesWithSameName.map(alias => alias.productId)).size === 1 ? aliasesWithSameName[0] : undefined);
  if (direct) return { productId: direct.productId, mappingStatus: "linked", matchedBy: "supplier_alias", matchConfidence: 100 };
  const signature = products.find(product => product.normalizedSignature === row.normalizedSignature);
  if (signature) return { productId: signature.id, mappingStatus: "suggested", matchedBy: "signature", matchConfidence: 92 };
  return { productId: null, mappingStatus: "unmapped", matchedBy: "none", matchConfidence: null };
}
async function ensureSupplier(name: string) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const normalizedName = normalizeSupplierName(name);
  const [existing] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.normalizedName, normalizedName)).limit(1);
  if (existing) return { supplier: existing, created: false };
  const [inserted] = await db.insert(priceSuppliers).values({ name: text(name), normalizedName }).$returningId();
  const [supplier] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.id, inserted.id)).limit(1);
  return { supplier: supplier!, created: true };
}
export async function createPriceSupplier(input: { name: string; contactNote?: string | null }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const name = text(input.name);
  if (name.length < 2) throw new Error("Укажите название поставщика.");
  const normalizedName = normalizeSupplierName(name);
  const [existing] = await db.select({ id: priceSuppliers.id, name: priceSuppliers.name }).from(priceSuppliers).where(eq(priceSuppliers.normalizedName, normalizedName)).limit(1);
  if (existing) throw new Error(`Поставщик «${existing.name}» уже есть в справочнике.`);
  const [inserted] = await db.insert(priceSuppliers).values({ name, normalizedName, contactNote: text(input.contactNote || "") || null, isActive: true }).$returningId();
  const [supplier] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.id, inserted.id)).limit(1);
  return supplier!;
}
export async function commitPriceImport(input: { buffer: Buffer; fileName: string; supplierName: string; sourceDate?: string | null; actorId: number; categorySelections?: PriceImportCategorySelection[]; priceEdits?: PriceImportPriceEdit[]; rowEdits?: PriceImportRowEdit[]; metadataEdits?: PriceImportMetadataEdit[]; priceAdditions?: PriceImportPriceAddition[]; priceRemovals?: PriceImportPriceRemoval[]; productLinks?: PriceImportProductLink[]; excludedRowIndexes?: number[] }) {
  const preview = await previewPriceImport(input.buffer, input.fileName);
  if (!preview.rows.length) throw new Error("Импорт не сохранен: в документе не найдено ни одной товарной строки с ценой.");
  const preparedRows = preparePriceImportRows(preview.rows, input.priceEdits, input.excludedRowIndexes, input.rowEdits, input.metadataEdits, input.priceAdditions, input.priceRemovals);
  if (!preparedRows.rows.length) throw new Error("Импорт не сохранен: все распознанные строки исключены до сохранения.");
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const categoryByRow = new Map<number, number>();
  for (const selection of input.categorySelections ?? []) {
    if (!Number.isInteger(selection.rowIndex) || selection.rowIndex < 0 || selection.rowIndex >= preview.rows.length || !Number.isInteger(selection.categoryId) || selection.categoryId < 1) throw new Error("Передана некорректная категория для строки прайс‑листа.");
    if (preparedRows.excludedRowIndexes.includes(selection.rowIndex)) throw new Error("Нельзя назначить категорию строке, исключенной из импорта.");
    if (categoryByRow.has(selection.rowIndex)) throw new Error("Категория повторно выбрана для одной строки прайс‑листа.");
    categoryByRow.set(selection.rowIndex, selection.categoryId);
  }
  const categoryIds = Array.from(new Set(categoryByRow.values()));
  const selectedCategories = categoryIds.length ? await db.select({ id: priceCategories.id, name: priceCategories.name, isActive: priceCategories.isActive }).from(priceCategories).where(inArray(priceCategories.id, categoryIds)) : [];
  if (selectedCategories.length !== categoryIds.length) throw new Error("Одна из выбранных категорий прайс‑контроля не найдена.");
  if (selectedCategories.some(category => !category.isActive)) throw new Error("Для импорта можно выбрать только активную существующую категорию.");
  const categoryMap = new Map(selectedCategories.map(category => [category.id, category]));
  const productByRow = new Map<number, number>();
  for (const link of input.productLinks ?? []) {
    if (!Number.isInteger(link.rowIndex) || link.rowIndex < 0 || link.rowIndex >= preview.rows.length || !Number.isInteger(link.productId) || link.productId < 1) {
      throw new Error("Передана некорректная связь товара для строки прайс‑листа.");
    }
    if (preparedRows.excludedRowIndexes.includes(link.rowIndex)) throw new Error("Нельзя связать исключенную из импорта строку.");
    if (productByRow.has(link.rowIndex)) throw new Error("Товар повторно выбран для одной строки прайс‑листа.");
    if (categoryByRow.has(link.rowIndex)) throw new Error("Для связанной позиции нельзя одновременно назначать новую категорию.");
    productByRow.set(link.rowIndex, link.productId);
  }
  const linkedProductIds = Array.from(new Set(productByRow.values()));
  const explicitlyLinkedProducts = linkedProductIds.length
    ? await db.select({ id: priceProducts.id, canonicalName: priceProducts.canonicalName, normalizedSignature: priceProducts.normalizedSignature }).from(priceProducts).where(inArray(priceProducts.id, linkedProductIds))
    : [];
  if (explicitlyLinkedProducts.length !== linkedProductIds.length) throw new Error("Один из выбранных внутренних товаров не найден.");
  const explicitProductMap = new Map(explicitlyLinkedProducts.map(product => [product.id, product]));
  const ensuredSupplier = await ensureSupplier(input.supplierName);
  const supplier = ensuredSupplier.supplier;
  const stored = await storagePut(`price-imports/${supplier.id}/${Date.now()}_${input.fileName}`, input.buffer, sourceMimeType(preview.sourceType));
  const [inserted] = await db.insert(priceImports).values({ supplierId: supplier.id, fileName: input.fileName, fileKey: stored.key, sourceDate: input.sourceDate || preview.detectedSourceDate, sourceType: preview.sourceType, status: "completed", rowCount: preparedRows.rows.length, importedByAccountId: input.actorId }).$returningId();
  const aliases = await db.select({ supplierId: priceSupplierAliases.supplierId, productId: priceSupplierAliases.productId, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature }).from(priceSupplierAliases).where(eq(priceSupplierAliases.supplierId, supplier.id));
  const products = await db.select({ id: priceProducts.id, normalizedSignature: priceProducts.normalizedSignature }).from(priceProducts).where(eq(priceProducts.isActive, true));
  let linked = 0, suggested = 0, createdProducts = 0, categorizedRows = 0, explicitlyLinked = 0;
  const createdProductDetails: Array<{ productName: string; internalCode: string; categoryName: string | null }> = [];
  const createdAliasDetails: Array<{ supplierProductName: string; productLabel: string; packaging: string | null }> = [];
  for (const { rowIndex, row } of preparedRows.rows) {
    const category = categoryMap.get(categoryByRow.get(rowIndex) ?? -1);
    const selectedProductId = productByRow.get(rowIndex);
    let mapping = selectedProductId
      ? { productId: selectedProductId, mappingStatus: "linked" as const, matchedBy: "supplier_alias" as const, matchConfidence: 100 }
      : resolvePriceMapping(row, supplier.id, aliases, products);
    if (selectedProductId) {
      const product = explicitProductMap.get(selectedProductId)!;
      await db.insert(priceSupplierAliases).values({ supplierId: supplier.id, productId: product.id, normalizedName: row.normalizedName, sourceSku: row.sourceSku, packagingSignature: row.packagingSignature, isConfirmed: true, createdByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { productId: product.id, sourceSku: row.sourceSku, isConfirmed: true, createdByAccountId: input.actorId } });
      aliases.push({ supplierId: supplier.id, productId: product.id, normalizedName: row.normalizedName, packagingSignature: row.packagingSignature });
      createdAliasDetails.push({ supplierProductName: row.rawName, productLabel: `${product.canonicalName} · выбран вручную`, packaging: row.packaging });
      explicitlyLinked += 1;
    }
    if (mapping.productId === null && category) {
      const product = await createPriceProduct({
        canonicalName: row.canonicalHint,
        categoryId: category.id,
        placeContents: row.placeContents,
      });
      products.push({ id: product.id, normalizedSignature: product.normalizedSignature });
      aliases.push({ supplierId: supplier.id, productId: product.id, normalizedName: row.normalizedName, packagingSignature: row.packagingSignature });
      await db.insert(priceSupplierAliases).values({ supplierId: supplier.id, productId: product.id, normalizedName: row.normalizedName, sourceSku: row.sourceSku, packagingSignature: row.packagingSignature, isConfirmed: true, createdByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { productId: product.id, sourceSku: row.sourceSku, isConfirmed: true, createdByAccountId: input.actorId } });
      mapping = { productId: product.id, mappingStatus: "linked", matchedBy: "new_product", matchConfidence: 100 };
      createdProducts += 1;
      categorizedRows += 1;
      createdProductDetails.push({ productName: product.canonicalName, internalCode: product.internalCode, categoryName: category.name });
      createdAliasDetails.push({ supplierProductName: row.rawName, productLabel: `${product.canonicalName} · ${product.internalCode}`, packaging: row.packaging });
    }
    if (mapping.mappingStatus === "linked") linked += 1;
    if (mapping.mappingStatus === "suggested") suggested += 1;
    const [rowInserted] = await db.insert(priceImportRows).values({ importId: inserted.id, sourceSheet: row.sourceSheet, sourceRowNumber: row.sourceRowNumber, sourceSku: row.sourceSku, rawName: row.rawName, normalizedName: row.normalizedName, rawCategory: row.category, rawPackaging: row.packaging, manufacturer: row.manufacturer, placeContents: row.placeContents, manufacturedOn: row.manufacturedOn, shelfLifeMonths: row.shelfLifeMonths, expiresOn: row.expiresOn, rawAvailability: row.availability, rawPayload: row.rawPayload, productId: mapping.productId, mappingStatus: mapping.mappingStatus, matchedBy: mapping.matchedBy, matchConfidence: mapping.matchConfidence === null ? null : mapping.matchConfidence.toFixed(2) }).$returningId();
    const storedOptions = row.priceOptions.filter((option): option is ParsedPriceOption & { priceAmount: number } => option.priceAmount !== null);
    if (storedOptions.length) await db.insert(priceOfferPrices).values(storedOptions.map(option => ({ importRowId: rowInserted.id, priceMode: canonicalPriceMode(option.priceMode), market: option.market, priceAmount: option.priceAmount.toFixed(2), priceBasis: option.priceBasis, normalizedPrice: option.normalizedPrice === null ? null : option.normalizedPrice.toFixed(2), normalizedUnit: option.normalizedUnit, minimumQuantityKg: option.minimumQuantityKg === null ? null : option.minimumQuantityKg.toFixed(2), includesVat: option.includesVat, sourcePriceText: option.sourcePriceText })));
  }
  return { importId: inserted.id, supplier: { id: supplier.id, name: supplier.name }, supplierWasCreated: ensuredSupplier.created, rowCount: preparedRows.rows.length, linked, suggested, unmapped: preparedRows.rows.length - linked - suggested, createdProducts, createdProductDetails, createdAliasDetails, categorizedRows, explicitlyLinked, warningCount: preview.warningCount, excludedRows: preparedRows.excludedRowIndexes.length, editedPriceOptions: preparedRows.editedPriceOptions, addedPriceOptions: preparedRows.addedPriceOptions, removedPriceOptions: preparedRows.removedPriceOptions, editedNames: preparedRows.editedNames, editedMetadata: preparedRows.editedMetadata };
}
function sourceMimeType(sourceType: PriceImportPreview["sourceType"]) { return sourceType === "pdf" ? "application/pdf" : sourceType === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.ms-excel"; }
export async function listPriceControlData() {
  const db = await getDb(); if (!db) return emptyPriceData();
  const [suppliers, categories, characteristics, products, imports, rows, aliases] = await Promise.all([
    db.select().from(priceSuppliers).orderBy(priceSuppliers.name),
    db.select().from(priceCategories).orderBy(priceCategories.name),
    db.select().from(priceProductCharacteristics).orderBy(priceProductCharacteristics.kind, priceProductCharacteristics.value),
    db.select({ id: priceProducts.id, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName, normalizedSignature: priceProducts.normalizedSignature, categoryId: priceProducts.categoryId, legacyCategory: priceProducts.category, categoryName: priceCategories.name, categoryIsActive: priceCategories.isActive, variantCharacteristicId: priceProducts.variantCharacteristicId, sizeCharacteristicId: priceProducts.sizeCharacteristicId, placeContentsCharacteristicId: priceProducts.placeContentsCharacteristicId, variant: priceProducts.variant, sizeText: priceProducts.sizeText, placeContents: priceProducts.placeContents, baseUnit: priceProducts.baseUnit, isActive: priceProducts.isActive }).from(priceProducts).leftJoin(priceCategories, eq(priceProducts.categoryId, priceCategories.id)).orderBy(priceProducts.canonicalName),
    db.select({ id: priceImports.id, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, fileName: priceImports.fileName, fileKey: priceImports.fileKey, sourceDate: priceImports.sourceDate, sourceType: priceImports.sourceType, rowCount: priceImports.rowCount, createdAt: priceImports.createdAt }).from(priceImports).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).orderBy(desc(priceImports.createdAt)).limit(50),
    db.select({ rowId: priceImportRows.id, importId: priceImportRows.importId, productId: priceImportRows.productId, rawName: priceImportRows.rawName, rawCategory: priceImportRows.rawCategory, rawPackaging: priceImportRows.rawPackaging, manufacturer: priceImportRows.manufacturer, placeContents: priceImportRows.placeContents, manufacturedOn: priceImportRows.manufacturedOn, shelfLifeMonths: priceImportRows.shelfLifeMonths, expiresOn: priceImportRows.expiresOn, mappingStatus: priceImportRows.mappingStatus, matchedBy: priceImportRows.matchedBy, matchConfidence: priceImportRows.matchConfidence, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, sourceDate: priceImports.sourceDate, importedAt: priceImports.createdAt, productName: priceProducts.canonicalName, internalCode: priceProducts.internalCode, priceId: priceOfferPrices.id, priceMode: priceOfferPrices.priceMode, market: priceOfferPrices.market, priceAmount: priceOfferPrices.priceAmount, priceBasis: priceOfferPrices.priceBasis, normalizedPrice: priceOfferPrices.normalizedPrice, normalizedUnit: priceOfferPrices.normalizedUnit, minimumQuantityKg: priceOfferPrices.minimumQuantityKg, sourcePriceText: priceOfferPrices.sourcePriceText }).from(priceImportRows).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id)).leftJoin(priceOfferPrices, eq(priceOfferPrices.importRowId, priceImportRows.id)).orderBy(desc(priceImports.createdAt)).limit(10000),
    db.select({ aliasId: priceSupplierAliases.id, supplierId: priceSupplierAliases.supplierId, supplierName: priceSuppliers.name, productId: priceSupplierAliases.productId, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature, updatedAt: priceSupplierAliases.updatedAt }).from(priceSupplierAliases).innerJoin(priceSuppliers, eq(priceSupplierAliases.supplierId, priceSuppliers.id)).innerJoin(priceProducts, eq(priceSupplierAliases.productId, priceProducts.id)).orderBy(priceSuppliers.name, priceSupplierAliases.normalizedName).limit(500),
  ]);
  const catalogProducts = products.map(product => ({ ...product, category: product.categoryName ?? product.legacyCategory, categoryIsActive: product.categoryIsActive ?? true }));
  const repairableVariants = catalogProducts
    .map(product => ({ id: product.id, canonicalName: product.canonicalName, variant: extractVariant(product.canonicalName) }))
    .filter((product): product is { id: number; canonicalName: string; variant: string } => Boolean(product.variant) && !catalogProducts.find(item => item.id === product.id)?.variant);
  const knownPlaceContents = new Set(
    characteristics
      .filter(item => item.kind === "place_contents")
      .map(item => item.normalizedValue)
  );
  const repairablePlaceContents = Array.from(
    new Set(
      rows
        .map(row => normalizeCharacteristicDisplay("place_contents", row.placeContents ?? ""))
        .filter(Boolean)
    )
  ).filter(value => !knownPlaceContents.has(normalizeCharacteristicValue(value))).sort();
  const productMap = new Map(catalogProducts.map(product => [product.id, product]));
  const priceChangeSources = rows.flatMap(row => row.priceId !== null && row.productId !== null && row.normalizedPrice !== null && row.normalizedUnit !== null ? [{ priceId: row.priceId, importId: row.importId, productId: row.productId, supplierId: row.supplierId, priceMode: row.priceMode, market: row.market, normalizedUnit: row.normalizedUnit, normalizedPrice: row.normalizedPrice, sourceDate: row.sourceDate, importedAt: row.importedAt }] : []);
  const priceChanges = calculatePriceChanges(priceChangeSources);
  const latestOffer = new Map<string, typeof rows[number]>();
  rows.filter(row => row.productId && row.priceId && row.normalizedPrice !== null).forEach(row => {
    const key = `${row.productId}:${row.supplierId}:${resolvePriceMarket(row.market, row.priceMode)}:${canonicalPriceMode(row.priceMode)}:${row.normalizedUnit}`;
    if (!latestOffer.has(key)) latestOffer.set(key, row);
  });
  const groups = new Map<number, Array<typeof rows[number]>>();
  latestOffer.forEach(row => { const items = groups.get(row.productId!) ?? []; items.push(row); groups.set(row.productId!, items); });
  const comparisons = Array.from(groups.entries()).map(([productId, offers]) => {
    const product = productMap.get(productId)!;
    const comparable = offers.filter(offer => offer.normalizedPrice !== null && offer.normalizedUnit !== "unknown").sort((a, b) => Number(a.normalizedPrice) - Number(b.normalizedPrice));
    const best = comparable[0]; const next = comparable.find(offer => offer.supplierId !== best?.supplierId && offer.normalizedUnit === best?.normalizedUnit && resolvePriceMarket(offer.market, offer.priceMode) === resolvePriceMarket(best?.market, best?.priceMode) && canonicalPriceMode(offer.priceMode) === canonicalPriceMode(best?.priceMode));
    const savings = best && next ? Number(next.normalizedPrice) - Number(best.normalizedPrice) : null;
    return { product: { id: product.id, internalCode: product.internalCode, canonicalName: product.canonicalName, categoryId: product.categoryId, category: product.category, categoryIsActive: product.categoryIsActive, variantCharacteristicId: product.variantCharacteristicId, sizeCharacteristicId: product.sizeCharacteristicId, placeContentsCharacteristicId: product.placeContentsCharacteristicId, variant: product.variant, sizeText: product.sizeText, placeContents: product.placeContents, baseUnit: product.baseUnit, isActive: product.isActive }, offers: comparable.map(offer => ({ importId: offer.importId, rowId: offer.rowId, priceId: offer.priceId, supplierId: offer.supplierId, supplierName: offer.supplierName, rawName: offer.rawName, packaging: offer.rawPackaging, manufacturer: offer.manufacturer, placeContents: offer.placeContents, manufacturedOn: offer.manufacturedOn, shelfLifeMonths: offer.shelfLifeMonths, expiresOn: offer.expiresOn, sourceDate: offer.sourceDate, priceMode: canonicalPriceMode(offer.priceMode), market: resolvePriceMarket(offer.market, offer.priceMode), priceAmount: Number(offer.priceAmount), priceBasis: offer.priceBasis, normalizedPrice: Number(offer.normalizedPrice), normalizedUnit: offer.normalizedUnit, minimumQuantityKg: offer.minimumQuantityKg === null ? null : Number(offer.minimumQuantityKg), sourcePriceText: offer.sourcePriceText, priceChange: offer.priceId === null ? null : priceChanges.get(offer.priceId) ?? null })), recommendation: best && next && savings !== null ? { supplierId: best.supplierId, supplierName: best.supplierName, normalizedPrice: Number(best.normalizedPrice), normalizedUnit: best.normalizedUnit as "kg" | "l" | "piece", savings, savingsPercent: Number(((savings / Number(next.normalizedPrice)) * 100).toFixed(1)) } : null };
  }).sort((a, b) => (b.recommendation?.savings ?? 0) - (a.recommendation?.savings ?? 0));
  const unmappedRows = rows.filter(row => row.mappingStatus !== "linked").slice(0, 100).map(row => ({ rowId: row.rowId, importId: row.importId, supplierId: row.supplierId, supplierName: row.supplierName, rawName: row.rawName, rawCategory: row.rawCategory, rawPackaging: row.rawPackaging, manufacturer: row.manufacturer, placeContents: row.placeContents, mappingStatus: row.mappingStatus, matchedBy: row.matchedBy, matchConfidence: row.matchConfidence === null ? null : Number(row.matchConfidence), suggestedProduct: row.productId ? { id: row.productId, name: row.productName, internalCode: row.internalCode } : null }));
  const history = rows.filter(row => row.productId && row.priceId && row.normalizedPrice !== null && row.normalizedUnit !== "unknown").map(row => ({ priceId: row.priceId!, productId: row.productId!, supplierId: row.supplierId, supplierName: row.supplierName, date: row.sourceDate || row.importedAt.toISOString().slice(0, 10), rawName: row.rawName, packaging: row.rawPackaging, manufacturer: row.manufacturer, placeContents: row.placeContents, priceAmount: Number(row.priceAmount), priceBasis: row.priceBasis, sourceDate: row.sourceDate, sourcePriceText: row.sourcePriceText, normalizedPrice: Number(row.normalizedPrice), normalizedUnit: row.normalizedUnit, priceMode: canonicalPriceMode(row.priceMode), market: resolvePriceMarket(row.market, row.priceMode), priceChange: priceChanges.get(row.priceId!) ?? null }));
  const previewMap = new Map(imports.map(item => [item.id, { importId: item.id, rows: [] as Array<{ rowId: number; rawName: string; rawCategory: string | null; rawPackaging: string | null; manufacturer: string | null; placeContents: string | null; productName: string | null; priceAmount: number | null }> }]));
  const previewSeen = new Set<number>();
  rows.forEach(row => {
    if (previewSeen.has(row.rowId)) return;
    previewSeen.add(row.rowId);
    const preview = previewMap.get(row.importId);
    if (preview) preview.rows.push({ rowId: row.rowId, rawName: row.rawName, rawCategory: row.rawCategory, rawPackaging: row.rawPackaging, manufacturer: row.manufacturer, placeContents: row.placeContents, productName: row.productName, priceAmount: row.priceAmount === null ? null : Number(row.priceAmount) });
  });
  return { suppliers, categories, characteristics, products: catalogProducts, imports, comparisons, unmappedRows, aliases, history, importPreviews: Array.from(previewMap.values()), repairableVariants: { count: repairableVariants.length, values: Array.from(new Set(repairableVariants.map(product => product.variant))).sort() }, repairablePlaceContents: { count: repairablePlaceContents.length, values: repairablePlaceContents } };
}
function emptyPriceData() { return { suppliers: [], categories: [], characteristics: [], products: [], imports: [], comparisons: [], unmappedRows: [], aliases: [], history: [], importPreviews: [], repairableVariants: { count: 0, values: [] as string[] }, repairablePlaceContents: { count: 0, values: [] as string[] } }; }

export async function listSignificantPriceIncreases(importId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ priceId: priceOfferPrices.id, importId: priceImportRows.importId, productId: priceImportRows.productId, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, productName: priceProducts.canonicalName, priceMode: priceOfferPrices.priceMode, market: priceOfferPrices.market, normalizedUnit: priceOfferPrices.normalizedUnit, normalizedPrice: priceOfferPrices.normalizedPrice, sourceDate: priceImports.sourceDate, importedAt: priceImports.createdAt }).from(priceOfferPrices).innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id)).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id));
  const changes = calculatePriceChanges(rows.filter((row): row is typeof row & { priceId: number; productId: number; normalizedPrice: NonNullable<typeof row.normalizedPrice>; normalizedUnit: NonNullable<typeof row.normalizedUnit> } => row.productId !== null && row.normalizedPrice !== null && row.normalizedUnit !== null));
  const unique = new Map<string, { supplierName: string; productName: string; percent: number }>();
  rows.filter(row => row.importId === importId && row.productId !== null && row.productName).forEach(row => {
    const change = changes.get(row.priceId);
    if (!change || change.direction !== "up" || change.percent < SIGNIFICANT_PRICE_INCREASE_PERCENT) return;
    const key = `${row.supplierId}:${row.productId}`;
    const existing = unique.get(key);
    if (!existing || change.percent > existing.percent) unique.set(key, { supplierName: row.supplierName, productName: row.productName!, percent: change.percent });
  });
  return Array.from(unique.values()).sort((left, right) => right.percent - left.percent);
}

export async function getPriceImportDownload(importId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [record] = await db.select({ fileKey: priceImports.fileKey, fileName: priceImports.fileName }).from(priceImports).where(eq(priceImports.id, importId)).limit(1);
  if (!record) throw new Error("Прайс‑лист не найден.");
  const stored = await storageGet(record.fileKey);
  return { fileName: record.fileName, url: stored.url };
}
function productCodeFromSignature(signature: string) { return `PRC-${createHash("sha1").update(signature).digest("hex").slice(0, 8).toUpperCase()}`; }
async function getPriceCategory(categoryId: number | null | undefined) {
  if (!categoryId) return null;
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [category] = await db.select().from(priceCategories).where(eq(priceCategories.id, categoryId)).limit(1);
  if (!category) throw new Error("Категория прайс‑контроля не найдена.");
  return category;
}

async function findPriceProductCharacteristic(kind: PriceCharacteristicKind, id: number | null | undefined) {
  if (!id) return null;
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [characteristic] = await db.select().from(priceProductCharacteristics).where(and(eq(priceProductCharacteristics.id, id), eq(priceProductCharacteristics.kind, kind))).limit(1);
  if (!characteristic) throw new Error("Характеристика товара не найдена или имеет другой тип.");
  return characteristic;
}

async function ensurePriceProductCharacteristic(kind: PriceCharacteristicKind, rawValue: string | null | undefined) {
  const value = normalizeCharacteristicDisplay(kind, text(rawValue || ""));
  if (!value) return null;
  if (value.length > 160) throw new Error("Характеристика товара слишком длинная.");
  const normalizedValue = normalizeCharacteristicValue(value);
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [existing] = await db.select().from(priceProductCharacteristics).where(and(eq(priceProductCharacteristics.kind, kind), eq(priceProductCharacteristics.normalizedValue, normalizedValue))).limit(1);
  if (existing) return existing;
  const [inserted] = await db.insert(priceProductCharacteristics).values({ kind, value, normalizedValue }).$returningId();
  const [created] = await db.select().from(priceProductCharacteristics).where(eq(priceProductCharacteristics.id, inserted.id)).limit(1);
  return created!;
}

export async function createPriceProductCharacteristic(input: { kind: PriceCharacteristicKind; value: string }) {
  const value = text(input.value);
  if (value.length < 1 || value.length > 160) throw new Error("Укажите характеристику товара: от 1 до 160 символов.");
  return ensurePriceProductCharacteristic(input.kind, value);
}

/** Repairs only empty variant fields when an already saved canonical name contains a recognized variant. */
export async function repairRecognizedPriceProductVariants() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const products = await db
    .select({ id: priceProducts.id, canonicalName: priceProducts.canonicalName, variant: priceProducts.variant, variantCharacteristicId: priceProducts.variantCharacteristicId })
    .from(priceProducts);
  const candidates = products
    .map(product => ({ ...product, nextVariant: product.variant ? null : extractVariant(product.canonicalName) }))
    .filter((product): product is typeof product & { nextVariant: string } => Boolean(product.nextVariant));
  const recognizedVariants = Array.from(new Set(candidates.map(product => product.nextVariant))).sort();
  const variants: string[] = [];
  for (const product of candidates) {
    const variant = await ensurePriceProductCharacteristic("variant", product.nextVariant);
    if (!variant) continue;
    await db
      .update(priceProducts)
      .set({ variantCharacteristicId: variant.id, variant: variant.value })
      .where(eq(priceProducts.id, product.id));
    variants.push(variant.value);
  }
  return { updated: variants.length, variants: Array.from(new Set(variants)).sort(), recognizedVariants };
}

/** Adds only missing reusable place contents found in saved supplier offers. It never changes a product or its links. */
export async function seedPriceOfferPlaceContentsCharacteristics() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [rows, characteristics] = await Promise.all([
    db.select({ placeContents: priceImportRows.placeContents }).from(priceImportRows),
    db.select({ normalizedValue: priceProductCharacteristics.normalizedValue })
      .from(priceProductCharacteristics)
      .where(eq(priceProductCharacteristics.kind, "place_contents")),
  ]);
  const values = Array.from(
    new Set(
      rows
        .map(row => normalizeCharacteristicDisplay("place_contents", row.placeContents ?? ""))
        .filter(Boolean)
    )
  ).sort();
  const existing = new Set(characteristics.map(item => item.normalizedValue));
  const missing = values.filter(value => !existing.has(normalizeCharacteristicValue(value)));
  const created: string[] = [];
  for (const value of missing) {
    const characteristic = await ensurePriceProductCharacteristic("place_contents", value);
    if (characteristic) created.push(characteristic.value);
  }
  return { scanned: values.length, created: Array.from(new Set(created)).sort() };
}

export async function updatePriceProductCharacteristic(input: { id: number; value: string; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const value = text(input.value);
  if (value.length < 1 || value.length > 160) throw new Error("Укажите характеристику товара: от 1 до 160 символов.");
  const [current] = await db.select().from(priceProductCharacteristics).where(eq(priceProductCharacteristics.id, input.id)).limit(1);
  if (!current) throw new Error("Характеристика товара не найдена.");
  const normalizedValue = normalizeCharacteristicValue(value);
  const [conflict] = await db.select({ id: priceProductCharacteristics.id }).from(priceProductCharacteristics).where(and(eq(priceProductCharacteristics.kind, current.kind), eq(priceProductCharacteristics.normalizedValue, normalizedValue))).limit(1);
  if (conflict && conflict.id !== input.id) throw new Error("Такая характеристика уже есть в справочнике.");
  await db.update(priceProductCharacteristics).set({ value, normalizedValue, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }).where(eq(priceProductCharacteristics.id, input.id));
  const [updated] = await db.select().from(priceProductCharacteristics).where(eq(priceProductCharacteristics.id, input.id)).limit(1);
  return updated!;
}

export async function getPriceProductCharacteristicAuditState(id: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [characteristic] = await db.select({ kind: priceProductCharacteristics.kind, value: priceProductCharacteristics.value, isActive: priceProductCharacteristics.isActive }).from(priceProductCharacteristics).where(eq(priceProductCharacteristics.id, id)).limit(1);
  return characteristic ?? null;
}

export async function getPriceProductAuditState(productId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select({
    productName: priceProducts.canonicalName, internalCode: priceProducts.internalCode,
    categoryName: priceCategories.name, legacyCategory: priceProducts.category,
    variant: priceProducts.variant, packaging: priceProducts.sizeText, placeContents: priceProducts.placeContents,
    baseUnit: priceProducts.baseUnit, isActive: priceProducts.isActive,
  }).from(priceProducts).leftJoin(priceCategories, eq(priceProducts.categoryId, priceCategories.id)).where(eq(priceProducts.id, productId)).limit(1);
  if (!product) return null;
  return { productName: product.productName, internalCode: product.internalCode, categoryName: product.categoryName ?? product.legacyCategory ?? null, variant: product.variant, packaging: product.packaging, placeContents: product.placeContents, baseUnit: product.baseUnit, isActive: product.isActive };
}

export async function getPriceCategoryAuditState(categoryId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [category] = await db.select({ categoryName: priceCategories.name, isActive: priceCategories.isActive }).from(priceCategories).where(eq(priceCategories.id, categoryId)).limit(1);
  return category ?? null;
}

export async function getPriceSupplierAuditState(supplierId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [supplier] = await db.select({ supplierName: priceSuppliers.name, contactNote: priceSuppliers.contactNote, isActive: priceSuppliers.isActive }).from(priceSuppliers).where(eq(priceSuppliers.id, supplierId)).limit(1);
  return supplier ?? null;
}

export async function getPriceOfferAuditState(priceId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [offer] = await db.select({
    supplierName: priceSuppliers.name, supplierProductName: priceImportRows.rawName,
    packaging: priceImportRows.rawPackaging, manufacturer: priceImportRows.manufacturer,
    placeContents: priceImportRows.placeContents, manufacturedOn: priceImportRows.manufacturedOn, shelfLifeMonths: priceImportRows.shelfLifeMonths, expiresOn: priceImportRows.expiresOn, priceMode: priceOfferPrices.priceMode,
    market: priceOfferPrices.market,
    priceAmount: priceOfferPrices.priceAmount, priceBasis: priceOfferPrices.priceBasis,
    normalizedPrice: priceOfferPrices.normalizedPrice, normalizedUnit: priceOfferPrices.normalizedUnit,
  }).from(priceOfferPrices).innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id)).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).where(eq(priceOfferPrices.id, priceId)).limit(1);
  return offer ? { ...offer, priceAmount: Number(offer.priceAmount), normalizedPrice: offer.normalizedPrice === null ? null : Number(offer.normalizedPrice) } : null;
}

export async function getPriceImportAuditState(importId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [record] = await db.select({ fileName: priceImports.fileName, supplierName: priceSuppliers.name, sourceDate: priceImports.sourceDate, sourceType: priceImports.sourceType, rowCount: priceImports.rowCount }).from(priceImports).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).where(eq(priceImports.id, importId)).limit(1);
  return record ?? null;
}

export async function getPriceImportRowAuditState(rowId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select({
    importId: priceImportRows.importId,
    fileName: priceImports.fileName,
    supplierName: priceSuppliers.name,
    rawName: priceImportRows.rawName,
    rawPackaging: priceImportRows.rawPackaging,
    productName: priceProducts.canonicalName,
  }).from(priceImportRows).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id)).where(eq(priceImportRows.id, rowId)).limit(1);
  return row ?? null;
}

export async function getPriceProductsAuditStates(productIds: number[]) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  if (!productIds.length) return [];
  const products = await db.select({ productName: priceProducts.canonicalName, internalCode: priceProducts.internalCode, categoryName: priceCategories.name, legacyCategory: priceProducts.category }).from(priceProducts).leftJoin(priceCategories, eq(priceProducts.categoryId, priceCategories.id)).where(inArray(priceProducts.id, productIds));
  return products.map(product => ({ productName: product.productName, internalCode: product.internalCode, categoryName: product.categoryName ?? product.legacyCategory ?? null }));
}

export async function createPriceCategory(input: { name: string }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const name = text(input.name); const normalizedName = normalizeCategoryName(name);
  if (name.length < 2 || !normalizedName) throw new Error("Укажите название категории.");
  const [existing] = await db.select().from(priceCategories).where(eq(priceCategories.normalizedName, normalizedName)).limit(1);
  if (existing) return existing;
  const [inserted] = await db.insert(priceCategories).values({ name, normalizedName }).$returningId();
  const [category] = await db.select().from(priceCategories).where(eq(priceCategories.id, inserted.id)).limit(1);
  return category!;
}

export async function updatePriceCategory(input: { id: number; name: string; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const name = text(input.name); const normalizedName = normalizeCategoryName(name);
  if (name.length < 2 || !normalizedName) throw new Error("Укажите название категории.");
  const [conflict] = await db.select({ id: priceCategories.id }).from(priceCategories).where(eq(priceCategories.normalizedName, normalizedName)).limit(1);
  if (conflict && conflict.id !== input.id) throw new Error("Категория с таким названием уже существует.");
  await db.update(priceCategories).set({ name, normalizedName, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }).where(eq(priceCategories.id, input.id));
  const [category] = await db.select().from(priceCategories).where(eq(priceCategories.id, input.id)).limit(1);
  if (!category) throw new Error("Категория прайс‑контроля не найдена.");
  return category;
}

export async function createPriceProduct(input: { canonicalName: string; internalCode?: string; categoryId?: number | null; category?: string | null; variantCharacteristicId?: number | null; sizeCharacteristicId?: number | null; placeContentsCharacteristicId?: number | null; variant?: string | null; sizeText?: string | null; placeContents?: string | null; baseUnit?: NormalizedUnit; defaultWeightGrams?: number | null; defaultVolumeMl?: number | null; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const canonicalName = text(input.canonicalName); const signature = productSignature(canonicalName);
  const category = await getPriceCategory(input.categoryId);
  const [existing] = await db.select().from(priceProducts).where(eq(priceProducts.normalizedSignature, signature)).limit(1);
  if (existing) return existing;
  const internalCode = text(input.internalCode || productCodeFromSignature(signature)).toUpperCase();
  const variant = input.variantCharacteristicId === undefined ? await ensurePriceProductCharacteristic("variant", input.variant || extractVariant(canonicalName)) : await findPriceProductCharacteristic("variant", input.variantCharacteristicId);
  const size = input.sizeCharacteristicId === undefined ? await ensurePriceProductCharacteristic("size", input.sizeText || extractSizeText(canonicalName)) : await findPriceProductCharacteristic("size", input.sizeCharacteristicId);
  const placeContents = input.placeContentsCharacteristicId === undefined ? await ensurePriceProductCharacteristic("place_contents", input.placeContents) : await findPriceProductCharacteristic("place_contents", input.placeContentsCharacteristicId);
  const [inserted] = await db.insert(priceProducts).values({ internalCode, canonicalName, normalizedSignature: signature, categoryId: category?.id ?? null, category: category?.name ?? (input.category || null), variantCharacteristicId: variant?.id ?? null, sizeCharacteristicId: size?.id ?? null, placeContentsCharacteristicId: placeContents?.id ?? null, variant: variant?.value ?? null, sizeText: size?.value ?? null, placeContents: placeContents?.value ?? null, baseUnit: input.baseUnit || "unknown", defaultWeightGrams: input.defaultWeightGrams === null || input.defaultWeightGrams === undefined ? null : input.defaultWeightGrams.toFixed(2), defaultVolumeMl: input.defaultVolumeMl === null || input.defaultVolumeMl === undefined ? null : input.defaultVolumeMl.toFixed(2), isActive: input.isActive ?? true }).$returningId();
  const [created] = await db.select().from(priceProducts).where(eq(priceProducts.id, inserted.id)).limit(1);
  return created!;
}

export async function updatePriceProduct(input: { id: number; canonicalName: string; internalCode: string; categoryId?: number | null; category?: string | null; variantCharacteristicId?: number | null; sizeCharacteristicId?: number | null; placeContentsCharacteristicId?: number | null; variant?: string | null; sizeText?: string | null; placeContents?: string | null; baseUnit?: NormalizedUnit; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const canonicalName = text(input.canonicalName); const internalCode = text(input.internalCode).toUpperCase();
  if (canonicalName.length < 2 || internalCode.length < 3) throw new Error("Укажите эталонное название и внутренний код товара.");
  const signature = productSignature(canonicalName);
  const category = await getPriceCategory(input.categoryId);
  const [signatureConflict] = await db.select({ id: priceProducts.id }).from(priceProducts).where(eq(priceProducts.normalizedSignature, signature)).limit(1);
  if (signatureConflict && signatureConflict.id !== input.id) throw new Error("Товар с такой нормализованной сигнатурой уже существует.");
  const [codeConflict] = await db.select({ id: priceProducts.id }).from(priceProducts).where(eq(priceProducts.internalCode, internalCode)).limit(1);
  if (codeConflict && codeConflict.id !== input.id) throw new Error("Такой внутренний код уже используется другим товаром.");
  const [current] = await db.select({ variantCharacteristicId: priceProducts.variantCharacteristicId, sizeCharacteristicId: priceProducts.sizeCharacteristicId, placeContentsCharacteristicId: priceProducts.placeContentsCharacteristicId, variant: priceProducts.variant, sizeText: priceProducts.sizeText, placeContents: priceProducts.placeContents }).from(priceProducts).where(eq(priceProducts.id, input.id)).limit(1);
  if (!current) throw new Error("Внутренний товар не найден.");
  const variant = input.variantCharacteristicId === undefined
    ? input.variant === undefined ? { id: current.variantCharacteristicId, value: current.variant } : await ensurePriceProductCharacteristic("variant", input.variant)
    : await findPriceProductCharacteristic("variant", input.variantCharacteristicId);
  const size = input.sizeCharacteristicId === undefined
    ? input.sizeText === undefined ? { id: current.sizeCharacteristicId, value: current.sizeText } : await ensurePriceProductCharacteristic("size", input.sizeText)
    : await findPriceProductCharacteristic("size", input.sizeCharacteristicId);
  const placeContents = input.placeContentsCharacteristicId === undefined
    ? input.placeContents === undefined ? { id: current.placeContentsCharacteristicId, value: current.placeContents } : await ensurePriceProductCharacteristic("place_contents", input.placeContents)
    : await findPriceProductCharacteristic("place_contents", input.placeContentsCharacteristicId);
  await db.update(priceProducts).set({ canonicalName, internalCode, normalizedSignature: signature, categoryId: category?.id ?? input.categoryId ?? null, category: category?.name ?? (text(input.category || "") || null), variantCharacteristicId: variant?.id ?? null, sizeCharacteristicId: size?.id ?? null, placeContentsCharacteristicId: placeContents?.id ?? null, variant: variant?.value ?? null, sizeText: size?.value ?? null, placeContents: placeContents?.value ?? null, baseUnit: input.baseUnit || "unknown", ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }).where(eq(priceProducts.id, input.id));
  const [product] = await db.select().from(priceProducts).where(eq(priceProducts.id, input.id)).limit(1);
  if (!product) throw new Error("Внутренний товар не найден.");
  return product;
}

export async function bulkAssignPriceCategory(input: {
  productIds: number[];
  categoryId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const category = await getPriceCategory(input.categoryId);
  if (!category || !category.isActive) {
    throw new Error("Выберите активную категорию прайс‑контроля.");
  }
  const productIds = Array.from(
    new Set(input.productIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (!productIds.length) throw new Error("Выберите хотя бы один товар.");
  await db
    .update(priceProducts)
    .set({ categoryId: category.id, category: category.name })
    .where(inArray(priceProducts.id, productIds));
  return { updated: productIds.length, category: { id: category.id, name: category.name } };
}

export async function bulkSetPriceProductsActive(input: {
  productIds: number[];
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const productIds = Array.from(
    new Set(input.productIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (!productIds.length) throw new Error("Выберите хотя бы один товар.");
  await db
    .update(priceProducts)
    .set({ isActive: input.isActive })
    .where(inArray(priceProducts.id, productIds));
  return { updated: productIds.length, isActive: input.isActive };
}

function cleanProductIds(productIds: number[]) {
  return Array.from(new Set(productIds.filter(id => Number.isInteger(id) && id > 0)));
}

export async function getPriceOfferMarketAuditState(productIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const ids = cleanProductIds(productIds);
  if (!ids.length) return { offerCount: 0, markets: {} as Record<string, number> };
  const rows = await db
    .select({ market: priceOfferPrices.market, priceMode: priceOfferPrices.priceMode })
    .from(priceOfferPrices)
    .innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id))
    .where(inArray(priceImportRows.productId, ids));
  const markets = rows.reduce<Record<string, number>>((summary, row) => {
    const market = resolvePriceMarket(row.market, row.priceMode);
    summary[market] = (summary[market] ?? 0) + 1;
    return summary;
  }, {});
  return { offerCount: rows.length, markets };
}

export async function bulkSetPriceOfferMarketByProducts(input: {
  productIds: number[];
  market: PriceMarket;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const productIds = cleanProductIds(input.productIds);
  if (!productIds.length) throw new Error("Выберите хотя бы один товар.");
  const prices = await db
    .select({ id: priceOfferPrices.id })
    .from(priceOfferPrices)
    .innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id))
    .where(inArray(priceImportRows.productId, productIds));
  const priceIds = prices.map(price => price.id);
  if (priceIds.length) {
    await db
      .update(priceOfferPrices)
      .set({ market: input.market })
      .where(inArray(priceOfferPrices.id, priceIds));
  }
  return { updatedProducts: productIds.length, updatedOffers: priceIds.length, market: input.market };
}

export async function updatePriceSupplier(input: { id: number; name: string; contactNote?: string | null; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const name = text(input.name); if (name.length < 2) throw new Error("Укажите название поставщика.");
  const normalizedName = normalizeSupplierName(name);
  const [conflict] = await db.select({ id: priceSuppliers.id }).from(priceSuppliers).where(eq(priceSuppliers.normalizedName, normalizedName)).limit(1);
  if (conflict && conflict.id !== input.id) throw new Error("Поставщик с таким названием уже существует.");
  await db.update(priceSuppliers).set({ name, normalizedName, contactNote: text(input.contactNote || "") || null, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }).where(eq(priceSuppliers.id, input.id));
  const [supplier] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.id, input.id)).limit(1);
  if (!supplier) throw new Error("Поставщик не найден.");
  return supplier;
}

/** Stores a point-in-time offer without a source file while preserving the common comparison and history model. */
export async function createManualPriceOffer(input: {
  productId: number;
  supplierId: number;
  sourceDate: string;
  priceAmount: number;
  priceBasis: PriceBasis;
  priceMode?: PriceMode;
  market?: PriceMarket;
  manufacturer?: string | null;
  placeContents?: string | null;
  manufacturedOn?: string | null;
  shelfLifeMonths?: number | null;
  expiresOn?: string | null;
  actorId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (!Number.isFinite(input.priceAmount) || input.priceAmount <= 0 || input.priceAmount > 10_000_000) {
    throw new Error("Укажите цену от 0 до 10 000 000 ₽.");
  }
  const sourceDate = normalizeIsoDate(input.sourceDate);
  if (!sourceDate) throw new Error("Укажите дату ручного предложения.");
  const [product] = await db
    .select({ id: priceProducts.id, canonicalName: priceProducts.canonicalName, normalizedSignature: priceProducts.normalizedSignature, sizeText: priceProducts.sizeText, placeContents: priceProducts.placeContents, isActive: priceProducts.isActive })
    .from(priceProducts)
    .where(eq(priceProducts.id, input.productId))
    .limit(1);
  if (!product || !product.isActive) throw new Error("Активный внутренний товар не найден.");
  const [supplier] = await db
    .select({ id: priceSuppliers.id, isActive: priceSuppliers.isActive })
    .from(priceSuppliers)
    .where(eq(priceSuppliers.id, input.supplierId))
    .limit(1);
  if (!supplier || !supplier.isActive) throw new Error("Выберите активного поставщика.");

  const manufacturer = text(input.manufacturer || "") || null;
  const placeContents = normalizePlaceContents(input.placeContents) || product.placeContents || null;
  const manufacturedOn = normalizeIsoDate(input.manufacturedOn);
  const shelfLifeMonths = input.shelfLifeMonths === null || input.shelfLifeMonths === undefined ? null : Number(input.shelfLifeMonths);
  const expiresOn = calculatePriceOfferExpiry(manufacturedOn, shelfLifeMonths);
  if (
    (manufacturer !== null && manufacturer.length > 255) ||
    (placeContents !== null && placeContents.length > 255) ||
    (input.manufacturedOn !== null && input.manufacturedOn !== undefined && !manufacturedOn) ||
    (shelfLifeMonths !== null && !PRICE_SHELF_LIFE_MONTHS.includes(shelfLifeMonths as typeof PRICE_SHELF_LIFE_MONTHS[number])) ||
    (input.expiresOn !== null && input.expiresOn !== undefined && normalizeIsoDate(input.expiresOn) !== expiresOn)
  ) {
    throw new Error("Характеристика ручного предложения некорректна.");
  }
  const rawPackaging = product.sizeText || product.placeContents || null;
  const normalized = normalizePrice(input.priceAmount, input.priceBasis, rawPackaging);
  const [manualImport] = await db.insert(priceImports).values({
    supplierId: supplier.id,
    fileName: `Ручное предложение · ${product.canonicalName}`.slice(0, 255),
    fileKey: `manual://offer/${input.actorId}/${Date.now()}/${product.id}`,
    sourceDate,
    sourceType: "manual",
    status: "completed",
    rowCount: 1,
    importedByAccountId: input.actorId,
  }).$returningId();
  const [manualRow] = await db.insert(priceImportRows).values({
    importId: manualImport.id,
    sourceSheet: "manual",
    sourceRowNumber: 1,
    sourceSku: null,
    rawName: product.canonicalName,
    normalizedName: product.normalizedSignature,
    rawCategory: null,
    rawPackaging,
    manufacturer,
    placeContents,
    manufacturedOn,
    shelfLifeMonths,
    expiresOn,
    rawAvailability: null,
    rawPayload: { source: "manual" },
    productId: product.id,
    mappingStatus: "linked",
    matchedBy: "manual",
    matchConfidence: "100.00",
  }).$returningId();
  const [manualPrice] = await db.insert(priceOfferPrices).values({
    importRowId: manualRow.id,
    priceMode: canonicalPriceMode(input.priceMode),
    market: input.market ?? "unknown",
    priceAmount: input.priceAmount.toFixed(2),
    priceBasis: input.priceBasis,
    normalizedPrice: normalized.normalizedPrice === null ? null : normalized.normalizedPrice.toFixed(2),
    normalizedUnit: normalized.normalizedUnit,
    minimumQuantityKg: null,
    includesVat: canonicalPriceMode(input.priceMode) === "cashless_vat",
    sourcePriceText: "Введено вручную",
  }).$returningId();
  return { importId: manualImport.id, rowId: manualRow.id, priceId: manualPrice.id };
}
export async function setPriceSupplierActive(input: { id: number; isActive: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  await db.update(priceSuppliers).set({ isActive: input.isActive }).where(eq(priceSuppliers.id, input.id));
  const [supplier] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.id, input.id)).limit(1);
  if (!supplier) throw new Error("Поставщик не найден.");
  return supplier;
}
export async function deletePriceSupplier(supplierId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [supplier] = await db.select({ id: priceSuppliers.id, name: priceSuppliers.name }).from(priceSuppliers).where(eq(priceSuppliers.id, supplierId)).limit(1);
  if (!supplier) throw new Error("Поставщик не найден.");
  const [importRow] = await db.select({ id: priceImports.id }).from(priceImports).where(eq(priceImports.supplierId, supplierId)).limit(1);
  const [aliasRow] = await db.select({ id: priceSupplierAliases.id }).from(priceSupplierAliases).where(eq(priceSupplierAliases.supplierId, supplierId)).limit(1);
  if (importRow || aliasRow) throw new Error("Поставщика с сохраненными прайс‑листами или товарными связями удалять нельзя. Скройте его в справочнике — история останется доступна.");
  await db.delete(priceSuppliers).where(eq(priceSuppliers.id, supplierId));
  return { id: supplier.id, name: supplier.name };
}

export async function updatePriceOffer(input: { priceId: number; priceAmount: number; priceBasis: PriceBasis; priceMode?: PriceMode; market?: PriceMarket; manufacturer?: string | null; placeContents?: string | null; manufacturedOn?: string | null; shelfLifeMonths?: number | null; expiresOn?: string | null }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [price] = await db.select({ id: priceOfferPrices.id, importRowId: priceOfferPrices.importRowId, rawPackaging: priceImportRows.rawPackaging, priceMode: priceOfferPrices.priceMode, market: priceOfferPrices.market }).from(priceOfferPrices).innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id)).where(eq(priceOfferPrices.id, input.priceId)).limit(1);
  if (!price) throw new Error("Цена прайс‑листа не найдена.");
  const normalized = normalizePrice(input.priceAmount, input.priceBasis, price.rawPackaging);
  await db.update(priceOfferPrices).set({ priceAmount: input.priceAmount.toFixed(2), priceBasis: input.priceBasis, priceMode: canonicalPriceMode(input.priceMode ?? price.priceMode), market: input.market ?? resolvePriceMarket(price.market, price.priceMode), normalizedPrice: normalized.normalizedPrice === null ? null : normalized.normalizedPrice.toFixed(2), normalizedUnit: normalized.normalizedUnit }).where(eq(priceOfferPrices.id, input.priceId));
  if (input.manufacturer !== undefined || input.placeContents !== undefined || input.manufacturedOn !== undefined || input.shelfLifeMonths !== undefined || input.expiresOn !== undefined) {
    const manufacturer = input.manufacturer === undefined ? undefined : text(input.manufacturer || "") || null;
    const placeContents = input.placeContents === undefined ? undefined : normalizePlaceContents(input.placeContents) || null;
    const manufacturedOn = input.manufacturedOn === undefined ? undefined : normalizeIsoDate(input.manufacturedOn);
    const shelfLifeMonths = input.shelfLifeMonths === undefined || input.shelfLifeMonths === null ? input.shelfLifeMonths : Number(input.shelfLifeMonths);
    const expiresOn = manufacturedOn === undefined || shelfLifeMonths === undefined ? undefined : calculatePriceOfferExpiry(manufacturedOn, shelfLifeMonths);
    if ((manufacturer?.length ?? 0) > 255 || (placeContents?.length ?? 0) > 255 || (input.manufacturedOn !== undefined && input.manufacturedOn !== null && !manufacturedOn) || (shelfLifeMonths !== undefined && shelfLifeMonths !== null && !PRICE_SHELF_LIFE_MONTHS.includes(shelfLifeMonths as typeof PRICE_SHELF_LIFE_MONTHS[number])) || (input.expiresOn !== undefined && normalizeIsoDate(input.expiresOn) !== expiresOn)) throw new Error("Характеристика предложения некорректна.");
    await db.update(priceImportRows).set({ ...(manufacturer === undefined ? {} : { manufacturer }), ...(placeContents === undefined ? {} : { placeContents }), ...(manufacturedOn === undefined ? {} : { manufacturedOn }), ...(shelfLifeMonths === undefined ? {} : { shelfLifeMonths }), ...(expiresOn === undefined ? {} : { expiresOn }) }).where(eq(priceImportRows.id, price.importRowId));
  }
  return { success: true, normalized };
}

export async function updatePriceImportDate(input: { importId: number; sourceDate: string | null }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  await db.update(priceImports).set({ sourceDate: input.sourceDate }).where(eq(priceImports.id, input.importId));
  const [record] = await db.select({ id: priceImports.id, sourceDate: priceImports.sourceDate }).from(priceImports).where(eq(priceImports.id, input.importId)).limit(1);
  if (!record) throw new Error("Прайс‑лист не найден.");
  return record;
}

export async function linkPriceImportRow(input: { rowId: number; productId: number; actorId: number; saveAlias: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select({ id: priceImportRows.id, importId: priceImportRows.importId, normalizedName: priceImportRows.normalizedName, rawName: priceImportRows.rawName, rawPackaging: priceImportRows.rawPackaging, mappingStatus: priceImportRows.mappingStatus, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, previousProductName: priceProducts.canonicalName, previousInternalCode: priceProducts.internalCode }).from(priceImportRows).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id)).where(eq(priceImportRows.id, input.rowId)).limit(1);
  if (!row) throw new Error("Строка прайс‑листа не найдена.");
  const [product] = await db.select().from(priceProducts).where(eq(priceProducts.id, input.productId)).limit(1);
  if (!product) throw new Error("Внутренний товар не найден.");
  await db.update(priceImportRows).set({ productId: input.productId, mappingStatus: "linked", matchedBy: "manual", matchConfidence: "100.00" }).where(eq(priceImportRows.id, input.rowId));
  if (input.saveAlias) await db.insert(priceSupplierAliases).values({ supplierId: row.supplierId, productId: input.productId, normalizedName: row.normalizedName, packagingSignature: packagingSignature(row.rawPackaging), isConfirmed: true, createdByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { productId: input.productId, isConfirmed: true, createdByAccountId: input.actorId } });
  const beforeProduct = row.mappingStatus === "linked" && row.previousProductName ? `${row.previousProductName} · ${row.previousInternalCode}` : null;
  const afterProduct = `${product.canonicalName} · ${product.internalCode}`;
  const auditBase = { supplierName: row.supplierName, supplierProductName: row.rawName, packaging: row.rawPackaging, savedForFuture: input.saveAlias };
  return { success: true, product: { id: product.id, internalCode: product.internalCode, canonicalName: product.canonicalName }, audit: { before: { ...auditBase, productLabel: beforeProduct }, after: { ...auditBase, productLabel: afterProduct } } };
}
export async function reassignPriceSupplierAlias(input: { aliasId: number; productId: number }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select({ id: priceProducts.id, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName }).from(priceProducts).where(and(eq(priceProducts.id, input.productId), eq(priceProducts.isActive, true))).limit(1);
  if (!product) throw new Error("Внутренний товар не найден или отключен.");
  const [alias] = await db.select({ id: priceSupplierAliases.id, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature, supplierName: priceSuppliers.name, previousProductName: priceProducts.canonicalName, previousInternalCode: priceProducts.internalCode }).from(priceSupplierAliases).innerJoin(priceSuppliers, eq(priceSupplierAliases.supplierId, priceSuppliers.id)).innerJoin(priceProducts, eq(priceSupplierAliases.productId, priceProducts.id)).where(eq(priceSupplierAliases.id, input.aliasId)).limit(1);
  if (!alias) throw new Error("Подтвержденная связь поставщика не найдена.");
  await db.update(priceSupplierAliases).set({ productId: input.productId, isConfirmed: true }).where(eq(priceSupplierAliases.id, input.aliasId));
  const auditBase = { supplierName: alias.supplierName, supplierProductName: alias.normalizedName, packaging: alias.packagingSignature, savedForFuture: true };
  return { success: true, product, audit: { before: { ...auditBase, productLabel: `${alias.previousProductName} · ${alias.previousInternalCode}` }, after: { ...auditBase, productLabel: `${product.canonicalName} · ${product.internalCode}` } } };
}
export async function unlinkPriceSupplierAlias(aliasId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [alias] = await db.select({ id: priceSupplierAliases.id, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature, supplierName: priceSuppliers.name, productName: priceProducts.canonicalName, internalCode: priceProducts.internalCode }).from(priceSupplierAliases).innerJoin(priceSuppliers, eq(priceSupplierAliases.supplierId, priceSuppliers.id)).innerJoin(priceProducts, eq(priceSupplierAliases.productId, priceProducts.id)).where(eq(priceSupplierAliases.id, aliasId)).limit(1);
  if (!alias) throw new Error("Подтвержденная связь поставщика не найдена.");
  const result = await db.delete(priceSupplierAliases).where(eq(priceSupplierAliases.id, aliasId));
  if (!result[0]?.affectedRows) throw new Error("Подтвержденная связь поставщика не найдена.");
  const auditBase = { supplierName: alias.supplierName, supplierProductName: alias.normalizedName, packaging: alias.packagingSignature, savedForFuture: true };
  return { success: true, audit: { before: { ...auditBase, productLabel: `${alias.productName} · ${alias.internalCode}` }, after: { ...auditBase, productLabel: null } } };
}
export async function deletePriceImport(importId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const rows = await db.select({ id: priceImportRows.id }).from(priceImportRows).where(eq(priceImportRows.importId, importId));
  if (rows.length) { const ids = rows.map(row => row.id); await db.delete(priceOfferPrices).where(inArray(priceOfferPrices.importRowId, ids)); await db.delete(priceImportRows).where(eq(priceImportRows.importId, importId)); }
  await db.delete(priceImports).where(eq(priceImports.id, importId));
  return { success: true };
}

/** Removes a saved source position and all of its price options; the original file stays available. */
export async function deletePriceImportRow(rowId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select({ id: priceImportRows.id, importId: priceImportRows.importId, rawName: priceImportRows.rawName }).from(priceImportRows).where(eq(priceImportRows.id, rowId)).limit(1);
  if (!row) throw new Error("Позиция прайс‑листа не найдена.");
  await db.delete(priceOfferPrices).where(eq(priceOfferPrices.importRowId, row.id));
  const result = await db.delete(priceImportRows).where(eq(priceImportRows.id, row.id));
  if (!result[0]?.affectedRows) throw new Error("Позиция прайс‑листа не найдена.");
  const remainingRows = await db.select({ id: priceImportRows.id }).from(priceImportRows).where(eq(priceImportRows.importId, row.importId));
  await db.update(priceImports).set({ rowCount: remainingRows.length }).where(eq(priceImports.id, row.importId));
  return { success: true, importId: row.importId, rowCount: remainingRows.length, rawName: row.rawName };
}
