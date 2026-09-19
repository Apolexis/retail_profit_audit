import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { __evotorSalesTestUtils, EVOTOR_DOCUMENT_RETENTION_START } from "./inventoryRegistry";

const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");

describe("read-only показатели продаж Эвотор", () => {
  it("группирует документ по московскому календарю, включая время", () => {
    expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "hour")).toMatchObject({ key: "2026-09-18T03", label: "18.09.2026 · 03:00" });
    expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "day")).toMatchObject({ key: "2026-09-18", label: "18.09.2026" });
    expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "week")).toMatchObject({ key: "2026-38", label: "Нед. 38 · 2026" });
  });

  it("доступен только администратору, принимает только календарный диапазон и не обращается к Эвотор", () => {
    expect(router).toContain("evotorSalesAnalytics");
    expect(router).toContain('actor.role !== "admin"');
    expect(router).toContain('granularity: z.enum(["month", "week", "day", "hour"])');
    expect(router).toContain('if (input.from > input.to)');
    expect(service).toContain("listOperationalEvotorSalesAnalytics");
    expect(service).toContain("operationalEvotorDocuments");
    expect(service).toContain("operationalEvotorDocumentPositions");
    expect(service).toContain("This does\n * not query Evotor");
  });

  it("не принимает в нормализованную витрину чеки до 2025 года", () => {
    expect(EVOTOR_DOCUMENT_RETENTION_START).toBe("2025-01-01");
    expect(service).toContain("filter(isRetainedEvotorDocument)");
    expect(service).toContain("businessDate >= EVOTOR_DOCUMENT_RETENTION_START");
    expect(service).toContain("input.from < EVOTOR_DOCUMENT_RETENTION_START");
  });

  it("отбирает только чеки продажи и отдает временной ряд самих товаров", () => {
    expect(service).toContain('eq(operationalEvotorDocuments.documentType, "SELL")');
    expect(service).toContain("productTimelineMap");
    expect(service).toContain("productTimeline: Array.from(productTimelineMap.values())");
    expect(service).toContain("productKey: key");
  });
});
