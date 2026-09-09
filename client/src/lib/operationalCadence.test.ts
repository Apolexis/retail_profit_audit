import { buildOperationalCadence } from "./operationalCadence";
import { describe, expect, it } from "vitest";

describe("buildOperationalCadence", () => {
  it("суммирует первичные дневные значения без повторного распределения", () => {
    const result = buildOperationalCadence([{ monthDate: "2026-08", entryDate: "2026-08-01", importId: 8, metrics: { revenue: 1200, net_profit: 120, purchases: 600 } }, { monthDate: "2026-08", entryDate: "2026-08-02", importId: 8, metrics: { revenue: 5800, net_profit: 580, purchases: 2900 } }], { from: "2026-08-01", to: "2026-08-07" });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0].revenue).toBe(1200);
    expect(result.daily[1].revenue).toBe(5800);
    expect(result.daily.reduce((total, day) => total + day.revenue, 0)).toBe(7000);
    expect(result.weekly.reduce((total, week) => total + week.revenue, 0)).toBe(7000);
  });

  it("не разносит ручную дневную запись и не включает остатки в поток", () => {
    const result = buildOperationalCadence([{ monthDate: "2026-08", entryDate: "2026-08-03", importId: null, metrics: { revenue: 1200, stock_close: 999999 } }], { from: "2026-08-01", to: "2026-08-07" });
    expect(result.daily.find(day => day.date === "2026-08-03")?.revenue).toBe(1200);
    expect(result.daily.reduce((total, day) => total + day.revenue, 0)).toBe(1200);
    expect(result.daily.some(day => "stockClose" in day)).toBe(false);
  });

  it("показывает состав наличных расходов отдельно от НДФЛ 22%", () => {
    const result = buildOperationalCadence([{ monthDate: "2026-08", entryDate: "2026-08-03", importId: 8, metrics: { household: 100, delivery: 200, driver_cash: 300, personal_income_tax_22: 132 } }], { from: "2026-08-01", to: "2026-08-07" });
    const day = result.daily.find(item => item.date === "2026-08-03");
    expect(day?.cashExpenses).toBe(600);
    expect(day?.cashTaxes).toBe(132);
    expect(day?.household).toBe(100);
    expect(day?.delivery).toBe(200);
    expect(day?.driverCash).toBe(300);
    const weekWithCash = result.weekly.find(item => item.cashExpenses > 0);
    expect(weekWithCash?.cashExpenses).toBe(600);
    expect(weekWithCash?.cashTaxes).toBe(132);
  });
});
