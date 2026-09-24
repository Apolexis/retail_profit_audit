import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/Forecast.tsx"), "utf8");
const styles = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");

describe("страница прогноза", () => {
  it("строится на факте текущего и прошлого годов без заполнения пропусков", () => {
    expect(page).toContain("buildSeasonalForecast");
    expect(page).toContain("useImportedAudit(previousYear)");
    expect(page).toContain("Система не заменяет отсутствующие факты нулями или вымышленными значениями.");
  });

  it("предлагает график и таблицу по полному набору прямых финансовых потоков", () => {
    expect(page).toContain("Выручка");
    expect(page).toContain("Валовая прибыль");
    expect(page).toContain("Чистая прибыль");
    expect(page).toContain("Закупки");
    expect(page).toContain("Продажи Коп.");
    expect(page).toContain("Перемещения");
    expect(page).toContain("Списания М.");
    expect(page).toContain("expenseDefinitions.map");
    expect(page).toContain("<optgroup");
    expect(page).toContain("ТАБЛИЦА РАСЧЕТА");
  });

  it("сохраняет мобильный перенос пояснения графика", () => {
    expect(page).toContain('className="card-title forecast-chart-title"');
  });

  it("объясняет основу прогноза, не оставляя нейтральной серой карточки", () => {
    expect(page).toContain('className="forecast-basis"');
    expect(page).toContain("Сопоставляются только завершенные месяцы");
  });

  it("передает денежные значения в тысячах, а чеки — как числа", () => {
    expect(page).toContain("const chartValue");
    expect(page).toContain("isEvotorChecks ? value : value / 1000");
    expect(page).toContain('displayMode={isEvotorChecks ? "number" : undefined}');
  });

	it("использует базовую сетку KPI с явными интервалами между карточками", () => {
	  expect(page).toContain('className="packet-kpis forecast-kpis"');
	});

	it("читает связанные controls попарно и не возвращает белую поверхность в светлой теме", () => {
	  expect(styles).toContain('@media (min-width: 341px)');
	  expect(styles).toContain('.packet .forecast-controls { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }');
	  expect(styles).toContain('.packet .forecast-controls > .forecast-basis { grid-column: 1 / -1; }');
	  expect(styles).toContain('html[data-audit-theme="light"] .packet .forecast-controls > :is(label, div) { background: #edf6ff !important;');
	});

  it("завершает расчетную таблицу согласованной строкой итогов", () => {
    expect(page).toContain("const historicalTotal = forecast.rows.reduce");
    expect(page).toContain('<tfoot><tr className="table-total"><th scope="row">Итого</th>');
    expect(page).toContain("{valueText(historicalTotal)}");
    expect(page).toContain("{valueText(forecast.actualToDate)}");
    expect(page).toContain("{valueText(forecast.forecastTotal)}");
  });

  it("строит отдельную read-only сезонность Эвотор без реестра чеков", () => {
    expect(page).toContain("evotorSalesAnalytics.useQuery");
    expect(page).toContain("evotorAnalyticsQueryOptions");
    expect(page).toContain('granularity: "month"');
    expect(page).toContain("includeProducts: false");
    expect(page).toContain("evotorForecastQuery.data?.performance?.serviceMs");
    expect(page).toContain('me.data?.role === "admin"');
    expect(page).toContain("!demoMode");
    expect(page).toContain("evotorForecastFacts");
    expect(page).toContain("Выручка общая Эвотор");
    expect(page).toContain("Чеки Эвотор");
    expect(page).toContain("Это не реестр чеков и не замена Excel/P&L.");
    expect(page).not.toContain("evotorSalesReceipts");
    expect(page).not.toContain("receiptNumber");
  });

  it("сверяет одноименную выручку Excel и Эвотор без подмены источника", () => {
    expect(page).toContain("evotorCounterpartByExcelMetric");
    expect(page).toContain("СВЕРКА ОДНОИМЕННОГО ФАКТА");
    expect(page).toContain("Excel и Эвотор не смешиваются");
    expect(page).toContain("Это сигнал для проверки, а не автоматическая корректировка Excel, P&L или чеков Эвотор.");
    expect(page).toContain("Monthly bins are");
    expect(page).toContain("cashAmount");
    expect(page).toContain("cashlessAmount");
  });

  it("возвращает все прямые финансовые факты выручки в прогноз", () => {
    expect(page).toContain('{ code: "receipts_total", label: "Выручка общая"');
    expect(page).toContain('{ code: "cash_revenue", label: "Выручка нал"');
    expect(page).toContain('{ code: "cashless_revenue", label: "Выручка б/нал"');
  });

	it("показывает сезонность Эвотор без финансового импорта Excel", () => {
	  expect(page).toContain("const stores = trpc.audit.stores.useQuery");
	  expect(page).toContain("const evotorOnlyMode = !imported.loading && !imported.available && mayReadEvotorForecast;");
	  expect(page).toContain("Do not replace the default Excel metric until its availability is known.");
	  expect(page).toContain("const metrics = evotorOnlyMode ? evotorForecastMetrics");
	  expect(page).toContain('setMetric(evotorOnlyMode ? "evotor_amount" : "revenue")');
    expect(page).toContain("(!isEvotorMetric && imported.loading)");
    expect(page).toContain("Недостаточно чеков для сезонного прогноза");
  });
});
