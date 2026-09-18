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
    expect(page).toContain('ДАННЫЕ ПОД ГРАФИКОМ');
    expect(page).toContain('ТОВАРЫ ПОД ГРАФИКОМ');
    expect(page).toContain('не является финансовым P&L');
    expect(page).not.toContain('confirmEvotorCatalog');
    expect(page).not.toContain('syncEvotorDocumentPage');
  });

  it("сохраняет тематичные поверхности и карточки таблиц на узком экране", () => {
    expect(css).toContain('background: #f7fbff');
    expect(css).toContain('background: #16101a');
    expect(css).toContain('.evotor-sales-table.data-table tbody tr');
    expect(css).toContain('content: attr(data-label)');
    expect(css).toContain('max-width: 760px');
  });
});
