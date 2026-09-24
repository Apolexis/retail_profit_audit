import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";
import { createScheduledExecutiveReport, findWeeklyScheduleByTaskUid, isWeeklyReportDue } from "../weeklyReports";
import { registerImportBinaryRoutes } from "../importBinaryRoutes";
import { registerPriceImportBinaryRoutes } from "../priceImportBinaryRoutes";
import {
  ensureOperationalEvotorSchedules,
  runScheduledEvotorCatalog,
  runScheduledEvotorDocuments,
  type OperationalEvotorScheduledKind,
} from "../operationalEvotorSchedule";
import { importOnecPackage } from "../onecImport";
import { ingestOperationalEvotorTerminalDocuments, ingestOperationalEvotorWebhookReceipt } from "../inventoryRegistry";
import { authorizeOnecInboundKey, markOnecInboundAccepted } from "../onecInboundCredentials";
import { authorizeEvotorWebhook, authorizeEvotorWebhookUser, issueEvotorWebhookUserToken, storeEvotorCloudUserToken } from "../evotorWebhookCredentials";
import { recordChange } from "../localAuth";
import { isSchedulerAuthenticationFailure, safeRussianDiagnostic } from "../httpRussianError";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function scheduledAccessDenied(res: express.Response) {
  return res.status(403).json({ code: "cron-only", error: "Доступ разрешен только планировщику приложения." });
}

function scheduledFailure(res: express.Response, error: unknown, code: string, label: string) {
  if (isSchedulerAuthenticationFailure(error)) return scheduledAccessDenied(res);
  return res.status(500).json({ code, error: label, message: safeRussianDiagnostic(error, "Повторите запуск позднее.") });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerImportBinaryRoutes(app);
  registerPriceImportBinaryRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.post("/api/scheduled/weekly-executive-report", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return scheduledAccessDenied(res);
      const schedule = await findWeeklyScheduleByTaskUid(user.taskUid);
      if (!schedule) return res.json({ ok: true, skipped: "orphan-or-disabled" });
      if (!isWeeklyReportDue(schedule)) return res.json({ ok: true, skipped: "not-scheduled-time" });
      const result = await createScheduledExecutiveReport();
      return res.json({ ok: true, created: result.created, reportId: result.report.id });
    } catch (error) {
      return scheduledFailure(res, error, "weekly-report-failed", "Не удалось сформировать еженедельный отчет.");
    }
  });
  app.post("/api/scheduled/operational-evotor-catalog", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return scheduledAccessDenied(res);
      // Retired one-lane callback: the scheduler disables it at startup and the
      // new deterministic catalog lanes below perform the read-only work.
      return scheduledAccessDenied(res);
    } catch (error) {
      return scheduledFailure(res, error, "operational-evotor-catalog-sync-failed", "Не удалось обновить каталог Эвотор.");
    }
  });
  for (let currentIndex = 1; currentIndex <= 4; currentIndex += 1) {
    const currentKind = `evotor_catalog_current_${currentIndex}` as Parameters<typeof runScheduledEvotorCatalog>[1];
    app.post(`/api/scheduled/operational-evotor-catalog-current-${currentIndex}`, async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user.isCron || !user.taskUid) return scheduledAccessDenied(res);
        return res.json({ ok: true, ...(await runScheduledEvotorCatalog(user.taskUid, currentKind)) });
      } catch (error) {
        return scheduledFailure(res, error, "operational-evotor-catalog-sync-failed", "Не удалось обновить каталог Эвотор.");
      }
    });
  }
  app.post("/api/scheduled/operational-evotor-documents", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return scheduledAccessDenied(res);
      return res.json({ ok: true, ...(await runScheduledEvotorDocuments(user.taskUid)) });
    } catch (error) {
      return scheduledFailure(res, error, "operational-evotor-document-sync-failed", "Не удалось загрузить документы Эвотор.");
    }
  });
  for (let currentIndex = 1; currentIndex <= 32; currentIndex += 1) {
    const currentKind = `evotor_documents_current_${currentIndex}` as OperationalEvotorScheduledKind;
    app.post(`/api/scheduled/operational-evotor-documents-current-${currentIndex}`, async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user.isCron || !user.taskUid) return scheduledAccessDenied(res);
        return res.json({ ok: true, ...(await runScheduledEvotorDocuments(user.taskUid, currentKind)) });
      } catch (error) {
        return scheduledFailure(res, error, "operational-evotor-current-sync-failed", "Не удалось обновить текущие документы Эвотор.");
      }
    });
  }
  /**
   * Fail-closed, one-way 1С receiver. It shares the established import service,
   * so snapshots/shipments still go through validation, idempotency and
   * quarantine and can never conduct shop stock or call an external system.
   */
  app.post("/api/integrations/1c/import", async (req, res) => {
    try {
      const header = req.header("X-1C-Key") ?? undefined;
      const credential = await authorizeOnecInboundKey(header);
      if (!credential) return res.status(401).json({ code: "unauthorized", error: "Ключ 1С не принят." });
      if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ code: "invalid-packet", error: "Ожидается один JSON-пакет 1С." });
      }
      const result = await importOnecPackage({ packet: req.body, actorId: credential.actorId });
      await markOnecInboundAccepted(credential.credentialId);
      if (result.created) {
        await recordChange({
          actorId: credential.actorId,
          action: "operational_onec.inbound_import",
          entityType: "operational_onec_import_batch",
          entityId: String(result.batch.id),
          afterState: {
            entity: result.batch.entity,
            totalRecords: result.batch.totalRecords,
            acceptedRecords: result.batch.acceptedRecords,
            quarantinedRecords: result.batch.quarantinedRecords,
            status: result.batch.status,
            policy: "one-way authenticated receiver; isolated registry; no automatic shop stock or external write",
          },
        });
      }
      return res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, batchId: result.batch.id, status: result.batch.status, message: result.message });
    } catch (error) {
      // No request body, technical source IDs or credential values are returned or logged.
      return res.status(400).json({ code: "packet-rejected", error: "Пакет 1С отклонен.", message: safeRussianDiagnostic(error, "Проверьте структуру пакета и повторите передачу.") });
    }
  });
  /**
   * V2 "Отправить чек" receiver. It does not call Evotor and never keeps raw
   * webhook JSON, fiscal data, a device ID or the Authorization value. The
   * accepted document is normalized idempotently before returning 200 OK.
   */
  app.post("/api/integrations/evotor/v2/receipts", async (req, res) => {
    try {
      if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ code: "invalid-receipt", error: "Ожидается JSON webhook чека Эвотор." });
      }
      const authorized = await authorizeEvotorWebhook(req.header("Authorization") ?? undefined);
      if (!authorized) return res.status(401).json({ code: "unauthorized", error: "Webhook Эвотор не авторизован." });
      await ingestOperationalEvotorWebhookReceipt({ payload: req.body });
      return res.status(200).json({ ok: true });
    } catch {
      // Do not expose payload fields, token values, device IDs or database details.
      return res.status(400).json({ code: "receipt-rejected", error: "Webhook чека Эвотор отклонен." });
    }
  });
  const evotorWebhookUserId = (body: unknown) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const value = (body as Record<string, unknown>).userId;
    if (typeof value !== "string") return null;
    const userId = value.trim();
    return userId.length >= 3 && userId.length <= 96 ? userId : null;
  };
  /**
   * Official V1 handshake: Cloud authenticates with the application token,
   * then receives an opaque user token for subsequent V1 notifications.
   */
  const issueEvotorV1WebhookUser = async (req: express.Request, res: express.Response) => {
    try {
      if (!req.is("application/json")) return res.status(400).json({ code: "invalid-user", error: "Ожидается JSON с userId Эвотор." });
      const authorized = await authorizeEvotorWebhook(req.header("Authorization") ?? undefined);
      if (!authorized) return res.status(401).json({ code: "unauthorized", error: "Webhook Эвотор не авторизован." });
      const userId = evotorWebhookUserId(req.body);
      if (!userId) return res.status(400).json({ code: "invalid-user", error: "Не передан корректный userId Эвотор." });
      return res.status(200).json(await issueEvotorWebhookUserToken(userId));
    } catch {
      return res.status(400).json({ code: "user-token-rejected", error: "Не удалось выдать пользовательский токен webhook Эвотор." });
    }
  };
  app.post("/api/v1/user/create", issueEvotorV1WebhookUser);
  app.post("/api/v1/user/verify", issueEvotorV1WebhookUser);

  /** V1 Cloud posts its own user token after the application is installed. */
  app.post("/api/v1/user/token", async (req, res) => {
    try {
      if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ code: "invalid-user-token", error: "Ожидается JSON с userId и токеном Эвотор." });
      }
      const authorized = await authorizeEvotorWebhook(req.header("Authorization") ?? undefined);
      if (!authorized) return res.status(401).json({ code: "unauthorized", error: "Webhook Эвотор не авторизован." });
      const body = req.body as Record<string, unknown>;
      const userId = evotorWebhookUserId(body);
      const token = typeof body.token === "string" ? body.token : "";
      if (!userId || !token.trim()) return res.status(400).json({ code: "invalid-user-token", error: "Не передан корректный userId или токен Эвотор." });
      await storeEvotorCloudUserToken(userId, token);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(400).json({ code: "user-token-rejected", error: "Токен пользователя Эвотор отклонен." });
    }
  });

  /** V1 "Передать документы" accepts only a token produced by the handshake. */
  app.put("/api/v1/inventories/stores/:storeUuid/documents", async (req, res) => {
    try {
      if (!req.is("application/json") || !Array.isArray(req.body)) {
        return res.status(400).json({ code: "invalid-terminal-documents", error: "Ожидается JSON-массив документов терминала Эвотор." });
      }
      const authorized = await authorizeEvotorWebhookUser(req.header("Authorization") ?? undefined);
      if (!authorized) return res.status(401).json({ code: "unauthorized", error: "Webhook документов терминала Эвотор не авторизован." });
      await ingestOperationalEvotorTerminalDocuments({ externalStoreId: req.params.storeUuid, payload: req.body });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(400).json({ code: "terminal-documents-rejected", error: "Webhook документов терминала Эвотор отклонен." });
    }
  });
  // Some cabinet forms store one fixed V1 documents URL rather than a templated
  // store path. The per-user token remains required; storeUuid comes from body.
  app.put("/api/integrations/evotor/v1/documents", async (req, res) => {
    try {
      if (!req.is("application/json") || !Array.isArray(req.body)) {
        return res.status(400).json({ code: "invalid-terminal-documents", error: "Ожидается JSON-массив документов терминала Эвотор." });
      }
      const authorized = await authorizeEvotorWebhookUser(req.header("Authorization") ?? undefined);
      if (!authorized) return res.status(401).json({ code: "unauthorized", error: "Webhook документов терминала Эвотор не авторизован." });
      const firstDocument = req.body[0] && typeof req.body[0] === "object" && !Array.isArray(req.body[0]) ? req.body[0] as Record<string, unknown> : null;
      const externalStoreId = typeof firstDocument?.storeUuid === "string" ? firstDocument.storeUuid : "";
      await ingestOperationalEvotorTerminalDocuments({ externalStoreId, payload: req.body });
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(400).json({ code: "terminal-documents-rejected", error: "Webhook документов терминала Эвотор отклонен." });
    }
  });
  // Do not let a mistyped cabinet method fall through to the SPA and appear as a
  // successful webhook delivery. Correct V2/V1 requests have already matched
  // the handlers above; only every other method reaches these explicit 405s.
  const rejectUnsupportedEvotorWebhookMethod = (allowedMethod: "POST" | "PUT") => (_req: express.Request, res: express.Response) =>
    res.set("Allow", allowedMethod).status(405).json({ code: "method-not-allowed", error: `Для этого webhook Эвотор используйте ${allowedMethod}.` });
  app.all("/api/integrations/evotor/v2/receipts", rejectUnsupportedEvotorWebhookMethod("POST"));
  app.all("/api/v1/user/create", rejectUnsupportedEvotorWebhookMethod("POST"));
  app.all("/api/v1/user/verify", rejectUnsupportedEvotorWebhookMethod("POST"));
  app.all("/api/v1/user/token", rejectUnsupportedEvotorWebhookMethod("POST"));
  app.all("/api/v1/inventories/stores/:storeUuid/documents", rejectUnsupportedEvotorWebhookMethod("PUT"));
  app.all("/api/integrations/evotor/v1/documents", rejectUnsupportedEvotorWebhookMethod("PUT"));
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    void ensureOperationalEvotorSchedules().catch(error =>
      console.error("[operational-evotor-schedule]", error instanceof Error ? error.message : error)
    );
  });
}

startServer().catch(console.error);
