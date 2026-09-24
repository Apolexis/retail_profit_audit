import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
const home = source("Home.tsx");
const cadence = source("OperationalCadence.tsx");
const forecast = source("Forecast.tsx");
const products = source("EvotorSalesAnalytics.tsx");
const receipts = source("EvotorReceipts.tsx");
const importedAudit = readFileSync(new URL("../hooks/useImportedAudit.ts", import.meta.url), "utf8");

describe("изоляция демонстрационного режима от реальных фактов Эвотор", () => {
  it("не читает реальную финансовую книгу и строит только синтетические периоды", () => {
    expect(importedAudit).toContain("trpc.audit.dashboard.useQuery(input,{retry:false,enabled:!demoMode})");
    expect(importedAudit).toContain("demoMode?buildDemoPeriods(input.ranges,demoSeed)");
    expect(importedAudit).toContain("не читает и не записывает финансовые факты пользователя");
  });

  it("выключает все read-only запросы Эвотор и не выводит их кэшированные данные", () => {
    expect(home).toContain('const mayReadEvotorFacts = me.data?.role === "admin" && !demoMode');
    expect(cadence).toContain("enabled: !demoMode && needsEvotorFacts && range.to >= \"2025-01-01\"");
    expect(cadence).toContain("const evotorTimeline = demoMode ? []");
    expect(forecast).toContain('me.data?.role === "admin" && !demoMode');
    expect(products).toContain("enabled: !demoMode");
    expect(products).toContain("const data = demoMode ? undefined : query.data");
    expect(receipts).toContain("enabled: !demoMode");
    expect(receipts).toContain("Чеки Эвотор отключены в демо‑режиме");
  });

  it("не подменяет демо финансовые показатели реальными чеками при открытии аналитических страниц", () => {
    expect(cadence).toContain("current => current.some(metric => metric.startsWith(\"evotor\")) ? current : [\"evotorAmount\"]");
    expect(cadence).toContain("if (!demoMode) return;");
    expect(forecast).toContain("const metrics = evotorOnlyMode ? evotorForecastMetrics : mayReadEvotorForecast ? [...financialMetrics, ...evotorForecastMetrics] : financialMetrics;");
    expect(products).toContain("Проданные товары отключены в демо‑режиме");
    expect(receipts).toContain("Чеки Эвотор отключены в демо‑режиме");
  });
});
