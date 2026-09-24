import { describe, expect, it } from "vitest";
import { PAYMENT_REVENUE_METRIC_CODES, mergeOperationalRevenueFacts, operationalRevenueFactMetrics } from "./audit";

describe("payment revenue metrics", () => {
  it("keeps the three payment-revenue facts available for a non-destructive backfill", () => {
    expect(PAYMENT_REVENUE_METRIC_CODES).toEqual(["cash_revenue", "cashless_revenue", "receipts_total"]);
  });

  it("uses an active website transfer for cash, cashless, and total instead of summing it with Excel", () => {
    const result = mergeOperationalRevenueFacts(
      [{ storeId: 1, store: "А1", isHidden: false, importId: 7, monthDate: "2026-09", entryDate: "2026-09-21", metrics: { cash_revenue: 100, cashless_revenue: 900, receipts_total: 1_000, rent: 400 } }],
      [{ storeId: 1, businessDate: "2026-09-21", cash: 120, cashless: 880 }],
    );
    expect(result).toEqual([
      expect.objectContaining({
        metrics: { cash_revenue: 120, cashless_revenue: 880, receipts_total: 1_000, rent: 400 },
      }),
    ]);
  });

  it("keeps an Excel row intact when there is no active website transfer", () => {
    const result = mergeOperationalRevenueFacts(
      [{ storeId: 1, store: "А1", isHidden: false, importId: 7, monthDate: "2026-09", entryDate: "2026-09-21", metrics: { cash_revenue: 100, cashless_revenue: 900, receipts_total: 1_000 } }],
      [],
    );
    expect(result[0]?.metrics).toEqual({ cash_revenue: 100, cashless_revenue: 900, receipts_total: 1_000 });
  });

  it("overlays only a filled same-named expense and preserves Excel for a blank transfer field", () => {
    const result = mergeOperationalRevenueFacts(
      [{ storeId: 1, store: "А1", isHidden: false, importId: 7, monthDate: "2026-09", entryDate: "2026-09-21", metrics: { operating_costs: 500, delivery: 300 } }],
      [{ storeId: 1, businessDate: "2026-09-21", cash: 0, cashless: 0, cashExpenses: 700, deliveryCash: 0 }],
    );
    expect(result[0]?.metrics).toMatchObject({ operating_costs: 700, delivery: 300 });
  });

  it("creates a daily fact from a website transfer when Excel has no row", () => {
    const result = mergeOperationalRevenueFacts(
      [],
      [{ storeId: 1, businessDate: "2026-09-21", cash: 120, cashless: 880 }],
      new Map([[1, { name: "А1", isHidden: false }]]),
    );
    expect(result).toEqual([
      expect.objectContaining({
        store: "А1",
        importId: null,
        entryDate: "2026-09-21",
        metrics: operationalRevenueFactMetrics({ storeId: 1, businessDate: "2026-09-21", cash: 120, cashless: 880 }),
      }),
    ]);
  });
});
