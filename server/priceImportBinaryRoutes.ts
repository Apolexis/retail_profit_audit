import type { Express, Request, Response } from "express";
import express from "express";
import { getCurrentLocalAccount, getPriceAlertRecipients, hasPriceAccess } from "./accessControl";
import { createContext } from "./_core/context";
import { commitPriceImport, listSignificantPriceIncreases, previewPriceImport } from "./priceControl";
import { recordChange } from "./localAuth";
import { createNotifications } from "./notifications";

const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось обработать прайс‑лист.";
const fileNameFrom = (req: Request) => typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
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
async function requirePricePermission(req: Request, res: Response, required: "view" | "upload" | "edit") {
  const ctx = await createContext({ req, res } as never);
  if (!ctx.user) { res.status(401).json({ error: "Требуется вход в учетную запись." }); return null; }
  if (!await hasPriceAccess(ctx.user.openId, required)) { res.status(403).json({ error: "Нет назначенного доступа к прайс‑контролю." }); return null; }
  return ctx;
}
function requirePriceFile(req: Request, res: Response) {
  const fileName = fileNameFrom(req);
  if (!/\.(xls|xlsx|pdf|docx)$/i.test(fileName)) { res.status(400).json({ error: "Поддерживаются прайс‑листы Excel (.xls, .xlsx), PDF и Word (.docx)." }); return null; }
  if (!Buffer.isBuffer(req.body) || !req.body.length) { res.status(400).json({ error: "Файл прайс‑листа не получен." }); return null; }
  return { fileName, buffer: req.body };
}
export function registerPriceImportBinaryRoutes(app: Express) {
  const binary = express.raw({ type: "application/octet-stream", limit: "30mb" });
  app.post("/api/price-import/preview", binary, async (req, res) => { try { const ctx = await requirePricePermission(req, res, "upload"); if (!ctx) return; const source = requirePriceFile(req, res); if (!source) return; res.json(await previewPriceImport(source.buffer, source.fileName)); } catch (error) { res.status(400).json({ error: errorText(error) }); } });
  app.post("/api/price-import/commit", binary, async (req, res) => { try { const ctx = await requirePricePermission(req, res, "upload"); if (!ctx) return; const source = requirePriceFile(req, res); if (!source) return; const supplierName = typeof req.query.supplierName === "string" ? req.query.supplierName.trim() : ""; if (supplierName.length < 2 || supplierName.length > 160) { res.status(400).json({ error: "Укажите поставщика: от 2 до 160 символов." }); return; } const sourceDate = typeof req.query.sourceDate === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(req.query.sourceDate) ? req.query.sourceDate : undefined; const categorySelections = categorySelectionsFrom(req); const actor = await getCurrentLocalAccount(ctx.user!.openId); if (!actor) { res.status(401).json({ error: "Локальная учетная запись не найдена." }); return; } const result = await commitPriceImport({ buffer: source.buffer, fileName: source.fileName, supplierName, sourceDate, actorId: actor.id, categorySelections }); const increases = await listSignificantPriceIncreases(result.importId); if (increases.length) { const recipients = await getPriceAlertRecipients(); const preview = increases.slice(0, 3).map(item => `${item.productName} +${item.percent}%`).join("; "); await createNotifications({ accountIds: recipients, severity: "warning", title: "Прайс‑контроль: существенное подорожание", message: `${supplierName}: ${increases.length} сопоставимых ${increases.length === 1 ? "товар" : "товаров"} подорожали на 10% и более. ${preview}${increases.length > 3 ? "…" : ""}`, entityType: "price", entityId: String(result.importId) }); } await recordChange({ actorId: actor.id, action: "price_import.commit", entityType: "price_import", entityId: String(result.importId), afterState: { fileName: source.fileName, supplierName, sourceDate, rowCount: result.rowCount, linked: result.linked, suggested: result.suggested, unmapped: result.unmapped, createdProducts: result.createdProducts, categorizedRows: result.categorizedRows, significantIncreases: increases.length } }); res.json({ ...result, significantIncreases: increases.length }); } catch (error) { res.status(400).json({ error: errorText(error) }); } });
}
