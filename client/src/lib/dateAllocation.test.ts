import { describe, expect, it } from "vitest";
import { allocateMetric, allocationRatio, monthBounds } from "./dateAllocation";

describe("allocationRatio", () => {
  const august = { monthDate: "2026-08", entryDate: "2026-08-01", importId: 7 };

  it("allocates an imported month equally across all calendar days", () => {
    expect(monthBounds("2026-08").days).toBe(31);
    expect(allocationRatio(august, { from: "2026-08-01", to: "2026-08-07" })).toBeCloseTo(7 / 31);
    expect(allocationRatio(august, { from: "2026-08-01", to: "2026-08-31" })).toBe(1);
  });

  it("keeps manually entered daily facts exact", () => {
    const daily = { monthDate: "2026-08", entryDate: "2026-08-12", importId: null };
    expect(allocationRatio(daily, { from: "2026-08-12", to: "2026-08-12" })).toBe(1);
    expect(allocationRatio(daily, { from: "2026-08-13", to: "2026-08-19" })).toBe(0);
  });

  it("does not allocate stock snapshots as operating flows", () => {
    expect(allocateMetric("net_profit", 31000, 7 / 31)).toBeCloseTo(7000);
    expect(allocateMetric("stock_close", 31000, 7 / 31)).toBe(31000);
  });
});
