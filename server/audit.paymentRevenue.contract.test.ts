import { describe, expect, it } from "vitest";
import { PAYMENT_REVENUE_METRIC_CODES } from "./audit";

describe("payment revenue metrics", () => {
  it("keeps the three payment-revenue facts available for a non-destructive backfill", () => {
    expect(PAYMENT_REVENUE_METRIC_CODES).toEqual(["cash_revenue", "cashless_revenue", "receipts_total"]);
  });
});
