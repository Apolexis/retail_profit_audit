import type { Express, Request, Response } from "express";
import express from "express";
import { createContext } from "./_core/context";
import { hasImportAccess, getCurrentLocalAccount, hasImportControlAccess } from "./accessControl";
import { commitWorkbookForDateRangeFast, getImportThresholdBreaches, previewImportThresholdBreaches, previewWorkbook, withWorkbookCredentials } from "./audit";
import { buildImportPreviewSummary } from "./importPreviewSummary";
import { resolveImportCredentials } from "./importCredentials";
import { recordChange } from "./localAuth";
import { createStoreEventNotifications } from "./notifications";

type Resolution = "replace" | "skip" | "preserve_manual";
const resolutionSet = new Set<Resolution>(["replace", "skip", "preserve_manual"]);

const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось обработать книгу Excel.";
const sourceName = (req: Request) => typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
const sourceRange = (req: Request) => {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  return /^20\d{2}-\d{2}-\d{2}$/.test(from) && /^20\d{2}-\d{2}-\d{2}$/.test(to) && from <= to ? { from, to } : undefined;
};
type ImportThresholdBreach = Awaited<ReturnType<typeof getImportThresholdBreaches>>[number];

export function summarizeImportThresholdBreaches(fileName: string, thresholdBreaches: ImportThresholdBreach[]) {
  const stores = new Set(thresholdBreaches.map(breach => breach.store));
  const rules = new Map<string, number>();
  for (const breach of thresholdBreaches) rules.set(breach.rule.label, (rules.get(breach.rule.label) ?? 0) + 1);
  const topRules = Array.from(rules.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, count]) => `${label} — ${count}`).join("; ");
  return {
    severity: thresholdBreaches.some(breach => breach.rule.severity === "critical") ? "critical" as const : "warning" as const,
    title: `Импорт: ${thresholdBreaches.length} пороговых сигналов`,
    message: `Книга «${fileName}» выявила ${thresholdBreaches.length} пороговых событий в ${stores.size} магазинах. ${topRules || "Откройте Сигналы для расшифровки."}`,
  };
}

/** Never send monetary control details to an uploader who lacks the dedicated preview permission. */
export function redactImportControlPreview<T extends ReturnType<typeof buildImportPreviewSummary>>(summary: T, canViewImportControls: boolean) {
  if (canViewImportControls) return { ...summary, canViewImportControls: true };
  return { ...summary, canViewImportControls: false, dailyTotals: [], thresholdBreachCount: 0, thresholdBreaches: [] };
}

async function requireBinaryImportAccess(req: Request, res: Response, required: "upload" | "edit") {
  const ctx = await createContext({ req, res } as never);
  if (!ctx.user) {
    res.status(401).json({ error: "Требуется вход в учетную запись." });
    return null;
  }
  if (!await hasImportAccess(ctx.user.openId, required)) {
    res.status(403).json({ error: required === "edit" ? "Нет права изменять импортированные данные." : "Нет права загружать книги Excel." });
    return null;
  }
  return ctx;
}

function requireWorkbook(req: Request, res: Response) {
  const fileName = sourceName(req);
  if (!/\.(xlsx|xlsm)$/i.test(fileName)) {
    res.status(400).json({ error: "Поддерживается книга Excel .xlsx или .xlsm." });
    return null;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "Файл книги не получен." });
    return null;
  }
  return { fileName, buffer: req.body };
}

export function registerImportBinaryRoutes(app: Express) {
  const binary = express.raw({ type: "application/octet-stream", limit: "50mb" });

  app.post("/api/audit-import/preview", binary, async (req, res) => {
    try {
      const ctx = await requireBinaryImportAccess(req, res, "upload");
      if (!ctx) return;
      const source = requireWorkbook(req, res);
      if (!source) return;
      const preview = await previewWorkbook(source.buffer, source.fileName, await resolveImportCredentials());
      const canViewImportControls = await hasImportControlAccess(ctx.user!.openId);
      const thresholdBreaches = canViewImportControls ? await previewImportThresholdBreaches(preview.periods) : [];
      res.json(redactImportControlPreview(buildImportPreviewSummary(preview, thresholdBreaches), canViewImportControls));
    } catch (error) {
      res.status(400).json({ error: errorText(error) });
    }
  });

  app.post("/api/audit-import/commit", binary, async (req, res) => {
    try {
      const requestedResolution = typeof req.query.resolution === "string" ? req.query.resolution : "";
      if (!resolutionSet.has(requestedResolution as Resolution)) {
        res.status(400).json({ error: "Выберите допустимый способ обработки совпадений." });
        return;
      }
      const resolution = requestedResolution as Resolution;
      const ctx = await requireBinaryImportAccess(req, res, resolution === "skip" ? "upload" : "edit");
      if (!ctx) return;
      const source = requireWorkbook(req, res);
      if (!source) return;
      const actor = await getCurrentLocalAccount(ctx.user!.openId);
      if (!actor) {
        res.status(401).json({ error: "Локальная учетная запись не найдена." });
        return;
      }
      const credentials = await resolveImportCredentials();
      const result = await withWorkbookCredentials(credentials, () => commitWorkbookForDateRangeFast(source.buffer, source.fileName, resolution, sourceRange(req)));
      const thresholdBreaches = await getImportThresholdBreaches(result.importId);
      await recordChange({
        actorId: actor.id,
        action: "import.commit",
        entityType: "import",
        entityId: String(result.importId),
        afterState: { fileName: source.fileName, resolution, dateRange: sourceRange(req) ?? "все распознанные даты", thresholdBreaches: thresholdBreaches.length, ...result },
      });
      if (thresholdBreaches.length) {
        const summary = summarizeImportThresholdBreaches(source.fileName, thresholdBreaches);
        await createStoreEventNotifications({
          severity: summary.severity,
          title: summary.title,
          message: summary.message,
          entityType: "alert_feed",
          entityId: String(result.importId),
        });
      }
      res.json({ ...result, thresholdBreaches: thresholdBreaches.length });
    } catch (error) {
      res.status(400).json({ error: errorText(error) });
    }
  });
}
