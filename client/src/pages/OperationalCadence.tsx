import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Calculator, FileSpreadsheet, Layers3 } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { ChartPeriodComparisonToggle, MetricLineChart, StoreSeriesModeToggle, formatK, formatTableAmount } from "@/components/AuditCharts";
import { ChartTableSearch, chartTableMatches } from "@/components/ChartTableSearch";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";
import { buildOperationalCadence, type CadenceMetric } from "@/lib/operationalCadence";
import { evotorAnalyticsQueryOptions } from "@/lib/evotorAnalyticsQuery";
import { previousComparableRange, previousSeriesKey, reverseComparableRows } from "@/lib/periodComparison";
import { trpc } from "@/lib/trpc";
import { formatMoscowDateTime } from "@/lib/utils";

type FactSource = "excel" | "site-overlay" | "evotor";

const siteOverlayMetrics = new Set<CadenceMetric>([
  "cashRevenue", "cashlessRevenue", "receiptsTotal", "household", "delivery", "cleaning",
  "bonus", "seniority", "supplement", "utilitiesCash", "operatingCosts", "salaryCash", "vacationCash",
]);

const factSource = (metric: CadenceMetric): FactSource => metric.startsWith("evotor") ? "evotor" : siteOverlayMetrics.has(metric) ? "site-overlay" : "excel";
const factSourceLabel = (metric: CadenceMetric) => factSource(metric) === "evotor"
  ? "Эвотор · отдельный read-only факт"
  : factSource(metric) === "site-overlay"
    ? "Сайт → Excel · замена одноимённого факта"
    : "Excel · первичный финансовый факт";

const metrics: Record<CadenceMetric, { label: string; color: string; note: string }> = {
  revenue: { label: "Продажи Коп. и Мор.", color: "#ffcf7b", note: "Сумма продаж копченой и мороженой продукции по исходной книге." },
  cashRevenue: { label: "Выручка нал", color: "#55b6ff", note: "Одноимённая переданная выручка сайта заменяет Excel; при отсутствии передачи сохраняется Excel." },
  cashlessRevenue: { label: "Выручка б/нал", color: "#61d9b5", note: "Одноимённая переданная выручка сайта заменяет Excel; при отсутствии передачи сохраняется Excel." },
  receiptsTotal: { label: "Выручка общая", color: "#d9bdff", note: "Наличная и безналичная передача сайта заменяют одноимённые Excel-факты, а не прибавляются к ним." },
  grossProfit: { label: "Валовая прибыль", color: "#72a8ff", note: "Разница выручки и закупочной части до операционных расходов." },
  netProfit: { label: "Чистая прибыль", color: "#38d6b0", note: "Результат после учтенных расходов." },
  purchases: { label: "Закупки", color: "#b694ff", note: "Объем пополнения товарного запаса." },
  purchaseSmoked: { label: "Закупка Коп.", color: "#de9a5d", note: "Закупка копченой продукции по фактическим дням." },
  purchaseFrozen: { label: "Закупка Мор.", color: "#7eb9df", note: "Закупка мороженой продукции по фактическим дням." },
  salesSmoked: { label: "Продажи Коп.", color: "#ffab62", note: "Продажи копченой продукции по фактическим дням." },
  salesFrozen: { label: "Продажи Мор.", color: "#49b6d8", note: "Продажи мороженой продукции по фактическим дням." },
  expenses: { label: "Общие расходы", color: "#ff6d8c", note: "Сумма абсолютных значений всех расходных статей." },
  cashExpenses: { label: "Общие траты нал", color: "#ff8b6f", note: "Наличные операционные расходы: хоз. нужды, доставка, уборка, премия, выслуга, доплата, водитель, коммунальные и прочие расходы." },
  cashlessExpenses: { label: "Общие траты б/нал", color: "#7aa9ff", note: "Безналичные операционные, ФОТ, налоговые, банковские и арендные расходы." },
  cashTaxes: { label: "НДФЛ 22%", color: "#e46ba9", note: "Налоговая нагрузка наличных выплат; контролируется вместе с тратами нал." },
  household: { label: "Хоз. нужды нал", color: "#ff8b6f", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  delivery: { label: "Доставка нал", color: "#ffbf69", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  cleaning: { label: "Уборка нал", color: "#7dcbff", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  bonus: { label: "Премия нал", color: "#e88af0", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  seniority: { label: "Выслуга нал", color: "#b49bff", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  supplement: { label: "Доплата нал", color: "#ff7f9d", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  driverCash: { label: "Водитель нал", color: "#67d6b5", note: "Наличные выплаты водителю." },
  utilitiesCash: { label: "Ком. плат. нал", color: "#6ba4ff", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  operatingCosts: { label: "Расходы нал", color: "#d9d75c", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  cashlessOperatingCosts: { label: "Расходы безналичные", color: "#8eb5ff", note: "Прочие операционные расходы безналично." },
  driverCashless: { label: "Водитель б/нал", color: "#58c5a4", note: "Безналичные выплаты водителю." },
  utilitiesCashless: { label: "Коммуналка б/нал", color: "#6b9ddc", note: "Безналичные коммунальные платежи." },
  rent: { label: "Аренда б/нал", color: "#e1a1cf", note: "Арендная плата, материализованная по дням при импорте." },
  bankFee: { label: "% банку", color: "#9ca9be", note: "Банковские комиссии по фактическим датам." },
  grossProfitTax: { label: "Налог с валовой прибыли", color: "#d78a72", note: "Налог с валовой прибыли." },
  salaryCashless: { label: "Зарплата б/нал", color: "#b2a0ec", note: "Безналичная зарплата, материализованная по дням при импорте." },
  payrollTax: { label: "Налоги зарплатные", color: "#d7a6a6", note: "Налоги на заработную плату." },
  vacationCashless: { label: "Отпускные б/нал", color: "#92c5d4", note: "Безналичные отпускные." },
  vacationTax: { label: "Налоги на отпускные", color: "#c4b17d", note: "Налоги на отпускные." },
  salaryCash: { label: "Зарплата нал", color: "#ff9d80", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  vacationCash: { label: "Отпускные нал", color: "#d890b9", note: "Переданное одноимённое значение сайта заменяет Excel только при сумме больше нуля." },
  writeoffSmoked: { label: "Списания К.", color: "#d08bff", note: "Списания копченой продукции для операционного контроля." },
  writeoffFrozen: { label: "Списания М.", color: "#e978ff", note: "Прямой расход по мороженой продукции." },
  movement: { label: "Перемещения", color: "#73d5b1", note: "Перемещения товарного запаса между точками." },
  discount: { label: "Уценка", color: "#e69a7c", note: "Уценка как управляемая корректировка товарного потока." },
  evotorAmount: { label: "Выручка общая Эвотор", color: "#0A84FF", note: "Сумма закрытых чеков продажи из уже загруженной read-only витрины Эвотор." },
  evotorCash: { label: "Выручка нал Эвотор", color: "#55b6ff", note: "Сумма оплат типа CASH из чеков Эвотор. Реквизиты платежей не сохраняются." },
  evotorCashless: { label: "Выручка б/нал Эвотор", color: "#61d9b5", note: "Сумма оплат типа ELECTRON из чеков Эвотор. Реквизиты платежей не сохраняются." },
  evotorChecks: { label: "Чеки Эвотор", color: "#34C759", note: "Количество закрытых документов продажи Эвотор; это не сумма выручки." },
  evotorAverage: { label: "Средний чек Эвотор", color: "#5E5CE6", note: "Выручка Эвотор, деленная на количество закрытых чеков." },
};

type EvotorStockSnapshot = {
  units: Array<{ unit: "fraction" | "l" | "piece"; quantity: number; positions: number; stores: number }>;
  positions: number;
  stores: number;
  snapshotAt: Date | null;
};

const evotorStockUnitLabel = (unit: EvotorStockSnapshot["units"][number]["unit"]) => unit === "fraction" ? "кг" : unit === "l" ? "л" : "шт";
const formatEvotorStockQuantity = (quantity: number, unit: EvotorStockSnapshot["units"][number]["unit"]) => `${new Intl.NumberFormat("ru-RU", { useGrouping: false, maximumFractionDigits: 3 }).format(quantity)}${evotorStockUnitLabel(unit)}`;

const metricGroups: Array<{ label: string; keys: CadenceMetric[] }> = [
  { label: "Выручка, результат и товар", keys: ["receiptsTotal", "cashRevenue", "cashlessRevenue", "evotorAmount", "evotorCash", "evotorCashless", "evotorChecks", "evotorAverage", "grossProfit", "netProfit", "purchases", "purchaseSmoked", "purchaseFrozen", "revenue", "salesSmoked", "salesFrozen"] },
  { label: "Итоговые расходы", keys: ["expenses", "cashExpenses", "cashlessExpenses"] },
  { label: "Наличные расходы и налоги", keys: ["cashTaxes", "household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driverCash", "utilitiesCash", "operatingCosts"] },
  { label: "Безналичные", keys: ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax"] },
  { label: "ФОТ и налоги", keys: ["salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash"] },
  { label: "Товарный поток", keys: ["writeoffSmoked", "writeoffFrozen", "movement", "discount"] },
];

type Granularity = "month" | "week" | "day" | "hour";
type CadencePoint = Record<CadenceMetric, number> & { date: string; month: string };
const emptyCadenceMetrics = Object.fromEntries(Object.keys(metrics).map(metric => [metric, 0])) as Record<CadenceMetric, number>;

function evotorTimelinePoints(timeline: Array<{ key: string; label: string; amount: number; cashAmount: number; cashlessAmount: number; checks: number }>): CadencePoint[] {
  const byHour = new Map<string, { label: string; amount: number; cashAmount: number; cashlessAmount: number; checks: number }>();
  for (const point of timeline) {
    const current = byHour.get(point.key) ?? { label: point.label, amount: 0, cashAmount: 0, cashlessAmount: 0, checks: 0 };
    current.amount += Number(point.amount ?? 0);
    current.cashAmount += Number(point.cashAmount ?? 0);
    current.cashlessAmount += Number(point.cashlessAmount ?? 0);
    current.checks += Number(point.checks ?? 0);
    byHour.set(point.key, current);
  }
  return Array.from(byHour.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, point]) => ({
    ...emptyCadenceMetrics,
    date,
    month: point.label,
    evotorAmount: Number(point.amount ?? 0),
    evotorCash: Number(point.cashAmount ?? 0),
    evotorCashless: Number(point.cashlessAmount ?? 0),
    evotorChecks: Number(point.checks ?? 0),
    evotorAverage: point.checks ? Number(point.amount ?? 0) / Number(point.checks) : 0,
  }));
}
const expenseBreakdownMetrics: CadenceMetric[] = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driverCash", "utilitiesCash", "operatingCosts", "cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax", "salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash", "cashTaxes"];
const cashlessBreakdownMetrics: CadenceMetric[] = ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax", "salaryCashless", "payrollTax", "vacationCashless", "vacationTax"];

export default function OperationalCadence() {
  const { selectedStores, range, rangeLabel, demoMode } = useAudit();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const storeDirectory = trpc.audit.stores.useQuery(undefined, { retry: false, enabled: !demoMode });
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedMetrics, setSelectedMetrics] = useState<CadenceMetric[]>(["netProfit"]);
  const [showStoreSeries, setShowStoreSeries] = useState(false);
  const [comparePeriod, setComparePeriod] = useState(false);
  const [chartTableQuery, setChartTableQuery] = useState("");
  const [expenseTableQuery, setExpenseTableQuery] = useState("");
  const comparableRange = useMemo(() => previousComparableRange(range), [range.from, range.to]);
  const facts = useAuditFacts({ comparisonRange: comparePeriod ? comparableRange : undefined });
  const selectedConcreteStores = selectedStores;
  const networkSelected = selectedStores.length === 0;
  // A range with no daily rows is not the same as an absent workbook. The
  // selector must remain available for Excel facts in the former case.
  const evotorOnlyMode = !demoMode && !facts.financialCoverageLoading && !facts.hasAnyFinancialFacts;
  const financialRangeEmpty = !demoMode && facts.hasAnyFinancialFacts && !facts.available;
  const evotorStoreDirectory = useMemo(() => (storeDirectory.data ?? []).filter(store => !store.isHidden), [storeDirectory.data]);
  const availableStoreNames = facts.available ? facts.storeNames : evotorStoreDirectory.map(store => store.name);
  const seriesStores = networkSelected ? availableStoreNames : selectedConcreteStores;
  const scope = networkSelected ? "Все магазины" : selectedConcreteStores.length === 1 ? selectedConcreteStores[0] : `${selectedConcreteStores.length} магазина`;
  const rows = useMemo(() => networkSelected ? facts.rowsFor("__all__") : selectedConcreteStores.flatMap(store => facts.rowsFor(store)), [facts.rowsFor, networkSelected, selectedConcreteStores]);
  const previousRows = useMemo(() => networkSelected ? facts.comparisonRowsFor("__all__") : selectedConcreteStores.flatMap(store => facts.comparisonRowsFor(store)), [facts.comparisonRowsFor, networkSelected, selectedConcreteStores]);
  const cadence = useMemo(() => buildOperationalCadence(rows, range), [rows, range]);
  const previousCadence = useMemo(() => buildOperationalCadence(previousRows, comparableRange), [previousRows, comparableRange]);
  const source = granularity === "month" ? cadence.monthly as CadencePoint[] : granularity === "week" ? cadence.weekly as CadencePoint[] : granularity === "day" ? cadence.daily as CadencePoint[] : [];
  const previousSource = granularity === "month" ? previousCadence.monthly as CadencePoint[] : granularity === "week" ? previousCadence.weekly as CadencePoint[] : granularity === "day" ? previousCadence.daily as CadencePoint[] : [];
  const evotorStoreIds = useMemo(() => networkSelected ? undefined : selectedConcreteStores
    .map(storeName => facts.summaries.find(summary => summary.store === storeName)?.storeId ?? evotorStoreDirectory.find(store => store.name === storeName)?.id)
    .filter((storeId): storeId is number => Number.isInteger(storeId)), [evotorStoreDirectory, facts.summaries, networkSelected, selectedConcreteStores]);
  const evotorRange = useMemo(() => ({ from: range.from < "2025-01-01" ? "2025-01-01" : range.from, to: range.to }), [range.from, range.to]);
  const previousEvotorRange = useMemo(() => ({ from: comparableRange.from < "2025-01-01" ? "2025-01-01" : comparableRange.from, to: comparableRange.to }), [comparableRange.from, comparableRange.to]);
  const needsEvotorFacts = selectedMetrics.some(metric => metric.startsWith("evotor"));
  // Demo mode is wholly synthetic: receipt facts and cached data are not read.
  // Receipt rows are loaded only when a receipt fact is selected. This prevents a
  // large read-only receipt aggregation from delaying the initial financial Rhythm
  // screen, whose default metric comes entirely from the imported workbook.
  const evotorFacts = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery({ ...evotorRange, granularity, storeIds: evotorStoreIds, includeProducts: false }, { ...evotorAnalyticsQueryOptions, enabled: !demoMode && needsEvotorFacts && range.to >= "2025-01-01" });
  const previousEvotorFacts = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery({ ...previousEvotorRange, granularity, storeIds: evotorStoreIds, includeProducts: false }, { ...evotorAnalyticsQueryOptions, enabled: !demoMode && comparePeriod && needsEvotorFacts && comparableRange.to >= "2025-01-01" });
  const mayReadEvotorStock = !demoMode && me.data?.role === "admin";
  const evotorStockSnapshot = trpc.inventoryRegistry.evotorStockSnapshot.useQuery({ storeIds: evotorStoreIds }, { retry: false, enabled: mayReadEvotorStock });
  const evotorTimeline = demoMode ? [] : evotorFacts.data?.timeline ?? [];
  const previousEvotorTimeline = demoMode ? [] : previousEvotorFacts.data?.timeline ?? [];
  const evotorSummary = demoMode ? { checks: 0 } : evotorFacts.data?.summary ?? { checks: 0 };
  const stockSnapshot = evotorStockSnapshot.data as EvotorStockSnapshot | undefined;
  const mergedSource = useMemo(() => {
    if (granularity === "hour") return evotorTimelinePoints(evotorTimeline);
    const byKey = new Map<string, { amount: number; cashAmount: number; cashlessAmount: number; checks: number }>();
    for (const row of evotorTimeline) {
      const current = byKey.get(row.key) ?? { amount: 0, cashAmount: 0, cashlessAmount: 0, checks: 0 };
      current.amount += Number(row.amount ?? 0);
      current.cashAmount += Number(row.cashAmount ?? 0);
      current.cashlessAmount += Number(row.cashlessAmount ?? 0);
      current.checks += Number(row.checks ?? 0);
      byKey.set(row.key, current);
    }
    return source.map(point => {
      const receipts = byKey.get(point.date) ?? { amount: 0, cashAmount: 0, cashlessAmount: 0, checks: 0 };
      return { ...point, evotorAmount: receipts.amount, evotorCash: receipts.cashAmount, evotorCashless: receipts.cashlessAmount, evotorChecks: receipts.checks, evotorAverage: receipts.checks ? receipts.amount / receipts.checks : 0 };
    });
  }, [evotorTimeline, granularity, source]);
  const previousMergedSource = useMemo(() => {
    if (granularity === "hour") return evotorTimelinePoints(previousEvotorTimeline);
    const byKey = new Map<string, { amount: number; cashAmount: number; cashlessAmount: number; checks: number }>();
    for (const row of previousEvotorTimeline) {
      const current = byKey.get(row.key) ?? { amount: 0, cashAmount: 0, cashlessAmount: 0, checks: 0 };
      current.amount += Number(row.amount ?? 0);
      current.cashAmount += Number(row.cashAmount ?? 0);
      current.cashlessAmount += Number(row.cashlessAmount ?? 0);
      current.checks += Number(row.checks ?? 0);
      byKey.set(row.key, current);
    }
    return previousSource.map(point => {
      const receipts = byKey.get(point.date) ?? { amount: 0, cashAmount: 0, cashlessAmount: 0, checks: 0 };
      return { ...point, evotorAmount: receipts.amount, evotorCash: receipts.cashAmount, evotorCashless: receipts.cashlessAmount, evotorChecks: receipts.checks, evotorAverage: receipts.checks ? receipts.amount / receipts.checks : 0 };
    });
  }, [previousEvotorTimeline, granularity, previousSource]);
  const primaryMetric = selectedMetrics[0] ?? "netProfit";
  const visibleSource = mergedSource.filter(point => selectedMetrics.some(metric => point[metric] !== 0));
  const previousVisibleSource = previousMergedSource.filter(point => selectedMetrics.some(metric => point[metric] !== 0));
  const data: Array<Record<string, string | number>> = visibleSource.map(point => ({ month: point.month, ...Object.fromEntries(selectedMetrics.map(metric => [metric, point[metric] / 1000])) }));
  const previousData: Array<Record<string, string | number>> = previousVisibleSource.map(point => ({ month: point.month, ...Object.fromEntries(selectedMetrics.map(metric => [metric, point[metric] / 1000])) }));
  const perStoreData = useMemo(() => {
    if (!showStoreSeries || comparePeriod || seriesStores.length < 2 || selectedMetrics.length !== 1) return null;
    const metric = selectedMetrics[0];
    const byPeriod = new Map<string, Record<string, string | number>>();

    // The Rhythm's "Ряды" mode must retain the source of the selected fact.
    // Financial facts come from the imported workbook, whereas receipt facts
    // come only from the read-only Evotor timeline already loaded for this view.
    if (metric.startsWith("evotor")) {
      for (const point of evotorTimeline) {
        if (!seriesStores.includes(point.storeName)) continue;
        const rawValue = metric === "evotorAmount" ? point.amount
          : metric === "evotorCash" ? point.cashAmount
          : metric === "evotorCashless" ? point.cashlessAmount
          : metric === "evotorChecks" ? point.checks
          : point.checks ? point.amount / point.checks : 0;
        if (!rawValue) continue;
        const current = byPeriod.get(point.key) ?? { month: point.label };
        // All Rhythm chart series are scaled in thousands. Counts use the same
        // internal scale and receive their own number formatter in the table.
        current[point.storeName] = rawValue / 1000;
        byPeriod.set(point.key, current);
      }
      return Array.from(byPeriod.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
    }

    seriesStores.forEach(storeName => {
      const storeCadence = buildOperationalCadence(facts.rowsFor(storeName), range);
      const storeSource = granularity === "month" ? storeCadence.monthly : granularity === "week" ? storeCadence.weekly : storeCadence.daily;
      storeSource.filter(point => point[metric] !== 0).forEach(point => {
        const current = byPeriod.get(point.date) ?? { month: point.month };
        current[storeName] = point[metric] / 1000;
        byPeriod.set(point.date, current);
      });
    });
    return Array.from(byPeriod.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
  }, [comparePeriod, evotorTimeline, facts.rowsFor, granularity, range, selectedMetrics, seriesStores, showStoreSeries]);
  const comparisonData = useMemo(() => {
    // A Moscow hour profile is not a chronological series: 12:00 must always
    // compare with 12:00 in the analogous range, never with the reversed 17:00.
    const pairs = granularity === "hour"
      ? data.map(active => ({ active, previous: previousData.find(previous => previous.month === active.month) ?? null }))
      : reverseComparableRows(data, previousData);
    return pairs.map(({ active, previous }) => ({
      ...active,
      ...Object.fromEntries(selectedMetrics.map(metric => [previousSeriesKey(metric), Number(previous?.[metric] ?? 0)])),
    }));
  }, [data, granularity, previousData, selectedMetrics]);
  const chartData = perStoreData ?? (comparePeriod ? comparisonData : data);
  const checksOnly = selectedMetrics.length === 1 && selectedMetrics[0] === "evotorChecks";
  const chartLines = perStoreData
    ? seriesStores.map((storeName, index) => ({ key: storeName, name: storeName, color: Object.values(metrics)[index % Object.keys(metrics).length].color, quantityUnit: checksOnly ? "check" : undefined }))
    : comparePeriod
	      ? selectedMetrics.flatMap(metric => ([
        { key: metric, name: metrics[metric].label, color: metrics[metric].color, quantityUnit: metric === "evotorChecks" ? "check" : undefined },
        { key: previousSeriesKey(metric), name: `${metrics[metric].label} · пред. период`, color: `${metrics[metric].color}99`, comparison: true, quantityUnit: metric === "evotorChecks" ? "check" : undefined },
	      ]))
	      : selectedMetrics.map(metric => ({ key: metric, name: metrics[metric].label, color: metrics[metric].color, quantityUnit: metric === "evotorChecks" ? "check" : undefined }));
	  const comparableRangeLabel = `${comparableRange.from.split("-").reverse().join(".")} — ${comparableRange.to.split("-").reverse().join(".")}`;
	  const total = mergedSource.reduce((sum, point) => sum + point[primaryMetric], 0);
	  const importedStockValue = !facts.available ? null : networkSelected
	    ? facts.network.stockClose
	    : selectedConcreteStores.reduce((sum, storeName) => sum + (facts.summaries.find(summary => summary.store === storeName)?.stockClose ?? 0), 0);
  const cashTotal = source.reduce((sum, point) => sum + point.cashExpenses + point.cashTaxes, 0);
  const cashShare = facts.network.revenue ? cashTotal / facts.network.revenue * 100 : 0;
  const cashBreakdown = source.map(point => ({ month: point.month, household: point.household / 1000, delivery: point.delivery / 1000, cleaning: point.cleaning / 1000, bonus: point.bonus / 1000, seniority: point.seniority / 1000, supplement: point.supplement / 1000, driverCash: point.driverCash / 1000, utilitiesCash: point.utilitiesCash / 1000, operatingCosts: point.operatingCosts / 1000 }));
  const expenseBreakdown = source.map(point => ({ month: point.month, ...Object.fromEntries(expenseBreakdownMetrics.map(metric => [metric, point[metric] / 1000])) }));
  const expenseBreakdownLines = expenseBreakdownMetrics.map(metric => ({ key: metric, name: metrics[metric].label, color: metrics[metric].color }));
  const expenseBreakdownLedger = expenseBreakdownMetrics.map(metric => ({ metric, label: metrics[metric].label, amount: source.reduce((sum, point) => sum + point[metric], 0) }));
  const expenseBreakdownRows = expenseBreakdownLedger.filter(row => chartTableMatches(expenseTableQuery, row.label, row.amount));
  const expenseBreakdownTotal = expenseBreakdownRows.reduce((sum, row) => sum + row.amount, 0);
  const cashlessBreakdown = source.map(point => ({ month: point.month, ...Object.fromEntries(cashlessBreakdownMetrics.map(metric => [metric, point[metric] / 1000])) }));
  const cashlessBreakdownLines = cashlessBreakdownMetrics.map(metric => ({ key: metric, name: metrics[metric].label, color: metrics[metric].color }));
  const tableRows = [...chartData].slice(-8).reverse();
  const intervalRows = [...visibleSource].slice(-8).reverse();
  const chartTableRows = chartData.filter(point => {
    const values = point as Record<string, string | number | undefined>;
    return chartTableMatches(chartTableQuery, point.month, ...chartLines.map(line => values[line.key]));
  });
  const chartTableTotals = chartLines.map(line => chartTableRows.reduce((sum, point) => sum + Number((point as Record<string, string | number | undefined>)[line.key] ?? 0), 0));
  const title = selectedMetrics.length === 1 ? metrics[primaryMetric].label : `${selectedMetrics.length} показателя`;
  const detailLabel = granularity === "month" ? "Итог по календарным месяцам" : granularity === "week" ? "Итог по календарным неделям" : granularity === "day" ? "Итог по календарным дням" : "Профиль по московским часам выбранного периода · только Эвотор";
  const formatCadenceValue = (value: number, metric: CadenceMetric) => metric === "evotorChecks" ? new Intl.NumberFormat("ru-RU").format(value) : formatTableAmount(value / 1000);
  const formatCadenceKpi = (value: number, metric: CadenceMetric) => metric === "evotorChecks" ? new Intl.NumberFormat("ru-RU").format(value) : formatK(value / 1000);
  const metricForChartLine = (key: string): CadenceMetric => key.startsWith("previous:") ? key.slice("previous:".length) as CadenceMetric : key as CadenceMetric;

  const toggleMetric = (metric: CadenceMetric) => setSelectedMetrics(current => {
    if (current.includes(metric)) return current.length === 1 ? current : current.filter(value => value !== metric);
    return [...current, metric];
  });

  useEffect(() => {
    if (!demoMode) return;
    setSelectedMetrics(current => {
      const nonEvotor = current.filter(metric => !metric.startsWith("evotor"));
      return nonEvotor.length ? nonEvotor : ["netProfit"];
    });
  }, [demoMode]);

  // Receipt facts are a separate read-only source.  A day already loaded from
  // Evotor must remain available even when the financial Excel workbook has no
  // matching period (or has never been imported).
  useEffect(() => {
    if (!evotorOnlyMode) return;
    setSelectedMetrics(current => current.some(metric => metric.startsWith("evotor")) ? current : ["evotorAmount"]);
  }, [evotorOnlyMode]);

  useEffect(() => {
    if (granularity !== "hour") return;
    setSelectedMetrics(current => current.some(metric => metric.startsWith("evotor")) ? current.filter(metric => metric.startsWith("evotor")) : ["evotorAmount"]);
  }, [granularity]);

  const visibleMetricGroups = useMemo(() => demoMode
    ? metricGroups.map(group => ({ ...group, keys: group.keys.filter(metric => !metric.startsWith("evotor")) })).filter(group => group.keys.length)
    : evotorOnlyMode || granularity === "hour"
      ? metricGroups.map(group => ({ ...group, keys: group.keys.filter(metric => metric.startsWith("evotor")) })).filter(group => group.keys.length)
      : metricGroups, [demoMode, evotorOnlyMode, granularity]);

  return <AuditShell kicker="08 / ОПЕРАЦИОННЫЙ РИТМ" title="Неделя, день и месяц: расчетный срез">
    {demoMode && facts.loading ? <FactsLoader/> : !facts.available && demoMode ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для расчетного среза</h2><p>Подтвердите импорт Excel, чтобы увидеть месячную, недельную и дневную динамику.</p></section> : <>
      <section className="page-lede"><div><h2>{evotorOnlyMode ? "Ритм по уже загруженным чекам Эвотор" : financialRangeEmpty ? "В выбранном периоде нет финансовых строк Excel" : "Операционный ритм по фактическим дням"}</h2><p>{evotorOnlyMode ? <>Финансовая книга Excel еще не импортирована. Поэтому здесь доступны только <b>read-only факты чеков Эвотор</b>: они не подменяют выручку, расходы, прибыль или остатки из книги.</> : financialRangeEmpty ? <>Книга Excel в системе есть, но за выбранные даты финансовых строк пока нет. <b>Список всех финансовых фактов сохранен</b>: выберите нужный показатель, чтобы видеть отсутствие данных без подмены нулями, или выберите факт Эвотор для read-only чеков.</> : <>Продажи, закупки, списания и остальные операционные показатели берутся из <b>первичных дневных строк</b> книги. Согласованные ежемесячные статьи уже материализованы по календарным дням во время импорта. НДФЛ 22%, банк и налоги остаются на фактической дате. Остатки здесь не распределяются.</>}</p></div></section>
      <section className="packet-kpis equal cadence-kpis"><article className="packet-kpi cadence-primary-kpi"><span>{metrics[primaryMetric].label} · {scope}</span><strong>{formatCadenceKpi(total, primaryMetric)}</strong><small>{rangeLabel}{selectedMetrics.length > 1 ? ` · в графике ${selectedMetrics.length} показателя` : ""}</small></article>{granularity !== "hour" && <article className="packet-kpi"><span>Наличные + НДФЛ 22%</span><strong>{formatK(cashTotal / 1000)}</strong><small>{cashShare.toFixed(1)}% выручки · контроль сокращения</small></article>}<article className="packet-kpi"><span>Чеки Эвотор в срезе</span><strong>{needsEvotorFacts ? new Intl.NumberFormat("ru-RU").format(evotorSummary.checks) : "—"}</strong><small>{demoMode ? "в демо режиме реальные чеки не читаются" : needsEvotorFacts ? "только уже загруженные документы продажи" : "выберите факт Эвотор для загрузки"}</small></article><article className="packet-kpi"><span>Магазины с чеками Эвотор</span><strong>{needsEvotorFacts ? `${new Set(evotorTimeline.map(row => row.storeId)).size} / ${demoMode ? 0 : evotorFacts.data?.stores.length ?? 0}` : "—"}</strong><small>{demoMode ? "в демо режиме реальные точки не читаются" : needsEvotorFacts ? "это coverage выбранного периода, не прогресс минутного обхода" : "появятся для выбранного факта Эвотор"}</small></article></section>
      {!demoMode && <section className="packet-card cadence-stock-facts" aria-label="Независимые факты остатков"><div className="card-title"><div><span>ТОВАРНЫЙ ПОТОК · НЕЗАВИСИМЫЕ ОСТАТКИ</span><h3>Остаток импорт и остаток Эвотор</h3></div><small>{scope}</small></div><div className="cadence-stock-facts-grid"><article><span>Остаток импорт</span><strong>{importedStockValue === null ? "—" : formatK(importedStockValue / 1000)}</strong><small>{importedStockValue === null ? "за срез нет строки остатка из Excel" : `денежный остаток на конец среза · ${rangeLabel}`}</small></article><article><span>Остаток Эвотор</span>{evotorStockSnapshot.isLoading ? <strong>проверяем…</strong> : stockSnapshot?.units.length ? <strong className="cadence-stock-unit-list">{stockSnapshot.units.map(item => <b key={item.unit}>{formatEvotorStockQuantity(item.quantity, item.unit)}</b>)}</strong> : <strong>—</strong>}<small>{stockSnapshot?.units.length ? `read-only снимок ${stockSnapshot.positions} поз. · ${formatMoscowDateTime(stockSnapshot.snapshotAt, { seconds: true })}` : "в каталоге выбранных точек нет актуального снимка"}</small></article></div><p className="packet-note"><Layers3 size={15}/> «Остаток импорт» — деньги из Excel; «Остаток Эвотор» — все сохраненные физические количества из read-only каталога. Кг, л и шт показаны раздельно, поэтому не подменяются одной суммой и не строятся на одном денежном графике.</p></section>}
      <section className="packet-card cadence-chart-card"><div className="card-title"><div><span>РАСЧЕТНАЯ ДИНАМИКА · {scope}</span><h3>{detailLabel} · {perStoreData ? `${title}: каждый магазин отдельно` : comparePeriod ? `${title}: ${rangeLabel} и ${comparableRangeLabel}` : title}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация ритма">{(["month", "week", "day", "hour"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => { setGranularity(level); if (level === "hour") setSelectedMetrics(current => current.some(metric => metric.startsWith("evotor")) ? current.filter(metric => metric.startsWith("evotor")) : ["evotorAmount"]); }}>{level === "hour" ? "Часы" : level === "day" ? "Дни" : level === "week" ? "Недели" : "Месяцы"}</button>)}</div>{seriesStores.length > 1 && selectedMetrics.length === 1 && <StoreSeriesModeToggle active={showStoreSeries} onChange={() => { setShowStoreSeries(current => !current); setComparePeriod(false); }}/>}</div></div><div className="cadence-metrics-picker" aria-label="Выберите показатели для сравнения"><div className="cadence-picker-heading"><span>Показатели для сравнения</span><small>{granularity === "hour" ? "только факты Эвотор по МСК; «Ряды» — по магазинам" : "без лимита; минимум один"}</small></div><aside className="cadence-source-contract" aria-label="Правило источников фактов"><strong>Источники фактов</strong><span><b>Excel</b> — первичные P&amp;L, закупки, списания, расходы и остаток в деньгах.</span><span><b>Сайт → Excel</b> — переданные одноимённые наличные/безналичные факты заменяют Excel, не складываются с ним; пустое или нулевое поле оставляет Excel.</span><span><b>Эвотор</b> — отдельные read-only чеки, оплаты, товары и физический остаток; не подменяют P&amp;L.</span></aside>{visibleMetricGroups.map(group => <div className={`cadence-metric-group ${group.label === "Наличные расходы и налоги" ? "cash-control-group" : ""}`} key={group.label}><div className="cadence-group-label"><span>{group.label}</span></div><div>{group.keys.map(metric => { const selected = selectedMetrics.includes(metric); return <button type="button" key={metric} title={factSourceLabel(metric)} aria-label={`${metrics[metric].label} · ${factSourceLabel(metric)}`} aria-pressed={selected} onClick={() => toggleMetric(metric)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: metrics[metric].color }}/>{metrics[metric].label}</button>; })}</div></div>)}</div>{chartData.length ? <MetricLineChart data={chartData} lines={chartLines} displayMode={checksOnly ? "number" : undefined} comparisonControl={() => <ChartPeriodComparisonToggle active={comparePeriod} onChange={() => { setComparePeriod(current => !current); setShowStoreSeries(false); }}/>} /> : <p className="packet-note cadence-range-empty" role="status"><FileSpreadsheet size={15}/> За выбранные даты нет строк для выбранных фактов. Показатели не скрыты: измените период, магазин или выберите read-only факт Эвотор.</p>}<p className="packet-note"><Calculator size={15}/> {comparePeriod ? granularity === "hour" ? `Предыдущий период ${comparableRangeLabel} сопоставлен с теми же московскими часами.` : `Предыдущий период ${comparableRangeLabel} показан обратным рядом: даты активного периода не меняют направление.` : perStoreData ? `${metrics[primaryMetric].label}: на графике и в таблице каждая точка показана отдельным рядом.` : selectedMetrics.length === 1 ? `${metrics[primaryMetric].note} Источник: ${factSourceLabel(primaryMetric)}.` : "Сопоставляйте показатели одной операционной задачи. При большом числе рядов выбирайте режим «Наложение» и опирайтесь на таблицу под графиком."} {!perStoreData && !comparePeriod && "Выбранные магазины суммируются до построения ряда."}</p></section>
      <section className="packet-card cadence-detail-table"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${title}: каждый магазин отдельно` : comparePeriod ? "Активный и аналогичный предыдущий период" : "Все интервалы активного среза"}</h3></div><small>{granularity === "month" ? "месяцы" : granularity === "week" ? "недели" : granularity === "day" ? "дни" : "часы МСК"}</small></div><ChartTableSearch value={chartTableQuery} onChange={setChartTableQuery} placeholder="Поиск интервала или значения" ariaLabel="Поиск в таблице под графиком Ритма" shownRows={chartTableRows.length} totalRows={chartData.length}/><div className="data-table-wrap cadence-full-table"><table className="data-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : granularity === "day" ? "Дата" : "Час МСК"}</th>{chartLines.map(line => <th className="numeric-column" key={line.key}>{line.name}</th>)}</tr></thead><tbody>{chartTableRows.map((point, index) => { const values = point as Record<string, string | number | undefined>; return <tr key={`${String(point.month)}-${index}`}><td>{String(point.month)}</td>{chartLines.map(line => <td className="numeric-column" key={line.key}>{formatCadenceValue(Number(values[line.key] ?? 0) * 1_000, perStoreData ? primaryMetric : metricForChartLine(line.key))}</td>)}</tr>; })}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th>{chartTableTotals.map((value, index) => <td className="numeric-column" key={chartLines[index].key}>{formatCadenceValue(value * 1_000, perStoreData ? primaryMetric : metricForChartLine(chartLines[index].key))}</td>)}</tr></tfoot></table></div><p className="packet-note">Таблица повторяет каждый интервал, построенный в графике. Нажмите на заголовок столбца, чтобы отсортировать данные.</p></section>
      {selectedMetrics.includes("cashExpenses") && <section className="packet-card cash-breakdown-card"><div className="card-title"><div><span>СОСТАВ ТРАТ НАЛ · {scope}</span><h3>Какие наличные статьи формируют расход</h3><small>Каждая линия — отдельная исходная статья, без включения НДФЛ 22%</small></div></div><MetricLineChart data={cashBreakdown} lines={[{key:"household",name:"Хоз. нужды нал",color:"#ff8b6f"},{key:"delivery",name:"Доставка нал",color:"#ffbf69"},{key:"cleaning",name:"Уборка нал",color:"#7dcbff"},{key:"bonus",name:"Премия нал",color:"#e88af0"},{key:"seniority",name:"Выслуга нал",color:"#b49bff"},{key:"supplement",name:"Доплата нал",color:"#ff7f9d"},{key:"driverCash",name:"Водитель нал",color:"#67d6b5"},{key:"utilitiesCash",name:"Ком. плат. нал",color:"#6ba4ff"},{key:"operatingCosts",name:"Расходы нал",color:"#d9d75c"}]}/><p className="packet-note"><Calculator size={15}/> Цель — снизить управляемые наличные траты и связанный с ними НДФЛ 22%, не теряя необходимых операционных действий.</p></section>}
      {selectedMetrics.includes("expenses") && <section className="packet-card expense-breakdown-card"><div className="card-title"><div><span>СОСТАВ РАСХОДОВ · {scope}</span><h3>Какие исходные статьи формируют общую расходную нагрузку</h3><small className="expense-breakdown-note">Показаны отдельные фактические статьи без строки «Расходы» и без двойного учета агрегатов.</small></div></div><MetricLineChart data={expenseBreakdown} lines={expenseBreakdownLines}/><ChartTableSearch value={expenseTableQuery} onChange={setExpenseTableQuery} placeholder="Поиск статьи расхода" ariaLabel="Поиск в таблице состава расходов" shownRows={expenseBreakdownRows.length} totalRows={expenseBreakdownLedger.length}/><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Исходная статья</th><th className="numeric-column">Сумма</th></tr></thead><tbody>{expenseBreakdownRows.map(row => <tr key={row.metric}><td>{row.label}</td><td className="numeric-column">{formatK(row.amount / 1000)}</td></tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого</th><td className="numeric-column">{formatK(expenseBreakdownTotal / 1000)}</td></tr></tfoot></table></div><p className="packet-note"><Calculator size={15}/> Используйте состав для проверки источника расхода: наличные, безналичные, ФОТ, налоги, аренда, банк и прочие статьи остаются отдельными рядами.</p></section>}
      {selectedMetrics.includes("cashlessExpenses") && <section className="packet-card cashless-breakdown-card"><div className="card-title"><div><span>СОСТАВ ТРАТ Б/НАЛ · {scope}</span><h3>Какие безналичные статьи формируют расход</h3><small>Показаны отдельные безналичные, ФОТ, налоговые, банковские и арендные строки без итогового дубля.</small></div></div><MetricLineChart data={cashlessBreakdown} lines={cashlessBreakdownLines}/><p className="packet-note"><Calculator size={15}/> Используйте состав для проверки источника безналичной нагрузки: аренда, ФОТ, налоги, банк, коммунальные и операционные расходы остаются отдельными рядами.</p></section>}
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>КАК ЧИТАТЬ СРЕЗ</span><h3>Разделение источников</h3></div><Layers3 size={19}/></div><div className="detail-stat"><span>Продажи, закупки, списания, НДФЛ, банк и налоги</span><strong>фактический день</strong></div><div className="detail-stat"><span>Аренда, зарплата, отпускные и согласованные расходы</span><strong>материализованы по дням при импорте</strong></div><div className="detail-stat"><span>Итоговая чистая прибыль</span><strong>материализована по расходной нагрузке дней</strong></div><div className="detail-stat"><span>Остаток на начало / конец</span><strong>не входит</strong></div><p className="packet-note">Для управления темпом продаж, прибылью, закупками, товарными перемещениями и уценкой используйте этот раздел. Для остатков и покрытия используйте отдельную страницу «Остатки».</p></article><article className="packet-card"><div className="card-title"><div><span>ПОСЛЕДНИЕ ИНТЕРВАЛЫ</span><h3>{title}</h3></div><CalendarDays size={19}/></div><div className="cadence-interval-list">{intervalRows.map(point => { const [period, year] = point.month.split(" · "); return <div className="cadence-interval-card" key={point.date}><div className="cadence-interval-period"><b>{period}</b>{year && <small>{year}</small>}</div><div className="cadence-interval-values">{selectedMetrics.map(metric => <div key={metric}><span>{metrics[metric].label}</span><strong>{formatK(point[metric] / 1000)}</strong></div>)}</div></div>; })}</div></article></section>
    </>}
  </AuditShell>;
}
