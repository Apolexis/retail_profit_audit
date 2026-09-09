import { describe, expect, it } from "vitest";
import { prepareDailyFacts } from "./dailyFacts";

describe("подготовка дневных фактов", () => {
  it("сохраняет продажи и НДФЛ на фактической дате, а согласованные месячные статьи распределяет по всему месяцу", () => {
    const rows = [
      { storeId: 1, store: "Точка", isHidden: false, importId: 10, monthDate: "2026-01", entryDate: "2026-01-01", metrics: { revenue: 120, rent: 3100, net_profit: 620, personal_income_tax_22: 22 } },
      { storeId: 1, store: "Точка", isHidden: false, importId: 10, monthDate: "2026-01", entryDate: "2026-01-02", metrics: { revenue: 280 } },
    ];
    const result = prepareDailyFacts(rows, { from: "2026-01-01", to: "2026-01-02" });
    expect(result.map(row => row.metrics.revenue)).toEqual([120, 280]);
    expect(result.map(row => row.metrics.rent)).toEqual([100, 100]);
    expect(result.map(row => row.metrics.net_profit)).toEqual([20, 20]);
    expect(result.map(row => row.metrics.personal_income_tax_22 ?? 0)).toEqual([22, 0]);
  });
});
