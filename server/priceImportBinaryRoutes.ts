import type { Express, Request, Response } from "express";
import express from "express";
import { getCurrentLocalAccount, getPriceAlertRecipients, hasPriceAccess } from "./accessControl";
import { createContext } from "./_core/context";
import { commitPriceImport, listSignificantPriceIncreases, previewPriceImport } from "./priceControl";
import { recordChange } from "./localAuth";
import { createNotifications } from "./notifications";

const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось обработать прайс‑лист.";
const fileNameFrom = (req: Request) => typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
const IMPORT_OPTIONS_MAGIC = Buffer.from("PRICE-IMPORT-OPTIONS-V1\n", "utf8");
const MAX_IMPORT_OPTIONS_BYTES = 500_000;
type ImportCommitOptions = {
  categorySelections: Array<{ rowIndex: number; categoryId: number }>;
  priceEdits: Array<{ rowIndex: number; optionIndex: number; priceAmount: number; priceBasis?: "kg" | "l" | "piece" | "package" | "unknown"; priceMode?: "cash" | "cashless_no_vat" | "cashless_vat"; market?: "unknown" | "spb" | "moscow" }>;
  priceAdditions: Array<{ rowIndex: number; priceAmount: number; priceBasis: "kg" | "l" | "piece" | "package" | "unknown"; priceMode: "cash" | "cashless_no_vat" | "cashless_vat"; market: "unknown" | "spb" | "moscow" }>;
  priceRemovals: Array<{ rowIndex: number; optionIndex: number }>;
  rowEdits: Array<{ rowIndex: number; rawName: string }>;
  metadataEdits: Array<{ rowIndex: number; manufacturer: string | null; placeContents: string | null; manufacturedOn: string | null; shelfLifeMonths: number | null; expiresOn: string | null }>;
  productLinks: Array<{ rowIndex: number; productId: number }>;
  excludedRowIndexes: number[];
};

function categorySelectionsFrom(req: Request) {
  const raw = typeof req.query.categorySelections === "string" ? req.query.categorySelections : "";
  if (!raw) return [];
  if (raw.length > 80_000) throw new Error("Список категорий для импорта слишком большой.");
  const entries = raw.split(",").filter(Boolean);
  if (entries.length > 3000) throw new Error("Передан некорректный список категорий прайс‑листа.");
  return entries.map(entry => {
    const [rowIndexText, categoryIdText, ...rest] = entry.split(":");
    const rowIndex = Number(rowIndexText);
    const categoryId = Number(categoryIdText);
    if (rest.length || !Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(categoryId) || categoryId < 1) throw new Error("Передана некорректная категория для строки прайс‑листа.");
    return { rowIndex, categoryId };
  });
}

function normalizeCommitOptions(value: unknown): ImportCommitOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Переданы некорректные параметры сохранения прайс‑листа.");
  const source = value as Record<string, unknown>;
  const categorySelections = Array.isArray(source.categorySelections) ? source.categorySelections : [];
  const priceEdits = Array.isArray(source.priceEdits) ? source.priceEdits : [];
  const priceAdditions = Array.isArray(source.priceAdditions) ? source.priceAdditions : [];
  const priceRemovals = Array.isArray(source.priceRemovals) ? source.priceRemovals : [];
  const rowEdits = Array.isArray(source.rowEdits) ? source.rowEdits : [];
  const metadataEdits = Array.isArray(source.metadataEdits) ? source.metadataEdits : [];
  const productLinks = Array.isArray(source.productLinks) ? source.productLinks : [];
  const excludedRowIndexes = Array.isArray(source.excludedRowIndexes) ? source.excludedRowIndexes : [];
  if (categorySelections.length > 3000 || priceEdits.length > 36_000 || priceAdditions.length > 36_000 || priceRemovals.length > 36_000 || rowEdits.length > 3000 || metadataEdits.length > 3000 || productLinks.length > 3000 || excludedRowIndexes.length > 3000) {
    throw new Error("Передано слишком много изменений для одного прайс‑листа.");
  }
  const allowedBases = new Set(["kg", "l", "piece", "package", "unknown"]);
  const allowedModes = new Set(["cash", "cashless_no_vat", "cashless_vat"]);
  const allowedMarkets = new Set(["unknown", "spb", "moscow"]);
  return {
    categorySelections: categorySelections.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передана некорректная категория для строки прайс‑листа.");
      const rowIndex = Number((item as Record<string, unknown>).rowIndex);
      const categoryId = Number((item as Record<string, unknown>).categoryId);
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(categoryId) || categoryId < 1) throw new Error("Передана некорректная категория для строки прайс‑листа.");
      return { rowIndex, categoryId };
    }),
    priceEdits: priceEdits.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передана некорректная ручная правка цены прайс‑листа.");
      const sourceEdit = item as Record<string, unknown>;
      const rowIndex = Number(sourceEdit.rowIndex);
      const optionIndex = Number(sourceEdit.optionIndex);
      const priceAmount = Number(sourceEdit.priceAmount);
      const priceBasis = sourceEdit.priceBasis;
      const priceMode = sourceEdit.priceMode;
      const market = sourceEdit.market;
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(optionIndex) || optionIndex < 0 || !Number.isFinite(priceAmount) || priceAmount <= 0 || priceAmount >= 10_000_000 || (priceBasis !== undefined && (typeof priceBasis !== "string" || !allowedBases.has(priceBasis))) || (priceMode !== undefined && (typeof priceMode !== "string" || !allowedModes.has(priceMode))) || (market !== undefined && (typeof market !== "string" || !allowedMarkets.has(market)))) {
        throw new Error("Передана некорректная ручная правка цены прайс‑листа.");
      }
      return { rowIndex, optionIndex, priceAmount, ...(priceBasis === undefined ? {} : { priceBasis: priceBasis as ImportCommitOptions["priceEdits"][number]["priceBasis"] }), ...(priceMode === undefined ? {} : { priceMode: priceMode as ImportCommitOptions["priceEdits"][number]["priceMode"] }), ...(market === undefined ? {} : { market: market as ImportCommitOptions["priceEdits"][number]["market"] }) };
    }),
    priceAdditions: priceAdditions.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передан некорректный добавленный вариант цены прайс‑листа.");
      const sourceAddition = item as Record<string, unknown>;
      const rowIndex = Number(sourceAddition.rowIndex);
      const priceAmount = Number(sourceAddition.priceAmount);
      const priceBasis = sourceAddition.priceBasis;
      const priceMode = sourceAddition.priceMode;
      const market = sourceAddition.market;
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isFinite(priceAmount) || priceAmount <= 0 || priceAmount >= 10_000_000 || typeof priceBasis !== "string" || !allowedBases.has(priceBasis) || typeof priceMode !== "string" || !allowedModes.has(priceMode) || typeof market !== "string" || !allowedMarkets.has(market)) {
        throw new Error("Передан некорректный добавленный вариант цены прайс‑листа.");
      }
      return { rowIndex, priceAmount, priceBasis: priceBasis as ImportCommitOptions["priceAdditions"][number]["priceBasis"], priceMode: priceMode as ImportCommitOptions["priceAdditions"][number]["priceMode"], market: market as ImportCommitOptions["priceAdditions"][number]["market"] };
    }),
    priceRemovals: priceRemovals.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передан некорректный вариант цены для удаления.");
      const sourceRemoval = item as Record<string, unknown>;
      const rowIndex = Number(sourceRemoval.rowIndex);
      const optionIndex = Number(sourceRemoval.optionIndex);
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(optionIndex) || optionIndex < 0) throw new Error("Передан некорректный вариант цены для удаления.");
      return { rowIndex, optionIndex };
    }),
    rowEdits: rowEdits.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передана некорректная правка названия позиции прайс‑листа.");
      const sourceEdit = item as Record<string, unknown>;
      const rowIndex = Number(sourceEdit.rowIndex);
      const rawName = typeof sourceEdit.rawName === "string" ? sourceEdit.rawName.trim().replace(/\s+/g, " ") : "";
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || rawName.length < 2 || rawName.length > 255) throw new Error("Передана некорректная правка названия позиции прайс‑листа.");
      return { rowIndex, rawName };
    }),
    metadataEdits: metadataEdits.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передана некорректная характеристика предложения прайс‑листа.");
      const sourceEdit = item as Record<string, unknown>;
      const rowIndex = Number(sourceEdit.rowIndex);
      const manufacturer = typeof sourceEdit.manufacturer === "string" ? sourceEdit.manufacturer.trim().replace(/\s+/g, " ") || null : sourceEdit.manufacturer === null ? null : undefined;
      const placeContents = typeof sourceEdit.placeContents === "string" ? sourceEdit.placeContents.trim().replace(/\s+/g, " ") || null : sourceEdit.placeContents === null ? null : undefined;
      const manufacturedOn = typeof sourceEdit.manufacturedOn === "string" ? sourceEdit.manufacturedOn.trim() || null : sourceEdit.manufacturedOn === null || sourceEdit.manufacturedOn === undefined ? null : undefined;
      const shelfLifeMonths = sourceEdit.shelfLifeMonths === null || sourceEdit.shelfLifeMonths === undefined || sourceEdit.shelfLifeMonths === "" ? null : Number(sourceEdit.shelfLifeMonths);
      const expiresOn = typeof sourceEdit.expiresOn === "string" ? sourceEdit.expiresOn.trim() || null : sourceEdit.expiresOn === null || sourceEdit.expiresOn === undefined ? null : undefined;
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || manufacturer === undefined || placeContents === undefined || manufacturedOn === undefined || expiresOn === undefined || (shelfLifeMonths !== null && !Number.isInteger(shelfLifeMonths)) || (manufacturer?.length ?? 0) > 255 || (placeContents?.length ?? 0) > 255) throw new Error("Передана некорректная характеристика предложения прайс‑листа.");
      return { rowIndex, manufacturer, placeContents, manufacturedOn, shelfLifeMonths, expiresOn };
    }),
    productLinks: productLinks.map(item => {
      if (!item || typeof item !== "object") throw new Error("Передана некорректная связь товара для строки прайс‑листа.");
      const sourceLink = item as Record<string, unknown>;
      const rowIndex = Number(sourceLink.rowIndex);
      const productId = Number(sourceLink.productId);
      if (!Number.isInteger(rowIndex) || rowIndex < 0 || !Number.isInteger(productId) || productId < 1) throw new Error("Передана некорректная связь товара для строки прайс‑листа.");
      return { rowIndex, productId };
    }),
    excludedRowIndexes: excludedRowIndexes.map(item => {
      const rowIndex = Number(item);
      if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new Error("Передан некорректный список исключенных строк прайс‑листа.");
      return rowIndex;
    }),
  };
}

function unpackCommitBody(body: Buffer) {
  if (!body.subarray(0, IMPORT_OPTIONS_MAGIC.length).equals(IMPORT_OPTIONS_MAGIC)) return { buffer: body, options: null as ImportCommitOptions | null };
  const headerEnd = IMPORT_OPTIONS_MAGIC.length + 4;
  if (body.length < headerEnd) throw new Error("Не удалось прочитать параметры сохранения прайс‑листа.");
  const optionsLength = body.readUInt32BE(IMPORT_OPTIONS_MAGIC.length);
  if (!optionsLength || optionsLength > MAX_IMPORT_OPTIONS_BYTES || body.length <= headerEnd + optionsLength) throw new Error("Не удалось прочитать параметры сохранения прайс‑листа.");
  let parsed: unknown;
  try { parsed = JSON.parse(body.subarray(headerEnd, headerEnd + optionsLength).toString("utf8")); } catch { throw new Error("Не удалось прочитать параметры сохранения прайс‑листа."); }
  return { buffer: body.subarray(headerEnd + optionsLength), options: normalizeCommitOptions(parsed) };
}
async function requirePricePermission(req: Request, res: Response, required: "view" | "upload" | "edit") {
  const ctx = await createContext({ req, res } as never);
  if (!ctx.user) { res.status(401).json({ error: "Требуется вход в учетную запись." }); return null; }
  if (!await hasPriceAccess(ctx.user.openId, required)) { res.status(403).json({ error: "Нет назначенного доступа к прайс‑контролю." }); return null; }
  return ctx;
}
function requirePriceFile(req: Request, res: Response, commit = false) {
  const fileName = fileNameFrom(req);
  if (!/\.(xls|xlsx|pdf|docx)$/i.test(fileName)) { res.status(400).json({ error: "Поддерживаются прайс‑листы Excel (.xls, .xlsx), PDF и Word (.docx)." }); return null; }
  if (!Buffer.isBuffer(req.body) || !req.body.length) { res.status(400).json({ error: "Файл прайс‑листа не получен." }); return null; }
  const unpacked = commit ? unpackCommitBody(req.body) : { buffer: req.body, options: null };
  if (!unpacked.buffer.length) { res.status(400).json({ error: "Файл прайс‑листа не получен." }); return null; }
  return { fileName, buffer: unpacked.buffer, options: unpacked.options };
}
export function registerPriceImportBinaryRoutes(app: Express) {
  const binary = express.raw({ type: "application/octet-stream", limit: "30mb" });
  app.post("/api/price-import/preview", binary, async (req, res) => { try { const ctx = await requirePricePermission(req, res, "upload"); if (!ctx) return; const source = requirePriceFile(req, res); if (!source) return; res.json(await previewPriceImport(source.buffer, source.fileName)); } catch (error) { res.status(400).json({ error: errorText(error) }); } });
  app.post("/api/price-import/commit", binary, async (req, res) => { try { const ctx = await requirePricePermission(req, res, "upload"); if (!ctx) return; const source = requirePriceFile(req, res, true); if (!source) return; const supplierName = typeof req.query.supplierName === "string" ? req.query.supplierName.trim() : ""; if (supplierName.length < 2 || supplierName.length > 160) { res.status(400).json({ error: "Укажите поставщика: от 2 до 160 символов." }); return; } const sourceDate = typeof req.query.sourceDate === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(req.query.sourceDate) ? req.query.sourceDate : undefined; const importOptions = source.options ?? { categorySelections: categorySelectionsFrom(req), priceEdits: [], priceAdditions: [], priceRemovals: [], rowEdits: [], metadataEdits: [], productLinks: [], excludedRowIndexes: [] }; const actor = await getCurrentLocalAccount(ctx.user!.openId); if (!actor) { res.status(401).json({ error: "Локальная учетная запись не найдена." }); return; } const result = await commitPriceImport({ buffer: source.buffer, fileName: source.fileName, supplierName, sourceDate, actorId: actor.id, ...importOptions }); const increases = await listSignificantPriceIncreases(result.importId); if (increases.length) { const recipients = await getPriceAlertRecipients(); const preview = increases.slice(0, 3).map(item => `${item.productName} +${item.percent}%`).join("; "); await createNotifications({ accountIds: recipients, severity: "warning", title: "Прайс‑контроль: существенное подорожание", message: `${supplierName}: ${increases.length} сопоставимых ${increases.length === 1 ? "товар" : "товаров"} подорожали на 10% и более. ${preview}${increases.length > 3 ? "…" : ""}`, entityType: "price", entityId: String(result.importId) }); } if (result.supplierWasCreated) await recordChange({ actorId: actor.id, action: "price_supplier.import_create", entityType: "price_supplier", entityId: String(result.supplier.id), afterState: { supplierName: result.supplier.name, source: `Импорт «${source.fileName}»` } }); if (result.createdProductDetails.length) await recordChange({ actorId: actor.id, action: "price_product.import_create", entityType: "price_product", entityId: String(result.importId), afterState: { fileName: source.fileName, supplierName: result.supplier.name, products: result.createdProductDetails } }); if (result.createdAliasDetails.length) await recordChange({ actorId: actor.id, action: "price_alias.import_link", entityType: "price_supplier_alias", entityId: String(result.importId), afterState: { fileName: source.fileName, supplierName: result.supplier.name, mappings: result.createdAliasDetails } }); await recordChange({ actorId: actor.id, action: "price_import.commit", entityType: "price_import", entityId: String(result.importId), afterState: { fileName: source.fileName, supplierName: result.supplier.name, sourceDate: sourceDate ?? null, rowCount: result.rowCount, linked: result.linked, suggested: result.suggested, unmapped: result.unmapped, createdProducts: result.createdProducts, categorizedRows: result.categorizedRows, explicitlyLinked: result.explicitlyLinked, excludedRows: result.excludedRows, editedPriceOptions: result.editedPriceOptions, addedPriceOptions: result.addedPriceOptions, removedPriceOptions: result.removedPriceOptions, editedNames: result.editedNames, editedMetadata: result.editedMetadata, significantIncreases: increases.length } }); res.json({ ...result, significantIncreases: increases.length }); } catch (error) { res.status(400).json({ error: errorText(error) }); } });
}
