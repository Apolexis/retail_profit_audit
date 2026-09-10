import { describe, expect, it } from "vitest";
import { buildSeasonalForecast } from "./forecastLogic";

const facts = [
  { store: "A", monthDate: "2025-01-01", metrics: { revenue: 100 } },
  { store: "A", monthDate: "2025-02-01", metrics: { revenue: 200 } },
  { store: "A", monthDate: "2025-03-01", metrics: { revenue: 300 } },
  { store: "A", monthDate: "2026-01-01", metrics: { revenue: 150 } },
  { store: "A", monthDate: "2026-02-01", metrics: { revenue: 300 } },
];

describe("сезонный прогноз по факту", () => {
  it("масштабирует доступный будущий сезон прошлого года по последнему фактическому темпу текущего года", () => {
    const result = buildSeasonalForecast({ facts, year: 2026, store: "__all__", metric: "revenue" });
    expect(result.latestActualMonth).toBe(2);
    expect(result.scaleFactor).toBe(0.75);
    expect(result.rows[2]).toMatchObject({ month: "Мар", historical: 300, actual: null, forecast: 225, forecastBasis: "seasonality" });
    expect(result.yearEndExpected).toBe(2700);
  });

  it("не выдумывает прогноз без сопоставимого фактического основания", () => {
    const result = buildSeasonalForecast({ facts: facts.filter(row => !row.monthDate.startsWith("2025")), year: 2026, store: "__all__", metric: "revenue" });
    expect(result.scaleFactor).toBeNull();
    expect(result.rows[2]).toMatchObject({ forecast: 225, forecastBasis: "run_rate" });
  });
});
