import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page=readFileSync(resolve(process.cwd(),"client/src/pages/WeeklyReports.tsx"),"utf8");

describe("WeeklyReports interaction contract",()=>{
  it("selects and opens the newly formed saved report with a Russian notification",()=>{
    expect(page).toContain("selectReport(result.report.id)");
    expect(page).toContain('toast.success(result.created?"Отчет сформирован и открыт":"Сводка уже существует и открыта"');
    expect(page).toContain("reportSummaryRef.current?.scrollIntoView");
    expect(page).toContain("window.history.replaceState");
  });

  it("keeps saved periods compact and labels the action separately",()=>{
    expect(page).toContain('className={isActive?"report-history-item active":"report-history-item"}');
    expect(page).toContain('isActive?"Открыта сейчас":"Показать"');
    expect(page).toContain('className={isEnabled?"schedule-toggle active":"schedule-toggle"}');
  });

  it("uses the currently selected form period for manual report generation",()=>{
    expect(page).toContain('const typeLabel=reportPeriod==="month"?"завершенный месяц":"прошлую неделю"');
    expect(page).not.toContain("const effectivePeriod=");
  });

  it("never displays legacy methodology from a stored report",()=>{
    expect(page).toContain("reportMethodology(summary)");
    expect(page).not.toContain("{summary.methodology}");
  });

  it("uses the immutable record dates when opening historical reports",()=>{
    expect(page).toContain("periodStart:selected.periodStart");
    expect(page).toContain("periodEnd:selected.periodEnd");
    expect(page).toContain('selected.periodStart.slice(0,7)===selected.periodEnd.slice(0,7)?"month":"week"');
    expect(page).toContain('key={`report-period-${selected.id}`}');
  });

  it("applies semantic colors only to signed financial outcomes",()=>{
    expect(page).toContain('const moneyClass=(value:number)=>value>0?"positive":value<0?"negative":"neutral"');
    expect(page).toContain("className={moneyClass(summary.netProfit)}");
    expect(page).toContain("className={moneyClass(item.value)}");
  });
});
