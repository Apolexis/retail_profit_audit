import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const journal = readFileSync(resolve(process.cwd(), "server/localAuth.ts"), "utf8");
const reports = readFileSync(resolve(process.cwd(), "server/weeklyReports.ts"), "utf8");

describe("серверный журнал и регулярные сводки", () => {
  it("ищет по всей истории, включая контекст события и исполнителя", () => {
    expect(journal).toContain('search?:string;filter?:ChangeLogFilter');
    expect(journal).toContain('CAST(${auditChangeLog.beforeState} AS CHAR) LIKE ${pattern}');
    expect(journal).toContain('CAST(${auditChangeLog.afterState} AS CHAR) LIKE ${pattern}');
    expect(journal).toContain('like(localAccounts.displayName,pattern)');
    expect(journal).toContain('limit+1').toContain('offset(offset)');
  });

  it("сохраняет платежные доли в новой сводке и ограничивает архив шестью отчетами", () => {
    expect(reports).toContain('cashShare:number;cashlessShare:number');
    expect(reports).toContain('cashShare:paymentRevenue?cashRevenue/paymentRevenue*100:0');
    expect(reports).toContain('const prunedReportIds=saved.slice(6).map(item=>item.id);');
    expect(reports).toContain('Math.min(6,Math.max(1,Math.floor(limit)))');
  });
});
