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

  it("крепит крестик слева от длинного заголовка только в компактном диалоге", () => {
    expect(styles).toContain('.chart-expand-dialog [data-slot="dialog-close"] { top: 22px !important; right: auto !important; left: 10px !important; transform: none !important; }');
    expect(styles).toContain('.chart-expand-dialog [data-slot="dialog-header"] { padding-right: 0 !important; padding-left: 48px !important; }');
  });
});
