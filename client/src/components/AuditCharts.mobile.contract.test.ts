import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const chart = readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");

describe("мобильный контракт графических контролов", () => {
  it("выводит выбор вида выше легенды и оставляет его доступным для касания", () => {
    expect(styles).toContain(".packet .chart-view-control { align-self: flex-start; order: -1; min-height: 38px; }");
    expect(styles).toContain(".packet .chart-view-button, .packet .series-toggle, .packet .cadence-metric-chip { min-height: 36px; touch-action: manipulation;");
  });

  it("использует нативные кнопки и явные обработчики для показателей и режимов", () => {
    expect(chart).toContain('type="button"');
    expect(chart).toContain('onClick={()=>onChange("bar")}');
    expect(chart).toContain('onClick={()=>toggle(line.key)}');
    expect(chart).toContain('function ChartTouchModeControls');
    expect(chart).toContain('onClick={()=>onChange("inspect")}');
    expect(chart).toContain('onClick={()=>onChange("pan")}');
    expect(chart).toContain("export function StoreSeriesModeToggle");
    expect(chart).toContain("Ряды (выбор режима отображения на графике)");
  });

  it("показывает режимы касания только при touch-вводе и использует анализ точек по умолчанию", () => {
    expect(chart).toContain('const [touchMode,setTouchMode]=useState<ChartTouchMode>("inspect")');
    expect(chart).toContain('const allowTouchPan=!touchModeControl||!touchInput||touchMode==="pan"');
    expect(chart).toContain('if(!allowTouchPan&&active.length===1)return');
    expect(chart).toContain('showTouchModeControl={compactViewport.touchInput&&data.length>1}');
    expect(chart).toContain('touchModeControl={data.length>1}');
    expect(chart).not.toContain('<ChartPanZoomSurface compact touchModeControl={true}');
    expect(styles).toContain('@media (hover: none), (pointer: coarse)');
    expect(styles).toContain('.packet .chart-touch-mode-control { display: inline-flex;');
    expect(styles).toContain('.chart-panzoom.chart-panzoom-touch-inspect { cursor: default; }');
  });

  it("показывает режимы в панели действий развернутого графика без дублирования в его toolbar", () => {
    expect(chart).toContain('className="chart-panzoom-touch-actions"');
    expect(chart).toContain('<ChartTouchModeControls mode={touchMode} onChange={setTouchMode}/>');
    expect(chart).toContain('{touchModeControl&&<div className="chart-panzoom-touch-actions">');
    expect(chart).toContain('expandedViewport.setTouchMode} showTouchModeControl={false}');
    expect(styles).toContain('.chart-expand-dialog .chart-panzoom-touch-actions { margin-right: auto; }');
    expect(styles).toContain('@media (hover: none), (pointer: coarse)');
  });

  it("сдвигает крестик компактного диалога правее от левого края, не перекрывая заголовок", () => {
    expect(styles).toContain('.chart-expand-dialog [data-slot="dialog-close"] { top: 22px !important; right: auto !important; left: 16px !important; transform: none !important; }');
    expect(styles).toContain('.chart-expand-dialog [data-slot="dialog-header"] { padding-right: 0 !important; padding-left: 48px !important; }');
  });

  it("дает общим графикам более ранний свободный pan только при отдельном touch-режиме", () => {
    expect(chart).toContain('const touchMove=(event:TouchEvent)=>');
    expect(chart).not.toContain('resolveChartPanAxis(next.x-start.x,next.y-start.y,dragThreshold)');
    expect(chart).toContain('const dragThreshold=touchModeControl?0:2');
    expect(chart).toContain('data-chart-pan-x={pan.x}');
  });

  it("измеряет положение высокого tooltip: деньги выбирают две или три колонки по ширине графика, а проценты — три колонки", () => {
    expect(chart).toContain('useLayoutEffect');
    expect(chart).toContain('wrapper.style.setProperty("--tiny-tooltip-shift-y"');
    expect(chart).toContain('tiny-tooltip-values-${columns}');
    expect(chart).toContain('gridAutoFlow:"column"');
    expect(chart).toContain('data-tooltip-count={tooltipRows.length}');
    expect(chart).toContain('const densePercent=mode==="percent"&&sortedValues.length>2');
    expect(chart).toContain('const denseMoney=mode!=="percent"&&sortedValues.length>12');
    expect(chart).not.toContain('longestValueLabel');
    expect(chart).not.toContain('const [chartWidth,setChartWidth]=useState(0)');
    expect(chart).toContain('data-tooltip-columns={columns}');
    expect(chart).toContain('className={`tiny-tooltip${densePercent?" tiny-tooltip-dense":""}${moneyTooltip?" tiny-tooltip-monetary":""}${denseMoney?" tiny-tooltip-monetary-dense":""}`}');
    expect(chart).toContain('item.missing?"Нет факта":chartTick(item.value??0,mode)');
    expect(styles).toContain('.tiny-tooltip-monetary { width: min(300px, calc(100vw - 32px)) !important;');
    expect(styles).toContain('.tiny-tooltip-monetary .tiny-tooltip-values-2 > span { white-space: nowrap; }');
    expect(styles).toContain('.tiny-tooltip-monetary-dense { width: min(300px, calc(100vw - 32px)) !important;');
  });

  it("сокращает левый резерв компактного медианного графика на телефоне и не меняет развернутый вариант", () => {
    expect(chart).toContain('const compactBenchmark=compactViewport&&!expanded');
    expect(chart).toContain('const storeAxisWidth=compactBenchmark?72:128');
    expect(chart).toContain('left:compactBenchmark?0:18');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .benchmark-chart:not(.benchmark-chart-expanded) .chart-touch-mode-control');
    expect(styles).toContain('border-color: #cbdcff !important; background: #f7faff !important;');
    expect(styles).toContain('.benchmark-chart:not(.benchmark-chart-expanded) .chart-touch-mode-button.active { border-color: #0a63c8 !important; background: #0a63c8 !important;');
    expect(styles).toContain('.tiny-tooltip[data-tooltip-count="1"]');
  });

  it("держит маркер, подпись и значение tooltip в одной строке с безопасным сокращением подписи", () => {
    expect(styles).toContain('grid-template-columns: 8px minmax(0, 1fr) max-content;');
    expect(styles).toContain('text-overflow: ellipsis;');
    expect(styles).toContain('font-variant-numeric: tabular-nums;');
    expect(styles).toContain('white-space: nowrap !important;');
  });

  it("дает периоду и строкам значений одинаковый вертикальный воздух", () => {
    expect(styles).toContain('.tiny-tooltip { padding: 10px 12px 11px !important; }');
    expect(styles).toContain('.tiny-tooltip > b { display: block; margin-bottom: 6px !important; line-height: 1.2; }');
    expect(styles).toContain('.tiny-tooltip .tiny-tooltip-values { row-gap: 4px; }');
  });
});
