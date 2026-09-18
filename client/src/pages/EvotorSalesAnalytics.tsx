import { BarChart3, Boxes, ReceiptText, ShoppingBasket } from "lucide-react";
import { useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, StoreSeriesModeToggle } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import "@/evotor-sales-analytics.css";

type Granularity = "month" | "week" | "day" | "hour";
type PageKind = "metrics" | "products";
type SalesMetric = "amount" | "checks" | "average";
type ProductMetric = "amount" | "quantity" | "positions";

type TimelineRow = {
  key: string;
  label: string;
  storeId: number;
  storeName: string;
  checks: number;
  amount: number;
  positions: number;
  positionAmount: number;
  quantity: number;
};
type ProductRow = {
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
  positions: number;
  stores: number;
};
type AnalyticsData = {
  stores: Array<{ id: number; name: string }>;
  timeline: TimelineRow[];
  products: ProductRow[];
  summary: { checks: number; amount: number; positions: number; positionAmount: number; quantity: number };
};

const granularityLabels: Record<Granularity, string> = { month: "Месяцы", week: "Недели", day: "Дни", hour: "По времени" };
const moneyText = (value: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
const numberText = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
const compactDate = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);

function salesValue(row: TimelineRow, metric: SalesMetric) {
  if (metric === "checks") return row.checks;
  if (metric === "average") return row.checks ? row.amount / row.checks : 0;
  return row.amount;
}

function productValue(row: TimelineRow, metric: ProductMetric) {
  if (metric === "quantity") return row.quantity;
  if (metric === "positions") return row.positions;
  return row.positionAmount;
}

function groupedTimeline(rows: TimelineRow[], metric: SalesMetric | ProductMetric, kind: PageKind) {
  const result = new Map<string, { key: string; label: string; amount: number; checks: number; positions: number; positionAmount: number; quantity: number }>();
  rows.forEach(row => {
    const current = result.get(row.key) ?? { key: row.key, label: row.label, amount: 0, checks: 0, positions: 0, positionAmount: 0, quantity: 0 };
    current.amount += row.amount;
    current.checks += row.checks;
    current.positions += row.positions;
    current.positionAmount += row.positionAmount;
    current.quantity += row.quantity;
    result.set(row.key, current);
  });
  return Array.from(result.values()).sort((left, right) => left.key.localeCompare(right.key)).map(row => ({
    month: compactDate(row.label),
    value: kind === "metrics"
      ? (metric === "checks" ? row.checks : metric === "average" ? (row.checks ? row.amount / row.checks : 0) : row.amount) / (metric === "checks" ? 1 : 1_000)
      : (metric === "quantity" ? row.quantity : metric === "positions" ? row.positions : row.positionAmount / 1_000),
    raw: row,
  }));
}

function seriesTimeline(rows: TimelineRow[], metric: SalesMetric | ProductMetric, kind: PageKind, stores: Array<{ id: number; name: string }>) {
  const result = new Map<string, Record<string, string | number>>();
  rows.forEach(row => {
    const current = result.get(row.key) ?? { month: compactDate(row.label), sort: row.key };
    const rawValue = kind === "metrics" ? salesValue(row, metric as SalesMetric) : productValue(row, metric as ProductMetric);
    current[row.storeName] = kind === "metrics" && metric !== "checks" ? rawValue / 1_000 : kind === "products" && metric === "amount" ? rawValue / 1_000 : rawValue;
    result.set(row.key, current);
  });
  return Array.from(result.values()).sort((left, right) => String(left.sort).localeCompare(String(right.sort))).map(({ sort: _sort, ...row }) => ({ ...Object.fromEntries(stores.map(store => [store.name, row[store.name] ?? 0])), ...row }));
}

export default function EvotorSalesAnalytics({ kind }: { kind: PageKind }) {
  const { range, rangeLabel, theme } = useAudit();
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [showStoreSeries, setShowStoreSeries] = useState(false);
  const [salesMetric, setSalesMetric] = useState<SalesMetric>("amount");
  const [productMetric, setProductMetric] = useState<ProductMetric>("amount");
  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const allStoresSelected = selectedStores.length === 0;
  const queryInput = useMemo(() => ({
    from: range.from,
    to: range.to,
    granularity,
    storeIds: allStoresSelected ? undefined : selectedStores,
  }), [allStoresSelected, granularity, range.from, range.to, selectedStores]);
  const query = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(queryInput, { retry: false });
  const data = query.data as AnalyticsData | undefined;
  const activeMetric = kind === "metrics" ? salesMetric : productMetric;
  const chartData = useMemo(() => groupedTimeline(data?.timeline ?? [], activeMetric, kind), [activeMetric, data?.timeline, kind]);
  const allowStoreSeries = (data?.stores.length ?? 0) > 1;
  const perStoreData = useMemo(() => showStoreSeries && allowStoreSeries
    ? seriesTimeline(data?.timeline ?? [], activeMetric, kind, data?.stores ?? [])
    : null, [activeMetric, allowStoreSeries, data?.stores, data?.timeline, kind, showStoreSeries]);
  const chartLines = perStoreData
    ? (data?.stores ?? []).map((store, index) => ({ key: store.name, name: store.name, color: theme === "dark" ? ["#ff765f", "#d88aa3", "#ffb56b", "#9f86d4"][index % 4] : ["#0a84ff", "#5e5ce6", "#00a3a3", "#34c759"][index % 4] }))
    : [{ key: "value", name: kind === "metrics" ? ({ amount: "Сумма чеков", checks: "Чеки", average: "Средний чек" } as Record<SalesMetric, string>)[salesMetric] : ({ amount: "Сумма товаров", quantity: "Количество", positions: "Строки чеков" } as Record<ProductMetric, string>)[productMetric], color: theme === "dark" ? "#ff765f" : "#0a84ff" }];
  const scope = allStoresSelected ? "Все магазины" : data?.stores.length === 1 ? data.stores[0].name : `${data?.stores.length ?? selectedStores.length} магазина`;
  const uniqueStoreCount = new Set((data?.timeline ?? []).map(row => row.storeId)).size;
  const productRows = data?.products ?? [];
  const noData = !query.isLoading && !query.isError && data && data.summary.checks === 0;
  const toggleStore = (id: number) => setSelectedStores(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const chartDetail = kind === "metrics"
    ? ({ amount: "Сумма чеков", checks: "Количество чеков", average: "Средний чек" } as Record<SalesMetric, string>)[salesMetric]
    : ({ amount: "Сумма проданных товаров", quantity: "Количество проданных товаров", positions: "Товарные строки чеков" } as Record<ProductMetric, string>)[productMetric];
  const title = kind === "metrics" ? "Показатели Эвотор" : "Проданные товары";
  const kicker = kind === "metrics" ? "28 / ПОКАЗАТЕЛИ ЭВОТОР" : "29 / ПРОДАННЫЕ ТОВАРЫ";

  return <AuditShell kicker={kicker} title={title}>
    <section className="page-lede evotor-sales-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>{kind === "metrics" ? "Чеки Эвотор: динамика показателей" : "Товары из чеков Эвотор"}</h2><p>{kind === "metrics" ? "Суммы, число чеков и средний чек строятся по уже нормализованным read-only документам Эвотор. Этот экран не является финансовым P&L и не меняет финансовые факты." : "Количество и сумма позиции строятся по сохраненным товарным строкам чеков Эвотор. Номенклатура, себестоимость и цены в этом экране не изменяются."}</p></div></section>

    <details className="cadence-store-picker evotor-sales-store-picker"><summary><span>Магазины для среза</span><b>{scope}</b><small>выбрать</small></summary><div><p>Выберите один или несколько магазинов либо оставьте общий срез всей сети. При включении «Каждый магазин» на графике и в таблице появится отдельный ряд для каждой выбранной точки.</p><button type="button" aria-pressed={allStoresSelected} onClick={() => setSelectedStores([])} className={allStoresSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Все магазины</button>{visibleStores.map(store => <button type="button" key={store.id} aria-pressed={selectedStores.includes(store.id)} onClick={() => toggleStore(store.id)} className={selectedStores.includes(store.id) ? "cadence-metric-chip active" : "cadence-metric-chip"}>{store.name}</button>)}</div></details>

    {query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Показатели чеков недоступны</h2><p>{query.error.message}</p></section> : noData ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>В выбранном срезе нет нормализованных чеков</h2><p>Здесь появятся результаты после автоматической read-only загрузки чеков Эвотор. Ручной импорт и запись в Эвотор на этом экране недоступны.</p></section> : data && <>
      {kind === "metrics" ? <section className="packet-kpis equal evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Сумма чеков · {scope}</span><strong>{moneyText(data.summary.amount)}</strong><small>{rangeLabel} · по документам Эвотор</small></article><article className="packet-kpi"><span>Чеки</span><strong>{numberText(data.summary.checks)}</strong><small>сумма берется как отдал Эвотор</small></article><article className="packet-kpi"><span>Средний чек</span><strong>{moneyText(data.summary.checks ? data.summary.amount / data.summary.checks : 0)}</strong><small>сумма чеков / число чеков</small></article><article className="packet-kpi"><span>Магазины с чеками</span><strong>{numberText(uniqueStoreCount)}</strong><small>из {data.stores.length} в выбранном срезе</small></article></section> : <section className="packet-kpis equal evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Сумма товарных строк · {scope}</span><strong>{moneyText(data.summary.positionAmount)}</strong><small>{rangeLabel} · по строкам чеков</small></article><article className="packet-kpi"><span>Продано</span><strong>{numberText(data.summary.quantity)}</strong><small>сумма количества в строках</small></article><article className="packet-kpi"><span>Товарных строк</span><strong>{numberText(data.summary.positions)}</strong><small>в загруженных чеках</small></article><article className="packet-kpi"><span>Уникальных товаров</span><strong>{numberText(productRows.length)}</strong><small>по названию и единице Эвотор</small></article></section>}

      <section className="packet-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ЧЕКОВ · {scope}</span><h3>{granularityLabels[granularity]} · {perStoreData ? `${chartDetail}: каждый магазин отдельно` : chartDetail}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация показателей Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div>{allowStoreSeries && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => setShowStoreSeries(current => !current)} />}</div></div><div className="cadence-metrics-picker evotor-metrics-picker"><div className="cadence-picker-heading"><span>Показатель графика</span><small>один показатель за раз</small></div><div>{kind === "metrics" ? (["amount", "checks", "average"] as SalesMetric[]).map(metric => <button key={metric} type="button" aria-pressed={salesMetric === metric} onClick={() => { setSalesMetric(metric); setShowStoreSeries(false); }} className={salesMetric === metric ? "cadence-metric-chip active" : "cadence-metric-chip"}>{({ amount: "Сумма чеков", checks: "Чеки", average: "Средний чек" } as Record<SalesMetric, string>)[metric]}</button>) : (["amount", "quantity", "positions"] as ProductMetric[]).map(metric => <button key={metric} type="button" aria-pressed={productMetric === metric} onClick={() => { setProductMetric(metric); setShowStoreSeries(false); }} className={productMetric === metric ? "cadence-metric-chip active" : "cadence-metric-chip"}>{({ amount: "Сумма товаров", quantity: "Количество", positions: "Строки чеков" } as Record<ProductMetric, string>)[metric]}</button>)}</div></div><MetricLineChart data={perStoreData ?? chartData} lines={chartLines} displayMode={activeMetric === "amount" || activeMetric === "average" ? "amount" : "number"} chartTitle={`${title}: ${chartDetail}`}/><p className="packet-note"><BarChart3 size={15}/> {perStoreData ? "Каждый выбранный магазин показан отдельным рядом. Отключите «Каждый магазин», чтобы увидеть их общий результат." : "В общем срезе значения магазинов суммируются до построения графика. Таблица непосредственно ниже повторяет его интервалы."}</p></section>

      {kind === "metrics" ? <section className="packet-card evotor-sales-table-card"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${chartDetail}: каждый магазин отдельно` : "Все интервалы выбранного показателя"}</h3></div><small>{granularityLabels[granularity].toLocaleLowerCase("ru-RU")} · {activeMetric === "checks" ? "шт." : "₽"}</small></div><div className="data-table-wrap evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : granularity === "day" ? "Дата" : "Время"}</th>{perStoreData ? chartLines.map(line => <th key={line.key} className="numeric-column">{line.name}</th>) : <><th className="numeric-column">Сумма чеков</th><th className="numeric-column">Чеки</th><th className="numeric-column">Средний чек</th></>}</tr></thead><tbody>{perStoreData ? perStoreData.map((row, index) => <tr key={`${String(row.month)}-${index}`}><td data-label="Интервал">{String(row.month)}</td>{chartLines.map(line => <td key={line.key} data-label={line.name} className="numeric-column">{activeMetric === "checks" ? numberText(Number(row[line.key] ?? 0)) : moneyText(Number(row[line.key] ?? 0) * 1_000)}</td>)}</tr>) : chartData.map(row => <tr key={row.raw.key}><td data-label="Интервал">{row.month}</td><td data-label="Сумма чеков" className="numeric-column">{moneyText(row.raw.amount)}</td><td data-label="Чеки" className="numeric-column">{numberText(row.raw.checks)}</td><td data-label="Средний чек" className="numeric-column">{moneyText(row.raw.checks ? row.raw.amount / row.raw.checks : 0)}</td></tr>)}</tbody></table></div><p className="packet-note">Сумма и количество берутся из сохраненных нормализованных документов Эвотор. Это read-only витрина; она не пересчитывает финансовый P&L.</p></section> : <section className="packet-card evotor-sales-table-card"><div className="card-title"><div><span>ТОВАРЫ ПОД ГРАФИКОМ · {scope}</span><h3>Проданные товары за выбранный период</h3></div><small>сортировка по сумме строк</small></div><div className="data-table-wrap evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>Товар</th><th className="numeric-column">Продано</th><th>Ед.</th><th className="numeric-column">Сумма строк</th><th className="numeric-column">Строки чеков</th><th className="numeric-column">Магазины</th></tr></thead><tbody>{productRows.map(row => <tr key={`${row.productName}:${row.unit ?? ""}`}><td data-label="Товар"><strong>{row.productName}</strong></td><td data-label="Продано" className="numeric-column">{numberText(row.quantity)}</td><td data-label="Ед.">{row.unit ?? "—"}</td><td data-label="Сумма строк" className="numeric-column">{moneyText(row.amount)}</td><td data-label="Строки чеков" className="numeric-column">{numberText(row.positions)}</td><td data-label="Магазины" className="numeric-column">{numberText(row.stores)}</td></tr>)}</tbody></table></div><p className="packet-note"><ShoppingBasket size={15}/> Названия, единицы, количество и сумма показаны такими, какими они сохранены в нормализованных строках чеков Эвотор. Себестоимость и внутренние цены не отображаются.</p></section>}
    </>}
  </AuditShell>;
}

export const __evotorSalesAnalyticsTestUtils = { groupedTimeline, seriesTimeline, salesValue, productValue };
