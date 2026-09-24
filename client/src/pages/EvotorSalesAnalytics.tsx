import { ChevronDown, ReceiptText, ShoppingBasket } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { ChartPeriodComparisonToggle, MetricLineChart, StoreSeriesModeToggle } from "@/components/AuditCharts";
import { ChartTableSearch, chartTableMatches } from "@/components/ChartTableSearch";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import { buildSelectedProductStoreTimeline, buildSelectedProductTimeline, type ProductMetric, type ProductTimelineRow } from "@/lib/evotorSalesAggregation";
import { evotorAnalyticsQueryOptions } from "@/lib/evotorAnalyticsQuery";
import { formatMoneyWithKopecks, formatQuantity, formatQuantityWithUnit, normalizeEvotorQuantityUnit, quantityUnitLabel } from "@/lib/displayFormat";
import { previousComparableRange, previousSeriesKey, reverseComparableRows } from "@/lib/periodComparison";
import { trpc } from "@/lib/trpc";
import { formatBusinessCalendarDate } from "@/lib/utils";
import "@/evotor-sales-analytics.css";

type Granularity = "month" | "week" | "day" | "hour";

type ProductRow = {
  key: string;
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
  stores: number;
};
type AnalyticsData = {
  stores: Array<{ id: number; name: string }>;
  products: ProductRow[];
  productTimeline: ProductTimelineRow[];
  summary: {
    checks: number;
    amount: number;
    cashAmount: number;
    cashlessAmount: number;
    quantitiesByUnit: Array<{ unit: string | null; quantity: number }>;
    paymentCapture: { complete: number; unavailable: number; unreconciled: number; malformed: number };
  };
  coverage: { from: string | null; to: string | null };
};

const EVOTOR_ANALYTICS_START = "2025-01-01";
const granularityLabels: Record<Granularity, string> = { month: "Месяцы", week: "Недели", day: "Дни", hour: "Часы" };
const productMetrics: Record<ProductMetric, { label: string; color: string; note: string }> = {
  quantity: { label: "Количество проданного", color: "#0A84FF", note: "Сумма количеств выбранных товаров в закрытых чеках продажи." },
  amount: { label: "Сумма проданного", color: "#5E5CE6", note: "Сумма товарных строк Эвотор; она может отличаться от суммы чека из-за скидок и округлений." },
};
const productColors = ["#0A84FF", "#34C759", "#5E5CE6", "#FF453A", "#64D2FF", "#FF6B8A", "#AF52DE", "#00A3A3"];

const rangeText = (value: DateRangeValue) => `${formatBusinessCalendarDate(value.from, { day: "numeric", month: "long", year: "numeric" })} — ${formatBusinessCalendarDate(value.to, { day: "numeric", month: "long", year: "numeric" })}`;
const moneyText = (value: number) => formatMoneyWithKopecks(value);
const paymentCaptureText = (capture: AnalyticsData["summary"]["paymentCapture"]) => {
  const unresolved = capture.unavailable + capture.unreconciled + capture.malformed;
  return unresolved
    ? `Оплаты подтверждены у ${capture.complete} из ${capture.complete + unresolved} чеков; наличные и безналичные суммы содержат только эту часть, остальные не оцениваются.`
    : "Оплаты извлечены и сверены по всем чекам выбранного среза.";
};

function retainedRange(value: DateRangeValue): DateRangeValue {
  const from = value.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.from;
  const to = value.to < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.to;
  return to < from ? { from: EVOTOR_ANALYTICS_START, to: EVOTOR_ANALYTICS_START } : { from, to };
}

export default function EvotorSalesAnalytics() {
  const { demoMode, range, selectedStores } = useAudit();
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [showStoreSeries, setShowStoreSeries] = useState(false);
  const [productMetric, setProductMetric] = useState<ProductMetric>("quantity");
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [comparePeriod, setComparePeriod] = useState(false);
  const [productTableQuery, setProductTableQuery] = useState("");
  const [expandedProductKey, setExpandedProductKey] = useState<string | null>(null);
  // The sales screen deliberately reads and changes the same active period as
  // Rhythm, Forecast and the other analytical pages. Evotor's retained window
  // begins in 2025, so an older global range is visibly clamped rather than
  // issuing an impossible query below the available source boundary.
  const salesRange = retainedRange(range);

  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const selectedStoreIds = useMemo(() => visibleStores.filter(store => selectedStores.includes(store.name)).map(store => store.id), [selectedStores, visibleStores]);
  const allStoresSelected = selectedStores.length === 0;
  const queryInput = useMemo(() => ({
    from: salesRange.from,
    to: salesRange.to,
    granularity,
    storeIds: allStoresSelected ? undefined : selectedStoreIds,
  }), [allStoresSelected, granularity, salesRange.from, salesRange.to, selectedStoreIds]);
  const previousRange = useMemo(() => previousComparableRange(salesRange), [salesRange.from, salesRange.to]);
  const previousQueryInput = useMemo(() => ({
    from: previousRange.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : previousRange.from,
    to: previousRange.to,
    granularity,
    storeIds: allStoresSelected ? undefined : selectedStoreIds,
  }), [allStoresSelected, granularity, previousRange.from, previousRange.to, selectedStoreIds]);
  // Synthetic demo periods must not be paired with real receipt rows or query cache.
  const query = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(queryInput, { ...evotorAnalyticsQueryOptions, enabled: !demoMode });
  const previousQuery = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery(previousQueryInput, { ...evotorAnalyticsQueryOptions, enabled: !demoMode && comparePeriod && previousRange.to >= EVOTOR_ANALYTICS_START });
  const data = demoMode ? undefined : query.data as AnalyticsData | undefined;
  const previousData = demoMode ? undefined : previousQuery.data as AnalyticsData | undefined;
  const productRows = data?.products ?? [];
  const productKeySet = useMemo(() => new Set(productRows.map(product => product.key)), [productRows]);
  const productColorByKey = useMemo(() => new Map(productRows.map((product, index) => [product.key, productColors[index % productColors.length]])), [productRows]);
  const productColor = (key: string) => productColorByKey.get(key) ?? productColors[0];

  useEffect(() => {
    if (!productRows.length) return;
    setSelectedProductKeys(current => {
      const retained = current.filter(key => productKeySet.has(key));
      return retained.length ? retained : [productRows[0].key];
    });
  }, [productKeySet, productRows]);

  useEffect(() => {
    const availableSelected = selectedProductKeys.filter(key => productKeySet.has(key));
    // A deliberately collapsed row must stay collapsed. Reopen only when a
    // previously expanded product disappeared after a filter/data change.
    setExpandedProductKey(current => current === null ? null : availableSelected.includes(current) ? current : availableSelected[0] ?? productRows[0]?.key ?? null);
  }, [productKeySet, productRows, selectedProductKeys]);

  const selectedProducts = useMemo(() => productRows.filter(product => selectedProductKeys.includes(product.key)), [productRows, selectedProductKeys]);
  const effectiveProducts = selectedProducts.length ? selectedProducts : productRows.slice(0, 1);
  const allowStoreSeries = effectiveProducts.length === 1 && (data?.stores.length ?? 0) > 1;
  const perStoreData = useMemo(() => showStoreSeries && !comparePeriod && allowStoreSeries && effectiveProducts[0]
    ? buildSelectedProductStoreTimeline(data?.productTimeline ?? [], effectiveProducts[0], data?.stores ?? [], productMetric)
    : null, [allowStoreSeries, comparePeriod, data?.productTimeline, data?.stores, effectiveProducts, productMetric, showStoreSeries]);
  const productChartData = useMemo(() => buildSelectedProductTimeline(data?.productTimeline ?? [], effectiveProducts, productMetric), [data?.productTimeline, effectiveProducts, productMetric]);
  const previousProductChartData = useMemo(() => buildSelectedProductTimeline(previousData?.productTimeline ?? [], effectiveProducts, productMetric), [previousData?.productTimeline, effectiveProducts, productMetric]);
  const comparisonChartData = useMemo(() => reverseComparableRows(productChartData, previousProductChartData).map(({ active, previous }) => ({
    ...active,
    ...Object.fromEntries(effectiveProducts.map(product => [previousSeriesKey(product.key), Number(previous?.[product.key] ?? 0)])),
  })), [effectiveProducts, previousProductChartData, productChartData]);
  const chartData = perStoreData ?? (comparePeriod ? comparisonChartData : productChartData);
  const productChartLines = perStoreData
    ? (data?.stores ?? []).map((store, index) => ({ key: store.name, name: store.name, color: productColors[index % productColors.length], quantityUnit: effectiveProducts[0]?.unit ?? undefined }))
    : comparePeriod
      ? effectiveProducts.flatMap(product => ([
        { key: product.key, name: product.productName, color: productColor(product.key), quantityUnit: product.unit ?? undefined },
        { key: previousSeriesKey(product.key), name: `${product.productName} · пред. период`, color: `${productColor(product.key)}99`, quantityUnit: product.unit ?? undefined, comparison: true },
      ]))
      : effectiveProducts.map(product => ({ key: product.key, name: product.productName, color: productColor(product.key), quantityUnit: product.unit ?? undefined }));
  const scope = allStoresSelected ? "Все магазины" : selectedStores.length === 1 ? selectedStores[0] : `${selectedStores.length} магазина`;
  const importedStoreCount = new Set((data?.productTimeline ?? []).map(row => row.storeId)).size;
  const selectedStoreCount = allStoresSelected ? visibleStores.length : selectedStores.length;
  const noData = !query.isLoading && !query.isError && data && data.summary.checks === 0;
  const coverageText = data?.coverage.from && data.coverage.to ? rangeText({ from: data.coverage.from, to: data.coverage.to }) : null;
  const productDisplayMode = productMetric === "amount" ? "amount" as const : "number" as const;
  const quantitySummaries = useMemo(() => {
    const totals = new Map<string, number>();
    (data?.summary.quantitiesByUnit ?? []).forEach(total => {
      const unit = normalizeEvotorQuantityUnit(total.unit);
      totals.set(unit, (totals.get(unit) ?? 0) + total.quantity);
    });
    return Array.from(totals.entries()).map(([unit, quantity]) => ({ unit, quantity })).filter(total => total.unit !== "unknown" && total.quantity !== 0);
  }, [data?.summary.quantitiesByUnit]);
  const productTableRows = useMemo(() => [...productRows].sort((left, right) => right.quantity - left.quantity || left.productName.localeCompare(right.productName, "ru")), [productRows]);
  const filteredProductTableRows = productTableRows.filter(row => chartTableMatches(productTableQuery, row.productName, quantityUnitLabel(row.unit), row.amount, row.quantity, row.stores));
  const productTableAmount = filteredProductTableRows.reduce((sum, row) => sum + row.amount, 0);
  const productStoresByKey = useMemo(() => {
    const byProduct = new Map<string, Map<number, { storeName: string; quantity: number; amount: number }>>();
    (data?.productTimeline ?? []).forEach(line => {
      const storesForProduct = byProduct.get(line.productKey) ?? new Map<number, { storeName: string; quantity: number; amount: number }>();
      const aggregate = storesForProduct.get(line.storeId) ?? { storeName: line.storeName, quantity: 0, amount: 0 };
      aggregate.quantity += line.quantity;
      aggregate.amount += line.amount;
      storesForProduct.set(line.storeId, aggregate);
      byProduct.set(line.productKey, storesForProduct);
    });
    return new Map(Array.from(byProduct.entries()).map(([productKey, storesForProduct]) => [
      productKey,
      Array.from(storesForProduct.values()).map(store => ({ ...store, quantity: Math.round(store.quantity * 1_000) / 1_000, amount: Math.round(store.amount * 100) / 100 })).sort((left, right) => right.amount - left.amount || left.storeName.localeCompare(right.storeName, "ru")),
    ]));
  }, [data?.productTimeline]);
  const toggleProduct = (key: string) => {
    setExpandedProductKey(key);
    setSelectedProductKeys(current => current.includes(key) ? current.length === 1 ? current : current.filter(value => value !== key) : [...current, key]);
  };
  const selectProductFromTable = (key: string) => {
    setSelectedProductKeys([key]);
    setExpandedProductKey(current => current === key ? null : key);
  };

  return <AuditShell kicker="29 / ПРОДАННЫЕ ТОВАРЫ" title="Проданные товары Эвотор">
    <p className="packet-note evotor-sales-coverage-note">{coverageText ? `В загруженной витрине: ${coverageText}. ` : "В аналитике учитываются только документы начиная с 2025 года. "}{data ? `Точки с фактами продажи в выбранном срезе: ${importedStoreCount} из ${selectedStoreCount}. ` : ""}Данные read-only; они не меняют финансовый P&amp;L. Режим «Ряды» доступен для одного товара и показывает каждую точку отдельной линией.</p>

    {demoMode ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Проданные товары отключены в демо‑режиме</h2><p>Демо использует только синтетические финансовые периоды. Факты чеков Эвотор не читаются и не смешиваются с ними.</p></section> : query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Проданные товары недоступны</h2><p>{query.error.message}</p></section> : noData ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>В выбранном срезе нет проданных товаров</h2><p>{coverageText ? `Витрина уже содержит период ${coverageText}; выберите дату внутри этого диапазона.` : "Товары появятся после автоматической read-only загрузки чеков Эвотор."} Нули не подставляются.</p></section> : data && <>
      <section className="packet-kpis equal cadence-kpis evotor-sales-kpis" aria-label="Продажи и оплаты Эвотор">{quantitySummaries.map((total, index) => <article className={index === 0 ? "packet-kpi cadence-primary-kpi" : "packet-kpi"} key={total.unit ?? "unknown"}><span>Продано · {quantityUnitLabel(total.unit)} · {scope}</span><strong>{formatQuantityWithUnit(total.quantity, total.unit)}</strong><small>{rangeText(salesRange)} · единицы не смешиваются</small></article>)}<article className="packet-kpi"><span>Сумма проданного</span><strong>{moneyText(productRows.reduce((sum, row) => sum + row.amount, 0))}</strong><small>сумма товарных строк</small></article><article className="packet-kpi cadence-primary-kpi"><span>Выручка общая Эвотор</span><strong>{moneyText(data.summary.amount)}</strong><small>сумма всех переданных оплат</small></article><article className="packet-kpi"><span>Выручка нал Эвотор</span><strong>{moneyText(data.summary.cashAmount)}</strong><small>подтвержденные оплаты CASH</small></article><article className="packet-kpi"><span>Выручка б/нал Эвотор</span><strong>{moneyText(data.summary.cashlessAmount)}</strong><small>подтвержденные оплаты ELECTRON</small></article></section>
      <p className="packet-note"><ShoppingBasket size={15}/> {paymentCaptureText(data.summary.paymentCapture)} Факты чеков загружаются отдельно от Excel-импорта и не меняют финансовый P&L.</p>

      <section className="packet-card cadence-chart-card evotor-sales-chart-card"><div className="card-title"><div><span>ДИНАМИКА ТОВАРОВ · {scope}</span><h3>{granularityLabels[granularity]} · {perStoreData ? `${effectiveProducts[0]?.productName}: каждый магазин отдельно` : comparePeriod ? `${productMetrics[productMetric].label}: аналогичный предыдущий период` : productMetrics[productMetric].label}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация товаров Эвотор">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{granularityLabels[level]}</button>)}</div>{allowStoreSeries && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => { setShowStoreSeries(current => !current); setComparePeriod(false); }} />}</div></div>
        <div className="chart-view-control evotor-product-metric-control" aria-label="Факт выбранных товаров">{(Object.keys(productMetrics) as ProductMetric[]).map(metric => <button type="button" key={metric} className={productMetric === metric ? "chart-view-button active" : "chart-view-button"} aria-pressed={productMetric === metric} onClick={() => setProductMetric(metric)}>{productMetrics[metric].label}</button>)}</div>
        <details className="cadence-store-picker evotor-product-picker" aria-label="Товары для графика"><summary><span>Товары для графика</span><b>{effectiveProducts.length === 1 ? effectiveProducts[0]?.productName : `${effectiveProducts.length} товара`}</b><small>выбрать</small></summary><div><p>Выберите товары для сравнения. Цвет маркера совпадает с линией на графике; минимум один товар остается выбранным.</p><div className="cadence-metric-group"><div>{productRows.map(product => { const selected = selectedProductKeys.includes(product.key); return <button type="button" key={product.key} aria-pressed={selected} onClick={() => toggleProduct(product.key)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: productColor(product.key) }}/>{product.productName}</button>; })}</div></div></div></details>
        <MetricLineChart data={chartData} lines={productChartLines} displayMode={productDisplayMode} chartTitle="Проданные товары Эвотор" comparisonControl={() => <ChartPeriodComparisonToggle active={comparePeriod} onChange={() => { setComparePeriod(current => !current); setShowStoreSeries(false); }}/>} />
        <p className="packet-note"><ShoppingBasket size={15}/> {granularity === "hour" && "«Часы» — суммарный профиль по московскому времени за весь выбранный период. "}{comparePeriod ? `Предыдущий период ${previousRange.from}—${previousRange.to} показан обратным рядом: направление активного периода и три вида графика сохранены.` : perStoreData ? "Каждый выбранный магазин показан отдельным рядом. Отключите режим «Ряды», чтобы сопоставить товары." : effectiveProducts.length === 1 ? productMetrics[productMetric].note : `На графике и в таблице показаны одни и те же ${effectiveProducts.length} выбранных товара.`}</p></section>

      <section className="packet-card cadence-detail-table evotor-sales-table-card"><div className="card-title"><div><span>ТОВАРЫ ПОД ГРАФИКОМ · {scope}</span><h3>Проданные товары за выбранный период</h3></div><small>Нажмите на название товара, чтобы выбрать его для графика и раскрыть магазины</small></div><ChartTableSearch value={productTableQuery} onChange={setProductTableQuery} placeholder="Поиск товара, единицы или значения" ariaLabel="Поиск в таблице проданных товаров" shownRows={filteredProductTableRows.length} totalRows={productTableRows.length}/><div className="data-table-wrap cadence-full-table evotor-sales-table-wrap"><table className="data-table evotor-sales-table evotor-sales-product-table"><thead><tr><th>Товар</th><th className="numeric-column">Продано</th><th className="numeric-column">Сумма строк</th><th className="numeric-column">Магазины</th></tr></thead><tbody>{filteredProductTableRows.map((row, index) => {
        const expanded = expandedProductKey === row.key;
        const storesForProduct = productStoresByKey.get(row.key) ?? [];
        const breakdownId = `evotor-product-stores-${index}`;
        return <Fragment key={row.key}>
          <tr className={expanded ? "evotor-product-row is-expanded" : "evotor-product-row"}><td data-label="Товар"><button type="button" className="evotor-product-row-trigger" aria-expanded={expanded} aria-controls={breakdownId} onClick={() => selectProductFromTable(row.key)}><strong>{row.productName}</strong><ChevronDown size={15} aria-hidden="true"/></button></td><td data-label="Продано" className="numeric-column">{formatQuantityWithUnit(row.quantity, row.unit)}</td><td data-label="Сумма строк" className="numeric-column">{moneyText(row.amount)}</td><td data-label="Магазины" className="numeric-column">{formatQuantity(row.stores)}</td></tr>
          {expanded && <tr className="evotor-product-store-row"><td colSpan={4}><div className="evotor-product-store-breakdown" id={breakdownId}><span>Продажи по магазинам</span>{storesForProduct.length ? <div>{storesForProduct.map(store => <article key={store.storeName}><b>{store.storeName}</b><small>{formatQuantityWithUnit(store.quantity, row.unit)} · {moneyText(store.amount)}</small></article>)}</div> : <small>В загруженных строках нет распределения по магазинам.</small>}</div></td></tr>}
        </Fragment>;
      })}</tbody><tfoot><tr className="table-total"><th scope="row">{productTableQuery.trim() ? "Итого по выборке" : "Итого"}</th><td className="numeric-column">по единицам выше</td><td className="numeric-column">{moneyText(productTableAmount)}</td><td className="numeric-column">—</td></tr></tfoot></table></div><p className="packet-note">Название товара выбирает только его для графика и раскрывает read-only распределение по магазинам в текущем срезе. Единица включена в количество; позиции чеков, себестоимость, внутренние цены и технические реквизиты не выводятся.</p></section>
    </>}
  </AuditShell>;
}
