import type { Express, Request, Response } from "express";
import express from "express";
import { getCurrentLocalAccount, hasPriceAccess } from "./accessControl";
import { createContext } from "./_core/context";
import { commitPriceImport, previewPriceImport } from "./priceControl";
import { recordChange } from "./localAuth";

const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось обработать прайс‑лист.";
const fileNameFrom = (req: Request) => typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
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
  app.post("/api/price-import/commit", binary, async (req, res) => { try { const ctx = await requirePricePermission(req, res, "upload"); if (!ctx) return; const source = requirePriceFile(req, res); if (!source) return; const supplierName = typeof req.query.supplierName === "string" ? req.query.supplierName.trim() : ""; if (supplierName.length < 2 || supplierName.length > 160) { res.status(400).json({ error: "Укажите поставщика: от 2 до 160 символов." }); return; } const sourceDate = typeof req.query.sourceDate === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(req.query.sourceDate) ? req.query.sourceDate : undefined; const actor = await getCurrentLocalAccount(ctx.user!.openId); if (!actor) { res.status(401).json({ error: "Локальная учетная запись не найдена." }); return; } const result = await commitPriceImport({ buffer: source.buffer, fileName: source.fileName, supplierName, sourceDate, actorId: actor.id }); await recordChange({ actorId: actor.id, action: "price_import.commit", entityType: "price_import", entityId: String(result.importId), afterState: { fileName: source.fileName, supplierName, sourceDate, rowCount: result.rowCount, linked: result.linked, suggested: result.suggested, unmapped: result.unmapped } }); res.json(result); } catch (error) { res.status(400).json({ error: errorText(error) }); } });
}
