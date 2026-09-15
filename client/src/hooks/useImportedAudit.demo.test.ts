import { describe, expect, it } from "vitest";
import { buildDemoPeriods, demoStoreNames } from "./useImportedAudit";

describe("демонстрационные факты", () => {
  const range = { from: "2026-01-01", to: "2026-03-31" };
  it("создает устойчивый набор без записи в финансовые факты", () => {
    const first = buildDemoPeriods([range], 101);
    expect(first).toHaveLength(demoStoreNames.length * 3);
    expect(first).toEqual(buildDemoPeriods([range], 101));
    expect(first.every(row => demoStoreNames.includes(row.store) && row.storeId < 0 && row.importId === null)).toBe(true);
    expect(first.find(row => row.store === "Н95")?.metrics.revenue).toBeGreaterThan(0);
  });
  it("сохраняет согласованность ключевых показателей", () => {
    const row = buildDemoPeriods([range], 101)[0];
    expect(row.metrics.receipts_total).toBe(row.metrics.revenue);
    expect(row.metrics.cash_revenue + row.metrics.cashless_revenue).toBe(row.metrics.revenue);
    expect(row.metrics.gross_profit).toBe(row.metrics.revenue - row.metrics.purchases);
  });
  it("дает другой демонстрационный набор при другом зерне", () => {
    expect(buildDemoPeriods([range], 101)[0].metrics.revenue).not.toBe(buildDemoPeriods([range], 202)[0].metrics.revenue);
  });
});
