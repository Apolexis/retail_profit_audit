import { ThemedSelect } from "@/components/ui/themed-select";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, ChartNoAxesCombined, Info, TrendingDown, TrendingUp } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatFactAmount, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useImportedAudit } from "@/hooks/useImportedAudit";
import { expenseDefinitions } from "@/hooks/useAuditFacts";
import { buildSeasonalForecast } from "@/lib/forecastLogic";
import { evotorAnalyticsQueryOptions } from "@/lib/evotorAnalyticsQuery";
import { trpc } from "@/lib/trpc";
import "@/forecast.css";

type ForecastMetric = { code: string; label: string; description: string };
const primaryMetrics: ForecastMetric[] = [
    { code: "revenue", label: "Выручка", description: "поступление от продаж" },
    { code: "receipts_total", label: "Выручка общая", description: "итог наличной и безналичной выручки" },
    { code: "cash_revenue", label: "Выручка нал", description: "наличная выручка из исходной книги" },
    { code: "cashless_revenue", label: "Выручка б/нал", description: "безналичная выручка из исходной книги" },
    { code: "gross_profit", label: "Валовая прибыль", description: "результат до операционных расходов" },
    { code: "net_profit", label: "Чистая прибыль", description: "итог после расходов" },
    { code: "purchases", label: "Закупки", description: "совокупный товарный поток" },
    { code: "sales_smoked", label: "Продажи Коп.", description: "продажи копченой продукции" },
    { code: "sales_frozen", label: "Продажи Мор.", description: "продажи мороженой продукции" },
    { code: "purchase_smoked", label: "Закупки Коп.", description: "закупка копченой продукции" },
    { code: "purchase_frozen", label: "Закупки Мор.", description: "закупка мороженой продукции" },
    { code: "writeoff_smoked", label: "Списания К.", description: "потери копченой продукции" },
    { code: "writeoff_frozen", label: "Списания М.", description: "потери мороженой продукции" },
  ];
const metricGroups: Array<{ label: string; metrics: ForecastMetric[] }> = [
  { label: "КОРРЕКТИРОВКИ ОБОРОТА", metrics: [
    { code: "movement", label: "Перемещения", description: "перемещение товарного остатка" },
    { code: "discount", label: "Уценка", description: "сумма скидок и уценки" },
    { code: "revaluation", label: "Переоценка", description: "результат переоценки" },
  ] },
  { label: "РАСХОДНЫЕ СТАТЬИ", metrics: expenseDefinitions.map(([code, label]) => ({ code, label, description: "фактическая расходная статья" })) },
];
const evotorForecastMetrics: ForecastMetric[] = [
  { code: "evotor_amount", label: "Выручка общая Эвотор", description: "агрегированная выручка импортированных чеков" },
  { code: "evotor_cash", label: "Выручка нал Эвотор", description: "оплаты типа CASH из импортированных чеков" },
  { code: "evotor_cashless", label: "Выручка б/нал Эвотор", description: "оплаты типа ELECTRON из импортированных чеков" },
  { code: "evotor_checks", label: "Чеки Эвотор", description: "количество импортированных чеков" },
];
const financialMetrics = [...primaryMetrics, ...metricGroups.flatMap(group => group.metrics)];
const evotorCounterpartByExcelMetric: Partial<Record<string, { key: "amount" | "cashAmount" | "cashlessAmount"; label: string }>> = {
  receipts_total: { key: "amount", label: "Выручка общая Эвотор" },
  cash_revenue: { key: "cashAmount", label: "Выручка нал Эвотор" },
  cashless_revenue: { key: "cashlessAmount", label: "Выручка б/нал Эвотор" },
};

const money = (value: number | null) => formatFactAmount(value);
const numberClass = (value: number) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

export default function Forecast() {
  const { range, selectedStore, demoMode } = useAudit();
  const year = Number(range.to.slice(0, 4));
  const [metric, setMetric] = useState("revenue");
  const previousYear = useMemo(() => ({ from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }), [year]);
  const imported = useImportedAudit(previousYear);
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const evotorStoreIds = useMemo(() => selectedStore === "__all__" ? undefined : (stores.data ?? []).filter(store => !store.isHidden && store.name === selectedStore).map(store => store.id), [selectedStore, stores.data]);
  const mayReadEvotorForecast = me.data?.role === "admin" && !demoMode && year >= 2025 && (selectedStore === "__all__" || Boolean(evotorStoreIds?.length));
  const evotorForecastRange = useMemo(() => ({ from: `${Math.max(2025, year - 1)}-01-01`, to: range.to }), [range.to, year]);
  const evotorForecastQuery = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery({ ...evotorForecastRange, granularity: "month", storeIds: evotorStoreIds, includeProducts: false }, { ...evotorAnalyticsQueryOptions, enabled: mayReadEvotorForecast });
  // Do not replace the default Excel metric until its availability is known.
  // Evotor remains selectable during loading, while a confirmed absent Excel
  // dashboard switches the selector to its read-only seasonal facts.
  const evotorOnlyMode = !imported.loading && !imported.available && mayReadEvotorForecast;
  const metrics = evotorOnlyMode ? evotorForecastMetrics : mayReadEvotorForecast ? [...financialMetrics, ...evotorForecastMetrics] : financialMetrics;
  const isEvotorMetric = metric.startsWith("evotor_");
  const evotorCounterpart = evotorCounterpartByExcelMetric[metric];
  const reconciliationRange = useMemo(() => ({ from: range.from < "2025-01-01" ? "2025-01-01" : range.from, to: range.to }), [range.from, range.to]);
  const mayCompareSources = Boolean(evotorCounterpart && mayReadEvotorForecast && range.to >= "2025-01-01");
  // The server applies the precise date filter before grouping. Monthly bins are
  // sufficient for an all-period total and avoid loading a needless daily series.
  const evotorReconciliationQuery = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery({ ...reconciliationRange, granularity: "month", storeIds: evotorStoreIds, includeProducts: false }, { ...evotorAnalyticsQueryOptions, enabled: mayCompareSources });
  useEffect(() => { if (!metrics.some(item => item.code === metric)) setMetric(evotorOnlyMode ? "evotor_amount" : "revenue"); }, [evotorOnlyMode, metric, metrics]);
  const selectedMetric = metrics.find(item => item.code === metric) ?? metrics[0];
  const evotorForecastFacts = useMemo(() => (evotorForecastQuery.data?.timeline ?? []).map(row => ({ store: row.storeName, monthDate: `${row.key}-01`, metrics: { evotor_amount: row.amount, evotor_cash: row.cashAmount, evotor_cashless: row.cashlessAmount, evotor_checks: row.checks } })), [evotorForecastQuery.data?.timeline]);
  const forecastFacts = isEvotorMetric ? evotorForecastFacts : imported.periods;
  const forecast = useMemo(() => buildSeasonalForecast({ facts: forecastFacts, year, store: selectedStore, metric }), [forecastFacts, metric, selectedStore, year]);
  const scope = selectedStore === "__all__" ? "Вся сеть" : selectedStore;
  const hasBasis = forecast.latestActualMonth > 0 && forecast.forecastRows.length > 0;
  const scale = forecast.scaleFactor === null ? null : (forecast.scaleFactor - 1) * 100;
  const historicalTotal = forecast.rows.reduce((sum, row) => sum + Number(row.historical ?? 0), 0);
  const isEvotorChecks = metric === "evotor_checks";
  const valueText = (value: number | null) => isEvotorChecks ? (value === null ? "—" : Math.round(value).toLocaleString("ru-RU")) : money(value);
  const chartValue = (value: number | null) => value === null ? null : isEvotorChecks ? value : value / 1000;
  const evotorResponseMs = evotorForecastQuery.data?.performance?.serviceMs;
  const evotorCoverageNote = evotorForecastQuery.data ? `${evotorForecastQuery.data.coverage.from ?? "—"} — ${evotorForecastQuery.data.coverage.to ?? "—"}; чеки есть у ${new Set(evotorForecastQuery.data.timeline.map(row => row.storeId)).size} из ${evotorForecastQuery.data.stores.length} точек; агрегат ${evotorResponseMs ?? "—"} мс.` : "загружаем только уже нормализованные чеки";
  const excelFactTotal = useMemo(() => imported.periods
    .filter(row => row.entryDate >= range.from && row.entryDate <= range.to && (selectedStore === "__all__" || row.store === selectedStore))
    .reduce((total, row) => total + Number(row.metrics[metric] ?? 0), 0), [imported.periods, metric, range.from, range.to, selectedStore]);
  const evotorFactTotal = useMemo(() => !evotorCounterpart ? null : (evotorReconciliationQuery.data?.timeline ?? [])
    .reduce((total, row) => total + Number(row[evotorCounterpart.key] ?? 0), 0), [evotorCounterpart, evotorReconciliationQuery.data?.timeline]);
  const reconciliationDifference = evotorFactTotal === null ? null : evotorFactTotal - excelFactTotal;
  const reconciliationPercent = reconciliationDifference === null || excelFactTotal === 0 ? null : reconciliationDifference / Math.abs(excelFactTotal) * 100;
  const sourceBasis = isEvotorMetric ? "Эвотор · импортированные закрытые чеки, МСК" : `Excel · «${selectedMetric.label}»`;

  if ((!isEvotorMetric && imported.loading) || (isEvotorMetric && evotorForecastQuery.isLoading)) return <AuditShell kicker="19 / ПРОГНОЗ" title="Прогноз по фактам"><section className="empty-state"><FactsLoader label={isEvotorMetric ? "Собираем сезонность импортированных чеков…" : "Собираем фактическую сезонность…"} /></section></AuditShell>;

  return <AuditShell kicker="19 / ПРОГНОЗ" title="Прогноз по фактам">
    <section className="page-lede"><div><span>{evotorOnlyMode ? "ОЖИДАЕМАЯ СЕЗОННОСТЬ · ЭВОТОР" : "ОЖИДАЕМАЯ СЕЗОННОСТЬ"}</span><h2>Факт текущего года × структура прошлого</h2><p>{isEvotorMetric ? `Прогноз использует только уже импортированные read-only чеки Эвотор: ${evotorCoverageNote} Это не реестр чеков и не замена Excel/P&L.` : "Прогноз не является планом. Будущие месяцы текущего года берут реальную сезонность прошлого года, когда она есть, и приводятся к последнему фактическому темпу. Если для конкретного будущего месяца исторической сезонности нет, показывается отдельный расчет по среднему трех последних фактических месяцев — без нулевых или вымышленных значений. Запас не прогнозируется: это остаток на дату, а не суммируемый поток."}</p></div></section>
    <section className="forecast-controls"><label>Показатель<ThemedSelect value={metric} onChange={event => setMetric(event.target.value)}>{!evotorOnlyMode && <>{primaryMetrics.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}{metricGroups.map(group => <optgroup key={group.label} label={group.label}>{group.metrics.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>)}</>}{mayReadEvotorForecast && <optgroup label="ФАКТЫ ЭВОТОР · READ-ONLY">{evotorForecastMetrics.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>}</ThemedSelect></label><div><span>Контур</span><strong>{scope}</strong><small>{selectedMetric.description}</small></div><div className="forecast-basis"><span>Основа прогноза</span><strong>{forecast.historyYear} → {year}</strong><small>{sourceBasis}. Сопоставляются только завершенные месяцы: сезонность прошлого года служит расчетным ориентиром, а не планом.</small></div></section>
    {evotorCounterpart && <section className="packet-card forecast-source-comparison"><div className="card-title"><div><span>СВЕРКА ОДНОИМЕННОГО ФАКТА</span><h3>Excel и Эвотор не смешиваются</h3></div><small>Срез: {range.from.split("-").reverse().join(".")} — {range.to.split("-").reverse().join(".")}</small></div>{evotorReconciliationQuery.isLoading ? <p className="packet-note"><Info size={14}/> Сверяем уже импортированные чеки Эвотор с одноименным фактом Excel…</p> : evotorFactTotal === null ? <p className="packet-note"><Info size={14}/> Факты Эвотор за этот срез недоступны для сверки. Финансовое значение Excel не заменяется.</p> : <><div className="forecast-source-grid"><article><span>EXCEL · {selectedMetric.label}</span><strong>{money(excelFactTotal)}</strong><small>исходная книга</small></article><article><span>ЭВОТОР · {evotorCounterpart.label}</span><strong>{money(evotorFactTotal)}</strong><small>read-only импорт чеков</small></article><article><span>РАЗНИЦА</span><strong className={numberClass(reconciliationDifference ?? 0)}>{money(reconciliationDifference)}</strong><small>{reconciliationPercent === null ? "процент не определен: база 0" : `${reconciliationPercent > 0 ? "+" : ""}${formatPct(reconciliationPercent)} к Excel`}</small></article></div><p className="packet-note"><Info size={14}/> Сверка использует одинаковые календарные дни и выбранный контур. Это сигнал для проверки, а не автоматическая корректировка Excel, P&L или чеков Эвотор.</p></>}</section>}
    {!hasBasis ? <section className="empty-state"><ChartNoAxesCombined size={30}/><h2>{isEvotorMetric ? "Недостаточно чеков для сезонного прогноза" : "Недостаточно фактического основания"}</h2><p>{isEvotorMetric ? "Для прогноза Эвотор нужны закрытые чеки хотя бы в завершенных месяцах. Нули и финансовые строки Excel не подставляются." : "Для прогноза нужны завершенные месяцы по выбранному показателю. Система не заменяет отсутствующие факты нулями или вымышленными значениями."}</p></section> : <>
      <section className="packet-kpis forecast-kpis"><article className="packet-kpi"><span>ФАКТ {year} · ЯНВ—{forecast.rows[forecast.latestActualMonth - 1]?.month.toUpperCase()}</span><strong className={numberClass(forecast.actualToDate)}>{valueText(forecast.actualToDate)}</strong><small>{isEvotorChecks ? "чеков по импортированным документам" : "в расчет взяты завершенные месяцы"}</small></article><article className="packet-kpi"><span>СЕЗОННЫЙ МАСШТАБ</span><strong className={scale === null ? "neutral" : numberClass(scale)}>{scale === null ? "Нет базы" : formatPct(scale)}</strong><small>{scale === null ? "используется текущий темп" : `к доступной сезонности ${forecast.historyYear} года`}</small></article><article className="packet-kpi"><span>ПРОГНОЗ · ОСТАТОК ГОДА</span><strong className={numberClass(forecast.forecastTotal)}>{valueText(forecast.forecastTotal)}</strong><small>{forecast.forecastRows.length} будущих месяцев на фактической основе</small></article><article className="packet-kpi"><span>ОЖИДАЕМЫЙ ИТОГ {year}</span><strong className={numberClass(forecast.yearEndExpected)}>{valueText(forecast.yearEndExpected)}</strong><small>факт + прогноз по данным</small></article></section>
      <section className="two-col"><article className="packet-card"><div className="card-title forecast-chart-title"><div><span><ChartNoAxesCombined size={15}/> ФАКТ И ПРОГНОЗ</span><h3>{selectedMetric.label}: {forecast.historyYear} и {year}</h3></div><small>Прогноз показан только после последнего фактического месяца.</small></div><MetricLineChart data={forecast.rows.map(row => ({ month: row.month, historical: chartValue(row.historical), actual: chartValue(row.actual), forecast: chartValue(row.forecast) }))} lines={[{ key: "historical", name: `Факт ${forecast.historyYear}`, color: "#b694ff" }, { key: "actual", name: `Факт ${year}`, color: "#6fe0c8" }, { key: "forecast", name: `Прогноз ${year}`, color: "#ff8b6f" }]} unit="k" displayMode={isEvotorChecks ? "number" : undefined} chartTitle={`Прогноз: ${selectedMetric.label}`} /></article><article className="packet-card forecast-signal"><div className="card-title"><div><span><CalendarClock size={15}/> КАЛЕНДАРЬ ОЖИДАНИЙ</span><h3>Когда уровень выше и ниже</h3></div></div><div className="forecast-signal-grid"><article><TrendingUp size={18}/><span>Наиболее высокий ожидаемый месяц</span><strong>{forecast.peak?.month ?? "—"}</strong><b className={numberClass(Number(forecast.peak?.forecast ?? 0))}>{valueText(forecast.peak?.forecast ?? null)}</b></article><article><TrendingDown size={18}/><span>Наиболее низкий ожидаемый месяц</span><strong>{forecast.trough?.month ?? "—"}</strong><b className={numberClass(Number(forecast.trough?.forecast ?? 0))}>{valueText(forecast.trough?.forecast ?? null)}</b></article></div><p className="packet-note"><Info size={14}/> Это механический ориентир по сезонному рисунку, а не гарантия спроса. Сверяйте его с планом, закупками и фактическими событиями.</p></article></section>
      <section className="packet-card"><div className="card-title"><div><span><BarChart3 size={15}/> ТАБЛИЦА РАСЧЕТА</span><h3>Фактическая база и ожидаемые месяцы</h3></div><small>«—» означает, что значение не подставляется.</small></div><div className="data-table-wrap"><table className="data-table forecast-table"><thead><tr><th>Месяц</th><th>Факт {forecast.historyYear}</th><th>Факт {year}</th><th>Прогноз {year}</th></tr></thead><tbody>{forecast.rows.map(row => <tr key={row.monthNumber} className={row.forecast !== null ? "forecast-row" : ""}><td><strong>{row.month}</strong>{row.forecast !== null && <small>{row.forecastBasis === "seasonality" ? "сезонность" : "текущий темп"}</small>}</td><td>{valueText(row.historical)}</td><td className={row.actual === null ? "muted" : numberClass(Number(row.actual))}>{valueText(row.actual)}</td><td className={row.forecast === null ? "muted" : numberClass(Number(row.forecast))}>{valueText(row.forecast)}</td></tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th><td>{valueText(historicalTotal)}</td><td>{valueText(forecast.actualToDate)}</td><td>{valueText(forecast.forecastTotal)}</td></tr></tfoot></table></div></section>
    </>}
  </AuditShell>;
}
