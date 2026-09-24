import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reports = readFileSync(new URL("./weeklyReports.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/audit.ts", import.meta.url), "utf8");
const journal = readFileSync(new URL("./localAuth.ts", import.meta.url), "utf8");

describe("управление сохраненными сводками и журналом", () => {
  it("выдает отчеты и журнал порциями без изменения финансовых фактов", () => {
    expect(reports).toContain("limit(page.limit+1).offset(page.offset)");
    expect(reports).toContain("export async function deleteWeeklyExecutiveReport");
    expect(journal).toContain("export async function listChangesPage");
    expect(journal).toContain("limit(limit+1).offset(offset)");
  });

  it("ограничивает поиск журнала календарным периодом МСК на сервере", () => {
    expect(journal).toContain("range?:{from:string;to:string}");
    expect(journal).toContain('new Date(`${input.range.from}T00:00:00+03:00`)');
    expect(journal).toContain('new Date(`${input.range.to}T23:59:59.999+03:00`)');
    expect(router).toContain("range:dateRange.optional()");
  });

  it("удаляет только сохраненную сводку через административную процедуру и фиксирует след", () => {
    expect(router).toContain("deleteWeeklyReport:adminProcedure");
    expect(router).toContain('action:"weekly_report.delete"');
    expect(router).toContain("deleteWeeklyExecutiveReport(input.reportId)");
  });
});
