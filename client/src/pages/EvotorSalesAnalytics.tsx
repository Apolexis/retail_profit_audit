import { BarChart3, ReceiptText, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, StoreSeriesModeToggle } from "@/components/AuditCharts";
import { DateRangeControl } from "@/components/DateRangeControl";
import { FactsLoader } from "@/components/OceanLoader";
import { type DateRangeValue } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import "@/evotor-sales-analytics.css";

type Granularity = "month" | "week" | "day" | "hour";
type ProductMetric = "quantity" | "positions" | "amount";
type ChartDatum = Record<string, string | number> & { month: string; sort: string };

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
  storeId: number;
  storeName: string;
  productKey: string;
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
  positions: number;
};
type AnalyticsData = {
  stores: Array<{ id: number; name: string }>;
  products: ProductRow[];
  productTimeline: ProductTimelineRow[];
  summary: { checks: number; amount: number; positions: number; positionAmount: number; quantity: number };
  coverage: { from: string | null; to: string | null };
};

const EVOTOR_ANALYTICS_START = "2025-01-01";
const granularityLabels: Record<Granularity, string> = { month: "Месяцы", week: "Недели", day: "Дни", hour: "По времени" };
const productMetrics: Record<ProductMetric, { label: string; color: string; note: string }> = {
  quantity: { label: "Количество проданного", color: "#0A84FF", note: "Сумма количеств выбранных товарных позиций из закрытых чеков продажи." },
  positions: { label: "Товарные позиции", color: "#34C759", note: "Сколько строк с выбранным товаром попало в закрытые чеки. Это не количество чеков." },
  amount: { label: "Сумма по товарным позициям", color: "#5E5CE6", note: "Сумма товарных строк, сохраненная из Эвотор; она может отличаться от суммы чеков из-за скидок и округлений." },
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
const unitLabel = (value: string | null) => {
  const unit = value?.trim().toLocaleLowerCase("ru-RU") ?? "";
  if (unit === "fraction" || unit === "дроб" || unit === "fractional") return "кг";
  if (unit === "piece" || unit === "шт" || unit === "штука") return "шт.";
  if (unit === "l" || unit === "литр") return "л";
  return value || "—";
};
const compactDate = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);

function retainedRange(value: DateRangeValue): DateRangeValue {
  const from = value.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.from;
  const to = value.to < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.to;
  return to < from ? { from: EVOTOR_ANALYTICS_START, to: EVOTOR_ANALYTICS_START } : { from, to };
}

function productRawValue(row: ProductTimelineRow, metric: ProductMetric) {
  if (metric === "quantity") return row.quantity;
  if (metric === "positions") return row.positions;
  return row.amount;
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
  const query = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(queryInput, { retry: false });
  const data = query.data as AnalyticsData | undefined;
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
  const selectedProductLabel = selectedProductKeys.length === 0 ? "Выберите товар" : selectedProductKeys.length === productRows.length ? `Все товары · ${productRows.length}` : selectedProductKeys.length === 1 ? effectiveProducts[0]?.productName ?? "Выберите товар" : `Выбрано товаров: ${selectedProductKeys.length}`;

  const toggleStore = (id: number) => setSelectedStores(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleProduct = (key: string) => setSelectedProductKeys(current => current.includes(key) ? current.length === 1 ? current : current.filter(value => value !== key) : [...current, key]);
  const toggleAllProducts = () => setSelectedProductKeys(current => current.length === productRows.length ? [productRows[0]?.key].filter(Boolean) : productRows.map(product => product.key));
  const productValue = (row: ProductRow) => productMetric === "amount" ? moneyText(row.amount) : productMetric === "positions" ? numberText(row.positions) : numberText(row.quantity);
  const chartTableTotal = (key: string) => chartData.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);

  return <AuditShell kicker="29 / ПРОДАННЫЕ ТОВАРЫ" title="Проданные товары Эвотор">
    <section className="analysis-filter evotor-sales-period">
      <div className="analysis-filter-copy"><span>ПЕРИОД ДОКУМЕНТОВ ЭВОТОР</span><strong>{rangeText(salesRange)}</strong><small>{coverageText ? `В загруженной витрине: ${coverageText}` : "В аналитике учитываются только документы начиная с 2025 года."}{data ? ` Точки с фактами продажи в выбранном срезе: ${importedStoreCount} из ${selectedStoreCount}.` : ""} Данные read-only; они не меняют финансовый P&L.</small></div>
      <DateRangeControl value={salesRange} onChange={value => setSalesRange(retainedRange(value))} title="ПЕРИОД ЧЕКОВ ЭВОТОР" ariaLabel="Изменить период чеков Эвотор" />
    </section>

    <details className="cadence-store-picker evotor-sales-store-picker"><summary><span>Магазины для суммарного среза</span><b>{scope}</b><small>выбрать</small></summary><div><p>Выберите магазины для общего ряда. Режим «Ряды» доступен для одного товара и показывает каждую точку отдельной линией.</p><button type="button" aria-pressed={allStoresSelected} onClick={() => setSelectedStores([])} className={allStoresSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Вся сеть</button>{visibleStores.map(store => <button type="button" key={store.id} aria-pressed={selectedStores.includes(store.id)} onClick={() => toggleStore(store.id)} className={selectedStores.includes(store.id) ? "cadence-metric-chip active" : "cadence-metric-chip"}>{store.name}</button>)}</div></details>

    {query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Проданные товары недоступны</h2><p>{query.error.message}</p></section> : noData ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>В выбранном срезе нет товарных позиций</h2><p>{coverageText ? `Витрина уже содержит период ${coverageText}; выберите дату внутри этого диапазона.` : "Товары появятся после автоматической read-only загрузки чеков Эвотор."} Нули не подставляются.</p></section> : data && <>
      <section className="packet-kpis equal cadence-kpis evotor-sales-kpis"><article className="packet-kpi cadence-primary-kpi"><span>Количество проданного · {scope}</span><strong>{numberText(data.summary.quantity)}</strong><small>{rangeText(salesRange)} · сумма количеств товарных позиций</small></article><article className="packet-kpi"><span>Наименований</span><strong>{numberText(productRows.length)}</strong><small>по названию и единице Эвотор</small></article><article className="packet-kpi"><span>Товарные позиции</span><strong>{numberText(data.summary.positions)}</strong><small>строки товаров в чеках, не количество чеков</small></article><article className="packet-kpi"><span>Сумма по товарным позициям</span><strong>{moneyText(data.summary.positionAmount)}</strong><small>может отличаться от суммы чеков</small></article></section>

      <section className="packet-card cadence-chart-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ТОВАРОВ · {scope}</span><h3>{granularityLabels[granularity]} · {perStoreData ? `${effectiveProducts[0]?.productName}: каждый магазин отдельно` : productMetrics[productMetric].label}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация товаров Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div>{allowStoreSeries && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => setShowStoreSeries(current => !current)} />}</div></div>
        <div className="evotor-product-controls"><div className="chart-view-control" aria-label="Показатель выбранных товаров">{(Object.keys(productMetrics) as ProductMetric[]).map(metric => <button type="button" key={metric} className={productMetric === metric ? "chart-view-button active" : "chart-view-button"} aria-pressed={productMetric === metric} onClick={() => { setProductMetric(metric); setShowStoreSeries(false); }}>{productMetrics[metric].label}</button>)}</div><details className="evotor-product-picker"><summary><span>Товары для графика</span><b>{selectedProductLabel}</b><small>выбрать</small></summary><div><div className="evotor-product-picker-actions"><button type="button" className="subtle-button" onClick={toggleAllProducts}>{selectedProductKeys.length === productRows.length ? "Оставить один" : "Выбрать все"}</button><small>Минимум один товар. Цвет ряда указан в легенде графика.</small></div><div className="evotor-product-options">{productRows.map((product, index) => { const selected = selectedProductKeys.includes(product.key); return <button type="button" key={product.key} aria-pressed={selected} onClick={() => { toggleProduct(product.key); setShowStoreSeries(false); }} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: selected ? productColors[index % productColors.length] : "var(--muted)" }}/>{product.productName}</button>; })}</div></div></details></div>
        <MetricLineChart data={chartData} lines={productChartLines} displayMode={productDisplayMode} chartTitle="Проданные товары Эвотор" forceTimeline />
        <p className="packet-note"><ShoppingBasket size={15}/> {perStoreData ? "Каждый выбранный магазин показан отдельным рядом. Отключите режим «Ряды», чтобы сопоставить товары." : effectiveProducts.length === 1 ? productMetrics[productMetric].note : `На графике и в таблице показаны одни и те же ${effectiveProducts.length} выбранных товара.`}</p></section>

      <section className="packet-card cadence-detail-table evotor-sales-table-card"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${effectiveProducts[0]?.productName}: каждый магазин отдельно` : "Все интервалы выбранных товаров"}</h3></div><small>{granularityLabels[granularity].toLocaleLowerCase("ru-RU")}</small></div><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : granularity === "day" ? "Дата" : "Время"}</th>{productChartLines.map(line => <th key={line.key} className="numeric-column">{line.name}</th>)}</tr></thead><tbody>{chartData.map((row, index) => <tr key={`${row.sort}-${index}`}><td data-label="Интервал">{row.month}</td>{productChartLines.map(line => <td key={line.key} data-label={line.name} className="numeric-column">{productMetric === "amount" ? moneyText(Number(row[line.key] ?? 0) * 1_000) : numberText(Number(row[line.key] ?? 0))}</td>)}</tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th>{productChartLines.map(line => <td key={line.key} className="numeric-column">{productMetric === "amount" ? moneyText(chartTableTotal(line.key) * 1_000) : numberText(chartTableTotal(line.key))}</td>)}</tr></tfoot></table></div><p className="packet-note">Таблица повторяет ряды графика и их интервалы. Себестоимость, внутренние цены и технические реквизиты не выводятся.</p></section>

      <section className="packet-card cadence-detail-table evotor-sales-summary-table"><div className="card-title"><div><span>СОСТАВ ПРОДАЖ · {scope}</span><h3>Все товары выбранного периода</h3></div><small>сортировка по количеству</small></div><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table"><thead><tr><th>Товар</th><th className="numeric-column">Количество</th><th className="numeric-column">Товарные позиции</th><th className="numeric-column">Сумма по позициям</th><th className="numeric-column">Магазины</th></tr></thead><tbody>{[...productRows].sort((left, right) => right.quantity - left.quantity || left.productName.localeCompare(right.productName, "ru")).map(row => <tr key={row.key}><td data-label="Товар"><strong>{row.productName}</strong></td><td data-label="Количество" className="numeric-column">{numberText(row.quantity)}</td><td data-label="Товарные позиции" className="numeric-column">{numberText(row.positions)}</td><td data-label="Сумма по позициям" className="numeric-column">{moneyText(row.amount)}</td><td data-label="Магазины" className="numeric-column">{numberText(row.stores)}</td></tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th><td className="numeric-column">{numberText(data.summary.quantity)}</td><td className="numeric-column">{numberText(data.summary.positions)}</td><td className="numeric-column">{moneyText(data.summary.positionAmount)}</td><td className="numeric-column">{numberText(data.stores.length)}</td></tr></tfoot></table></div><p className="packet-note">Единицы измерения используются внутри нормализованной витрины; визуально не смешиваются с количеством разных товаров.</p></section>
    </>}
  </AuditShell>;
}
