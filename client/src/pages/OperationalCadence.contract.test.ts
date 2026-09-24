import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./OperationalCadence.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Ритм»", () => {
	it("дает выбрать несколько показателей и сохраняет хотя бы один", () => {
	  expect(page).toContain("Показатели для сравнения");
	  expect(page).toContain("без лимита; минимум один");
	  expect(page).toContain("current.length === 1 ? current");
	  expect(page).toContain("selectedMetrics.map(metric");
	});

		it("показывает выбранные факты отдельными цветными значениями без процентов между фактами", () => {
	  expect(page).toContain("comparableRangeLabel");
	  expect(page).not.toContain("tooltipPairComparison={tooltipPairComparison}");
	  expect(page).not.toContain("Порядок выбора задаёт базу процента.");
	});

	  it("встраивает read-only факты чеков Эвотор в ту же группу выручки", () => {
    expect(page).toContain('evotorAmount: { label: "Выручка общая Эвотор"');
    expect(page).toContain('evotorCash: { label: "Выручка нал Эвотор"');
    expect(page).toContain('evotorCashless: { label: "Выручка б/нал Эвотор"');
    expect(page).toContain('evotorChecks: { label: "Чеки Эвотор"');
	    expect(page).toContain('evotorAverage: { label: "Средний чек Эвотор"');
	    expect(page).toContain("current.cashAmount += Number(row.cashAmount ?? 0)");
	    expect(page).toContain("current.cashlessAmount += Number(row.cashlessAmount ?? 0)");
	    expect(page).toContain("includeProducts: false");
	    expect(page).toContain("evotorAnalyticsQueryOptions");
	  });

  it("ставит суммарные продажи рядом с копченой и мороженой частью", () => {
    expect(page).toContain('revenue: { label: "Продажи Коп. и Мор."');
    expect(page).toContain('"purchaseFrozen", "revenue", "salesSmoked", "salesFrozen"');
  });

  it("отделяет независимый товарный поток от верхних карточек", () => {
    expect(page).toContain('className="packet-card cadence-stock-facts"');
    expect(styles).toContain(".packet .cadence-stock-facts { margin: 22px 0 18px; }");
  });

  it("рисует количество чеков числом с явной единицей, а не денежным рядом", () => {
    expect(page).toContain('const checksOnly = selectedMetrics.length === 1 && selectedMetrics[0] === "evotorChecks";');
    expect(page).toContain('quantityUnit: metric === "evotorChecks" ? "check" : undefined');
    expect(page).toContain('displayMode={checksOnly ? "number" : undefined}');
  });

	it("не читает и не выводит реальные чековые факты при демо-режиме", () => {
	    expect(page).toContain("const { selectedStores, range, rangeLabel, demoMode } = useAudit();");
    expect(page).toContain("const needsEvotorFacts = selectedMetrics.some(metric => metric.startsWith(\"evotor\"));");
    expect(page).toContain("enabled: !demoMode && needsEvotorFacts && range.to >= \"2025-01-01\"");
    expect(page).toContain("const evotorTimeline = demoMode ? []");
    expect(page).toContain("visibleMetricGroups");
  });

	  it("не скрывает уже загруженные read-only чеки Эвотор из-за отсутствия Excel", () => {
	    expect(page).toContain("const evotorOnlyMode = !demoMode && !facts.financialCoverageLoading && !facts.hasAnyFinancialFacts;");
	    expect(page).toContain("const evotorStoreDirectory");
	    expect(page).toContain("metric.startsWith(\"evotor\")");
	    expect(page).toContain("Финансовая книга Excel еще не импортирована");
	    expect(page).toContain("Ритм по уже загруженным чекам Эвотор");
	    expect(page).toContain("!facts.available && demoMode");
	    expect(page).toContain("demoMode && facts.loading ? <FactsLoader/>");
	    expect(page).not.toContain("facts.loading || (evotorOnlyMode && storeDirectory.isLoading)");
	  });

	  it("не скрывает Excel-факты, когда книга есть, но в выбранном периоде нет строк", () => {
	    expect(page).toContain("facts.financialCoverageLoading");
	    expect(page).toContain("facts.hasAnyFinancialFacts");
	    expect(page).toContain("const financialRangeEmpty");
	    expect(page).toContain("В выбранном периоде нет финансовых строк Excel");
	    expect(page).toContain("Список всех финансовых фактов сохранен");
	    expect(page).toContain("За выбранные даты нет строк для выбранных фактов");
	  });

	it("добавляет компактную детализацию по месяцам, неделям, дням и часам Эвотор", () => {
	  expect(page).toContain('aria-label="Детализация ритма"');
	  expect(page).toContain('"hour" ? "Часы" : level === "day" ? "Дни"');
	  expect(page).toContain("evotorTimelinePoints");
	  expect(page).toContain('seriesStores.length > 1 && selectedMetrics.length === 1 && <StoreSeriesModeToggle');
	  expect(page).toContain("только факты Эвотор по МСК");
	  expect(page).toContain('«Ряды» — по магазинам');
	  expect(page).toContain("cadence.monthly");
	});

	it("сохраняет ряды по магазинам и для часового профиля Эвотор", () => {
	  expect(page).toContain('if (!showStoreSeries || comparePeriod || seriesStores.length < 2 || selectedMetrics.length !== 1) return null;');
	  expect(page).toContain('if (metric.startsWith("evotor"))');
	  expect(page).not.toContain('if (granularity === "hour" || !showStoreSeries');
	});

	it("сопоставляет профиль часов с тем же часом предыдущего диапазона", () => {
	  expect(page).toContain('previousData.find(previous => previous.month === active.month)');
	  expect(page).toContain("сопоставлен с теми же московскими часами");
	});

  it("дает выбрать магазины без лимита и показывает полную таблицу под графиком", () => {
    expect(page).toContain("const selectedConcreteStores = selectedStores;");
    expect(page).toContain("const networkSelected = selectedStores.length === 0;");
    expect(page).not.toContain("Магазины для суммарного среза");
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).toContain("каждый магазин отдельно");
    expect(page).toContain("const [showStoreSeries, setShowStoreSeries] = useState(false);");
    expect(page).toContain("!showStoreSeries || comparePeriod || seriesStores.length < 2 || selectedMetrics.length !== 1");
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain('active={showStoreSeries}');
    expect(page).toContain("const chartTableTotals");
    expect(page).toContain('<tfoot><tr className="table-total"><th scope="row">Итого</th>');
  });

  it("фильтрует строки и итоги таблиц под графиками локальным поиском", () => {
    expect(page).toContain('const [chartTableQuery, setChartTableQuery] = useState("")');
    expect(page).toContain('const [expenseTableQuery, setExpenseTableQuery] = useState("")');
    expect(page).toContain("const chartTableRows = chartData.filter");
    expect(page).toContain("const expenseBreakdownRows = expenseBreakdownLedger.filter");
    expect(page).toContain('ariaLabel="Поиск в таблице под графиком Ритма"');
    expect(page).toContain('ariaLabel="Поиск в таблице состава расходов"');
    expect(page).toContain("chartTableRows.reduce");
    expect(page).toContain("expenseBreakdownRows.map");
  });

	  it("строит режим «Ряды» для чеков Эвотор по витрине чеков, а не по Excel", () => {
    expect(page).toContain('if (metric.startsWith("evotor"))');
		    expect(page).toContain("for (const point of evotorTimeline)");
		    expect(page).toContain("metric === \"evotorCash\" ? point.cashAmount");
		    expect(page).toContain("metric === \"evotorChecks\" ? point.checks");
		    expect(page).toContain("const evotorTimeline = demoMode ? []");
		  });

	  it("показывает импортный денежный остаток и read-only остаток Эвотор раздельно", () => {
	    expect(page).toContain("trpc.inventoryRegistry.evotorStockSnapshot.useQuery");
	    expect(page).toContain("const importedStockValue");
	    expect(page).toContain("Остаток импорт");
	    expect(page).toContain("Остаток Эвотор");
	    expect(page).toContain("Кг, л и шт показаны раздельно");
	    expect(page).toContain("все сохраненные физические количества из read-only каталога");
	    expect(page).toContain("useGrouping: false");
	    expect(page).not.toContain("unlimitedPositions");
	    expect(page).toContain("formatEvotorStockQuantity");
	    expect(styles).toContain(".packet .cadence-stock-facts-grid");
	    expect(styles).toContain(".packet .cadence-stock-unit-list");
	  });

	  it("оставляет в Ритме coverage выбранного периода, а технический обход переносит в реестр чеков", () => {
		    expect(page).toContain("это coverage выбранного периода, не прогресс минутного обхода");
		    expect(page).not.toContain("trpc.inventoryRegistry.evotorSyncStatus.useQuery");
		    expect(page).not.toContain('aria-label="Статус загрузки фактов Эвотор за текущий день"');
		    expect(page).not.toContain('className="packet-note cadence-evotor-sync-note"');
		  });

	  it("выделяет наличные расходы и НДФЛ 22% в понятную группу", () => {
    expect(page).toContain("Наличные расходы и налоги");
    expect(page).toContain('expenses: { label: "Общие расходы"');
    expect(page).toContain('{ label: "Итоговые расходы", keys: ["expenses", "cashExpenses", "cashlessExpenses"] }');
    expect(page).toContain('{ label: "Наличные расходы и налоги", keys: ["cashTaxes", "household"');
    expect(page).toContain("cash-control-group");
    expect(page).not.toContain("нал + НДФЛ 22%");
    expect(page).toContain("cadence-group-label");
  });

  it("показывает состав всех исходных расходных статей при выборе показателя «Расходы»", () => {
    expect(page).toContain("expenseBreakdownMetrics");
    expect(page).toContain('selectedMetrics.includes("expenses")');
    expect(page).toContain("СОСТАВ РАСХОДОВ");
    expect(page).toContain("без двойного учета агрегатов");
    expect(page).toContain('className="expense-breakdown-note"');
    expect(page).toContain("const expenseBreakdownLedger");
    expect(page).toContain("const expenseBreakdownTotal");
    expect(page).toContain("Исходная статья");
    expect(styles).toContain(".packet .expense-breakdown-card .expense-breakdown-note {");
    expect(styles).toContain("text-wrap: pretty;");
    expect(styles).toContain("background: transparent !important;");
  });

  it("показывает общие безналичные траты и их исходный состав", () => {
    expect(page).toContain('cashlessExpenses: { label: "Общие траты б/нал"');
    expect(page).toContain("cashlessBreakdownMetrics");
    expect(page).toContain('selectedMetrics.includes("cashlessExpenses")');
    expect(page).toContain("СОСТАВ ТРАТ Б/НАЛ");
  });

  it("использует согласованные краткие подписи без изменения кодов расходных статей", () => {
    expect(page).toContain('driverCashless: { label: "Водитель б/нал"');
    expect(page).toContain('utilitiesCashless: { label: "Коммуналка б/нал"');
    expect(page).toContain('bankFee: { label: "% банку"');
    expect(page).toContain('salaryCashless: { label: "Зарплата б/нал"');
    expect(page).toContain('payrollTax: { label: "Налоги зарплатные"');
    expect(page).toContain('vacationCashless: { label: "Отпускные б/нал"');
    expect(page).toContain('vacationTax: { label: "Налоги на отпускные"');
  });

  it("разделяет безналичные расходы и ФОТ на две плоские группы без потери выбора статей", () => {
    expect(page).toContain('{ label: "Безналичные", keys: ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax"] }');
    expect(page).toContain('{ label: "ФОТ и налоги", keys: ["salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash"] }');
    expect(page).not.toContain('label: "Безналичные, ФОТ и налоги"');
  });

  it("использует для группы наличных расходов обычный цвет заголовков в обеих темах", () => {
    expect(styles).toContain(".packet .cadence-group-label > span { color: var(--faint);");
    expect(styles).not.toContain(".cash-control-group .cadence-group-label > span { color:");
  });

  it("показывает последние интервалы карточками с отдельными значениями", () => {
    expect(page).toContain("cadence-interval-card");
    expect(page).toContain("cadence-interval-values");
  });

  it("не добавляет пустые нулевые интервалы в график, таблицу и последние карточки", () => {
    expect(page).toContain("const visibleSource = mergedSource.filter(point => selectedMetrics.some(metric => point[metric] !== 0));");
    expect(page).toContain("const data: Array<Record<string, string | number>> = visibleSource.map(point");
    expect(page).toContain("const perStoreData = useMemo");
    expect(page).toContain("const intervalRows = [...visibleSource].slice(-8).reverse();");
    expect(page).toContain("chartLines.map(line => <th");
  });

	it("сопоставляет аналогичный предыдущий период обратным рядом без разворота графика", () => {
	  expect(page).toContain("previousComparableRange(range)");
	  expect(page).toContain("facts.comparisonRowsFor");
	  expect(page).toContain("previousEvotorFacts");
	  expect(page).toContain("reverseComparableRows(data, previousData)");
	  expect(page).toContain("previousSeriesKey(metric)");
	  expect(page).toContain("ChartPeriodComparisonToggle");
	  expect(page).toContain('comparisonControl={() => <ChartPeriodComparisonToggle');
	  expect(page).toContain("показан обратным рядом");
	});

	it("явно показывает правило источников без сложения сайта, Excel и Эвотор", () => {
	  expect(page).toContain('type FactSource = "excel" | "site-overlay" | "evotor"');
	  expect(page).toContain("const siteOverlayMetrics");
	  expect(page).toContain("Сайт → Excel");
	  expect(page).toContain("заменяют Excel, не складываются с ним");
	  expect(page).toContain("Эвотор");
	  expect(page).toContain("не подменяют P&amp;L");
	  expect(page).toContain("title={factSourceLabel(metric)}");
	  expect(styles).toContain(".packet .cadence-source-contract");
	});

	it("передает сравнение периода в общий toolbar перед режимами графика", () => {
	  expect(styles).toContain('.chart-expand-controls');
	  expect(styles).toContain('html[data-audit-theme="light"] :is(.packet, .chart-expand-dialog, .chart-expand-dialog-general) .chart-view-button.active');
	  expect(styles).toContain('html[data-audit-theme="dark"] :is(.packet, .chart-expand-dialog, .chart-expand-dialog-general) .chart-view-button.active');
	});
});
