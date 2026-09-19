import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./EvotorSalesAnalytics.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../evotor-sales-analytics.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("проданные товары Эвотор", () => {
  it("оставляет отдельную товарную витрину и возвращает старый маршрут показателей в Ритм", () => {
    expect(app).toContain('path="/evotor-sales/metrics" component={EvotorMetricsRedirect}');
    expect(app).toContain('path="/evotor-sales/products" component={EvotorSalesAnalytics}');
    expect(shell).not.toContain('"Показатели Эвотор", true');
    expect(shell).toContain('"Проданные товары", true');
  });

  it("повторяет контролы Ритма и не смешивается с P&L", () => {
    expect(page).toContain('["month", "week", "day", "hour"]');
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain("MetricLineChart");
    expect(page).toContain('forceTimeline');
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).toContain("СОСТАВ ПРОДАЖ");
    expect(page).toContain("read-only");
    expect(page).not.toContain("confirmEvotorCatalog");
  });

  it("ограничивает факты 2025 годом и не скрывает ограничение покрытия", () => {
    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
    expect(page).toContain("DateRangeControl");
    expect(page).toContain("Точки с фактами продажи в выбранном срезе");
    expect(page).toContain("function retainedRange");
  });

  it("выбирает товары через раскрывающийся selector без внутреннего скролла", () => {
    expect(page).toContain("Выбрать все");
    expect(page).toContain("selectedProductKeys");
    expect(page).toContain("productTimeline");
    expect(page).toContain("selectedProductTimeline");
    expect(page).toContain("Товарные позиции");
    expect(css).toContain(".packet .evotor-product-picker");
    expect(css).toContain("max-height: none");
    expect(css).toContain("overflow: visible");
  });
});
