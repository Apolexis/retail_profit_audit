import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./useAuditFacts.ts", import.meta.url), "utf8");

describe("useAuditFacts payment revenue", () => {
  it("keeps cash, cashless and total receipt fields in each summary", () => {
    expect(source).toContain("cashRevenue");
    expect(source).toContain("cashlessRevenue");
    expect(source).toContain("receiptsTotal");
    expect(source).toContain('sum(rows,"cash_revenue")');
    expect(source).toContain('sum(rows,"cashless_revenue")');
    expect(source).toContain('sum(rows,"receipts_total")');
  });
});
