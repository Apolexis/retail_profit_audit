import { describe, expect, it } from "vitest";
import { chartPanSpeedForZoom, clampChartZoom, formatK, nonZeroLines, normalizeOverlayBarRect, panChartRows, resolveChartPanAxis, resolveMetricChartLayout, resolveMetricChartView, resolveOverlayBarGeometry, sortTooltipPayload, viewportChartDomain, windowChartRows, zeroAwareTicks } from "./AuditCharts";

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
  it("масштабирует домен и видимый срез данных, а не SVG-поверхность", () => {
    expect(clampChartZoom(.5)).toBe(1);
    expect(clampChartZoom(4)).toBe(3);
    expect(chartPanSpeedForZoom(1)).toBeCloseTo(2.35);
    expect(chartPanSpeedForZoom(3)).toBeCloseTo(2.35/Math.pow(3,1.75));
    expect(resolveChartPanAxis(1,0)).toBeNull();
    expect(resolveChartPanAxis(14,5)).toBe("x");
    expect(resolveChartPanAxis(5,14)).toBe("y");
    expect(windowChartRows([1,2,3,4,5,6],{zoom:2,pan:{x:0,y:0}})).toEqual([3,4,5]);
    expect(windowChartRows([1,2,3,4,5,6],{zoom:2,pan:{x:0,y:1}},"y")).toEqual([4,5,6]);
    expect(windowChartRows([1,2,3,4],{zoom:1.16,pan:{x:1,y:0}})).toEqual([2,3,4]);
    expect(windowChartRows([1,2,3,4,5,6],{zoom:2,pan:{x:2.4,y:0}})).toEqual([4,5,6]);
    expect(panChartRows([{month:"M1"},{month:"M2"},{month:"M3"}],{zoom:1,pan:{x:1,y:0}}).map(row=>row.month)).toEqual(["M1","M2","M3"]);
    expect(panChartRows([{store:"A"},{store:"B"},{store:"C"}],{zoom:1,pan:{x:0,y:-1}},"y").map(row=>row.store)).toEqual(["A","B","C"]);
    expect(viewportChartDomain([0,100],{zoom:2,pan:{x:0,y:0}})).toEqual([25,75]);
    expect(viewportChartDomain([0,100],{zoom:2,pan:{x:1,y:0}},"x")).toEqual([125,175]);
    expect(viewportChartDomain([0,100],{zoom:2,pan:{x:2,y:0}},"x")).toEqual([225,275]);
    expect(viewportChartDomain([0,100],{zoom:1,pan:{x:1,y:0}},"x")).toEqual([75,175]);
    expect(viewportChartDomain([0,100],{zoom:1,pan:{x:2.4,y:0}},"x")).toEqual([180,280]);
    expect(viewportChartDomain([8,18],{zoom:2,pan:{x:0,y:0}},"y",false)).toEqual([10.5,15.5]);
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain('=>windowChartRows(data,viewport,axis)');
    expect(source).toContain("export const panChartRows");
    expect(source).toContain("const chartData=panChartRows(data,viewport)");
    expect(source).toContain('const chartData=panChartRows(data,viewport,"y")');
    expect(source).toContain('viewportChartDomain(fullPlottedValues,viewport,"y",(viewport?.zoom??1)<=1)');
    expect(source).toContain('axis:"x"|"y"="y"');
    expect(source).toContain("includeZero=true");
    expect(source).not.toContain("scale(${zoom})");
    expect(source).toContain("onPointerDownCapture={down}");
    expect(source).toContain('addEventListener("wheel",wheel,{passive:false})');
    expect(source).toContain("event.stopPropagation()");
    expect(source).not.toContain("if(activeZoom<=1)return");
    expect(source).toContain("const speed=chartPanSpeedForZoom(zoomRef.current)");
    expect(source).toContain("const queuePan=(delta:{x:number;y:number})");
    expect(source).toContain("if(axisLock&&!gesture.current.axis)");
    expect(source).toContain('gesture.current.axis==="y"?0:-deltaX*speed');
    expect(source).toContain('gesture.current.axis==="x"?0:deltaY*speed');
    expect(source).toContain("event.currentTarget.setPointerCapture(event.pointerId)");
    expect(source).toContain("const renderPan=pan");
    expect(source).toContain("onLostPointerCapture={cancel}");
    expect(source).not.toContain("onBlur={cancel}");
    expect(source).toContain('window.addEventListener("pointerup",release,true)');
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("const clampUnit=(value:number)=>Math.min(2.4,Math.max(-2.4,value))");
    expect(source).toContain("button,[data-chart-point='true']");
    expect(source).toContain("resolveChartPanAxis(next.x-start.x,next.y-start.y,dragThreshold)");
    expect(source).toContain("gesture.current.lastPoint=next;gesture.current.panning=true;event.preventDefault();event.stopPropagation();setDragging(true)");
    expect(source).not.toContain("onPointerDownOutside={event=>event.preventDefault()}");
    expect(source).toContain('const chartRenderKey=`${chartView}-${visibleLines.map(line=>line.key).join("-")}`');
    expect(source).toContain('<ResponsiveContainer key={chartRenderKey} width="100%" height={chartHeight}>');
    expect(source).toContain("isAnimationActive={false}");
    expect(source).toContain('addEventListener("touchstart",touchStart,{passive:false,capture:true})');
    expect(source).toContain('addEventListener("touchmove",touchMove,{passive:false,capture:true})');
    expect(source).toContain('const touchEnd=()=>clearGesture()');
    expect(source).toContain('const touchStart=(event:TouchEvent)=>{if(isControl(event.target)||!event.touches.length)return;const active=touches(event)');
    expect(source).toContain('if(!gesture.current.panning&&Math.hypot(next.x-start.x,next.y-start.y)<dragThreshold)');
    expect(source).toContain('if(event.pointerType==="touch"||!pointers.current.has(event.pointerId))return');
    expect(source).toContain('if(event.pointerType==="touch"||(event.target as Element).closest');
    expect(source).not.toContain('onPointerDownOutside={keepChartSurfaceInside}');
    expect(source).not.toContain('const keepChartSurfaceInside');
    expect(source).toContain('aria-label={compact?"Интерактивный график":"Интерактивный увеличенный график"}');
    expect(source).toContain('compact?:boolean;axisLock?:boolean;touchModeControl?:boolean}');
    expect(source).not.toContain("invertX");
    expect(source).toContain('function useSmallChartViewport()');
    expect(source).toContain('const timelineMargin=compactChart?{top:12,right:8,left:0,bottom:4}');
    expect(source).toContain('const timelineAxisWidth=compactChart?55:78');
    expect(source).toContain('compactChart?322:306');
    expect(source).toContain('<ChartPanZoomSurface compact touchModeControl={data.length>1} axisLock={false}>{compactViewport=><MetricLineChart');
    expect(source).toContain('<ChartPanZoomSurface compact>{compactViewport=><BenchmarkBars');
    expect(source).toContain('<ChartExpandButton title={chartTitle} initialView={chartView} showViewControls={data.length>1} touchModeControl={data.length>1}>');
    expect(source).not.toContain('<ChartPanZoomSurface compact touchModeControl={true}>');
    expect(source).toContain("Сброс");
    expect(source).toContain('const medianColor=expanded&&theme==="dark"?"#b694ff":palette.median');
    expect(source).toContain("stroke={medianColor}");
  });
  it("использует единый широкий слот наложения и один цвет для легенды, линии и маркера", () => {
    expect(resolveOverlayBarGeometry(140, 18, 0, 3)).toEqual({ x: 140, width: 54 });
    expect(resolveOverlayBarGeometry(158, 18, 1, 3)).toEqual({ x: 140, width: 54 });
    expect(resolveOverlayBarGeometry(176, 18, 2, 3)).toEqual({ x: 140, width: 54 });
    expect(normalizeOverlayBarRect(82, -24)).toEqual({ y: 58, height: 24 });
    expect(normalizeOverlayBarRect(58, 24)).toEqual({ y: 58, height: 24 });
    const source = require("node:fs").readFileSync(new URL("./AuditCharts.tsx", import.meta.url), "utf8");
    expect(source).toContain("barGap={0}");
    expect(source).toContain("resolveOverlayBarGeometry");
    expect(source).toContain("normalizeOverlayBarRect");
    expect(source).toContain("fill={color}");
    expect(source).not.toContain("chart-overlay-note");
    expect(source).toContain('stroke:"none",strokeWidth:0,fill:color');
  });
  it("сохраняет нулевую отметку в шкале положительных, отрицательных и смешанных значений", () => {
    expect(zeroAwareTicks([12, 48])).toContain(0);
    expect(zeroAwareTicks([-12, -48])).toContain(0);
    expect(zeroAwareTicks([-12, 48])).toContain(0);
  });
});
