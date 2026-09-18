import { BarChart3, ReceiptText, Search, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, StoreSeriesModeToggle } from "@/components/AuditCharts";
import { DateRangeControl } from "@/components/DateRangeControl";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import "@/evotor-sales-analytics.css";

type Granularity = "month" | "week" | "day" | "hour";
type PageKind = "metrics" | "products";
type SalesMetric = "amount" | "checks" | "average";
type ProductMetric = "quantity" | "positions" | "amount";
type ChartDatum = Record<string, string | number> & { month: string; sort: string };

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
  key: string;
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
  positions: number;
  stores: number;
};
type ProductTimelineRow = {
  key: string;
  label: string;
  productKey: string;
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
  positions: number;
};
type AnalyticsData = {
  stores: Array<{ id: number; name: string }>;
  timeline: TimelineRow[];
  products: ProductRow[];
  productTimeline: ProductTimelineRow[];
  summary: { checks: number; amount: number; positions: number; positionAmount: number; quantity: number };
  coverage: { from: string | null; to: string | null };
};

const EVOTOR_ANALYTICS_START = "2025-01-01";
const granularityLabels: Record<Granularity, string> = { month: "Месяцы", week: "Недели", day: "Дни", hour: "По времени" };
const salesMetrics: Record<SalesMetric, { label: string; color: string; note: string }> = {
  amount: { label: "Сумма чеков", color: "#0A84FF", note: "Сумма закрытых чеков продажи, сохраненных из Эвотор." },
  checks: { label: "Чеки", color: "#34C759", note: "Количество закрытых чеков продажи, без отчетов и возвратов." },
  average: { label: "Средний чек", color: "#5E5CE6", note: "Сумма закрытых чеков продажи, деленная на их количество." },
};
const productMetrics: Record<ProductMetric, { label: string; color: string; note: string }> = {
  quantity: { label: "Продано", color: "#0A84FF", note: "Количество выбранных товарных позиций из строк чеков продажи." },
  positions: { label: "Строки чеков", color: "#34C759", note: "Количество строк выбранных товарных позиций в чеках продажи." },
  amount: { label: "Сумма продаж", color: "#5E5CE6", note: "Сумма строк выбранных товарных позиций, как ее передал Эвотор." },
};

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
const rangeText = (value: DateRangeValue) => `${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value.from}T12:00:00Z`))} — ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value.to}T12:00:00Z`))}`;
const trimNumber = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits).replace(/\.?0+$/, "") : "—";
const numberText = (value: number, digits = 3) => trimNumber(value, digits).replace(/(?<!^)(?=(\d{3})+(?:\.|$))/g, " ");
const moneyText = (value: number) => `${numberText(value, 2)} ₽`;
const unitLabel = (value: string | null) => value === "fraction" ? "кг" : value === "piece" ? "шт." : value === "l" ? "л" : value || "—";
const compactDate = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);

function retainedRange(value: DateRangeValue): DateRangeValue {
  const from = value.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.from;
  const to = value.to < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.to;
  return to < from ? { from: EVOTOR_ANALYTICS_START, to: EVOTOR_ANALYTICS_START } : { from, to };
}

function salesRawValue(row: TimelineRow, metric: SalesMetric) {
  if (metric === "checks") return row.checks;
  if (metric === "average") return row.checks ? row.amount / row.checks : 0;
  return row.amount;
}

function productRawValue(row: ProductTimelineRow, metric: ProductMetric) {
  if (metric === "quantity") return row.quantity;
  if (metric === "positions") return row.positions;
  return row.amount;
}

function scaledValue(value: number, metric: SalesMetric | ProductMetric) {
  return metric === "amount" || metric === "average" ? value / 1_000 : value;
}

function groupedSalesTimeline(rows: TimelineRow[], selectedMetrics: SalesMetric[]): ChartDatum[] {
  const intervals = new Map<string, TimelineRow>();
  rows.forEach(row => {
    const current = intervals.get(row.key) ?? { ...row, checks: 0, amount: 0, positions: 0, positionAmount: 0, quantity: 0 };
    current.checks += row.checks;
    current.amount += row.amount;
    intervals.set(row.key, current);
  });
  return Array.from(intervals.values()).sort((left, right) => left.key.localeCompare(right.key)).map(row => ({
    month: compactDate(row.label),
    sort: row.key,
    ...Object.fromEntries(selectedMetrics.map(metric => [metric, scaledValue(salesRawValue(row, metric), metric)])),
  }));
}

function perStoreSalesTimeline(rows: TimelineRow[], metric: SalesMetric, stores: Array<{ id: number; name: string }>): ChartDatum[] {
  const intervals = new Map<string, ChartDatum>();
  rows.forEach(row => {
    const current = intervals.get(row.key) ?? { month: compactDate(row.label), sort: row.key };
    current[row.storeName] = scaledValue(salesRawValue(row, metric), metric);
    intervals.set(row.key, current);
  });
  return Array.from(intervals.values()).sort((left, right) => left.sort.localeCompare(right.sort)).map(row => ({
    ...Object.fromEntries(stores.map(store => [store.name, row[store.name] ?? 0])),
    ...row,
  }));
}

function selectedProductTimeline(rows: ProductTimelineRow[], products: ProductRow[], metric: ProductMetric): ChartDatum[] {
  const selectedKeys = new Set(products.map(product => product.key));
  const intervals = new Map<string, ChartDatum>();
  rows.filter(row => selectedKeys.has(row.productKey)).forEach(row => {
    const current = intervals.get(row.key) ?? { month: compactDate(row.label), sort: row.key };
    current[row.productKey] = scaledValue(productRawValue(row, metric), metric);
    intervals.set(row.key, current);
  });
  return Array.from(intervals.values()).sort((left, right) => left.sort.localeCompare(right.sort)).map(row => ({
    ...Object.fromEntries(products.map(product => [product.key, row[product.key] ?? 0])),
    ...row,
  }));
}

export default function EvotorSalesAnalytics({ kind }: { kind: PageKind }) {
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [showStoreSeries, setShowStoreSeries] = useState(false);
  const [selectedSalesMetrics, setSelectedSalesMetrics] = useState<SalesMetric[]>(["amount"]);
  const [productMetric, setProductMetric] = useState<ProductMetric>("quantity");
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [visibleProductCount, setVisibleProductCount] = useState(48);
  const [salesRange, setSalesRange] = useState<DateRangeValue>(() => ({ from: EVOTOR_ANALYTICS_START, to: todayIso() }));

  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const allStoresSelected = selectedStores.length === 0;
  const queryInput = useMemo(() => ({
    from: salesRange.from,
    to: salesRange.to,
    granularity,
    storeIds: allStoresSelected ? undefined : selectedStores,
  }), [allStoresSelected, granularity, salesRange.from, salesRange.to, selectedStores]);
  const query = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(queryInput, { retry: false });
  const data = query.data as AnalyticsData | undefined;
  const productRows = data?.products ?? [];
  const productKeySet = useMemo(() => new Set(productRows.map(product => product.key)), [productRows]);

  useEffect(() => {
    if (kind !== "products" || !productRows.length) return;
    setSelectedProductKeys(current => {
      const retained = current.filter(key => productKeySet.has(key));
      return retained.length ? retained : [productRows[0].key];
    });
  }, [kind, productKeySet, productRows]);

  const selectedProducts = useMemo(() => productRows.filter(product => selectedProductKeys.includes(product.key)), [productRows, selectedProductKeys]);
  const effectiveProducts = selectedProducts.length ? selectedProducts : productRows.slice(0, 1);
  const salesChartData = useMemo(() => groupedSalesTimeline(data?.timeline ?? [], selectedSalesMetrics), [data?.timeline, selectedSalesMetrics]);
  const allowStoreSeries = selectedSalesMetrics.length === 1 && (data?.stores.length ?? 0) > 1;
  const perStoreData = useMemo(() => showStoreSeries && allowStoreSeries
    ? perStoreSalesTimeline(data?.timeline ?? [], selectedSalesMetrics[0], data?.stores ?? [])
    : null, [allowStoreSeries, data?.stores, data?.timeline, selectedSalesMetrics, showStoreSeries]);
  const productChartData = useMemo(() => selectedProductTimeline(data?.productTimeline ?? [], effectiveProducts, productMetric), [data?.productTimeline, effectiveProducts, productMetric]);
  const metricChartData = perStoreData ?? salesChartData;
  const metricChartLines = perStoreData
    ? (data?.stores ?? []).map((store, index) => ({ key: store.name, name: store.name, color: ["#0A84FF", "#34C759", "#5E5CE6", "#FF453A"][index % 4] }))
    : selectedSalesMetrics.map(metric => ({ key: metric, name: salesMetrics[metric].label, color: salesMetrics[metric].color }));
  const productChartLines = effectiveProducts.map((product, index) => ({ key: product.key, name: `${product.productName} · ${unitLabel(product.unit)}`, color: ["#0A84FF", "#34C759", "#5E5CE6", "#FF453A", "#64D2FF", "#FF9F0A"][index % 6] }));
  const scope = allStoresSelected ? "Все магазины" : data?.stores.length === 1 ? data.stores[0].name : `${data?.stores.length ?? selectedStores.length} магазина`;
  const importedStoreCount = new Set((data?.timeline ?? []).map(row => row.storeId)).size;
  const noData = !query.isLoading && !query.isError && data && data.summary.checks === 0;
  const coverageText = data?.coverage.from && data.coverage.to ? rangeText({ from: data.coverage.from, to: data.coverage.to }) : null;
  const normalizedProductSearch = productSearch.trim().toLocaleLowerCase("ru-RU");
  const productChoices = useMemo(() => productRows.filter(product => `${product.productName} ${unitLabel(product.unit)}`.toLocaleLowerCase("ru-RU").includes(normalizedProductSearch)), [normalizedProductSearch, productRows]);
  const visibleProductChoices = productChoices.slice(0, visibleProductCount);
  const productDisplayMode = productMetric === "amount" ? "amount" as const : "number" as const;
  const metricDisplayMode = selectedSalesMetrics.some(metric => metric === "amount" || metric === "average") ? "amount" as const : "number" as const;

  const toggleStore = (id: number) => setSelectedStores(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleSalesMetric = (metric: SalesMetric) => setSelectedSalesMetrics(current => current.includes(metric) ? current.length === 1 ? current : current.filter(value => value !== metric) : [...current, metric]);
  const toggleProduct = (key: string) => setSelectedProductKeys(current => current.includes(key) ? current.length === 1 ? current : current.filter(value => value !== key) : [...current, key]);
  const formatMetricValue = (value: number, metric: SalesMetric) => metric === "checks" ? numberText(value) : moneyText(value * 1_000);
  const metricTotal = (metric: SalesMetric) => metric === "amount" ? data?.summary.amount ?? 0 : metric === "checks" ? data?.summary.checks ?? 0 : data?.summary.checks ? data.summary.amount / data.summary.checks : 0;
  const formatProductValue = (value: number) => productMetric === "amount" ? moneyText(value * 1_000) : numberText(value);
  const title = kind === "metrics" ? "Показатели Эвотор" : "Проданные товары";
  const kicker = kind === "metrics" ? "28 / ПОКАЗАТЕЛИ ЭВОТОР" : "29 / ПРОДАННЫЕ ТОВАРЫ";

  return <AuditShell kicker={kicker} title={title}>
    <section className="analysis-filter evotor-sales-period">
      <div className="analysis-filter-copy"><span>ПЕРИОД ДОКУМЕНТОВ ЭВОТОР</span><strong>{rangeText(salesRange)}</strong><small>{coverageText ? `В загруженной витрине: ${coverageText}` : "В аналитике учитываются только документы начиная с 2025 года."}{data ? ` Факты продажи сейчас загружены для ${importedStoreCount} из ${data.stores.length} выбранных магазинов; очередь продолжает read-only загрузку.` : ""} Это независимая read-only витрина и не является финансовым P&L.</small></div>
      <DateRangeControl value={salesRange} onChange={value => setSalesRange(retainedRange(value))} title="ПЕРИОД ЧЕКОВ ЭВОТОР" ariaLabel="Изменить период чеков Эвотор" />
    </section>

    <details className="cadence-store-picker evotor-sales-store-picker"><summary><span>Магазины для суммарного среза</span><b>{scope}</b><small>выбрать</small></summary><div><p>Выберите магазины для общего ряда. При одном выбранном показателе режим «Магазины» показывает отдельную линию каждой точки.</p><button type="button" aria-pressed={allStoresSelected} onClick={() => setSelectedStores([])} className={allStoresSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Вся сеть</button>{visibleStores.map(store => <button type="button" key={store.id} aria-pressed={selectedStores.includes(store.id)} onClick={() => toggleStore(store.id)} className={selectedStores.includes(store.id) ? "cadence-metric-chip active" : "cadence-metric-chip"}>{store.name}</button>)}</div></details>

    {query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Показатели чеков недоступны</h2><p>{query.error.message}</p></section> : noData ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>В выбранном срезе нет чеков продажи</h2><p>{coverageText ? `Витрина уже содержит период ${coverageText}; выберите дату внутри этого диапазона.` : "Здесь появятся результаты после автоматической read-only загрузки чеков Эвотор."} Ручной импорт и запись в Эвотор на этом экране недоступны.</p></section> : data && <>
      {kind === "metrics" ? <section className="packet-kpis equal cadence-kpis evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Сумма чеков · {scope}</span><strong>{moneyText(data.summary.amount)}</strong><small>{rangeText(salesRange)} · чеки продажи Эвотор</small></article><article className="packet-kpi"><span>Чеки</span><strong>{numberText(data.summary.checks)}</strong><small>закрытые чеки продажи</small></article><article className="packet-kpi"><span>Средний чек</span><strong>{moneyText(data.summary.checks ? data.summary.amount / data.summary.checks : 0)}</strong><small>сумма чеков / число чеков</small></article><article className="packet-kpi"><span>Магазины с чеками</span><strong>{numberText(importedStoreCount)}</strong><small>из {data.stores.length} в выбранном срезе</small></article></section> : <section className="packet-kpis equal cadence-kpis evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Продано товаров · {scope}</span><strong>{numberText(data.summary.quantity)}</strong><small>{rangeText(salesRange)} · строки чеков продажи</small></article><article className="packet-kpi"><span>Наименований</span><strong>{numberText(productRows.length)}</strong><small>по названию и единице Эвотор</small></article><article className="packet-kpi"><span>Товарных строк</span><strong>{numberText(data.summary.positions)}</strong><small>в сохраненных чеках продажи</small></article><article className="packet-kpi"><span>Сумма продаж</span><strong>{moneyText(data.summary.positionAmount)}</strong><small>сумма товарных строк Эвотор</small></article></section>}

      {kind === "metrics" ? <>
        <section className="packet-card cadence-chart-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ЧЕКОВ · {scope}</span><h3>{granularityLabels[granularity]} · {perStoreData ? `${salesMetrics[selectedSalesMetrics[0]].label}: каждый магазин отдельно` : selectedSalesMetrics.length === 1 ? salesMetrics[selectedSalesMetrics[0]].label : `${selectedSalesMetrics.length} показателя`}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация чеков Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div>{allowStoreSeries && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => setShowStoreSeries(current => !current)} />}</div></div><div className="cadence-metrics-picker"><div className="cadence-picker-heading"><span>Показатели для сравнения</span><small>минимум один</small></div><div className="cadence-metric-group"><div>{(Object.keys(salesMetrics) as SalesMetric[]).map(metric => <button type="button" key={metric} aria-pressed={selectedSalesMetrics.includes(metric)} onClick={() => { toggleSalesMetric(metric); setShowStoreSeries(false); }} className={selectedSalesMetrics.includes(metric) ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: salesMetrics[metric].color }}/>{salesMetrics[metric].label}</button>)}</div></div></div><MetricLineChart data={metricChartData} lines={metricChartLines} displayMode={metricDisplayMode} chartTitle={`${title}: чеки`} /><p className="packet-note"><BarChart3 size={15}/> {perStoreData ? "Каждый выбранный магазин показан отдельным рядом. Отключите режим «Магазины», чтобы увидеть общий результат." : selectedSalesMetrics.length === 1 ? salesMetrics[selectedSalesMetrics[0]].note : "Выбранные показатели повторяются в таблице непосредственно под графиком."}</p></section>
        <section className="packet-card cadence-detail-table evotor-sales-table-card"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${salesMetrics[selectedSalesMetrics[0]].label}: каждый магазин отдельно` : "Все интервалы активного среза"}</h3></div><small>{granularityLabels[granularity].toLocaleLowerCase("ru-RU")}</small></div><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : granularity === "day" ? "Дата" : "Время"}</th>{metricChartLines.map(line => <th key={line.key} className="numeric-column">{line.name}</th>)}</tr></thead><tbody>{metricChartData.map((row, index) => <tr key={`${row.sort}-${index}`}><td data-label="Интервал">{row.month}</td>{metricChartLines.map(line => <td key={line.key} data-label={line.name} className="numeric-column">{perStoreData ? formatMetricValue(Number(row[line.key] ?? 0), selectedSalesMetrics[0]) : formatMetricValue(Number(row[line.key] ?? 0), line.key as SalesMetric)}</td>)}</tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th>{metricChartLines.map(line => <td key={line.key} className="numeric-column">{perStoreData ? formatMetricValue(metricChartData.reduce((sum, row) => sum + Number(row[line.key] ?? 0), 0), selectedSalesMetrics[0]) : formatMetricValue(scaledValue(metricTotal(line.key as SalesMetric), line.key as SalesMetric), line.key as SalesMetric)}</td>)}</tr></tfoot></table></div><p className="packet-note">Таблица повторяет выбранные ряды графика. В расчете участвуют только документы типа «продажа» из сохраненной read-only витрины Эвотор.</p></section>
      </> : <>
        <section className="packet-card cadence-chart-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ТОВАРОВ · {scope}</span><h3>{granularityLabels[granularity]} · {productMetrics[productMetric].label}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация товаров Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div></div></div><div className="cadence-metrics-picker evotor-products-picker"><div className="cadence-picker-heading"><span>Товары для сравнения</span><small>минимум один</small></div><div className="cadence-metric-group"><div>{(Object.keys(productMetrics) as ProductMetric[]).map(metric => <button type="button" key={metric} aria-pressed={productMetric === metric} onClick={() => setProductMetric(metric)} className={productMetric === metric ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: productMetrics[metric].color }}/>{productMetrics[metric].label}</button>)}</div></div><label className="evotor-product-search"><span><Search size={14}/>Найти товар для графика</span><input value={productSearch} onChange={event => { setProductSearch(event.target.value); setVisibleProductCount(48); }} placeholder="Название товара" autoComplete="off" /></label><div className="evotor-product-chips">{visibleProductChoices.map(product => <button type="button" key={product.key} aria-pressed={selectedProductKeys.includes(product.key)} onClick={() => toggleProduct(product.key)} className={selectedProductKeys.includes(product.key) ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: selectedProductKeys.includes(product.key) ? "#0A84FF" : "var(--muted)" }}/>{product.productName} · {unitLabel(product.unit)}</button>)}</div>{visibleProductCount < productChoices.length && <button type="button" className="subtle-button evotor-show-more" onClick={() => setVisibleProductCount(current => current + 96)}>Показать еще</button>}</div><MetricLineChart data={productChartData} lines={productChartLines} displayMode={productDisplayMode} chartTitle={`${title}: выбранные товары`} /><p className="packet-note"><ShoppingBasket size={15}/> {effectiveProducts.length === 1 ? productMetrics[productMetric].note : `На графике сопоставляются ${effectiveProducts.length} выбранных товара. Таблица ниже показывает весь состав продаж за тот же период.`}</p></section>
        <section className="packet-card cadence-detail-table evotor-sales-table-card"><div className="card-title"><div><span>ТОВАРЫ ПОД ГРАФИКОМ · {scope}</span><h3>Проданные товары за выбранный период</h3></div><small>сортировка по количеству</small></div><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>Товар</th><th className="numeric-column">Продано</th><th>Ед.</th><th className="numeric-column">Сумма продаж</th><th className="numeric-column">Строки чеков</th><th className="numeric-column">Магазины</th></tr></thead><tbody>{[...productRows].sort((left, right) => right.quantity - left.quantity || left.productName.localeCompare(right.productName, "ru")).map(row => <tr key={row.key}><td data-label="Товар"><strong>{row.productName}</strong></td><td data-label="Продано" className="numeric-column">{numberText(row.quantity)}</td><td data-label="Ед.">{unitLabel(row.unit)}</td><td data-label="Сумма продаж" className="numeric-column">{moneyText(row.amount)}</td><td data-label="Строки чеков" className="numeric-column">{numberText(row.positions)}</td><td data-label="Магазины" className="numeric-column">{numberText(row.stores)}</td></tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th><td className="numeric-column">{numberText(data.summary.quantity)}</td><td>—</td><td className="numeric-column">{moneyText(data.summary.positionAmount)}</td><td className="numeric-column">{numberText(data.summary.positions)}</td><td className="numeric-column">{numberText(productRows.length)}</td></tr></tfoot></table></div><p className="packet-note">В таблице показаны название, единица, количество и сумма сохраненных строк чеков продажи. Себестоимость и внутренние цены не отображаются.</p></section>
      </>}
    </>}
  </AuditShell>;
}
