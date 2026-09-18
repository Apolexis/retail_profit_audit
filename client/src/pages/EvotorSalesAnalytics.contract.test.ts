import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./EvotorSalesAnalytics.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../evotor-sales-analytics.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("страницы продаж Эвотор", () => {
  it("разделяет показатели чеков и проданные товары на два маршрута", () => {
    expect(app).toContain('path="/evotor-sales/metrics"');
    expect(app).toContain('path="/evotor-sales/products"');
    expect(shell).toContain('"Показатели Эвотор", true');
    expect(shell).toContain('"Проданные товары", true');
    expect(page).toContain('kind === "metrics" ? "Показатели Эвотор" : "Проданные товары"');
  });

  it("повторяет контролы Ритма без смешения с P&L", () => {
    expect(page).toContain('["month", "week", "day", "hour"]');
    expect(page).toContain('Все магазины');
    expect(page).toContain('StoreSeriesModeToggle');
    expect(page).toContain('MetricLineChart');
    expect(page).toContain('cadence-chart-card evotor-sales-chart-card');
    expect(page).toContain('cadence-detail-table evotor-sales-table-card');
    expect(page).toContain('cadence-full-table evotor-sales-table-wrap');
    expect(page).toContain('<tfoot><tr className="table-total"><th scope="row">Итого</th>');
    expect(page).toContain('ДАННЫЕ ПОД ГРАФИКОМ');
    expect(page).toContain('ТОВАРЫ ПОД ГРАФИКОМ');
    expect(page).toContain('не является финансовым P&L');
    expect(page).not.toContain('confirmEvotorCatalog');
    expect(page).not.toContain('syncEvotorDocumentPage');
  });

  it("начинает аналитику с 2025 года и не растягивает календарь в карточку", () => {
    expect(page).toContain('DateRangeControl');
    expect(page).toContain('ПЕРИОД ДОКУМЕНТОВ ЭВОТОР');
    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
    expect(page).toContain('from: EVOTOR_ANALYTICS_START');
    expect(page).toContain('В аналитике учитываются только документы начиная с 2025 года.');
    expect(page).toContain('function retainedRange');
    expect(page).not.toContain('className="packet-card evotor-sales-period"');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(css).toContain('padding: 0 0 18px');
  });

  it("сохраняет тематичные поверхности и карточки таблиц на узком и среднем экране", () => {
    expect(css).toContain('background: #f7fbff');
    expect(css).toContain('background: #16101a');
    expect(css).toContain('.evotor-sales-table.data-table tbody tr');
    expect(css).toContain('content: attr(data-label)');
    expect(css).toContain('max-width: 1024px');
    expect(css).toContain('A compact tablet cannot usefully drag an analytical table');
    expect(css).toContain('.evotor-sales-period');
  });

  it("показывает проданные товары прежде денежных показателей и расшифровывает единицу fraction", () => {
    expect(page).toContain('useState<ProductMetric>("quantity")');
    expect(page).toContain('const unitLabel = (value: string | null) => value === "fraction" ? "кг"');
    expect(page).toContain('amount: "Сумма продаж", quantity: "Продано", positions: "Строки чеков"');
    expect(page).toContain('data-label="Продано"');
    expect(page).toContain('unitLabel(row.unit)');
  });
});
