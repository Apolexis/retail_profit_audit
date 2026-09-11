import { useMemo, useState } from "react";
import { BarChart3, CalendarClock, ChartNoAxesCombined, Info, TrendingDown, TrendingUp } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useImportedAudit } from "@/hooks/useImportedAudit";
import { expenseDefinitions } from "@/hooks/useAuditFacts";
import { buildSeasonalForecast } from "@/lib/forecastLogic";
import "@/forecast.css";

type ForecastMetric = { code: string; label: string; description: string };
const metricGroups: Array<{ label: string; metrics: ForecastMetric[] }> = [
  { label: "ФИНАНСОВЫЙ РЕЗУЛЬТАТ И ТОВАР", metrics: [
    { code: "revenue", label: "Выручка", description: "поступление от продаж" },
    { code: "gross_profit", label: "Валовая прибыль", description: "результат до операционных расходов" },
    { code: "net_profit", label: "Чистая прибыль", description: "итог после расходов" },
    { code: "purchases", label: "Закупки", description: "совокупный товарный поток" },
    { code: "sales_smoked", label: "Продажи Коп.", description: "продажи копченой продукции" },
    { code: "sales_frozen", label: "Продажи Мор.", description: "продажи мороженой продукции" },
    { code: "purchase_smoked", label: "Закупки Коп.", description: "закупка копченой продукции" },
    { code: "purchase_frozen", label: "Закупки Мор.", description: "закупка мороженой продукции" },
    { code: "writeoff_smoked", label: "Списания К.", description: "потери копченой продукции" },
    { code: "writeoff_frozen", label: "Списания М.", description: "потери мороженой продукции" },
  ] },
  { label: "КОРРЕКТИРОВКИ ОБОРОТА", metrics: [
    { code: "movement", label: "Перемещения", description: "перемещение товарного остатка" },
    { code: "discount", label: "Уценка", description: "сумма скидок и уценки" },
    { code: "revaluation", label: "Переоценка", description: "результат переоценки" },
  ] },
  { label: "РАСХОДНЫЕ СТАТЬИ", metrics: expenseDefinitions.map(([code, label]) => ({ code, label, description: "фактическая расходная статья" })) },
];
const metrics = metricGroups.flatMap(group => group.metrics);

const money = (value: number | null) => value === null ? "—" : formatK(value / 1000);
const numberClass = (value: number) => value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

export default function Forecast() {
  const { range, selectedStore } = useAudit();
  const year = Number(range.to.slice(0, 4));
  const [metric, setMetric] = useState("revenue");
  const previousYear = useMemo(() => ({ from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }), [year]);
  const imported = useImportedAudit(previousYear);
  const selectedMetric = metrics.find(item => item.code === metric) ?? metrics[0];
  const forecast = useMemo(() => buildSeasonalForecast({ facts: imported.periods, year, store: selectedStore, metric }), [imported.periods, metric, selectedStore, year]);
  const scope = selectedStore === "__all__" ? "Вся сеть" : selectedStore;
  const hasBasis = forecast.latestActualMonth > 0 && forecast.forecastRows.length > 0;
  const scale = forecast.scaleFactor === null ? null : (forecast.scaleFactor - 1) * 100;

  if (imported.loading) return <AuditShell kicker="19 / ПРОГНОЗ" title="Прогноз по фактам"><section className="empty-state"><FactsLoader label="Собираем фактическую сезонность…" /></section></AuditShell>;

  return <AuditShell kicker="19 / ПРОГНОЗ" title="Прогноз по фактам">
    <section className="page-lede"><div><span>ОЖИДАЕМАЯ СЕЗОННОСТЬ</span><h2>Факт текущего года × структура прошлого</h2><p>Прогноз не является планом. Будущие месяцы {year} года берут реальную сезонность {forecast.historyYear} года, когда она есть, и приводятся к последнему фактическому темпу {year} года. Если для конкретного будущего месяца исторической сезонности нет, показывается отдельный расчет по среднему трех последних фактических месяцев — без нулевых или вымышленных значений. Запас не прогнозируется: это остаток на дату, а не суммируемый поток.</p></div></section>
    <section className="forecast-controls"><label>Показатель<select value={metric} onChange={event => setMetric(event.target.value)}>{metricGroups.map(group => <optgroup key={group.label} label={group.label}>{group.metrics.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>)}</select></label><div><span>Контур</span><strong>{scope}</strong><small>{selectedMetric.description}</small></div><div><span>Основа</span><strong>{forecast.historyYear} → {year}</strong><small>одинаковые завершенные месяцы</small></div></section>
    {!hasBasis ? <section className="empty-state"><ChartNoAxesCombined size={30}/><h2>Недостаточно фактического основания</h2><p>Для прогноза нужны завершенные месяцы по выбранному показателю. Система не заменяет отсутствующие факты нулями или вымышленными значениями.</p></section> : <>
      <section className="packet-kpis forecast-kpis"><article className="packet-kpi"><span>ФАКТ {year} · ЯНВ—{forecast.rows[forecast.latestActualMonth - 1]?.month.toUpperCase()}</span><strong className={numberClass(forecast.actualToDate)}>{money(forecast.actualToDate)}</strong><small>в расчет взяты завершенные месяцы</small></article><article className="packet-kpi"><span>СЕЗОННЫЙ МАСШТАБ</span><strong className={scale === null ? "neutral" : numberClass(scale)}>{scale === null ? "Нет базы" : formatPct(scale)}</strong><small>{scale === null ? "используется текущий темп" : `к доступной сезонности ${forecast.historyYear} года`}</small></article><article className="packet-kpi"><span>ПРОГНОЗ · ОСТАТОК ГОДА</span><strong className={numberClass(forecast.forecastTotal)}>{money(forecast.forecastTotal)}</strong><small>{forecast.forecastRows.length} будущих месяцев на фактической основе</small></article><article className="packet-kpi"><span>ОЖИДАЕМЫЙ ИТОГ {year}</span><strong className={numberClass(forecast.yearEndExpected)}>{money(forecast.yearEndExpected)}</strong><small>факт + прогноз по данным</small></article></section>
      <section className="two-col"><article className="packet-card"><div className="card-title forecast-chart-title"><div><span><ChartNoAxesCombined size={15}/> ФАКТ И ПРОГНОЗ</span><h3>{selectedMetric.label}: {forecast.historyYear} и {year}</h3></div><small>Прогноз показан только после последнего фактического месяца.</small></div><MetricLineChart data={forecast.rows.map(row => ({ month: row.month, historical: row.historical === null ? null : row.historical / 1000, actual: row.actual === null ? null : row.actual / 1000, forecast: row.forecast === null ? null : row.forecast / 1000 }))} lines={[{ key: "historical", name: `Факт ${forecast.historyYear}`, color: "#b694ff" }, { key: "actual", name: `Факт ${year}`, color: "#6fe0c8" }, { key: "forecast", name: `Прогноз ${year}`, color: "#ff8b6f" }]} unit="k" /></article><article className="packet-card forecast-signal"><div className="card-title"><div><span><CalendarClock size={15}/> КАЛЕНДАРЬ ОЖИДАНИЙ</span><h3>Когда уровень выше и ниже</h3></div></div><div className="forecast-signal-grid"><article><TrendingUp size={18}/><span>Наиболее высокий ожидаемый месяц</span><strong>{forecast.peak?.month ?? "—"}</strong><b className={numberClass(Number(forecast.peak?.forecast ?? 0))}>{money(forecast.peak?.forecast ?? null)}</b></article><article><TrendingDown size={18}/><span>Наиболее низкий ожидаемый месяц</span><strong>{forecast.trough?.month ?? "—"}</strong><b className={numberClass(Number(forecast.trough?.forecast ?? 0))}>{money(forecast.trough?.forecast ?? null)}</b></article></div><p className="packet-note"><Info size={14}/> Это механический ориентир по сезонному рисунку, а не гарантия спроса. Сверяйте его с планом, закупками и фактическими событиями.</p></article></section>
      <section className="packet-card"><div className="card-title"><div><span><BarChart3 size={15}/> ТАБЛИЦА РАСЧЕТА</span><h3>Фактическая база и ожидаемые месяцы</h3></div><small>«—» означает, что значение не подставляется.</small></div><div className="data-table-wrap"><table className="data-table forecast-table"><thead><tr><th>Месяц</th><th>Факт {forecast.historyYear}</th><th>Факт {year}</th><th>Прогноз {year}</th></tr></thead><tbody>{forecast.rows.map(row => <tr key={row.monthNumber} className={row.forecast !== null ? "forecast-row" : ""}><td><strong>{row.month}</strong>{row.forecast !== null && <small>{row.forecastBasis === "seasonality" ? "сезонность" : "текущий темп"}</small>}</td><td>{money(row.historical)}</td><td className={row.actual === null ? "muted" : numberClass(Number(row.actual))}>{money(row.actual)}</td><td className={row.forecast === null ? "muted" : numberClass(Number(row.forecast))}>{money(row.forecast)}</td></tr>)}</tbody></table></div></section>
    </>}
  </AuditShell>;
}
