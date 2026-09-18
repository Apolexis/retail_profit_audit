import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { operationalEvotorScheduleDefinitions } from "./operationalEvotorSchedule";

const registry = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");

describe("планировщик read-only синхронизации Эвотор", () => {
  it("ограничивает каждый scheduled запуск одним складом на минимальном допустимом интервале", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog).toMatchObject({
      cron: "0 * * * * *",
      path: "/api/scheduled/operational-evotor-catalog",
    });
    expect(operationalEvotorScheduleDefinitions.evotor_documents).toMatchObject({
      cron: "0 * * * * *",
      path: "/api/scheduled/operational-evotor-documents",
    });
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.description).toContain("одного закрепленного склада");
    expect(operationalEvotorScheduleDefinitions.evotor_documents.description).toContain("следующей страницы");
  });

  it("оставляет внешние вызовы только внутри защищенных scheduled маршрутов", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.path).toMatch(/^\/api\/scheduled\//);
    expect(operationalEvotorScheduleDefinitions.evotor_documents.path).toMatch(/^\/api\/scheduled\//);
  });

	it("сохраняет страницу документов пакетно, чтобы callback завершался в лимите", () => {
		expect(registry).toContain("const uniqueDocuments = Array.from(new Map(page.documents");
		expect(registry).toContain("const existingIds = uniqueDocuments.length");
		expect(registry).toContain("for (let start = 0; start < newDocuments.length; start += 20)");
		expect(registry).toContain("await db.insert(operationalEvotorDocuments).values(batch.map");
		expect(registry).toContain("await db.insert(operationalEvotorDocumentPositions).values(positions)");
		expect(registry).toContain("await forEachBoundedBatch(preview.products, 12");
	});

	it("начинает новую серию документов с 2025 года и продолжает ее только opaque cursor", () => {
		expect(registry).toContain("requestedFrom: EVOTOR_DOCUMENT_RETENTION_START");
		expect(registry).toContain("requestedTo: moscowBusinessDate()");
		expect(registry).toContain("Серия перезапущена с границы хранения 2025-01-01.");
		expect(registry).toContain("since: sync.cursor ? undefined : sync.requestedFrom");
		expect(registry).toContain("until: sync.cursor ? undefined : sync.requestedTo");
	});
});
