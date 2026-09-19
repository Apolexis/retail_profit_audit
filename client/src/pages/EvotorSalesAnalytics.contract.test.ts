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

  it("повторяет контролы, график и одну таблицу Ритма", () => {
    expect(page).toContain('["month", "week", "day", "hour"]');
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain("MetricLineChart");
    expect(page).not.toContain("forceTimeline");
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).not.toContain("СОСТАВ ПРОДАЖ");
    expect(page).toContain("read-only");
    expect(page).not.toContain("confirmEvotorCatalog");
  });

  it("ограничивает факты 2025 годом и показывает реальный охват", () => {
    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
    expect(page).toContain("DateRangeControl");
    expect(page).toContain("Точки с фактами продажи в выбранном срезе");
    expect(page).toContain("function retainedRange");
  });

  it("выбирает товары встроенными цветными чипами без поиска, скролла и массового выбора", () => {
    expect(page).toContain('className="cadence-metrics-picker evotor-product-metrics-picker"');
    expect(page).toContain("selectedProductKeys");
    expect(page).toContain("productTimeline");
    expect(page).toContain("selectedProductTimeline");
    expect(page).toContain("productColors[index % productColors.length]");
    expect(page).not.toContain("Выбрать все");
    expect(page).not.toContain("Товарные позиции");
    expect(page).not.toContain("evotor-product-picker");
    expect(css).not.toContain("evotor-product-picker");
    expect(css).not.toContain("max-height");
  });

  it("сохраняет режим рядов при смене факта или товара и строит строки по магазину", () => {
    expect(page).not.toContain("setShowStoreSeries(false)");
    expect(page).toContain("selectedProductStoreTimeline");
    expect(page).toContain("row.storeName");
  });
});
