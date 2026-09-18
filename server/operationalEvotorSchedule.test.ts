import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { operationalEvotorScheduleDefinitions } from "./operationalEvotorSchedule";

const registry = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");

describe("планировщик read-only синхронизации Эвотор", () => {
  it("ограничивает каждый scheduled запуск одним складом с разным ритмом каталога и чеков", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog).toMatchObject({
      cron: "0 */15 * * * *",
      path: "/api/scheduled/operational-evotor-catalog",
    });
    expect(operationalEvotorScheduleDefinitions.evotor_documents).toMatchObject({
      cron: "0 */10 * * * *",
      path: "/api/scheduled/operational-evotor-documents",
    });
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.description).toContain("одного закрепленного склада");
    expect(operationalEvotorScheduleDefinitions.evotor_documents.description).toContain("следующей страницы");
  });

  it("оставляет внешние вызовы только внутри защищенных scheduled маршрутов", () => {
    expect(operationalEvotorScheduleDefinitions.evotor_catalog.path).toMatch(/^\/api\/scheduled\//);
    expect(operationalEvotorScheduleDefinitions.evotor_documents.path).toMatch(/^\/api\/scheduled\//);
  });

  it("ограничивает параллельность сохранения, чтобы callback завершался в лимите", () => {
    expect(registry).toContain("async function forEachBoundedBatch");
    expect(registry).toContain("await forEachBoundedBatch(page.documents, 4");
    expect(registry).toContain("await forEachBoundedBatch(preview.products, 12");
  });
});
