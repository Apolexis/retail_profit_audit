import { buildOperationalCadence } from "./operationalCadence";
import { describe, expect, it } from "vitest";

describe("buildOperationalCadence", () => {
  it("ровно распределяет уже отобранный месячный поток по календарным дням", () => {
    const result = buildOperationalCadence([{ monthDate: "2026-08", entryDate: "2026-08-01", importId: 8, metrics: { revenue: 7000, net_profit: 700, purchases: 3500 } }], { from: "2026-08-01", to: "2026-08-07" });
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0].revenue).toBe(1000);
    expect(result.daily.reduce((total, day) => total + day.revenue, 0)).toBe(7000);
    expect(result.weekly.reduce((total, week) => total + week.revenue, 0)).toBe(7000);
  });

  it("не разносит ручную дневную запись и не включает остатки в поток", () => {
    const result = buildOperationalCadence([{ monthDate: "2026-08", entryDate: "2026-08-03", importId: null, metrics: { revenue: 1200, stock_close: 999999 } }], { from: "2026-08-01", to: "2026-08-07" });
    expect(result.daily.find(day => day.date === "2026-08-03")?.revenue).toBe(1200);
    expect(result.daily.reduce((total, day) => total + day.revenue, 0)).toBe(1200);
    expect(result.daily.some(day => "stockClose" in day)).toBe(false);
  });
});
