import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./EvotorSalesAnalytics.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../evotor-sales-analytics.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

// These contracts protect the two independent read-only views from drifting away
// from the interaction vocabulary of «Ритм» while avoiding UI-only API writes.
describe("страницы продаж Эвотор", () => {
  it("разделяет показатели чеков и проданные товары на два маршрута", () => {
    expect(app).toContain('path="/evotor-sales/metrics"');
    expect(app).toContain('path="/evotor-sales/products"');
    expect(shell).toContain('"Показатели Эвотор", true');
    expect(shell).toContain('"Проданные товары", true');
    expect(page).toContain('kind === "metrics" ? "Показатели Эвотор" : "Проданные товары"');
  });

  it("повторяет контролы Ритма и не смешивается с финансовым P&L", () => {
    expect(page).toContain('["month", "week", "day", "hour"]');
    expect(page).toContain("Все магазины");
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain("MetricLineChart");
    expect(page).toContain("cadence-chart-card evotor-sales-chart-card");
    expect(page).toContain("cadence-detail-table evotor-sales-table-card");
    expect(page).toContain("cadence-full-table evotor-sales-table-wrap");
    expect(page).toContain('<tfoot><tr className="table-total"><th scope="row">Итого</th>');
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).toContain("ТОВАРЫ ПОД ГРАФИКОМ");
    expect(page).toContain("не является финансовым P&L");
    expect(page).not.toContain("confirmEvotorCatalog");
    expect(page).not.toContain("syncEvotorDocumentPage");
  });

  it("начинает аналитику с 2025 года и использует компактный общий контрол периода", () => {
    expect(page).toContain("DateRangeControl");
    expect(page).toContain("ПЕРИОД ДОКУМЕНТОВ ЭВОТОР");
    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
    expect(page).toContain("from: EVOTOR_ANALYTICS_START");
    expect(page).toContain("В аналитике учитываются только документы начиная с 2025 года.");
    expect(page).toContain("function retainedRange");
    expect(page).toContain('className="analysis-filter evotor-sales-period"');
    expect(css).toContain(".packet .evotor-sales-period { margin-bottom: 18px; }");
    expect(css).not.toContain("packet-card evotor-sales-period");
  });

  it("не вводит отдельную оранжевую палитру и перестраивает таблицу на средней ширине", () => {
    expect(css).not.toContain("#ff765f");
    expect(css).not.toContain("#f7fbff");
    expect(css).toContain(".evotor-sales-table.data-table tbody tr");
    expect(css).toContain("content: attr(data-label)");
    expect(css).toContain("@media (max-width: 1024px)");
    expect(css).toContain("overflow: visible");
  });

  it("дает выбрать сами товары для графика и показывает количество прежде суммы", () => {
    expect(page).toContain('useState<ProductMetric>("quantity")');
    expect(page).toContain('const unitLabel = (value: string | null) => value === "fraction" ? "кг"');
    expect(page).toContain("Товары для сравнения");
    expect(page).toContain("selectedProductKeys");
    expect(page).toContain("productTimeline");
    expect(page).toContain("selectedProductTimeline");
    expect(page).toContain('data-label="Продано"');
    expect(page).toContain("unitLabel(row.unit)");
  });
});
