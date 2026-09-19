import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { operationalEvotorScheduleDefinitions } from "./operationalEvotorSchedule";

const registry = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const scheduler = readFileSync(new URL("./operationalEvotorSchedule.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("./evotorCatalog.ts", import.meta.url), "utf8");
const signals = readFileSync(new URL("./operationalSignals.ts", import.meta.url), "utf8");

describe("планировщик read-only синхронизации Эвотор", () => {
  it("ограничивает каждый scheduled запуск одним складом на минимальном допустимом интервале", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-catalog" });
    expect(operationalEvotorScheduleDefinitions.evotor_documents).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-documents" });
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.description).toContain("одного закрепленного склада");
    expect(operationalEvotorScheduleDefinitions.evotor_documents.description).toContain("следующей страницы");
  });

  it("оставляет внешние вызовы только внутри защищенных scheduled маршрутов", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.path).toMatch(/^\/api\/scheduled\//);
    expect(operationalEvotorScheduleDefinitions.evotor_documents.path).toMatch(/^\/api\/scheduled\//);
  });

  it("сохраняет страницу документов пакетно и гидратирует только агрегаты оплат", () => {
    expect(registry).toContain("const uniqueDocuments = Array.from(new Map(page.documents");
    expect(registry).toContain("const existingByExternalId = uniqueDocuments.length");
    expect(registry).toContain("for (let start = 0; start < newDocuments.length; start += 20)");
    expect(registry).toContain("await db.insert(operationalEvotorDocuments).values(batch.map");
    expect(registry).toContain("await db.insert(operationalEvotorDocumentPositions).values(positions)");
    expect(registry).toContain("paymentCaptureStatus: document.paymentSummary.captureStatus");
    expect(scheduler).toContain("paymentHeadersHydrated: result.hydratedPaymentDocuments");
    expect(registry).toContain("await forEachBoundedBatch(preview.products, 12");
  });

  it("сохраняет отдельные cursor-цепочки для сегодняшнего окна и архива 2025+", () => {
    expect(registry).toContain('mode?: "historical" | "current_day"');
    expect(registry).toContain('syncMode === "current_day" ? businessDate : EVOTOR_DOCUMENT_RETENTION_START');
    expect(registry).toContain("since: sync.cursor ? undefined : sync.requestedFrom");
    expect(registry).toContain("until: sync.cursor ? undefined : sync.requestedTo");
    expect(scheduler).toContain("async function nextDocumentSyncTarget");
    expect(scheduler).toContain('mode: "current_day"');
    expect(scheduler).toContain('importWindow: target.mode');
    expect(scheduler).toContain("oldest-page round robin");
    expect(scheduler).toContain("Start every mapped store before taking a second cursor page");
  });

  it("фиксирует только числовые сведения о квоте без реквизитов запроса", () => {
    expect(client).toContain('numberHeader("X-RateLimit-Limit")');
    expect(client).toContain('numberHeader("X-RateLimit-Remaining")');
    expect(scheduler).toContain("rateLimit: result.rateLimit");
    expect(client).not.toContain("Authorization: token");
  });

  it("проверяет операционные дедлайны идемпотентно внутри уже существующего минутного callback", () => {
    expect(scheduler).toContain("evaluateOperationalStoreSignals()");
    expect(signals).toContain("request_missing:");
    expect(signals).toContain("revenue_missing:");
    expect(signals).toContain("20 * 60 + 5");
    expect(signals).toContain("21 * 60 + 5");
    expect(signals).toContain("eq(stores.isHidden, false)");
    expect(signals).toContain("entityType: \"operational_signal\"");
  });
});
