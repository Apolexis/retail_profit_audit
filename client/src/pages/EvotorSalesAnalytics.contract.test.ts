import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./EvotorSalesAnalytics.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../evotor-sales-analytics.css", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const aggregation = readFileSync(new URL("../lib/evotorSalesAggregation.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("проданные товары Эвотор", () => {
  it("оставляет отдельную товарную витрину и возвращает старый маршрут показателей в Ритм", () => {
    expect(app).toContain('path="/evotor-sales/metrics" component={EvotorMetricsRedirect}');
    expect(app).toContain('path="/evotor-sales/products" component={EvotorSalesAnalytics}');
    expect(shell).not.toContain('"Показатели Эвотор", true');
    expect(shell).toContain('"Проданные товары", true');
  });

	  it("сохраняет контролы и график Ритма, а под ним — товарную таблицу с понятным раскрытием", () => {
    expect(page).toContain('["month", "week", "day", "hour"]');
    expect(page).toContain('hour: "Часы"');
    expect(page).toContain("суммарный профиль по московскому времени");
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain("MetricLineChart");
    expect(page).not.toContain("forceTimeline");
	  expect(page).toContain("ТОВАРЫ ПОД ГРАФИКОМ");
	  expect(page).toContain("const productTableRows = useMemo");
	  expect(page).toContain("Нажмите на название товара, чтобы выбрать его для графика и раскрыть магазины");
	  expect(page).toContain('className="data-table evotor-sales-table evotor-sales-product-table"');
	  expect(page).toContain('className="data-table-wrap cadence-full-table evotor-sales-table-wrap"');
	  expect(css).not.toContain(".evotor-sales-table.data-table thead { position: absolute");
	  expect(css).not.toContain(".evotor-sales-table-wrap { overflow: visible");
	  expect(css).not.toContain(".evotor-sales-table.data-table tbody tr { display: grid");
	  expect(page).toContain("по единицам выше");
	  expect(page).toContain('const [productTableQuery, setProductTableQuery] = useState("")');
	  expect(page).toContain("const filteredProductTableRows = productTableRows.filter");
	  expect(page).toContain('ariaLabel="Поиск в таблице проданных товаров"');
	  expect(page).toContain("filteredProductTableRows.map");
	  expect(page).not.toContain("СОСТАВ ПРОДАЖ");
    expect(page).toContain("read-only");
    expect(page).not.toContain("confirmEvotorCatalog");
  });

	  it("ограничивает факты 2025 годом и показывает реальный охват", () => {
	    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
	    expect(page).not.toContain("DateRangeControl");
	    expect(page).toContain("const { demoMode, range, selectedStores } = useAudit();");
	    expect(page).toContain("const salesRange = retainedRange(range);");
	    expect(page).not.toContain("defaultSalesRange");
	    expect(page).toContain("Точки с фактами продажи в выбранном срезе");
	    expect(page).toContain("function retainedRange");
	    expect(page).toContain("evotorAnalyticsQueryOptions");
	    expect(page).toContain("storeIds: allStoresSelected ? undefined : selectedStoreIds");
		    expect(page).toContain("formatBusinessCalendarDate(value.from");
		    expect(page).toContain("function retainedRange");
		    expect(page).not.toContain('new Date(`${to}T12:00:00Z`)');
	  });

	  it("не читает витрину реальных товаров в демо-режиме", () => {
	    expect(page).toContain("const { demoMode, range, selectedStores } = useAudit();");
    expect(page).toContain("enabled: !demoMode");
    expect(page).toContain("Проданные товары отключены в демо‑режиме");
  });

  it("выбирает товары во встроенном компактном раскрывающемся контроле без поиска, скролла и массового выбора", () => {
    expect(page).toContain('className="cadence-store-picker evotor-product-picker"');
    expect(page).toContain("selectedProductKeys");
    expect(page).toContain("productTimeline");
    expect(page).toContain("buildSelectedProductTimeline");
    expect(page).toContain("const productColorByKey = useMemo");
    expect(page).toContain("const productColor = (key: string) => productColorByKey.get(key)");
    expect(page).toContain("color: productColor(product.key)");
    expect(page).toContain("background: productColor(product.key)");
    expect(page).not.toContain("effectiveProducts.map((product, index) => ({ key: product.key, name: product.productName, color: productColors[index % productColors.length]" );
    expect(page).not.toContain("Выбрать все");
    expect(page).not.toContain("Товарные позиции");
    expect(page).toContain("Товары для графика");
    expect(css).toContain("evotor-product-picker > summary");
    expect(css).not.toContain("max-height");
  });

  it("показывает только понятные показатели товара, без счетчика товарных позиций", () => {
    expect(page).toContain("Количество проданного");
    expect(page).toContain("Сумма проданного");
    expect(page).not.toContain('<span>Наименований</span>');
    expect(page).not.toContain("по названию и единице Эвотор");
  });

		it("не смешивает кг и шт и сохраняет копейки в фактах оплат Эвотор", () => {
    expect(page).toContain("quantitiesByUnit");
    expect(page).toContain("normalizeEvotorQuantityUnit(total.unit)");
    expect(page).toContain("единицы не смешиваются");
    expect(page).toContain("formatQuantityWithUnit(total.quantity, total.unit)");
    expect(page).toContain("quantityUnitLabel(total.unit)");
    expect(page).toContain("formatQuantityWithUnit(row.quantity, row.unit)");
    expect(page).toContain("quantityUnit: product.unit ?? undefined");
    expect(page).toContain("Выручка нал Эвотор");
    expect(page).toContain("Выручка б/нал Эвотор");
	    expect(page).toContain("paymentCaptureText");
	    expect(page).toContain("Оплаты подтверждены у");
	    expect(page).toContain("подтвержденные оплаты CASH");
	    expect(page).toContain("подтвержденные оплаты ELECTRON");
	    expect(page).toContain("сумма всех переданных оплат");
	    expect(page).not.toContain("закрытых чеков продажи");
		    expect(page).toContain("formatMoneyWithKopecks");
    expect(page).toContain("Факты чеков загружаются отдельно от Excel-импорта");
  });

	  it("сохраняет режим рядов при смене факта или товара и отделяет его от сравнения периодов", () => {
    expect(page).toContain("setShowStoreSeries(false);");
    expect(page).toContain("setComparePeriod(false);");
    expect(page).toContain("showStoreSeries && !comparePeriod");
    expect(page).toContain("buildSelectedProductStoreTimeline");
	    expect(aggregation).toContain("row.storeName");
	  });

	  it("синхронизирует товар таблицы с графиком и раскрывает только его read-only магазины", () => {
	    expect(page).toContain('const [expandedProductKey, setExpandedProductKey] = useState<string | null>(null)');
	    expect(page).toContain("const productStoresByKey = useMemo");
	    expect(page).toContain("data?.productTimeline");
	    expect(page).toContain("const selectProductFromTable = (key: string)");
	    expect(page).toContain("setSelectedProductKeys([key]);");
	    expect(page).toContain("setExpandedProductKey(current => current === key ? null : key);");
	    expect(page).toContain("current === null ? null");
	    expect(page).toContain('className="evotor-product-row-trigger"');
	    expect(page).toContain('aria-expanded={expanded}');
	    expect(page).toContain("Продажи по магазинам");
	    expect(page).toContain("storesForProduct.map");
	    expect(page).toContain("read-only распределение по магазинам");
	    expect(css).toContain(".packet .evotor-product-store-breakdown");
	    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
	    expect(css).not.toContain("evotor-product-row-trigger:hover strong");
	  });

	it("сопоставляет аналогичный предыдущий период обратным рядом без изменения режима графика", () => {
	  expect(page).toContain("previousComparableRange(salesRange)");
	  expect(page).toContain("previousQuery");
	  expect(page).toContain("reverseComparableRows(productChartData, previousProductChartData)");
	  expect(page).toContain("previousSeriesKey(product.key)");
	  expect(page).toContain("ChartPeriodComparisonToggle");
	  expect(page).toContain('comparisonControl={() => <ChartPeriodComparisonToggle');
	  expect(page).toContain("показан обратным рядом");
	});

	it("использует тот же control сравнения периода перед режимами общего графика", () => {
	  expect(overrides).toContain('.chart-expand-controls');
	  expect(overrides).toContain('.cadence-compare-control:not(.active)');
	});

	  it("на широком экране выводит KPI и выбор товаров в две полезные колонки", () => {
	    expect(overrides).toContain(".packet .evotor-sales-kpis");
	    expect(overrides).toContain("repeat(2, minmax(0, 1fr)) !important");
	    expect(page).toContain('aria-label="Продажи и оплаты Эвотор"');
	    expect(page).not.toContain("evotor-sales-payment-kpis");
    expect(overrides).toContain(".packet .evotor-product-picker .cadence-metric-group {");
    expect(overrides).toContain(".packet .evotor-product-picker .cadence-metric-group > div");
    expect(overrides).toContain("repeat(auto-fit, minmax(min(188px, 100%), 1fr))");
  });

	  it("на phone оставляет KPI попарно и не использует оранжевый в товарной палитре", () => {
	    expect(css).toContain("@media (max-width: 720px)");
	    expect(css).toContain(".packet .evotor-sales-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
	    expect(overrides).toContain('@media (min-width: 341px)');
	    expect(overrides).toContain('.packet :is(.packet-kpis.equal, .cadence-kpis) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }');
	    expect(css).toContain("@media (max-width: 860px)");
	    expect(css).toContain(".packet .evotor-sales-product-table { display: block; width: 100%; min-width: 0 !important;");
	    expect(css).toContain(".packet .evotor-sales-product-table .evotor-product-row { display: grid;");
	    expect(css).toContain(".packet .evotor-sales-product-table .evotor-product-row > td::before");
    expect(overrides).toContain(".packet .evotor-sales-table-wrap.cadence-full-table .evotor-sales-product-table");
    expect(overrides).toContain("inline-size: 100% !important;");
	    expect(css).toContain('html[data-audit-theme="dark"] .packet .evotor-sales-chart-card .chart-view-button.active');
    expect(page).toContain("#FF6B8A");
    expect(page).not.toContain("#FF9F0A");
  });
});
