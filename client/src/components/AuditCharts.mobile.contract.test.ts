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

  it("измеряет положение высокого tooltip и включает плотную сетку только при большом числе рядов", () => {
    expect(chart).toContain('useLayoutEffect');
    expect(chart).toContain('wrapper.style.setProperty("--tiny-tooltip-shift-y"');
    expect(chart).toContain('gridAutoFlow:"column"');
    expect(chart).toContain('gridTemplateRows:`repeat(${Math.ceil(sortedValues.length/columnCount)}, auto)`');
    expect(chart).toContain('className={sortedValues.length>12?"tiny-tooltip tiny-tooltip-dense":"tiny-tooltip"}');
  });

  it("сокращает левый резерв компактного медианного графика на телефоне и не меняет развернутый вариант", () => {
    expect(chart).toContain('const compactBenchmark=compactViewport&&!expanded');
    expect(chart).toContain('const storeAxisWidth=compactBenchmark?72:128');
    expect(chart).toContain('left:compactBenchmark?0:18');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .benchmark-chart:not(.benchmark-chart-expanded) .chart-touch-mode-control');
    expect(styles).toContain('border-color: #cbdcff !important; background: #f7faff !important;');
  });
});
