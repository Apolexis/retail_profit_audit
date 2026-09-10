import { describe, expect, it } from "vitest";
import { SUPPORTED_MONTHLY_MATERIALIZATION_METRICS, materializeMonthlyDailyFacts, type ParsedPeriod } from "./audit";

const records: ParsedPeriod[] = [
  { store: "Тестовый магазин", monthDate: "2026-01", entryDate: "2026-01-01", metrics: [{ code: "delivery", amount: 120 }, { code: "rent", amount: 10 }, { code: "net_profit", amount: 300 }] },
  { store: "Тестовый магазин", monthDate: "2026-01", entryDate: "2026-01-02", metrics: [{ code: "delivery", amount: 0 }, { code: "rent", amount: 30 }, { code: "net_profit", amount: 0 }] },
];

const metric = (row: ParsedPeriod, code: string) => row.metrics.find(item => item.code === code)?.amount ?? 0;

describe("материализация будущих импортов", () => {
  it("сохраняет код payroll_tax и использует краткую подпись налога на зарплату", () => {
    expect(SUPPORTED_MONTHLY_MATERIALIZATION_METRICS.find(metric => metric.code === "payroll_tax")?.label).toBe("Налоги з/п");
  });

  it("материализует только выбранную согласованную статью и оставляет исключенную в исходной дневной записи", () => {
    const selected = materializeMonthlyDailyFacts(records, ["delivery"]);
    expect(selected.map(row => metric(row, "delivery"))).toEqual([60, 60]);

    const excluded = materializeMonthlyDailyFacts(records, []);
    expect(excluded.map(row => metric(row, "delivery"))).toEqual([120, 0]);
  });

  it("не делит чистую прибыль поровну: использует абсолютную дневную расходную нагрузку и сохраняет сумму месяца", () => {
    const result = materializeMonthlyDailyFacts(records, ["delivery"]);
    expect(result.map(row => metric(row, "net_profit"))).toEqual([131.25, 168.75]);
    expect(result.reduce((sum, row) => sum + metric(row, "net_profit"), 0)).toBe(300);
  });
});
