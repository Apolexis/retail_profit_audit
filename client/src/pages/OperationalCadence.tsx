import { useMemo, useState } from "react";
import { CalendarDays, Calculator, FileSpreadsheet, Layers3 } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";
import { buildOperationalCadence, type CadenceMetric } from "@/lib/operationalCadence";

const metrics: Record<CadenceMetric, { label: string; color: string; note: string }> = {
  revenue: { label: "Продажи общие", color: "#ffcf7b", note: "Продажи по исходной книге." },
  cashRevenue: { label: "Выручка нал", color: "#55b6ff", note: "Фактическая выручка наличными из исходной книги." },
  cashlessRevenue: { label: "Выручка б/нал", color: "#61d9b5", note: "Фактическая выручка безналично из исходной книги." },
  receiptsTotal: { label: "Выручка общая", color: "#d9bdff", note: "Итог выручки наличными и безналично из исходной книги." },
  grossProfit: { label: "Валовая прибыль", color: "#72a8ff", note: "Разница выручки и закупочной части до операционных расходов." },
  netProfit: { label: "Чистая прибыль", color: "#38d6b0", note: "Результат после учтенных расходов." },
  purchases: { label: "Закупки", color: "#b694ff", note: "Объем пополнения товарного запаса." },
  purchaseSmoked: { label: "Закупка Коп.", color: "#de9a5d", note: "Закупка копченой продукции по фактическим дням." },
  purchaseFrozen: { label: "Закупка Мор.", color: "#7eb9df", note: "Закупка мороженой продукции по фактическим дням." },
  salesSmoked: { label: "Продажи Коп.", color: "#ffab62", note: "Продажи копченой продукции по фактическим дням." },
  salesFrozen: { label: "Продажи Мор.", color: "#49b6d8", note: "Продажи мороженой продукции по фактическим дням." },
  expenses: { label: "Расходы", color: "#ff6d8c", note: "Сумма абсолютных значений расходных статей." },
  cashExpenses: { label: "Общие траты нал", color: "#ff8b6f", note: "Наличные операционные расходы: хоз. нужды, доставка, уборка, премия, выслуга, доплата, водитель, коммунальные и прочие расходы." },
  cashTaxes: { label: "НДФЛ 22%", color: "#e46ba9", note: "Налоговая нагрузка наличных выплат; контролируется вместе с тратами нал." },
  household: { label: "Хоз. нужды нал", color: "#ff8b6f", note: "Наличные хозяйственные нужды." },
  delivery: { label: "Доставка нал", color: "#ffbf69", note: "Наличные расходы на доставку." },
  cleaning: { label: "Уборка нал", color: "#7dcbff", note: "Наличные расходы на уборку." },
  bonus: { label: "Премия нал", color: "#e88af0", note: "Наличные премии." },
  seniority: { label: "Выслуга нал", color: "#b49bff", note: "Наличные выплаты за выслугу." },
  supplement: { label: "Доплата нал", color: "#ff7f9d", note: "Наличные доплаты." },
  driverCash: { label: "Водитель нал", color: "#67d6b5", note: "Наличные выплаты водителю." },
  utilitiesCash: { label: "Ком. плат. нал", color: "#6ba4ff", note: "Наличные коммунальные платежи." },
  operatingCosts: { label: "Расходы нал", color: "#d9d75c", note: "Прочие наличные операционные расходы." },
  cashlessOperatingCosts: { label: "Расходы безналичные", color: "#8eb5ff", note: "Прочие операционные расходы безналично." },
  driverCashless: { label: "Водитель безналично", color: "#58c5a4", note: "Безналичные выплаты водителю." },
  utilitiesCashless: { label: "Коммунальные безналично", color: "#6b9ddc", note: "Безналичные коммунальные платежи." },
  rent: { label: "Аренда б/нал", color: "#e1a1cf", note: "Арендная плата, материализованная по дням при импорте." },
  bankFee: { label: "-% банк", color: "#9ca9be", note: "Банковские комиссии по фактическим датам." },
  grossProfitTax: { label: "Налог с валовой прибыли", color: "#d78a72", note: "Налог с валовой прибыли." },
  salaryCashless: { label: "Зарплата безналично", color: "#b2a0ec", note: "Безналичная зарплата, материализованная по дням при импорте." },
  payrollTax: { label: "Налоги зарплаты", color: "#d7a6a6", note: "Налоги на заработную плату." },
  vacationCashless: { label: "Отпускные безналично", color: "#92c5d4", note: "Безналичные отпускные." },
  vacationTax: { label: "Налоги отпускных", color: "#c4b17d", note: "Налоги на отпускные." },
  salaryCash: { label: "Зарплата нал", color: "#ff9d80", note: "Наличная зарплата." },
  vacationCash: { label: "Отпускные нал", color: "#d890b9", note: "Наличные отпускные." },
  writeoffSmoked: { label: "Списания К.", color: "#d08bff", note: "Списания копченой продукции для операционного контроля." },
  writeoffFrozen: { label: "Списания М.", color: "#e978ff", note: "Прямой расход по мороженой продукции." },
  movement: { label: "Перемещения", color: "#73d5b1", note: "Перемещения товарного запаса между точками." },
  discount: { label: "Уценка", color: "#e69a7c", note: "Уценка как управляемая корректировка товарного потока." },
};

const metricGroups: Array<{ label: string; keys: CadenceMetric[] }> = [
  { label: "Выручка, результат и товар", keys: ["receiptsTotal", "cashRevenue", "cashlessRevenue", "revenue", "grossProfit", "netProfit", "purchases", "purchaseSmoked", "purchaseFrozen", "salesSmoked", "salesFrozen"] },
  { label: "Итоговые расходы", keys: ["expenses"] },
  { label: "Наличные расходы и налоги", keys: ["cashExpenses", "cashTaxes", "household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driverCash", "utilitiesCash", "operatingCosts"] },
  { label: "Безналичные, ФОТ и налоги", keys: ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax", "salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash"] },
  { label: "Товарный поток", keys: ["writeoffSmoked", "writeoffFrozen", "movement", "discount"] },
];

type Granularity = "month" | "week" | "day";

export default function OperationalCadence() {
  const facts = useAuditFacts();
  const { selectedStore, range, rangeLabel } = useAudit();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [selectedMetrics, setSelectedMetrics] = useState<CadenceMetric[]>(["netProfit"]);
  const [selectedStores, setSelectedStores] = useState<string[]>(() => selectedStore !== "__all__" ? [selectedStore] : ["__all__"]);
  const selectedConcreteStores = useMemo(() => selectedStores.filter(store => store !== "__all__"), [selectedStores]);
  const networkSelected = selectedStores.includes("__all__");
  const scope = networkSelected ? "Все магазины" : selectedConcreteStores.length === 1 ? selectedConcreteStores[0] : `${selectedConcreteStores.length} магазина`;
  const rows = useMemo(() => networkSelected ? facts.rowsFor("__all__") : selectedConcreteStores.flatMap(store => facts.rowsFor(store)), [facts.rowsFor, networkSelected, selectedConcreteStores]);
  const cadence = useMemo(() => buildOperationalCadence(rows, range), [rows, range]);
  const source = granularity === "month" ? cadence.monthly : granularity === "week" ? cadence.weekly : cadence.daily;
  const primaryMetric = selectedMetrics[0] ?? "netProfit";
  const visibleSource = source.filter(point => selectedMetrics.some(metric => point[metric] !== 0));
  const data = visibleSource.map(point => ({ month: point.month, ...Object.fromEntries(selectedMetrics.map(metric => [metric, point[metric] / 1000])) }));
  const perStoreData = useMemo(() => {
    if (!networkSelected || selectedMetrics.length !== 1) return null;
    const metric = selectedMetrics[0];
    const byPeriod = new Map<string, Record<string, string | number>>();
    facts.storeNames.forEach(storeName => {
      const storeCadence = buildOperationalCadence(facts.rowsFor(storeName), range);
      const storeSource = granularity === "month" ? storeCadence.monthly : granularity === "week" ? storeCadence.weekly : storeCadence.daily;
      storeSource.filter(point => point[metric] !== 0).forEach(point => {
        const current = byPeriod.get(point.date) ?? { month: point.month };
        current[storeName] = point[metric] / 1000;
        byPeriod.set(point.date, current);
      });
    });
    return Array.from(byPeriod.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
  }, [facts.rowsFor, facts.storeNames, granularity, networkSelected, range, selectedMetrics]);
  const chartData = perStoreData ?? data;
  const chartLines = perStoreData ? facts.storeNames.map((storeName, index) => ({ key: storeName, name: storeName, color: Object.values(metrics)[index % Object.keys(metrics).length].color })) : selectedMetrics.map(metric => ({ key: metric, name: metrics[metric].label, color: metrics[metric].color }));
  const total = source.reduce((sum, point) => sum + point[primaryMetric], 0);
  const cashTotal = source.reduce((sum, point) => sum + point.cashExpenses + point.cashTaxes, 0);
  const cashShare = facts.network.revenue ? cashTotal / facts.network.revenue * 100 : 0;
  const cashBreakdown = source.map(point => ({ month: point.month, household: point.household / 1000, delivery: point.delivery / 1000, cleaning: point.cleaning / 1000, bonus: point.bonus / 1000, seniority: point.seniority / 1000, supplement: point.supplement / 1000, driverCash: point.driverCash / 1000, utilitiesCash: point.utilitiesCash / 1000, operatingCosts: point.operatingCosts / 1000 }));
  const tableRows = [...chartData].slice(-8).reverse();
  const intervalRows = [...visibleSource].slice(-8).reverse();
  const title = selectedMetrics.length === 1 ? metrics[primaryMetric].label : `${selectedMetrics.length} показателя`;
  const detailLabel = granularity === "month" ? "Итог по календарным месяцам" : granularity === "week" ? "Итог по календарным неделям" : "Итог по календарным дням";

  const toggleMetric = (metric: CadenceMetric) => setSelectedMetrics(current => {
    if (current.includes(metric)) return current.length === 1 ? current : current.filter(value => value !== metric);
    return [...current, metric];
  });

  const toggleStore = (store: string) => setSelectedStores(current => {
    if (store === "__all__") return ["__all__"];
    const concrete = current.filter(value => value !== "__all__");
    if (concrete.includes(store)) return concrete.length === 1 ? concrete : concrete.filter(value => value !== store);
    return [...concrete, store];
  });

  return <AuditShell kicker="08 / ОПЕРАЦИОННЫЙ РИТМ" title="Неделя, день и месяц: расчетный срез">
    {facts.loading ? <FactsLoader/> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для расчетного среза</h2><p>Подтвердите импорт Excel, чтобы увидеть месячную, недельную и дневную динамику.</p></section> : <>
      <section className="page-lede"><div><h2>Операционный ритм по фактическим дням</h2><p>Продажи, закупки, списания и остальные операционные показатели берутся из <b>первичных дневных строк</b> книги. Согласованные ежемесячные статьи уже материализованы по календарным дням во время импорта. НДФЛ 22%, банк и налоги остаются на фактической дате. Остатки здесь не распределяются.</p></div></section>
      <details className="cadence-store-picker"><summary><span>Магазины для суммарного среза</span><b>{scope}</b><small>выбрать</small></summary><div><p>Выберите нужные магазины: их первичные факты суммируются в одном ряду. Для сопоставления точек между собой используйте раздел «Сравнить».</p><button type="button" aria-pressed={networkSelected} onClick={() => toggleStore("__all__")} className={networkSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Вся сеть</button>{facts.storeNames.map(store => { const selected = selectedConcreteStores.includes(store); return <button type="button" key={store} aria-pressed={selected} onClick={() => toggleStore(store)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}>{store}</button>; })}</div></details>
      <section className="packet-kpis equal cadence-kpis"><article className="packet-kpi cadence-primary-kpi"><span>{metrics[primaryMetric].label} · {scope}</span><strong>{formatK(total / 1000)}</strong><small>{rangeLabel}{selectedMetrics.length > 1 ? ` · в графике ${selectedMetrics.length} показателя` : ""}</small></article><article className="packet-kpi"><span>Наличные + НДФЛ 22%</span><strong>{formatK(cashTotal / 1000)}</strong><small>{cashShare.toFixed(1)}% выручки · контроль сокращения</small></article><article className="packet-kpi"><span>Месяцы с дневными строками</span><strong>{cadence.monthlySources}</strong><small>продажи и операции — по фактическим датам</small></article><article className="packet-kpi"><span>Точные ручные строки</span><strong>{cadence.manualRows}</strong><small>не перераспределяются</small></article></section>
      <section className="packet-card cadence-chart-card"><div className="card-title"><div><span>РАСЧЕТНАЯ ДИНАМИКА · {scope}</span><h3>{detailLabel} · {perStoreData ? `${title}: каждый магазин отдельно` : title}</h3></div><div className="chart-view-control" aria-label="Детализация ритма">{(["month", "week", "day"] as Granularity[]).map(level => <button type="button" key={level} className={granularity === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setGranularity(level)}>{level === "day" ? "Дни" : level === "week" ? "Недели" : "Месяцы"}</button>)}</div></div><div className="cadence-metrics-picker" aria-label="Выберите показатели для сравнения"><div className="cadence-picker-heading"><span>Показатели для сравнения</span><small>без лимита; минимум один</small></div>{metricGroups.map(group => <div className={`cadence-metric-group ${group.label === "Наличные расходы и налоги" ? "cash-control-group" : ""}`} key={group.label}><div className="cadence-group-label"><span>{group.label}</span></div><div>{group.keys.map(metric => { const selected = selectedMetrics.includes(metric); return <button type="button" key={metric} aria-pressed={selected} onClick={() => toggleMetric(metric)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}><i style={{ background: metrics[metric].color }}/>{metrics[metric].label}</button>; })}</div></div>)}</div><MetricLineChart data={chartData} lines={chartLines}/><p className="packet-note"><Calculator size={15}/> {perStoreData ? `${metrics[primaryMetric].label}: на графике и в таблице каждая точка показана отдельным рядом.` : selectedMetrics.length === 1 ? metrics[primaryMetric].note : "Сопоставляйте показатели одной операционной задачи. При большом числе рядов выбирайте режим «Наложение» и опирайтесь на таблицу под графиком."} {!perStoreData && "Выбранные магазины суммируются до построения ряда."}</p></section>
      <section className="packet-card cadence-detail-table"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{perStoreData ? `${title}: каждый магазин отдельно` : "Все интервалы активного среза"}</h3></div><small>{granularity === "month" ? "месяцы" : granularity === "week" ? "недели" : "дни"} · млн / тыс. ₽</small></div><div className="data-table-wrap cadence-full-table"><table className="data-table"><thead><tr><th>{granularity === "month" ? "Месяц" : granularity === "week" ? "Неделя" : "Дата"}</th>{chartLines.map(line => <th className="numeric-column" key={line.key}>{line.name}</th>)}</tr></thead><tbody>{chartData.map((point, index) => { const values = point as Record<string, string | number | undefined>; return <tr key={`${String(point.month)}-${index}`}><td>{String(point.month)}</td>{chartLines.map(line => <td className="numeric-column" key={line.key}>{formatK(Number(values[line.key] ?? 0))}</td>)}</tr>; })}</tbody></table></div><p className="packet-note">Таблица повторяет каждый интервал, построенный в графике. Нажмите на заголовок столбца, чтобы отсортировать данные.</p></section>
      {selectedMetrics.includes("cashExpenses") && <section className="packet-card cash-breakdown-card"><div className="card-title"><div><span>СОСТАВ ТРАТ НАЛ · {scope}</span><h3>Какие наличные статьи формируют расход</h3><small>Каждая линия — отдельная исходная статья, без включения НДФЛ 22%</small></div></div><MetricLineChart data={cashBreakdown} lines={[{key:"household",name:"Хоз. нужды нал",color:"#ff8b6f"},{key:"delivery",name:"Доставка нал",color:"#ffbf69"},{key:"cleaning",name:"Уборка нал",color:"#7dcbff"},{key:"bonus",name:"Премия нал",color:"#e88af0"},{key:"seniority",name:"Выслуга нал",color:"#b49bff"},{key:"supplement",name:"Доплата нал",color:"#ff7f9d"},{key:"driverCash",name:"Водитель нал",color:"#67d6b5"},{key:"utilitiesCash",name:"Ком. плат. нал",color:"#6ba4ff"},{key:"operatingCosts",name:"Расходы нал",color:"#d9d75c"}]}/><p className="packet-note"><Calculator size={15}/> Цель — снизить управляемые наличные траты и связанный с ними НДФЛ 22%, не теряя необходимых операционных действий.</p></section>}
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>КАК ЧИТАТЬ СРЕЗ</span><h3>Разделение источников</h3></div><Layers3 size={19}/></div><div className="detail-stat"><span>Продажи, закупки, списания, НДФЛ, банк и налоги</span><strong>фактический день</strong></div><div className="detail-stat"><span>Аренда, зарплата, отпускные и согласованные расходы</span><strong>материализованы по дням при импорте</strong></div><div className="detail-stat"><span>Итоговая чистая прибыль</span><strong>материализована по расходной нагрузке дней</strong></div><div className="detail-stat"><span>Остаток на начало / конец</span><strong>не входит</strong></div><p className="packet-note">Для управления темпом продаж, прибылью, закупками, товарными перемещениями и уценкой используйте этот раздел. Для остатков и покрытия используйте отдельную страницу «Остатки».</p></article><article className="packet-card"><div className="card-title"><div><span>ПОСЛЕДНИЕ ИНТЕРВАЛЫ</span><h3>{title}</h3></div><CalendarDays size={19}/></div><div className="cadence-interval-list">{intervalRows.map(point => { const [period, year] = point.month.split(" · "); return <div className="cadence-interval-card" key={point.date}><div className="cadence-interval-period"><b>{period}</b>{year && <small>{year}</small>}</div><div className="cadence-interval-values">{selectedMetrics.map(metric => <div key={metric}><span>{metrics[metric].label}</span><strong>{formatK(point[metric] / 1000)}</strong></div>)}</div></div>; })}</div></article></section>
    </>}
  </AuditShell>;
}
