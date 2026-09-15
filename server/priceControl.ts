import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { priceCategories, priceImports, priceImportRows, priceOfferPrices, priceProducts, priceSupplierAliases, priceSuppliers } from "../drizzle/schema";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";

export type PriceBasis = "kg" | "l" | "piece" | "package" | "unknown";
export type NormalizedUnit = "kg" | "l" | "piece" | "unknown";
export type PriceMode = "standard" | "cash" | "cashless_no_vat" | "cashless_vat" | "spb" | "moscow" | "special" | "threshold";
export type ParsedPriceOption = { priceAmount: number; priceBasis: PriceBasis; normalizedPrice: number | null; normalizedUnit: NormalizedUnit; priceMode: PriceMode; minimumQuantityKg: number | null; includesVat: boolean | null; sourcePriceText: string };
export type ParsedPriceRow = { sourceSheet: string; sourceRowNumber: number; sourceSku: string | null; rawName: string; normalizedName: string; canonicalHint: string; normalizedSignature: string; category: string | null; packaging: string | null; packagingSignature: string; availability: string | null; variant: string | null; sizeText: string | null; priceOptions: ParsedPriceOption[]; rawPayload: Record<string, string> };
export type PriceImportPreview = { fileName: string; sourceType: "xls" | "xlsx" | "pdf" | "docx"; detectedSupplierName: string | null; detectedSourceDate: string | null; rows: ParsedPriceRow[]; warningCount: number; warnings: string[] };
export type PriceChange = { previousPrice: number; previousDate: string | null; delta: number; percent: number; direction: "up" | "down" | "same" };
type PriceChangeSource = { priceId: number; importId: number; productId: number | null; supplierId: number; priceMode: string | null; normalizedUnit: string | null; normalizedPrice: string | number | null; sourceDate: string | null; importedAt: Date | string };
export const SIGNIFICANT_PRICE_INCREASE_PERCENT = 10;

const MAX_IMPORT_ROWS = 3000;
const supplierHints: Array<[RegExp, string]> = [[/moreodor|мореодор/i, "Мореодор"], [/lucky\s*fish/i, "Lucky Fish"], [/купеческ/i, "Купеческий"], [/атлантид/i, "Атлантида"], [/вкус\s*север/i, "Вкус Севера"], [/mir\s*delicatesov|мир\s*деликатес/i, "Mir Delicatesov"], [/redgm/i, "RedGM"], [/арктическ.*вкус/i, "Арктический Вкус"], [/даллос/i, "Даллос"]];
const synonymTokens: Record<string, string> = { "семга": "лосось", "сёмга": "лосось", "лососевая": "лосось", "лососевые": "лосось" };

function text(value: unknown) { return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
function fold(value: string) { return text(value).toLowerCase().replace(/ё/g, "е"); }
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
    const key = `${offer.productId}:${offer.supplierId}:${offer.priceMode}:${offer.normalizedUnit}`;
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
  if (!raw || /дог|запрос|уточн|нет\s*цен|n\/a/i.test(raw)) return null;
  const match = raw.match(/-?\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(/[\s]/g, "").replace(",", "."));
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
  const match = normalizeProductName(value).match(/\b(sup|super|premium|prem|ord|ordinary|экстра|премиум)\b/);
  if (!match) return null;
  return ({ super: "sup", premium: "premium", prem: "premium", "премиум": "premium", "экстра": "premium", ordinary: "ord" } as Record<string, string>)[match[1]] ?? match[1];
}
export function productSignature(value: string) {
  const name = normalizeProductName(value).replace(/\b(sup|super|premium|prem|ord|ordinary|экстра|премиум)\b/g, " ").replace(/\b\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?\b/g, " ").replace(/\s+/g, " ").trim();
  return [name, extractSizeText(value)].filter(Boolean).join("|") || normalizeProductName(value);
}
export function parsePackaging(value: string) {
  const normalized = fold(value);
  const weight = normalized.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|гр|gr|g)(?![a-zа-я])/);
  const volume = normalized.match(/(\d+(?:[.,]\d+)?)\s*(л|литр|l|мл|ml)(?![a-zа-я])/);
  const count = normalized.match(/(\d+)\s*(шт|pcs?|штук)(?![a-zа-я])/);
  if (weight) { const amount = Number(weight[1].replace(",", ".")); return { grams: Math.round(amount * (["кг", "kg"].includes(weight[2]) ? 1000 : 1)), volumeMl: null, pieces: count ? Number(count[1]) : null }; }
  if (volume) { const amount = Number(volume[1].replace(",", ".")); return { grams: null, volumeMl: Math.round(amount * (["л", "литр", "l"].includes(volume[2]) ? 1000 : 1)), pieces: count ? Number(count[1]) : null }; }
  return { grams: null, volumeMl: null, pieces: count ? Number(count[1]) : null };
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
  if (/\/(?:кг)|за\s*кг|\bкг\b/.test(source)) return "kg";
  if (/\/(?:л)|за\s*л|\bлитр/.test(source)) return "l";
  if (/\/(?:шт)|за\s*шт|\bштук/.test(source)) return "piece";
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
function makeOption(raw: unknown, header: string, rawName: string, packaging: string | null): ParsedPriceOption | null {
  const priceAmount = numberFromText(raw);
  if (priceAmount === null) return null;
  const priceBasis = priceBasisFromText(header, rawName, packaging);
  const normalized = normalizePrice(priceAmount, priceBasis, packaging);
  const threshold = fold(header).match(/(?:от|с)\s*(\d+(?:[.,]\d+)?)\s*кг/);
  return { priceAmount, priceBasis, ...normalized, priceMode: priceModeFromHeader(header), minimumQuantityKg: threshold ? Number(threshold[1].replace(",", ".")) : null, includesVat: /с\s*ндс|ндс\s*\d+/.test(fold(header)) ? true : /без\s*ндс/.test(fold(header)) ? false : null, sourcePriceText: text(raw) };
}
function isProductHeader(value: unknown) { return /^(наименовани\w*|товар\w*|номенклатур\w*|позици\w*|продукт\w*)/i.test(text(value)); }
function isPriceHeader(value: unknown) { return /цен|стоим|прайс|опт|налич|безнал/i.test(text(value)); }
function findHeaderIndex(rows: unknown[][]) {
  return rows.slice(0, 90).findIndex(row => row.some(isProductHeader) && row.some(isPriceHeader));
}
function columnIndex(headers: string[], expression: RegExp) { return headers.findIndex(value => expression.test(fold(value))); }
function parseExcel(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const rows: ParsedPriceRow[] = [];
  workbook.SheetNames.forEach(sheetName => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" });
    const headerRow = findHeaderIndex(matrix);
    if (headerRow < 0) return;
    const headers = matrix[headerRow].map(cell => text(cell));
    const nameIndex = headers.findIndex(isProductHeader);
    const priceIndexes = headers.map((header, index) => ({ header, index })).filter(({ header }) => /цен|стоим|прайс|опт|налич|безнал/i.test(header));
    const skuIndex = columnIndex(headers, /артикул|код\s*(товара)?|^код$/);
    const categoryIndex = columnIndex(headers, /катег|раздел|групп/);
    const packagingIndex = columnIndex(headers, /фас|упак|тара|вес|короб|нетто/);
    const availabilityIndex = columnIndex(headers, /налич|остат|склад/);
    matrix.slice(headerRow + 1).forEach((cells, offset) => {
      const rawName = text(cells[nameIndex]);
      if (!rawName || rawName.length < 2 || isAdministrativeText(rawName)) return;
      const packaging = text(cells[packagingIndex]) || null;
      const options = priceIndexes.map(({ header, index }) => makeOption(cells[index], header, rawName, packaging || rawName)).filter((value): value is ParsedPriceOption => Boolean(value));
      if (!options.length) return;
      const rowNumber = headerRow + offset + 2;
      const rawPayload = Object.fromEntries(headers.map((header, index) => [header || `Колонка ${index + 1}`, text(cells[index])]).filter(([, value]) => value));
      rows.push({ sourceSheet: sheetName, sourceRowNumber: rowNumber, sourceSku: text(cells[skuIndex]) || null, rawName, normalizedName: normalizeProductName(rawName), canonicalHint: rawName, normalizedSignature: productSignature(rawName), category: text(cells[categoryIndex]) || null, packaging, packagingSignature: packagingSignature(packaging || rawName), availability: text(cells[availabilityIndex]) || null, variant: extractVariant(rawName), sizeText: extractSizeText(rawName), priceOptions: options, rawPayload });
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
    const rawName = text(line.slice(0, candidate.index));
    const price = candidate.amount;
    if (!price || rawName.length < 3 || /^(цена|руб|код|артикул)$/i.test(rawName) || isAdministrativeText(rawName)) return;
    const packingMatch = line.match(/\d+(?:[.,]\d+)?\s*(?:кг|г|гр|л|мл|шт)(?![a-zа-я])/i);
    const packaging = packingMatch?.[0] ?? null;
    const option = makeOption(candidate.text, "цена", rawName, packaging || rawName);
    if (!option) return;
    rows.push({ sourceSheet: "Документ", sourceRowNumber: index + 1, sourceSku: null, rawName, normalizedName: normalizeProductName(rawName), canonicalHint: rawName, normalizedSignature: productSignature(rawName), category: null, packaging, packagingSignature: packagingSignature(packaging || rawName), availability: null, variant: extractVariant(rawName), sizeText: extractSizeText(rawName), priceOptions: [option], rawPayload: { line } });
  });
  return rows;
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
  if (sourceType === "docx") { documentText = (await mammoth.extractRawText({ buffer })).value; rows = parseExtractedText(documentText); }
  if (sourceType === "pdf") { const parser = new PDFParse({ data: buffer }); try { documentText = (await parser.getText()).text; } finally { await parser.destroy(); } rows = parseExtractedText(documentText); }
  const trimmedRows = rows.slice(0, MAX_IMPORT_ROWS);
  const warnings: string[] = [];
  if (!trimmedRows.length) warnings.push("Товарные строки с распознанной ценой не найдены. Проверьте документ и разметку прайс‑листа.");
  if (rows.length > MAX_IMPORT_ROWS) warnings.push(`Обработаны первые ${MAX_IMPORT_ROWS} строк из ${rows.length}.`);
  const source = `${fileName}\n${documentText.slice(0, 6000)}`;
  return { fileName, sourceType, detectedSupplierName: findSupplierName(source), detectedSourceDate: sourceDateFromText(source), rows: trimmedRows, warningCount: warnings.length + trimmedRows.filter(row => row.priceOptions.some(option => option.normalizedPrice === null)).length, warnings };
}

type Mapping = { productId: number | null; mappingStatus: "linked" | "suggested" | "unmapped"; matchedBy: "supplier_alias" | "signature" | "none"; matchConfidence: number | null };
export function resolvePriceMapping(row: ParsedPriceRow, supplierId: number, aliases: Array<{ supplierId: number; productId: number; normalizedName: string; packagingSignature: string | null }>, products: Array<{ id: number; normalizedSignature: string }>): Mapping {
  const direct = aliases.find(alias => alias.supplierId === supplierId && alias.normalizedName === row.normalizedName && (alias.packagingSignature || "") === row.packagingSignature);
  if (direct) return { productId: direct.productId, mappingStatus: "linked", matchedBy: "supplier_alias", matchConfidence: 100 };
  const signature = products.find(product => product.normalizedSignature === row.normalizedSignature);
  if (signature) return { productId: signature.id, mappingStatus: "suggested", matchedBy: "signature", matchConfidence: 92 };
  return { productId: null, mappingStatus: "unmapped", matchedBy: "none", matchConfidence: null };
}
async function ensureSupplier(name: string) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const normalizedName = normalizeSupplierName(name);
  const [existing] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.normalizedName, normalizedName)).limit(1);
  if (existing) return existing;
  const [inserted] = await db.insert(priceSuppliers).values({ name: text(name), normalizedName }).$returningId();
  const [supplier] = await db.select().from(priceSuppliers).where(eq(priceSuppliers.id, inserted.id)).limit(1);
  return supplier!;
}
export async function commitPriceImport(input: { buffer: Buffer; fileName: string; supplierName: string; sourceDate?: string | null; actorId: number }) {
  const preview = await previewPriceImport(input.buffer, input.fileName);
  if (!preview.rows.length) throw new Error("Импорт не сохранен: в документе не найдено ни одной товарной строки с ценой.");
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const supplier = await ensureSupplier(input.supplierName);
  const stored = await storagePut(`price-imports/${supplier.id}/${Date.now()}_${input.fileName}`, input.buffer, sourceMimeType(preview.sourceType));
  const [inserted] = await db.insert(priceImports).values({ supplierId: supplier.id, fileName: input.fileName, fileKey: stored.key, sourceDate: input.sourceDate || preview.detectedSourceDate, sourceType: preview.sourceType, status: "completed", rowCount: preview.rows.length, importedByAccountId: input.actorId }).$returningId();
  const aliases = await db.select({ supplierId: priceSupplierAliases.supplierId, productId: priceSupplierAliases.productId, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature }).from(priceSupplierAliases).where(eq(priceSupplierAliases.supplierId, supplier.id));
  const products = await db.select({ id: priceProducts.id, normalizedSignature: priceProducts.normalizedSignature }).from(priceProducts).where(eq(priceProducts.isActive, true));
  let linked = 0, suggested = 0;
  for (const row of preview.rows) {
    const mapping = resolvePriceMapping(row, supplier.id, aliases, products);
    if (mapping.mappingStatus === "linked") linked += 1;
    if (mapping.mappingStatus === "suggested") suggested += 1;
    const [rowInserted] = await db.insert(priceImportRows).values({ importId: inserted.id, sourceSheet: row.sourceSheet, sourceRowNumber: row.sourceRowNumber, sourceSku: row.sourceSku, rawName: row.rawName, normalizedName: row.normalizedName, rawCategory: row.category, rawPackaging: row.packaging, rawAvailability: row.availability, rawPayload: row.rawPayload, productId: mapping.productId, mappingStatus: mapping.mappingStatus, matchedBy: mapping.matchedBy, matchConfidence: mapping.matchConfidence === null ? null : mapping.matchConfidence.toFixed(2) }).$returningId();
    await db.insert(priceOfferPrices).values(row.priceOptions.map(option => ({ importRowId: rowInserted.id, priceMode: option.priceMode, priceAmount: option.priceAmount.toFixed(2), priceBasis: option.priceBasis, normalizedPrice: option.normalizedPrice === null ? null : option.normalizedPrice.toFixed(2), normalizedUnit: option.normalizedUnit, minimumQuantityKg: option.minimumQuantityKg === null ? null : option.minimumQuantityKg.toFixed(2), includesVat: option.includesVat, sourcePriceText: option.sourcePriceText })));
  }
  return { importId: inserted.id, supplier: { id: supplier.id, name: supplier.name }, rowCount: preview.rows.length, linked, suggested, unmapped: preview.rows.length - linked - suggested, warningCount: preview.warningCount };
}
function sourceMimeType(sourceType: PriceImportPreview["sourceType"]) { return sourceType === "pdf" ? "application/pdf" : sourceType === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.ms-excel"; }
export async function listPriceControlData() {
  const db = await getDb(); if (!db) return emptyPriceData();
  const [suppliers, categories, products, imports, rows, aliases] = await Promise.all([
    db.select().from(priceSuppliers).orderBy(priceSuppliers.name),
    db.select().from(priceCategories).orderBy(priceCategories.name),
    db.select({ id: priceProducts.id, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName, normalizedSignature: priceProducts.normalizedSignature, categoryId: priceProducts.categoryId, legacyCategory: priceProducts.category, categoryName: priceCategories.name, categoryIsActive: priceCategories.isActive, variant: priceProducts.variant, sizeText: priceProducts.sizeText, baseUnit: priceProducts.baseUnit, isActive: priceProducts.isActive }).from(priceProducts).leftJoin(priceCategories, eq(priceProducts.categoryId, priceCategories.id)).orderBy(priceProducts.canonicalName),
    db.select({ id: priceImports.id, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, fileName: priceImports.fileName, fileKey: priceImports.fileKey, sourceDate: priceImports.sourceDate, sourceType: priceImports.sourceType, rowCount: priceImports.rowCount, createdAt: priceImports.createdAt }).from(priceImports).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).orderBy(desc(priceImports.createdAt)).limit(50),
    db.select({ rowId: priceImportRows.id, importId: priceImportRows.importId, productId: priceImportRows.productId, rawName: priceImportRows.rawName, rawCategory: priceImportRows.rawCategory, rawPackaging: priceImportRows.rawPackaging, mappingStatus: priceImportRows.mappingStatus, matchedBy: priceImportRows.matchedBy, matchConfidence: priceImportRows.matchConfidence, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, sourceDate: priceImports.sourceDate, importedAt: priceImports.createdAt, productName: priceProducts.canonicalName, internalCode: priceProducts.internalCode, priceId: priceOfferPrices.id, priceMode: priceOfferPrices.priceMode, priceAmount: priceOfferPrices.priceAmount, priceBasis: priceOfferPrices.priceBasis, normalizedPrice: priceOfferPrices.normalizedPrice, normalizedUnit: priceOfferPrices.normalizedUnit, minimumQuantityKg: priceOfferPrices.minimumQuantityKg, sourcePriceText: priceOfferPrices.sourcePriceText }).from(priceImportRows).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id)).leftJoin(priceOfferPrices, eq(priceOfferPrices.importRowId, priceImportRows.id)).orderBy(desc(priceImports.createdAt)).limit(10000),
    db.select({ aliasId: priceSupplierAliases.id, supplierId: priceSupplierAliases.supplierId, supplierName: priceSuppliers.name, productId: priceSupplierAliases.productId, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName, normalizedName: priceSupplierAliases.normalizedName, packagingSignature: priceSupplierAliases.packagingSignature, updatedAt: priceSupplierAliases.updatedAt }).from(priceSupplierAliases).innerJoin(priceSuppliers, eq(priceSupplierAliases.supplierId, priceSuppliers.id)).innerJoin(priceProducts, eq(priceSupplierAliases.productId, priceProducts.id)).orderBy(priceSuppliers.name, priceSupplierAliases.normalizedName).limit(500),
  ]);
  const catalogProducts = products.map(product => ({ ...product, category: product.categoryName ?? product.legacyCategory, categoryIsActive: product.categoryIsActive ?? true }));
  const productMap = new Map(catalogProducts.map(product => [product.id, product]));
  const priceChangeSources = rows.flatMap(row => row.priceId !== null && row.productId !== null && row.normalizedPrice !== null && row.normalizedUnit !== null ? [{ priceId: row.priceId, importId: row.importId, productId: row.productId, supplierId: row.supplierId, priceMode: row.priceMode, normalizedUnit: row.normalizedUnit, normalizedPrice: row.normalizedPrice, sourceDate: row.sourceDate, importedAt: row.importedAt }] : []);
  const priceChanges = calculatePriceChanges(priceChangeSources);
  const latestOffer = new Map<string, typeof rows[number]>();
  rows.filter(row => row.productId && row.priceId && row.normalizedPrice !== null).forEach(row => {
    const key = `${row.productId}:${row.supplierId}:${row.priceMode}:${row.normalizedUnit}`;
    if (!latestOffer.has(key)) latestOffer.set(key, row);
  });
  const groups = new Map<number, Array<typeof rows[number]>>();
  latestOffer.forEach(row => { const items = groups.get(row.productId!) ?? []; items.push(row); groups.set(row.productId!, items); });
  const comparisons = Array.from(groups.entries()).map(([productId, offers]) => {
    const product = productMap.get(productId)!;
    const comparable = offers.filter(offer => offer.normalizedPrice !== null && offer.normalizedUnit !== "unknown").sort((a, b) => Number(a.normalizedPrice) - Number(b.normalizedPrice));
    const best = comparable[0]; const next = comparable.find(offer => offer.supplierId !== best?.supplierId && offer.normalizedUnit === best?.normalizedUnit);
    const savings = best && next ? Number(next.normalizedPrice) - Number(best.normalizedPrice) : null;
    return { product: { id: product.id, internalCode: product.internalCode, canonicalName: product.canonicalName, categoryId: product.categoryId, category: product.category, categoryIsActive: product.categoryIsActive, variant: product.variant, sizeText: product.sizeText, baseUnit: product.baseUnit, isActive: product.isActive }, offers: comparable.map(offer => ({ importId: offer.importId, rowId: offer.rowId, priceId: offer.priceId, supplierId: offer.supplierId, supplierName: offer.supplierName, rawName: offer.rawName, packaging: offer.rawPackaging, priceMode: offer.priceMode, priceAmount: Number(offer.priceAmount), priceBasis: offer.priceBasis, normalizedPrice: Number(offer.normalizedPrice), normalizedUnit: offer.normalizedUnit, minimumQuantityKg: offer.minimumQuantityKg === null ? null : Number(offer.minimumQuantityKg), sourcePriceText: offer.sourcePriceText, priceChange: offer.priceId === null ? null : priceChanges.get(offer.priceId) ?? null })), recommendation: best && next && savings !== null ? { supplierId: best.supplierId, supplierName: best.supplierName, normalizedPrice: Number(best.normalizedPrice), normalizedUnit: best.normalizedUnit as "kg" | "l" | "piece", savings, savingsPercent: Number(((savings / Number(next.normalizedPrice)) * 100).toFixed(1)) } : null };
  }).sort((a, b) => (b.recommendation?.savings ?? 0) - (a.recommendation?.savings ?? 0));
  const unmappedRows = rows.filter(row => row.mappingStatus !== "linked").slice(0, 100).map(row => ({ rowId: row.rowId, importId: row.importId, supplierId: row.supplierId, supplierName: row.supplierName, rawName: row.rawName, rawCategory: row.rawCategory, rawPackaging: row.rawPackaging, mappingStatus: row.mappingStatus, matchedBy: row.matchedBy, matchConfidence: row.matchConfidence === null ? null : Number(row.matchConfidence), suggestedProduct: row.productId ? { id: row.productId, name: row.productName, internalCode: row.internalCode } : null }));
  const history = rows.filter(row => row.productId && row.priceId && row.normalizedPrice !== null && row.normalizedUnit !== "unknown").map(row => ({ priceId: row.priceId!, productId: row.productId!, supplierId: row.supplierId, supplierName: row.supplierName, date: row.sourceDate || row.importedAt.toISOString().slice(0, 10), normalizedPrice: Number(row.normalizedPrice), normalizedUnit: row.normalizedUnit, priceMode: row.priceMode, priceChange: priceChanges.get(row.priceId!) ?? null }));
  const previewMap = new Map(imports.map(item => [item.id, { importId: item.id, rows: [] as Array<{ rowId: number; rawName: string; rawCategory: string | null; rawPackaging: string | null; productName: string | null; priceAmount: number | null }> }]));
  const previewSeen = new Set<number>();
  rows.forEach(row => {
    if (previewSeen.has(row.rowId)) return;
    previewSeen.add(row.rowId);
    const preview = previewMap.get(row.importId);
    if (preview && preview.rows.length < 24) preview.rows.push({ rowId: row.rowId, rawName: row.rawName, rawCategory: row.rawCategory, rawPackaging: row.rawPackaging, productName: row.productName, priceAmount: row.priceAmount === null ? null : Number(row.priceAmount) });
  });
  return { suppliers, categories, products: catalogProducts, imports, comparisons, unmappedRows, aliases, history, importPreviews: Array.from(previewMap.values()) };
}
function emptyPriceData() { return { suppliers: [], categories: [], products: [], imports: [], comparisons: [], unmappedRows: [], aliases: [], history: [], importPreviews: [] }; }

export async function listSignificantPriceIncreases(importId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ priceId: priceOfferPrices.id, importId: priceImportRows.importId, productId: priceImportRows.productId, supplierId: priceImports.supplierId, supplierName: priceSuppliers.name, productName: priceProducts.canonicalName, priceMode: priceOfferPrices.priceMode, normalizedUnit: priceOfferPrices.normalizedUnit, normalizedPrice: priceOfferPrices.normalizedPrice, sourceDate: priceImports.sourceDate, importedAt: priceImports.createdAt }).from(priceOfferPrices).innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id)).innerJoin(priceImports, eq(priceImportRows.importId, priceImports.id)).innerJoin(priceSuppliers, eq(priceImports.supplierId, priceSuppliers.id)).leftJoin(priceProducts, eq(priceImportRows.productId, priceProducts.id));
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

export async function createPriceProduct(input: { canonicalName: string; internalCode?: string; categoryId?: number | null; category?: string | null; variant?: string | null; sizeText?: string | null; baseUnit?: NormalizedUnit; defaultWeightGrams?: number | null; defaultVolumeMl?: number | null }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const canonicalName = text(input.canonicalName); const signature = productSignature(canonicalName);
  const category = await getPriceCategory(input.categoryId);
  const [existing] = await db.select().from(priceProducts).where(eq(priceProducts.normalizedSignature, signature)).limit(1);
  if (existing) return existing;
  const internalCode = text(input.internalCode || productCodeFromSignature(signature)).toUpperCase();
  const [inserted] = await db.insert(priceProducts).values({ internalCode, canonicalName, normalizedSignature: signature, categoryId: category?.id ?? null, category: category?.name ?? (input.category || null), variant: input.variant || extractVariant(canonicalName), sizeText: input.sizeText || extractSizeText(canonicalName), baseUnit: input.baseUnit || "unknown", defaultWeightGrams: input.defaultWeightGrams === null || input.defaultWeightGrams === undefined ? null : input.defaultWeightGrams.toFixed(2), defaultVolumeMl: input.defaultVolumeMl === null || input.defaultVolumeMl === undefined ? null : input.defaultVolumeMl.toFixed(2) }).$returningId();
  const [created] = await db.select().from(priceProducts).where(eq(priceProducts.id, inserted.id)).limit(1);
  return created!;
}

export async function updatePriceProduct(input: { id: number; canonicalName: string; internalCode: string; categoryId?: number | null; category?: string | null; variant?: string | null; sizeText?: string | null; baseUnit?: NormalizedUnit; isActive?: boolean }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const canonicalName = text(input.canonicalName); const internalCode = text(input.internalCode).toUpperCase();
  if (canonicalName.length < 2 || internalCode.length < 3) throw new Error("Укажите эталонное название и внутренний код товара.");
  const signature = productSignature(canonicalName);
  const category = await getPriceCategory(input.categoryId);
  const [signatureConflict] = await db.select({ id: priceProducts.id }).from(priceProducts).where(eq(priceProducts.normalizedSignature, signature)).limit(1);
  if (signatureConflict && signatureConflict.id !== input.id) throw new Error("Товар с такой нормализованной сигнатурой уже существует.");
  const [codeConflict] = await db.select({ id: priceProducts.id }).from(priceProducts).where(eq(priceProducts.internalCode, internalCode)).limit(1);
  if (codeConflict && codeConflict.id !== input.id) throw new Error("Такой внутренний код уже используется другим товаром.");
  await db.update(priceProducts).set({ canonicalName, internalCode, normalizedSignature: signature, categoryId: category?.id ?? input.categoryId ?? null, category: category?.name ?? (text(input.category || "") || null), variant: text(input.variant || "") || extractVariant(canonicalName), sizeText: text(input.sizeText || "") || extractSizeText(canonicalName), baseUnit: input.baseUnit || "unknown", ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }).where(eq(priceProducts.id, input.id));
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

export async function updatePriceOffer(input: { priceId: number; priceAmount: number; priceBasis: PriceBasis }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [price] = await db.select({ id: priceOfferPrices.id, rawPackaging: priceImportRows.rawPackaging }).from(priceOfferPrices).innerJoin(priceImportRows, eq(priceOfferPrices.importRowId, priceImportRows.id)).where(eq(priceOfferPrices.id, input.priceId)).limit(1);
  if (!price) throw new Error("Цена прайс‑листа не найдена.");
  const normalized = normalizePrice(input.priceAmount, input.priceBasis, price.rawPackaging);
  await db.update(priceOfferPrices).set({ priceAmount: input.priceAmount.toFixed(2), priceBasis: input.priceBasis, normalizedPrice: normalized.normalizedPrice === null ? null : normalized.normalizedPrice.toFixed(2), normalizedUnit: normalized.normalizedUnit }).where(eq(priceOfferPrices.id, input.priceId));
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
  const [row] = await db.select({ id: priceImportRows.id, importId: priceImportRows.importId, normalizedName: priceImportRows.normalizedName, rawPackaging: priceImportRows.rawPackaging }).from(priceImportRows).where(eq(priceImportRows.id, input.rowId)).limit(1);
  if (!row) throw new Error("Строка прайс‑листа не найдена.");
  const [importRecord] = await db.select({ supplierId: priceImports.supplierId }).from(priceImports).where(eq(priceImports.id, row.importId)).limit(1);
  if (!importRecord) throw new Error("Импорт прайс‑листа не найден.");
  const [product] = await db.select().from(priceProducts).where(eq(priceProducts.id, input.productId)).limit(1);
  if (!product) throw new Error("Внутренний товар не найден.");
  await db.update(priceImportRows).set({ productId: input.productId, mappingStatus: "linked", matchedBy: "manual", matchConfidence: "100.00" }).where(eq(priceImportRows.id, input.rowId));
  if (input.saveAlias) await db.insert(priceSupplierAliases).values({ supplierId: importRecord.supplierId, productId: input.productId, normalizedName: row.normalizedName, packagingSignature: packagingSignature(row.rawPackaging), isConfirmed: true, createdByAccountId: input.actorId }).onDuplicateKeyUpdate({ set: { productId: input.productId, isConfirmed: true, createdByAccountId: input.actorId } });
  return { success: true, product: { id: product.id, internalCode: product.internalCode, canonicalName: product.canonicalName } };
}
export async function reassignPriceSupplierAlias(input: { aliasId: number; productId: number }) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const [product] = await db.select({ id: priceProducts.id, internalCode: priceProducts.internalCode, canonicalName: priceProducts.canonicalName }).from(priceProducts).where(and(eq(priceProducts.id, input.productId), eq(priceProducts.isActive, true))).limit(1);
  if (!product) throw new Error("Внутренний товар не найден или отключен.");
  const [alias] = await db.select({ id: priceSupplierAliases.id }).from(priceSupplierAliases).where(eq(priceSupplierAliases.id, input.aliasId)).limit(1);
  if (!alias) throw new Error("Подтвержденная связь поставщика не найдена.");
  await db.update(priceSupplierAliases).set({ productId: input.productId, isConfirmed: true }).where(eq(priceSupplierAliases.id, input.aliasId));
  return { success: true, product };
}
export async function unlinkPriceSupplierAlias(aliasId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const result = await db.delete(priceSupplierAliases).where(eq(priceSupplierAliases.id, aliasId));
  if (!result[0]?.affectedRows) throw new Error("Подтвержденная связь поставщика не найдена.");
  return { success: true };
}
export async function deletePriceImport(importId: number) {
  const db = await getDb(); if (!db) throw new Error("База данных недоступна");
  const rows = await db.select({ id: priceImportRows.id }).from(priceImportRows).where(eq(priceImportRows.importId, importId));
  if (rows.length) { const ids = rows.map(row => row.id); await db.delete(priceOfferPrices).where(inArray(priceOfferPrices.importRowId, ids)); await db.delete(priceImportRows).where(eq(priceImportRows.importId, importId)); }
  await db.delete(priceImports).where(eq(priceImports.id, importId));
  return { success: true };
}
