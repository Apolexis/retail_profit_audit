import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page=readFileSync(resolve(process.cwd(),"client/src/pages/WeeklyReports.tsx"),"utf8");
const styles=readFileSync(resolve(process.cwd(),"client/src/final-overrides.css"),"utf8");

describe("WeeklyReports interaction contract",()=>{
  it("selects and opens the newly formed saved report with a Russian notification",()=>{
    expect(page).toContain("selectReport(result.report.id)");
    expect(page).toContain('toast.success(result.created?"Отчет сформирован и открыт":"Сводка уже существует и открыта"');
    expect(page).toContain("reportSummaryRef.current?.scrollIntoView");
    expect(page).toContain("window.history.replaceState");
  });

  it("keeps saved periods compact, paginated and safely removable",()=>{
    expect(page).toContain('className={isActive?"report-history-item active":"report-history-item"}');
    expect(page).toContain('isActive?"Открыта":"Показать"');
    expect(page).toContain('trpc.audit.weeklyReports.useQuery({limit:REPORTS_PAGE_SIZE,offset:reportOffset}');
    expect(page).toContain('trpc.audit.deleteWeeklyReport.useMutation');
    expect(page).toContain('Удалить сформированную сводку?');
    expect(page).toContain('Показать следующие');
    expect(styles).toContain('.packet .report-history-row');
    expect(page).toContain('className={isEnabled?"schedule-toggle active":"schedule-toggle"}');
  });

  it("allows a calendar-selected custom period only for manual report generation",()=>{
    expect(page).toContain('import { DateRangeControl } from "@/components/DateRangeControl"');
    expect(page).toContain('const [reportPeriod,setReportPeriod]=useState<"week"|"month"|"custom">("week")');
    expect(page).toContain('<option value="custom">Произвольный период</option>');
    expect(page).toContain('value={customRange} onChange={setCustomRange} title="ПЕРИОД ОТЧЕТА"');
    expect(page).toContain('<DateRangeControl value={customRange}');
    expect(page).not.toContain('<DateRangeControl compact value={customRange}');
    expect(styles).toContain('.packet .report-schedule-controls .report-custom-period .date-range-control {\n  width: 100%;\n  justify-content: space-between;\n}');
    expect(page).toContain('generate.mutate(isCustomPeriod?{range:customRange}:undefined)');
    expect(page).toContain('Он формируется вручную и не меняет сохраненное недельное или месячное расписание.');
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

  it("выгружает выбранную сводку локально в PDF без изменения ее фактического состава",()=>{
    expect(page).toContain('import("html2canvas")');
    expect(page).toContain('import("jspdf")');
    expect(page).toContain('const exportPdf=async()=>');
    expect(page).toContain('pdf.save(`Рыбный_отчет_${summary.periodStart}_${summary.periodEnd}.pdf`)');
    expect(page).toContain('ref={reportPdfRef} className="report-pdf-source"');
    expect(page).toContain('aria-label="Выгрузить выбранный отчет в PDF"');
    expect(page).toContain('toast.success("PDF-отчет выгружен"');
    expect(page).toContain('loadPdfBrand(pdfTheme).catch');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .report-export-button');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .report-export-button');
  });

  it("добавляет в PDF фирменный знак и момент формирования до локального захвата",()=>{
    expect(page).toContain('const pdfTimestamp=');
    expect(page).toContain('const [pdfGeneratedAt,setPdfGeneratedAt]=useState<Date|null>(null)');
    expect(page).toContain('setPdfGeneratedAt(new Date());');
    expect(page).toContain('requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))');
    expect(page).toContain('className="report-pdf-brand"');
    expect(page).toContain('const ReportPdfBrandGlyph=');
    expect(page).toContain('<ReportPdfBrandGlyph theme={theme}/>');
    expect(page).toContain('const reportPdfBrandIcon=');
    expect(page).toContain('const loadPdfBrand=async');
    expect(page).toContain('const [pdfBrandSrc,setPdfBrandSrc]=useState<string>()');
    expect(page).toContain('СФОРМИРОВАНО');
    expect(styles).toContain('.packet .report-pdf-brand { display: flex;');
  });

  it("добавляет отдельную PDF-страницу динамики из фактических дневных записей выбранного отчета",()=>{
    expect(page).toContain('export const reportTimeline=');
    expect(page).toContain('trpc.audit.dashboard.useQuery({ranges:');
    expect(page).toContain('const dynamics=await createReportDynamicsCanvas(summary,timeline,pdfTheme,brandSource);');
    expect(page).toContain('pdf.addPage();');
    expect(page).toContain('"Динамика фактических показателей"');
    expect(page).toContain('Источник: фактические дневные записи видимых точек в периоде выбранного отчета.');
    expect(page).toContain('disabled={isExporting||reportDashboard.isLoading}');
  });

  it("добавляет полноценный тематический управленческий реестр на отдельную PDF-страницу",()=>{
    expect(page).toContain('const createReportInsightsCanvas=async');
    expect(page).toContain('"Управленческий реестр фактов"');
    expect(page).toContain('"Точки-ориентиры по прибыли"');
    expect(page).toContain('"Риск-сигналы выбранного среза"');
    expect(page).toContain('"Состав и границы фактической базы"');
    expect(page).toContain('const insights=await createReportInsightsCanvas(summary,timeline,pdfTheme,brandSource);');
  });

  it("не вставляет пустую промежуточную страницу для почти помещающейся короткой сводки",()=>{
    expect(page).toContain('export const shouldFitPdfSummaryOnOnePage=');
    expect(page).toContain('if(shouldFitPdfSummaryOnOnePage(imageHeight,printableHeight))');
    expect(page).toContain('const renderedWidth=imageWidth*scale;');
  });
});
