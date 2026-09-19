import { ReceiptText, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, StoreSeriesModeToggle } from "@/components/AuditCharts";
import { DateRangeControl } from "@/components/DateRangeControl";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import "@/evotor-sales-analytics.css";

type Granularity = "month" | "week" | "day" | "hour";
type ProductMetric = "quantity" | "amount";
type ChartDatum = Record<string, string | number> & { month: string; sort: string };

type ProductRow = {
  key: string;
  productName: string;
  amount: number;
  quantity: number;
  stores: number;
};
type ProductTimelineRow = {
  key: string;
  label: string;
  storeId: number;
  storeName: string;
  productKey: string;
  productName: string;
  amount: number;
  quantity: number;
};
type AnalyticsData = {
  stores: Array<{ id: number; name: string }>;
  products: ProductRow[];
  productTimeline: ProductTimelineRow[];
  summary: { checks: number; amount: number; cashAmount: number; cashlessAmount: number; quantity: number };
  coverage: { from: string | null; to: string | null };
};

const EVOTOR_ANALYTICS_START = "2025-01-01";
const granularityLabels: Record<Granularity, string> = { month: "Месяцы", week: "Недели", day: "Дни", hour: "По времени" };
const productMetrics: Record<ProductMetric, { label: string; color: string; note: string }> = {
  quantity: { label: "Количество проданного", color: "#0A84FF", note: "Сумма количеств выбранных товаров в закрытых чеках продажи." },
  amount: { label: "Сумма проданного", color: "#5E5CE6", note: "Сумма товарных строк Эвотор; она может отличаться от суммы чека из-за скидок и округлений." },
};
const productColors = ["#0A84FF", "#34C759", "#5E5CE6", "#FF453A", "#64D2FF", "#FF9F0A", "#AF52DE", "#00A3A3"];

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
const defaultSalesRange = (): DateRangeValue => {
  const to = todayIso();
  const date = new Date(`${to}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 30);
  const from = date.toISOString().slice(0, 10);
  return { from: from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : from, to };
};
const rangeText = (value: DateRangeValue) => `${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value.from}T12:00:00Z`))} — ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value.to}T12:00:00Z`))}`;
const trimNumber = (value: number, digits = 3) => Number.isFinite(value) ? value.toFixed(digits).replace(/\.?0+$/, "") : "—";
const numberText = (value: number, digits = 3) => {
  const [integer, fraction] = trimNumber(value, digits).split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${groupedInteger}.${fraction}` : groupedInteger;
};
const moneyText = (value: number) => `${numberText(value, 2)} ₽`;
const compactDate = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);

function retainedRange(value: DateRangeValue): DateRangeValue {
  const from = value.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.from;
  const to = value.to < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.to;
  return to < from ? { from: EVOTOR_ANALYTICS_START, to: EVOTOR_ANALYTICS_START } : { from, to };
}

function productRawValue(row: ProductTimelineRow, metric: ProductMetric) {
  return metric === "amount" ? row.amount : row.quantity;
}

function scaledValue(value: number, metric: ProductMetric) {
  return metric === "amount" ? value / 1_000 : value;
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

function selectedProductStoreTimeline(rows: ProductTimelineRow[], product: ProductRow, stores: Array<{ id: number; name: string }>, metric: ProductMetric): ChartDatum[] {
  const rowsByInterval = new Map<string, ChartDatum>();
  rows.filter(row => row.productKey === product.key).forEach(row => {
    const current = rowsByInterval.get(row.key) ?? { month: compactDate(row.label), sort: row.key };
    current[row.storeName] = scaledValue(productRawValue(row, metric), metric);
    rowsByInterval.set(row.key, current);
  });
  return Array.from(rowsByInterval.values()).sort((left, right) => left.sort.localeCompare(right.sort)).map(row => ({
    ...Object.fromEntries(stores.map(store => [store.name, row[store.name] ?? 0])),
    ...row,
  }));
}

export default function EvotorSalesAnalytics() {
  const { demoMode } = useAudit();
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [showStoreSeries, setShowStoreSeries] = useState(false);
  const [productMetric, setProductMetric] = useState<ProductMetric>("quantity");
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [salesRange, setSalesRange] = useState<DateRangeValue>(defaultSalesRange);

  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const allStoresSelected = selectedStores.length === 0;
  const queryInput = useMemo(() => ({
    from: salesRange.from,
    to: salesRange.to,
    granularity,
    storeIds: allStoresSelected ? undefined : selectedStores,
  }), [allStoresSelected, granularity, salesRange.from, salesRange.to, selectedStores]);
  // Synthetic demo periods must not be paired with real receipt rows or query cache.
  const query = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(queryInput, { retry: false, enabled: !demoMode });
  const data = demoMode ? undefined : query.data as AnalyticsData | undefined;
  const productRows = data?.products ?? [];
  const productKeySet = useMemo(() => new Set(productRows.map(product => product.key)), [productRows]);

  useEffect(() => {
    if (!productRows.length) return;
    setSelectedProductKeys(current => {
      const retained = current.filter(key => productKeySet.has(key));
      return retained.length ? retained : [productRows[0].key];
    });
  }, [productKeySet, productRows]);

  const selectedProducts = useMemo(() => productRows.filter(product => selectedProductKeys.includes(product.key)), [productRows, selectedProductKeys]);
  const effectiveProducts = selectedProducts.length ? selectedProducts : productRows.slice(0, 1);
  const allowStoreSeries = effectiveProducts.length === 1 && (data?.stores.length ?? 0) > 1;
  const perStoreData = useMemo(() => showStoreSeries && allowStoreSeries && effectiveProducts[0]
    ? selectedProductStoreTimeline(data?.productTimeline ?? [], effectiveProducts[0], data?.stores ?? [], productMetric)
    : null, [allowStoreSeries, data?.productTimeline, data?.stores, effectiveProducts, productMetric, showStoreSeries]);
  const productChartData = useMemo(() => selectedProductTimeline(data?.productTimeline ?? [], effectiveProducts, productMetric), [data?.productTimeline, effectiveProducts, productMetric]);
  const chartData = perStoreData ?? productChartData;
  const productChartLines = perStoreData
    ? (data?.stores ?? []).map((store, index) => ({ key: store.name, name: store.name, color: productColors[index % productColors.length] }))
    : effectiveProducts.map((product, index) => ({ key: product.key, name: product.productName, color: productColors[index % productColors.length] }));
  const scope = allStoresSelected ? "Все магазины" : data?.stores.length === 1 ? data.stores[0].name : `${data?.stores.length ?? selectedStores.length} магазина`;
  const importedStoreCount = new Set((data?.productTimeline ?? []).map(row => row.storeId)).size;
  const selectedStoreCount = allStoresSelected ? visibleStores.length : selectedStores.length;
  const noData = !query.isLoading && !query.isError && data && data.summary.checks === 0;
  const coverageText = data?.coverage.from && data.coverage.to ? rangeText({ from: data.coverage.from, to: data.coverage.to }) : null;
  const productDisplayMode = productMetric === "amount" ? "amount" as const : "number" as const;
  const toggleStore = (id: number) => setSelectedStores(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleProduct = (key: string) => setSelectedProductKeys(current => current.includes(key) ? current.length === 1 ? current : current.filter(value => value !== key) : [...current, key]);
  const chartTableTotal = (key: string) => chartData.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

  return <AuditShell kicker="29 / ПРОДАННЫЕ ТОВАРЫ" title="Проданные товары Эвотор">
    <section className="analysis-filter evotor-sales-period">
      <div className="analysis-filter-copy"><span>ПЕРИОД ДОКУМЕНТОВ ЭВОТОР</span><strong>{rangeText(salesRange)}</strong><small>{coverageText ? `В загруженной витрине: ${coverageText}` : "В аналитике учитываются только документы начиная с 2025 года."}{data ? ` Точки с фактами продажи в выбранном срезе: ${importedStoreCount} из ${selectedStoreCount}.` : ""} Данные read-only; они не меняют финансовый P&L.</small></div>
      <DateRangeControl value={salesRange} onChange={value => setSalesRange(retainedRange(value))} title="ПЕРИОД ЧЕКОВ ЭВОТОР" ariaLabel="Изменить период чеков Эвотор" />
    </section>

    <details className="cadence-store-picker evotor-sales-store-picker"><summary><span>Магазины для суммарного среза</span><b>{scope}</b><small>выбрать</small></summary><div><p>Выберите магазины для общего ряда. Режим «Ряды» доступен для одного товара и показывает каждую точку отдельной линией.</p><button type="button" aria-pressed={allStoresSelected} onClick={() => setSelectedStores([])} className={allStoresSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Вся сеть</button>{visibleStores.map(store => <button type="button" key={store.id} aria-pressed={selectedStores.includes(store.id)} onClick={() => toggleStore(store.id)} className={selectedStores.includes(store.id) ? "cadence-metric-chip active" : "cadence-metric-chip"}>{store.name}</button>)}</div></details>

    {demoMode ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Проданные товары отключены в демо‑режиме</h2><p>Демо использует только синтетические финансовые периоды. Факты чеков Эвотор не читаются и не смешиваются с ними.</p></section> : query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Проданные товары недоступны</h2><p>{query.error.message}</p></section> : noData ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>В выбранном срезе нет проданных товаров</h2><p>{coverageText ? `Витрина уже содержит период ${coverageText}; выберите дату внутри этого диапазона.` : "Товары появятся после автоматической read-only загрузки чеков Эвотор."} Нули не подставляются.</p></section> : data && <>
      <section className="packet-kpis equal cadence-kpis evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Количество проданного · {scope}</span><strong>{numberText(data.summary.quantity)}</strong><small>{rangeText(salesRange)} · сумма количеств товаров</small></article><article className="packet-kpi"><span>Наименований</span><strong>{numberText(productRows.length)}</strong><small>по названию и единице Эвотор</small></article><article className="packet-kpi"><span>Сумма проданного</span><strong>{moneyText(productRows.reduce((sum, row) => sum + row.amount, 0))}</strong><small>сумма товарных строк</small></article></section>

      <section className="packet-card cadence-chart-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ТОВАРОВ · {scope}</span><h3>{granularityLabels[granularity]} · {perStoreData ? `${effectiveProducts[0]?.productName}: каждый магазин отдельно` : productMetrics[productMetric].label}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация товаров Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div>{allowStoreSeries && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => setShowStoreSeries(current => !current)} />}</div></div>
        <div className="chart-view-control evotor-product-metric-control" aria-label="Факт выбранных товаров">{(Object.keys(productMetrics) as ProductMetric[]).map(metric => <button type="button" key={metric} className={productMetric === metric ? "chart-view-button active" : "chart-view-button"} aria-pressed={productMetric === metric} onClick={() => setProductMetric(metric)}>{productMetrics[metric].label}</button>)}</div>
        <details className="cadence-store-picker evotor-product-picker" aria-label="Товары для графика"><summary><span>Товары для графика</span><b>{effectiveProducts.length === 1 ? effectiveProducts[0]?.productName : `${effectiveProducts.length} товара`}</b><small>выбрать</small></summary><div><p>Выберите товары для сравнения. Цвет маркера совпадает с линией на графике; минимум один товар остается выбранным.</p><div className="cadence-metric-group"><div>{productRows.map((product, index) => { const selected = selectedProductKeys.includes(product.key); return <button type="button" key={product.key} aria-pressed={selected} onClick={() => toggleProduct(product.key)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: productColors[index % productColors.length] }}/>{product.productName}</button>; })}</div></div></div></details>
        <MetricLineChart data={chartData} lines={productChartLines} displayMode={productDisplayMode} chartTitle="Проданные товары Эвотор" />
        <p className="packet-note"><ShoppingBasket size={15}/> {perStoreData ? "Каждый выбранный магазин показан отдельным рядом. Отключите режим «Ряды», чтобы сопоставить товары." : effectiveProducts.length === 1 ? productMetrics[productMetric].note : `На графике и в таблице показаны одни и те же ${effectiveProducts.length} выбранных товара.`}</p></section>

      <section className="packet-card cadence-detail-table evotor-sales-table-card"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${effectiveProducts[0]?.productName}: каждый магазин отдельно` : "Все интервалы выбранных товаров"}</h3></div><small>{granularityLabels[granularity].toLocaleLowerCase("ru-RU")}</small></div><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : granularity === "day" ? "Дата" : "Время"}</th>{productChartLines.map(line => <th key={line.key} className="numeric-column">{line.name}</th>)}</tr></thead><tbody>{chartData.map((row, index) => <tr key={`${row.sort}-${index}`}><td data-label="Интервал">{row.month}</td>{productChartLines.map(line => <td key={line.key} data-label={line.name} className="numeric-column">{productMetric === "amount" ? moneyText(Number(row[line.key] ?? 0) * 1_000) : numberText(Number(row[line.key] ?? 0))}</td>)}</tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th>{productChartLines.map(line => <td key={line.key} className="numeric-column">{productMetric === "amount" ? moneyText(chartTableTotal(line.key) * 1_000) : numberText(chartTableTotal(line.key))}</td>)}</tr></tfoot></table></div><p className="packet-note">Таблица повторяет каждый ряд и каждый интервал графика. Себестоимость, внутренние цены и технические реквизиты не выводятся.</p></section>
    </>}
  </AuditShell>;
}
