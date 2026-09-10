import { describe, expect, it } from "vitest";
import { clampChartPan, clampChartZoom, formatK, nonZeroLines, resolveMetricChartLayout, resolveMetricChartView, resolveOverlayBarGeometry, sortTooltipPayload, zeroAwareTicks } from "./AuditCharts";

describe("форматирование денежных показателей", () => {
  it("не скрывает малые ненулевые суммы округлением до нуля", () => {
    expect(formatK(0.4)).toBe("0,4 тыс. ₽");
    expect(formatK(65.2)).toBe("65,2 тыс. ₽");
  });
  it("показывает крупные значения в миллионах", () => {
    expect(formatK(1540)).toBe("1,5 млн ₽");
  });
  it("сортирует значения тултипа по убыванию, включая отрицательные", () => {
    expect(sortTooltipPayload([{ name: "C", value: -5 }, { name: "A", value: 120 }, { name: "B", value: 40 }]).map(item => item.name)).toEqual(["A", "B", "C"]);
  });
  it("не выводит серию, которая за весь выбранный срез равна нулю", () => {
    const lines=[{key:"driverCash",name:"Водитель нал",color:"#111"},{key:"cash",name:"Траты нал",color:"#222"}];
    expect(nonZeroLines([{driverCash:0,cash:120},{driverCash:0,cash:-30}],lines).map(line=>line.key)).toEqual(["cash"]);
  });
  it("принудительно использует столбец и скрывает смысл выбора вида для единственной точки", () => {
    expect(resolveMetricChartView(1,"line")).toBe("bar");
    expect(resolveMetricChartView(0,"line")).toBe("bar");
    expect(resolveMetricChartView(2,"line")).toBe("line");
    expect(resolveMetricChartView(2,"bar")).toBe("bar");
  });
  it("для одного периода по нескольким магазинам выбирает горизонтальные столбцы", () => {
    expect(resolveMetricChartLayout(1, 4)).toBe("single-period-comparison");
    expect(resolveMetricChartLayout(1, 1)).toBe("single-value");
    expect(resolveMetricChartLayout(2, 4)).toBe("timeline");
  });
  it("сохраняет волну как базовое представление динамики", () => {
    expect(resolveMetricChartView(3, "line")).toBe("line");
  });
  it("сохраняет наложенные столбцы отдельным режимом для многоточечного ряда", () => {
    expect(resolveMetricChartView(3, "overlay")).toBe("overlay");
    expect(resolveMetricChartView(1, "overlay")).toBe("bar");
  });
  it("дает многоточечному общему графику все три доступных представления", () => {
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("{showViewControls&&data.length>1&&<ChartViewControls");
    expect(source).toContain(">Волна</button>");
    expect(source).toContain(">Столбцы</button>");
    expect(source).toContain(">Наложение</button>");
  });
  it("дает всем общим графикам доступное увеличение в отдельном диалоге", () => {
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("function ChartExpandButton");
    expect(source).toContain("Увеличить график:");
    expect(source).not.toContain("Детальный просмотр: колесо или pinch");
    expect(source).toContain("<MetricLineChart key={expandedView} data={data}");
    expect(source).toContain("<BenchmarkBars data={data}");
  });

  it("сохраняет выбранный вид и дает переключатель в увеличенном графике", () => {
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("initialView?:MetricChartView");
    expect(source).toContain("useState<MetricChartView>(initialView)");
    expect(source).toContain("initialView={expandedView} expanded showViewControls={false}");
    expect(source).toContain("{showViewControls&&data.length>1&&<ChartViewControls view={chartView}");
    expect(source).toContain('className="chart-expand-view-control"');
    expect(source).toContain("showViewControls={data.length>1}");
  });
  it("поддерживает ограниченное мышиное и сенсорное управление увеличенным графиком", () => {
    expect(clampChartZoom(.5)).toBe(1);
    expect(clampChartZoom(4)).toBe(3);
    expect(clampChartPan(999,2)).toBe(180);
    expect(clampChartPan(-999,2)).toBe(-180);
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("onPointerDown={down}");
    expect(source).toContain("onWheel={wheel}");
    expect(source).toContain("Колесо мыши или щипок");
    expect(source).toContain("Сброс");
  });
  it("использует единый широкий слот наложения и один цвет для легенды, линии и маркера", () => {
    expect(resolveOverlayBarGeometry(140, 18, 0, 3)).toEqual({ x: 140, width: 54 });
    expect(resolveOverlayBarGeometry(158, 18, 1, 3)).toEqual({ x: 140, width: 54 });
    expect(resolveOverlayBarGeometry(176, 18, 2, 3)).toEqual({ x: 140, width: 54 });
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("barGap={0}");
    expect(source).toContain("resolveOverlayBarGeometry");
    expect(source).toContain("fill={color}");
    expect(source).not.toContain("chart-overlay-note");
    expect(source).toContain("stroke:color,strokeWidth:2,fill:color");
  });
  it("сохраняет нулевую отметку в шкале положительных, отрицательных и смешанных значений", () => {
    expect(zeroAwareTicks([12, 48])).toContain(0);
    expect(zeroAwareTicks([-12, -48])).toContain(0);
    expect(zeroAwareTicks([-12, 48])).toContain(0);
  });
});
