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

  it("keeps saved periods compact, stores six recent reports and allows safe manual removal",()=>{
    expect(page).toContain('className={isActive?"report-history-item active":"report-history-item"}');
    expect(page).toContain('isActive?"Открыта":"Показать"');
    expect(page).toContain('trpc.audit.weeklyReports.useQuery({limit:REPORTS_PAGE_SIZE,offset:reportOffset}');
    expect(page).toContain('trpc.audit.deleteWeeklyReport.useMutation');
    expect(page).toContain('Удалить сформированную сводку?');
    expect(page).toContain('const REPORTS_PAGE_SIZE=6;');
    expect(page).toContain('Хранятся шесть последних сводок. При создании седьмой автоматически удаляется самая старая сводка');
    expect(page).toContain('ДОЛЯ НАЛИЧНОЙ ВЫРУЧКИ');
    expect(page).toContain('ДОЛЯ БЕЗНАЛИЧНОЙ ВЫРУЧКИ');
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
    expect(page).toContain('import("jspdf")');
    expect(page).toContain('const exportPdf=async()=>');
    expect(page).toContain('const savePdfForDevice=async');
    expect(page).toContain('const delivery=await savePdfForDevice(pdf,fileName,previewWindow);');
    expect(page).toContain('navigator as Navigator');
    expect(page).toContain('className="report-pdf-source"');
    expect(page).toContain('aria-label="Выгрузить выбранный отчет в PDF"');
    expect(page).toContain('toast.success("PDF-отчет подготовлен"');
    expect(page).toContain('loadPdfBrand(pdfTheme).catch');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .report-export-button');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .report-export-button');
  });

  it("добавляет в PDF фирменный знак и первую локально рисуемую страницу без DOM-снимка",()=>{
    expect(page).toContain('const createReportSummaryCanvas=async');
    expect(page).toContain('const summaryCanvas=await createReportSummaryCanvas(summary,pdfTheme,brandSource);');
    expect(page).toContain('const previewWindow=isAppleMobile?window.open("about:blank","_blank"):null;');
    expect(page).toContain('const reportPdfBrandIcon=');
    expect(page).toContain('const loadPdfBrand=async');
    expect(page).toContain('previewWindow.location.replace(url)');
  });

  it("добавляет отдельную PDF-страницу динамики из фактических дневных записей выбранного отчета",()=>{
    expect(page).toContain('export const reportTimeline=');
    expect(page).toContain('trpc.audit.dashboard.useQuery({ranges:');
    expect(page).toContain('const dynamics=await createReportDynamicsCanvas(summary,timeline,pdfTheme,brandSource);');
    expect(page).toContain('pdf.addPage();');
    expect(page).toContain('"Динамика фактических показателей"');
    expect(page).toContain('Источник: фактические дневные записи видимых точек в периоде выбранного отчета.');
    expect(page).toContain('disabled={isExporting||reportDashboard.isLoading}');
    expect(page).not.toContain('import("html2canvas")');
  });

  it("добавляет полноценный тематический управленческий реестр на отдельную PDF-страницу",()=>{
    expect(page).toContain('const createReportInsightsCanvas=async');
    expect(page).toContain('"Управленческий реестр фактов"');
    expect(page).toContain('"Точки-ориентиры по прибыли"');
    expect(page).toContain('"Риск-сигналы выбранного среза"');
    expect(page).toContain('"Состав и границы фактической базы"');
    expect(page).toContain('const insights=await createReportInsightsCanvas(summary,timeline,pdfTheme,brandSource);');
  });

  it("добавляет полный дневной реестр с фактической разбивкой наличных и безналичных платежей",()=>{
    expect(page).toContain('const createReportLedgerCanvases=async');
    expect(page).toContain('"Дневной реестр фактических показателей"');
    expect(page).toContain('cashRevenue+=finite(period.metrics.cash_revenue)');
    expect(page).toContain('cashlessRevenue+=finite(period.metrics.cashless_revenue)');
    expect(page).toContain('const ledgers=await createReportLedgerCanvases(summary,timeline,pdfTheme,brandSource);');
  });

  it("создает первую страницу PDF без разрезания DOM-снимка на промежуточные листы",()=>{
    expect(page).toContain('const createReportSummaryCanvas=async');
    expect(page).toContain('pdf.addImage(summaryCanvas.toDataURL("image/png"),"PNG",0,0,pageWidth,pageHeight,undefined,"FAST");');
    expect(page).not.toContain('import("html2canvas")');
  });
});
