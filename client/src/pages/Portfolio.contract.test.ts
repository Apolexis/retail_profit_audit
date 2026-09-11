import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Portfolio.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Портфель»", () => {
  it("оставляет на точечных картах только выбранную и приоритетные подписи", () => {
    expect(page).toContain("const labelledStores = new Set(priority.slice(0, 6)");
    expect(page).toContain("label: labelledStores.has(item.store) ? item.store : \"\"");
    expect(page).toContain("<LabelList dataKey=\"label\"");
    expect(page).toContain("Точка на графике");
  });

  it("показывает отдельные цветовые причины риска и точные значения при наведении", () => {
    expect(page).toContain("Маржа ниже");
    expect(page).toContain("priorityThresholds.highCover");
    expect(page).toContain("priorityThresholds.lowCover");
    expect(page).toContain("Покрытие:");
    expect(page).toContain("Маржа:");
    expect(page).toContain('normal: "#6978d5"');
    expect(page).toContain('normal: "#a8b2ff"');
  });

  it("выбирает точку только явным кликом по видимому маркеру, а hover оставляет для просмотра", () => {
    expect(page).not.toContain("onClick={selectScatterPoint}");
    expect(page).not.toContain("onMouseMove={selectScatterPoint}");
    expect(page).toContain("const focusPoint = (event: React.MouseEvent<SVGGElement>)");
    expect(page).toContain("onClick={focusPoint}");
    expect(page).toContain("onPointerEnter={() => props.payload && setHoveredStore(props.payload.store)}");
    expect(page).not.toContain("onPointerMove={focusPoint}");
    expect(page).toContain("selected || hovered");
    expect(page).toContain('"portfolio-scatter-focus"');
    expect(page).not.toContain('className="portfolio-scatter-hit"');
    expect(page).toContain("fillOpacity={focus?.store && focus.store !== item.store ? .26 : 1}");
    expect(page).toContain('stroke="none"');
    expect(page).toContain('viewportChartDomain(allPoints.map(item => Number(item[kind])), viewport, "x", false)');
    expect(page).toContain('viewportChartDomain(allPoints.map(item => item.netMargin), viewport, "y", false)');
    expect(page).toContain("allowDataOverflow");
    expect(page).toContain("const chartData = allPoints.filter");
    expect(page).toContain('margin={{ top: 42, right: 28, bottom: 18, left: 14 }}');
    expect(page).toContain('style={{pointerEvents:"none"}}');
  });

  it("оставляет только линию медианы с конкретной подписью", () => {
    expect(page).toContain('Медиана: {kind === "cover"');
    expect(page).toContain("<ReferenceLine x={mediansByChart[kind]}");
    expect(page).not.toContain("пунктир: медиана и 0%");
    expect(page).not.toContain("<ReferenceLine y={priorityThresholds.margin}");
  });

  it("показывает карту приоритетов и крупные графики на любой ширине", () => {
    expect(page).toContain("portfolio-mobile-map");
    expect(page).toContain("portfolio-mobile-priority-list");
    expect(page).toContain("portfolio-meter");
    expect(styles).toContain(".packet .portfolio-mobile-map { display: grid;");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
    expect(styles).toContain("@media (max-width: 720px)");
    expect(page).toContain("setExpandedChart(kind)");
    expect(page).toContain("chart-expand-dialog portfolio-chart-dialog");
    expect(page).toContain("<ChartPanZoomSurface invertX>");
    expect(page).toContain('<ChartPanZoomSurface compact invertX>{viewport=>scatter(kind,510,viewport)}</ChartPanZoomSurface>');
    expect(styles).toContain(".packet .portfolio-mobile-priority-list { display: grid;");
    expect(page).toContain('["revenue","cover","stock","writeoffs"] as const');
    expect(page).toContain("Остаток и чистая маржа");
    expect(page).toContain("Списания и чистая маржа");
    expect(page).toContain("mediansByChart[kind]");
  });

  it("не оставляет у легенды мелкое техническое пояснение", () => {
    expect(page).not.toContain("Подписи оставлены у выбранной точки");
    expect(styles).toContain("margin: 16px 0 18px");
    expect(page).toContain('portfolio-focus-select portfolio-focus-select-inline');
    expect(styles).toContain(".packet .portfolio-focus-card { grid-template-columns: minmax(280px, .85fr) minmax(0, 1.6fr) !important; }");
    expect(page).toContain('className="portfolio-map-legend-items"');
    expect(styles).toContain('.packet .portfolio-map-legend { display: grid !important; grid-template-columns: minmax(0, 1fr) !important;');
  });

  it("разделяет списания копченой и мороженой продукции в таблице экономики", () => {
    expect(page).toContain("writeoffSmoked: summary.writeoffSmoked");
    expect(page).toContain("writeoffFrozen: summary.writeoffFrozen");
    expect(page).toContain("<th>Списания К.</th>");
    expect(page).toContain("<th>Списания М.</th>");
    expect(page).toContain("money(item.writeoffSmoked)");
    expect(page).toContain("money(item.writeoffFrozen)");
  });

  it("дает отдельные сохраняемые пороги приоритета для маржи и покрытия", () => {
    expect(page).toContain('priorityThresholdStorageKey = "audit-portfolio-priority-thresholds"');
    expect(page).toContain("КРИТЕРИИ КАРТЫ ПРИОРИТЕТОВ");
    expect(page).toContain("финансовые факты и расчеты не меняются.");
    expect(page).toContain("Маржа ниже");
    expect(page).toContain("Низкое покрытие");
    expect(page).toContain("Высокое покрытие");
    expect(page).toContain("threshold-stepper");
    expect(page).toContain("Типичное покрытие сети");
    expect(page).toContain("localStorage.setItem(priorityThresholdStorageKey");
    expect(page).toContain("priorityScore(b, priorityThresholds)");
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .portfolio-mobile-priority.active { border-color: #ff765f;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .portfolio-thresholds { border-color: #cbdcff !important; background: #f7fbff !important;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .zone-grid article:nth-child(2) { border-color: #cbdcff !important; background: #f5f8ff !important; }');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .zone-grid article:hover { transform: none !important; border-color: #0a84ff !important;');
  });

  it("разделяет пояснение покрытия на читаемые строки и согласует критерии темной темы", () => {
    expect(page).toContain('Покрытие запаса</b> — дни обычных продаж, на которые хватит конечного остатка:<br/>');
    expect(page).toContain('конечный остаток ÷ средние продажи в день.</b><br/>Медиана');
    expect(page).toContain('плановый норматив.<br/>Срез:');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .portfolio-thresholds { border-color: #365675 !important; background: #15263c !important;');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .portfolio-thresholds .card-title > div > span { color: #88bdff !important; }');
    expect(styles).toContain('.packet .chart-expand-button { min-height: 35px !important;');
  });

  it("компенсирует горизонтальное направление viewport только в картах портфеля", () => {
    expect(page).toContain('<ChartPanZoomSurface compact invertX>');
    expect(page).toContain('<ChartPanZoomSurface invertX>');
  });
});
