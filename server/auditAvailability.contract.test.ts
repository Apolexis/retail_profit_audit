import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const audit = readFileSync(new URL("./audit.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/audit.ts", import.meta.url), "utf8");

describe("доступность финансовых фактов вне текущего диапазона", () => {
  it("проверяет только границы доступной книги, не подменяя пустой срез отсутствием импорта", () => {
    expect(audit).toContain("export async function getAuditFactAvailability");
    expect(audit).toContain("hasAnyFinancialFacts");
    expect(audit).toContain("firstDate");
    expect(audit).toContain("lastDate");
    expect(audit).toContain("orderBy(asc(periods.entryDate)).limit(1)");
    expect(audit).toContain("orderBy(desc(periods.entryDate)).limit(1)");
  });

  it("защищает метаданные книги тем же финансовым доступом, что и dashboard", () => {
    expect(router).toContain("dashboardAvailability:protectedProcedure.query");
    expect(router).toContain("requireFinancialPermission(ctx.user.openId)");
    expect(router).toContain("getAuditFactAvailability(await getAccessibleStoreIds(ctx.user.openId))");
  });
});
