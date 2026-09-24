import { describe, expect, it } from "vitest";
import { resolveReportWindow } from "./weeklyReports";

describe("custom executive report window", () => {
  it("keeps an explicitly selected calendar range exactly as requested", () => {
    expect(resolveReportWindow("custom", { periodStart: "2026-02-03", periodEnd: "2026-08-17" })).toEqual({
      periodStart: "2026-02-03",
      periodEnd: "2026-08-17",
    });
  });

  it("preserves the existing completed-period resolver for scheduled reports", () => {
    expect(resolveReportWindow("month", { periodStart: "2026-07-01", periodEnd: "2026-07-31" })).toEqual({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
  });
});
