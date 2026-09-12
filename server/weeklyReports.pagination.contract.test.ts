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

  it("удаляет только сохраненную сводку через административную процедуру и фиксирует след", () => {
    expect(router).toContain("deleteWeeklyReport:adminProcedure");
    expect(router).toContain('action:"weekly_report.delete"');
    expect(router).toContain("deleteWeeklyExecutiveReport(input.reportId)");
  });
});
