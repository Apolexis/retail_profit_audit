import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const receiver = readFileSync(resolve(root, "server/_core/index.ts"), "utf8");
const credentials = readFileSync(resolve(root, "server/evotorWebhookCredentials.ts"), "utf8");
const registry = readFileSync(resolve(root, "server/inventoryRegistry.ts"), "utf8");
const router = readFileSync(resolve(root, "server/routers/localAuth.ts"), "utf8");

describe("V2 webhook чеков Эвотор", () => {
  it("принимает только server-side авторизованный JSON по отдельному маршруту", () => {
    expect(receiver).toContain('app.post("/api/integrations/evotor/v2/receipts"');
    expect(receiver).toContain('authorizeEvotorWebhook(req.header("Authorization")');
    expect(receiver).toContain('ingestOperationalEvotorWebhookReceipt({ payload: req.body })');
    expect(receiver).toContain('return res.status(200).json({ ok: true })');
    expect(receiver).not.toContain('recordChange({ payload: req.body');
  });

	it("реализует официальный V1 user-token flow без подмены токена приложения", () => {
	  expect(receiver).toContain('app.put("/api/v1/inventories/stores/:storeUuid/documents"');
	  expect(receiver).toContain('app.put("/api/integrations/evotor/v1/documents"');
	  expect(receiver).toContain('app.post("/api/v1/user/create", issueEvotorV1WebhookUser)');
	  expect(receiver).toContain('app.post("/api/v1/user/verify", issueEvotorV1WebhookUser)');
	  expect(receiver).toContain('app.post("/api/v1/user/token"');
	  expect(receiver).toContain('authorizeEvotorWebhook(req.header("Authorization") ?? undefined)');
	  expect(receiver).toContain('issueEvotorWebhookUserToken(userId)');
	  expect(receiver).toContain('storeEvotorCloudUserToken(userId, token)');
	  expect(receiver).toContain('authorizeEvotorWebhookUser(req.header("Authorization") ?? undefined)');
	  expect(receiver).toContain('ingestOperationalEvotorTerminalDocuments({ externalStoreId: req.params.storeUuid, payload: req.body })');
  });

  it("не выдаёт SPA-ответ за доставленный webhook при неверном методе", () => {
    expect(receiver).toContain('rejectUnsupportedEvotorWebhookMethod');
	  expect(receiver).toContain('app.all("/api/integrations/evotor/v2/receipts", rejectUnsupportedEvotorWebhookMethod("POST"))');
	  expect(receiver).toContain('app.all("/api/v1/user/token", rejectUnsupportedEvotorWebhookMethod("POST"))');
	  expect(receiver).toContain('app.all("/api/v1/inventories/stores/:storeUuid/documents", rejectUnsupportedEvotorWebhookMethod("PUT"))');
    expect(receiver).toContain('app.all("/api/integrations/evotor/v1/documents", rejectUnsupportedEvotorWebhookMethod("PUT"))');
    expect(receiver).toContain('status(405).json({ code: "method-not-allowed"');
  });

  it("хранит токен приложения зашифрованно и сравнивает его constant-time", () => {
    expect(credentials).toContain('const CREDENTIAL_KEY = "evotor_v2_webhook_application_token"');
    expect(credentials).toContain('aes-256-gcm');
    expect(credentials).toContain('timingSafeEqual(expected, received)');
    expect(credentials).toContain('The token and every representation of it stay out of the audit log.');
    expect(credentials).toContain('export async function revealEvotorWebhookCredential()');
    expect(credentials).toContain('application token for V2 "Отправить чек"');
    expect(credentials).toContain('V1 terminal documents require their own per-user token');
	  expect(credentials).toContain('randomBytes(32).toString("base64url")');
	  expect(credentials).toContain('operationalEvotorWebhookUsers');
	  expect(credentials).toContain('operationalEvotorCloudUserTokens');
	  expect(credentials).toContain('storeEvotorCloudUserToken');
    expect(credentials).toContain('tokenFingerprint');
    expect(router).toContain('replaceEvotorWebhookCredential');
    expect(router).toContain('revealEvotorWebhookCredential: adminProcedure.mutation');
    expect(router).not.toContain('replaceEvotorTerminalDocumentsCredential');
  });

  it("не сохраняет raw webhook, не создаёт дубли и не выдаёт тихую точку за ошибочную продажу", () => {
    expect(registry).toContain('export async function ingestOperationalEvotorWebhookReceipt');
    expect(registry).toContain('eq(operationalStoreMappings.evotorTerminalUuid, externalStoreId)');
    expect(registry).toContain('eq(operationalEvotorDocuments.evotorDocumentId, documentId)');
    expect(registry).toContain("if (existing) {");
    expect(registry).toContain("return { accepted: true, duplicate: true, documentId: existing.id };");
    expect(registry).toContain('Concurrent duplicate delivery may race');
    expect(registry).toContain('raw payloads/requisites are never stored');
    expect(registry).toContain('The scheduled V2 reader');
    expect(registry).toContain('reconciliation fallback.');
  });

  it("проверяет возврат и план после durable intake и повторяет проверку на безопасном duplicate", () => {
    expect(registry).toContain('import { evaluateCurrentDayEvotorReturnSignals } from "./operationalSignals";');
    expect(registry).toContain('const evaluateCurrentDaySignals = async () => {');
    expect(registry).toContain("await evaluateCurrentDayEvotorReturnSignals();");
    expect(registry).toContain("if (existing) {");
    expect(registry).toContain("if (raceExisting) {");
    expect(registry).toContain("[evotor-current-day-signal] notification deferred");
  });

  it("нормализует V1 документы без raw payload и даёт V2 один раз дополнить отсутствующие позиции", () => {
    expect(registry).toContain('export async function ingestOperationalEvotorTerminalDocuments');
    expect(registry).toContain('Webhook документов терминала Эвотор должен содержать до 200 документов.');
    expect(registry).toContain('eq(operationalStoreMappings.evotorTerminalUuid, externalStoreId)');
    expect(registry).toContain('const positionHydrationDocuments = syncMode === "current_day"');
    expect(registry).toContain('document.positions.length && !existingPositionCounts.get(existing.id)');
    expect(registry).toContain('it never replaces persisted');
  });
});
