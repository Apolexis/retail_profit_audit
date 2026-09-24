import { describe, expect, it } from "vitest";
import { prepareDailyFacts } from "./dailyFacts";

describe("подготовка дневных фактов", () => {
  it("читает материализованные дневные факты без повторного распределения", () => {
    const rows = [
      { storeId: 1, store: "Точка", isHidden: false, importId: 10, monthDate: "2026-01", entryDate: "2026-01-01", metrics: { revenue: 120, rent: 3100, net_profit: 620, personal_income_tax_22: 22 } },
      { storeId: 1, store: "Точка", isHidden: false, importId: 10, monthDate: "2026-01", entryDate: "2026-01-02", metrics: { revenue: 280 } },
    ];
    const result = prepareDailyFacts(rows, { from: "2026-01-01", to: "2026-01-02" });
    expect(result.map(row => row.metrics.revenue)).toEqual([120, 280]);
    expect(result.map(row => row.metrics.rent ?? 0)).toEqual([3100, 0]);
    expect(result.map(row => row.metrics.net_profit ?? 0)).toEqual([620, 0]);
    expect(result.map(row => row.metrics.personal_income_tax_22 ?? 0)).toEqual([22, 0]);
  });
});
