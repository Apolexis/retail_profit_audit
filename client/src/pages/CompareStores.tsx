import { useMemo, useState } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { FileSpreadsheet } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK, formatPct, type MetricChartTooltipMode } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { expenseDefinitions, useAuditFacts, type ExpenseCode, type FactSummary } from "@/hooks/useAuditFacts";

type Mode = "stores" | "periods";
type SummaryMetric = "revenue" | "cashRevenue" | "cashlessRevenue" | "receiptsTotal" | "grossProfit" | "netProfit" | "expenses" | "purchases" | "purchaseSmoked" | "purchaseFrozen" | "salesSmoked" | "salesFrozen" | "stockOpen" | "stockClose" | "stockChange" | "writeoffSmoked" | "writeoffFrozen" | "netMargin" | "grossMargin" | "markup" | "markupSmoked" | "markupFrozen" | "markupTotal" | "coverDays";
type ComparisonMetric = SummaryMetric | `expense:${ExpenseCode}`;
type MetricKind = "money" | "percent" | "number";
type MetricMeta = { label: string; kind: MetricKind };

const summaryMetrics: Record<SummaryMetric, MetricMeta> = {
  revenue: { label: "Продажи общие", kind: "money" }, cashRevenue: { label: "Выручка нал", kind: "money" }, cashlessRevenue: { label: "Выручка б/нал", kind: "money" }, receiptsTotal: { label: "Выручка общая", kind: "money" }, grossProfit: { label: "Валовая прибыль", kind: "money" }, netProfit: { label: "Чистая прибыль", kind: "money" }, expenses: { label: "Все расходы", kind: "money" }, purchases: { label: "Закупки", kind: "money" }, purchaseSmoked: { label: "Закупка Коп.", kind: "money" }, purchaseFrozen: { label: "Закупка Мор.", kind: "money" }, salesSmoked: { label: "Продажи Коп.", kind: "money" }, salesFrozen: { label: "Продажи Мор.", kind: "money" }, stockOpen: { label: "Остаток на начало", kind: "money" }, stockClose: { label: "Остаток на конец", kind: "money" }, stockChange: { label: "Изменение остатка", kind: "money" }, writeoffSmoked: { label: "Списания К.", kind: "money" }, writeoffFrozen: { label: "Списания М.", kind: "money" }, netMargin: { label: "Чистая маржа", kind: "percent" }, grossMargin: { label: "Валовая маржа", kind: "percent" }, markup: { label: "% наценки Общий", kind: "percent" }, markupSmoked: { label: "% наценки Коп.", kind: "percent" }, markupFrozen: { label: "% наценки Мор.", kind: "percent" }, markupTotal: { label: "% наценки Общий", kind: "percent" }, coverDays: { label: "Дней покрытия", kind: "number" },
};

const metricGroups: Array<{ label: string; metrics: ComparisonMetric[] }> = [
  { label: "Выручка и финансовый результат", metrics: ["receiptsTotal", "cashRevenue", "cashlessRevenue", "revenue", "grossProfit", "netProfit", "expenses"] },
  { label: "Продажи и закупки", metrics: ["purchases", "purchaseSmoked", "purchaseFrozen", "salesSmoked", "salesFrozen"] },
  { label: "Остатки и потери", metrics: ["stockOpen", "stockClose", "stockChange", "writeoffSmoked", "writeoffFrozen", "coverDays"] },
  { label: "Маржинальность и наценка", metrics: ["grossMargin", "netMargin", "markupSmoked", "markupFrozen", "markupTotal"] },
  { label: "Детализация расходов", metrics: expenseDefinitions.map(([code]) => `expense:${code}` as ComparisonMetric) },
];

const money = (amount: number) => formatK(amount / 1000);
const monthIso = (date: string) => format(parseISO(date), "yyyy-MM");

function metaFor(metric: ComparisonMetric): MetricMeta {
  if (!metric.startsWith("expense:")) return summaryMetrics[metric as SummaryMetric];
  const code = metric.slice("expense:".length);
  return { label: expenseDefinitions.find(([key]) => key === code)?.[1] ?? code, kind: "money" };
}

function valueFor(summary: FactSummary, metric: ComparisonMetric) {
  if (metric === "stockChange") return summary.stockClose - summary.stockOpen;
  if (metric.startsWith("expense:")) return Math.abs(summary.expenseByCode[metric.slice("expense:".length)] ?? 0);
  return Number((summary as Record<string, unknown>)[metric]);
}

function displayValue(value: number, kind: MetricKind) {
  if (kind === "percent") return formatPct(value);
  if (kind === "number") return `${value.toFixed(1)} дн.`;
  return money(value);
}

export default function CompareStores() {
  const [onlyVisibleStores,setOnlyVisibleStores]=useState(true);
  const facts = useAuditFacts({includeHidden:!onlyVisibleStores});
  const { selectedStore, range, rangeLabel } = useAudit();
  const [mode, setMode] = useState<Mode>("stores");
  const [left, setLeft] = useState(() => localStorage.getItem("compare-left") ?? "");
  const [right, setRight] = useState(() => localStorage.getItem("compare-right") ?? "");
  const [metric, setMetric] = useState<ComparisonMetric>("netProfit");
  const names = facts.storeNames;
  const effectiveLeft = names.includes(left) ? left : selectedStore !== "__all__" && names.includes(selectedStore) ? selectedStore : names[0] ?? "";
  const effectiveRight = names.includes(right) && right !== effectiveLeft ? right : names.find(name => name !== effectiveLeft) ?? effectiveLeft;
  const metricMeta = metaFor(metric);
  const from = monthIso(range.from);
  const to = monthIso(range.to);
  const monthSpan = Math.max(1, (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1);
  const previousFrom = monthIso(format(addMonths(parseISO(`${from}-01`), -monthSpan), "yyyy-MM-dd"));
  const previousTo = monthIso(format(addMonths(parseISO(`${from}-01`), -1), "yyyy-MM-dd"));
  const summary = (store: string, start = from, end = to) => facts.summaryFor(facts.rowsFor(store).filter(row => row.monthDate >= start && row.monthDate <= end), store);
  const a = summary(effectiveLeft);
  const b = summary(mode === "stores" ? effectiveRight : effectiveLeft, mode === "stores" ? from : previousFrom, mode === "stores" ? to : previousTo);
  const aValue = valueFor(a, metric);
  const bValue = valueFor(b, metric);
  const labelA = mode === "stores" ? effectiveLeft : rangeLabel;
  const labelB = mode === "stores" ? effectiveRight : "Предыдущий сопоставимый период";
  const chartMode: MetricChartTooltipMode = metricMeta.kind === "percent" ? "percent" : metricMeta.kind === "number" ? "number" : "amount";
  const chart = useMemo(() => {
    const first = facts.monthlyFor(effectiveLeft).filter(row => row.monthDate >= from && row.monthDate <= to);
    if (mode === "stores") {
      const second = new Map(facts.monthlyFor(effectiveRight).map(row => [row.monthDate, row]));
      return first.map(row => ({ month: row.month, [labelA]: metricMeta.kind === "money" ? valueFor(row, metric) / 1000 : valueFor(row, metric), [labelB]: metricMeta.kind === "money" ? valueFor(second.get(row.monthDate) ?? b, metric) / 1000 : valueFor(second.get(row.monthDate) ?? b, metric) }));
    }
    const earlier = facts.monthlyFor(effectiveLeft).filter(row => row.monthDate >= previousFrom && row.monthDate <= previousTo);
    return first.map((row, index) => ({ month: row.month, [labelA]: metricMeta.kind === "money" ? valueFor(row, metric) / 1000 : valueFor(row, metric), [labelB]: metricMeta.kind === "money" ? valueFor(earlier[index] ?? b, metric) / 1000 : valueFor(earlier[index] ?? b, metric) }));
  }, [facts, effectiveLeft, effectiveRight, from, to, previousFrom, previousTo, mode, metric, metricMeta.kind, labelA, labelB, b]);
  const save = (side: "left" | "right", value: string) => { if (side === "left") { setLeft(value); localStorage.setItem("compare-left", value); } else { setRight(value); localStorage.setItem("compare-right", value); } };
  const rank = (store: string) => [...facts.summaries].sort((one, two) => two.netProfit - one.netProfit).findIndex(item => item.store === store) + 1;

  return <AuditShell kicker="06 / СРАВНЕНИЕ МАГАЗИНОВ" title="Магазины и периоды: одна рабочая плоскость">
    {facts.loading ? <FactsLoader/> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет данных для сравнения</h2><p>Сначала подтвердите импорт книги Excel. Сохраненные ранее пары магазинов останутся в браузере.</p></section> : <>
      <section className="page-lede"><div><h2>Сравнивайте точки между собой или один магазин во времени.</h2><p>Пара магазинов сохраняется в браузере. В режиме «два магазина» используется активный календарный диапазон: <b>{rangeLabel}</b>. В режиме периода — такой же по длине предыдущий отрезок.</p></div><div className="page-controls"><label>Режим<select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="stores">Два магазина</option><option value="periods">Один магазин · периоды</option></select></label><label className="compare-store-visibility"><span>Состав выбора</span><button type="button" className={onlyVisibleStores?"visibility-toggle active":"visibility-toggle"} aria-pressed={onlyVisibleStores} onClick={()=>setOnlyVisibleStores(value=>!value)}>{onlyVisibleStores?"Только видимые":"Все точки"}</button></label><label>Магазин A<select value={effectiveLeft} onChange={event => save("left", event.target.value)}>{names.map(name => <option key={name} value={name}>{name}</option>)}</select></label>{mode === "stores" && <label>Магазин B<select value={effectiveRight} onChange={event => save("right", event.target.value)}>{names.filter(name => name !== effectiveLeft).map(name => <option key={name} value={name}>{name}</option>)}</select></label>}<label>Показатель<select value={metric} onChange={event => setMetric(event.target.value as ComparisonMetric)}>{metricGroups.map(group => <optgroup label={group.label} key={group.label}>{group.metrics.map(item => <option key={item} value={item}>{metaFor(item).label}</option>)}</optgroup>)}</select></label></div></section>
      <section className="packet-kpis equal"><article className={metricMeta.kind === "money" && aValue < 0 ? "packet-kpi risk" : "packet-kpi"}><span>{metricMeta.label} · {labelA}</span><strong className={metricMeta.kind === "money" ? aValue < 0 ? "negative" : aValue > 0 ? "positive" : "" : ""}>{displayValue(aValue, metricMeta.kind)}</strong><small>{mode === "stores" ? rangeLabel : "текущий срез"}</small></article><article className={metricMeta.kind === "money" && bValue < 0 ? "packet-kpi risk" : "packet-kpi"}><span>{metricMeta.label} · {labelB}</span><strong className={metricMeta.kind === "money" ? bValue < 0 ? "negative" : bValue > 0 ? "positive" : "" : ""}>{displayValue(bValue, metricMeta.kind)}</strong><small>{mode === "stores" ? rangeLabel : `${previousFrom} — ${previousTo}`}</small></article><article className={aValue - bValue < 0 ? "packet-kpi risk" : "packet-kpi"}><span>Разница A − B</span><strong className={aValue - bValue < 0 ? "negative" : aValue - bValue > 0 ? "positive" : ""}>{aValue - bValue > 0 ? "+" : ""}{displayValue(aValue - bValue, metricMeta.kind)}</strong><small>по выбранному показателю</small></article><article className="packet-kpi"><span>{mode === "stores" ? "Ранг по прибыли" : "Магазин"}</span><strong>{mode === "stores" ? `#${rank(effectiveLeft)} / #${rank(effectiveRight)}` : effectiveLeft}</strong><small>{mode === "stores" ? `${effectiveLeft} / ${effectiveRight}` : "одна точка · два среза"}</small></article></section>
      <section className="packet-card"><div className="card-title"><div><span>ПО МЕСЯЦАМ · {metricMeta.label.toUpperCase()}</span><h3>{labelA} против {labelB}</h3></div><small>{metricMeta.kind === "percent" ? "%" : metricMeta.kind === "number" ? "дни" : "млн / тыс. ₽"}</small></div><MetricLineChart data={chart} percent={metricMeta.kind === "percent"} displayMode={chartMode} lines={[{key:labelA,name:labelA,color:"#ff6d8c"},{key:labelB,name:labelB,color:"#b694ff"}]}/></section>
      {mode === "stores" && <section className="packet-card"><div className="card-title"><div><span>ОБЩАЯ КАРТИНА</span><h3>P&L, остаток и операционный масштаб</h3></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Показатель</th><th>{effectiveLeft}</th><th>{effectiveRight}</th></tr></thead><tbody>{[["Выручка общая",money(a.receiptsTotal),money(b.receiptsTotal)],["Выручка нал",money(a.cashRevenue),money(b.cashRevenue)],["Выручка б/нал",money(a.cashlessRevenue),money(b.cashlessRevenue)],["Продажи общие",money(a.revenue),money(b.revenue)],["Чистая прибыль",money(a.netProfit),money(b.netProfit)],["Чистая маржа",formatPct(a.netMargin),formatPct(b.netMargin)],["% наценки Коп.",formatPct(a.markupSmoked),formatPct(b.markupSmoked)],["% наценки Мор.",formatPct(a.markupFrozen),formatPct(b.markupFrozen)],["% наценки Общий",formatPct(a.markupTotal),formatPct(b.markupTotal)],["Конечный остаток",money(a.stockClose),money(b.stockClose)],["Дней покрытия",`${a.coverDays.toFixed(1)} дн.`,`${b.coverDays.toFixed(1)} дн.`],["Списания К.",money(a.writeoffSmoked),money(b.writeoffSmoked)],["Списания М.",money(a.writeoffFrozen),money(b.writeoffFrozen)]].map(row => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div></section>}
    </>}
  </AuditShell>;
}
