import { describe, expect, it } from "vitest";
import { buildImportPreviewSummary } from "./importPreviewSummary";

describe("buildImportPreviewSummary", () => {
  it("returns daily aggregates and bounded examples instead of every metric row", () => {
    const result = buildImportPreviewSummary(
      {
        year: 2025,
        stores: ["ПОРТ", "КНИП"],
        periods: [
          { store: "ПОРТ", monthDate: "2025-01", entryDate: "2025-01-01", metrics: [{ code: "delivery", amount: 100 }, { code: "personal_income_tax_22", amount: 22 }] },
          { store: "КНИП", monthDate: "2025-01", entryDate: "2025-01-01", metrics: [{ code: "delivery", amount: -50 }] },
        ],
        recognitionIssues: [],
        conflicts: [{ store: "ПОРТ", monthDate: "2025-01", entryDate: "2025-01-01" }],
        protectedMetrics: [{ store: "КНИП", entryDate: "2025-01-01", metricCode: "rent" }],
      },
      [{ entryDate: "2025-01-01", store: "ПОРТ", amount: 100 }],
    );

    expect(result.periodCount).toBe(2);
    expect(result.dailyTotals).toEqual([
      expect.objectContaining({
        entryDate: "2025-01-01",
        periodCount: 2,
        cashTotals: { delivery: 150 },
        ndflTotal: 22,
        conflictCount: 1,
        protectedMetricCount: 1,
        thresholdBreachCount: 1,
      }),
    ]);
    expect("periods" in result).toBe(false);
  });
});
