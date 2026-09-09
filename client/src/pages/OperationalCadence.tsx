import { useMemo, useState } from "react";
import { CalendarDays, Calculator, FileSpreadsheet, Layers3 } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK } from "@/components/AuditCharts";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";
import { buildOperationalCadence, type CadenceMetric } from "@/lib/operationalCadence";

const metrics: Record<CadenceMetric, { label: string; color: string; note: string }> = {
  revenue: { label: "Выручка", color: "#ffcf7b", note: "Денежный приток от продаж." },
  grossProfit: { label: "Валовая прибыль", color: "#72a8ff", note: "Разница выручки и закупочной части до операционных расходов." },
  netProfit: { label: "Чистая прибыль", color: "#38d6b0", note: "Результат после учтенных расходов." },
  purchases: { label: "Закупки", color: "#b694ff", note: "Объем пополнения товарного запаса." },
  purchaseSmoked: { label: "Закупка Коп.", color: "#de9a5d", note: "Закупка копченой продукции по фактическим дням." },
  purchaseFrozen: { label: "Закупка Мор.", color: "#7eb9df", note: "Закупка мороженой продукции по фактическим дням." },
  salesSmoked: { label: "Продажи Коп.", color: "#ffab62", note: "Продажи копченой продукции по фактическим дням." },
  salesFrozen: { label: "Продажи Мор.", color: "#49b6d8", note: "Продажи мороженой продукции по фактическим дням." },
  expenses: { label: "Расходы", color: "#ff6d8c", note: "Сумма абсолютных значений расходных статей." },
  cashExpenses: { label: "Траты нал", color: "#ff8b6f", note: "Наличные операционные расходы: хоз. нужды, доставка, уборка, премия, выслуга, доплата, водитель, коммунальные и прочие расходы." },
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
  rent: { label: "Аренда", color: "#e1a1cf", note: "Арендная плата, материализованная по дням при импорте." },
  bankFee: { label: "Банк", color: "#9ca9be", note: "Банковские комиссии по фактическим датам." },
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
  { label: "Результат и товар", keys: ["revenue", "grossProfit", "netProfit", "purchases", "purchaseSmoked", "purchaseFrozen", "salesSmoked", "salesFrozen"] },
  { label: "Итоговые расходы", keys: ["expenses", "cashExpenses", "cashTaxes"] },
  { label: "Наличные статьи", keys: ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driverCash", "utilitiesCash", "operatingCosts"] },
  { label: "Безналичные, ФОТ и налоги", keys: ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax", "salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash"] },
  { label: "Товарный поток", keys: ["writeoffSmoked", "writeoffFrozen", "movement", "discount"] },
];

export default function OperationalCadence() {
  const facts = useAuditFacts();
  const { selectedStore, setSelectedStore, range, rangeLabel } = useAudit();
  const [granularity, setGranularity] = useState<"week" | "day">("week");
  const [metric, setMetric] = useState<CadenceMetric>("netProfit");
  const all = selectedStore === "__all__" || !facts.storeNames.includes(selectedStore);
  const scope = all ? "Все магазины" : selectedStore;
  const rows = facts.rowsFor(all ? "__all__" : selectedStore);
  const cadence = useMemo(() => buildOperationalCadence(rows, range), [rows, range]);
  const source = granularity === "week" ? cadence.weekly : cadence.daily;
  const data = source.map(point => ({ month: point.month, [metric]: point[metric] / 1000 }));
  const total = source.reduce((sum, point) => sum + point[metric], 0);
  const cashTotal = source.reduce((sum, point) => sum + point.cashExpenses + point.cashTaxes, 0);
  const cashShare = facts.network.revenue ? cashTotal / facts.network.revenue * 100 : 0;
  const cashBreakdown = source.map(point => ({ month: point.month, household: point.household / 1000, delivery: point.delivery / 1000, cleaning: point.cleaning / 1000, bonus: point.bonus / 1000, seniority: point.seniority / 1000, supplement: point.supplement / 1000, driverCash: point.driverCash / 1000, utilitiesCash: point.utilitiesCash / 1000, operatingCosts: point.operatingCosts / 1000 }));
  const tableRows = [...source].slice(-8).reverse();

  return <AuditShell kicker="08 / ОПЕРАЦИОННЫЙ РИТМ" title="Неделя и день: расчетный срез">
    {facts.loading ? <section className="empty-state"><p>Загружаем факты…</p></section> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для расчетного среза</h2><p>Подтвердите импорт Excel, чтобы увидеть недельную и дневную динамику.</p></section> : <>
      <section className="page-lede"><div><h2>Операционный ритм по фактическим дням</h2><p>Продажи, закупки, списания и остальные операционные показатели берутся из <b>первичных дневных строк</b> книги. Согласованные ежемесячные статьи уже материализованы по календарным дням во время импорта. НДФЛ 22%, банк и налоги остаются на фактической дате. Остатки здесь не распределяются.</p></div><div className="page-controls"><label>Магазин<select value={all ? "__all__" : selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="__all__">Все магазины</option>{facts.storeNames.map(store => <option key={store} value={store}>{store}</option>)}</select></label></div></section>
      <section className="packet-kpis equal cadence-kpis"><article className="packet-kpi cadence-primary-kpi"><span>{metrics[metric].label} · {scope}</span><strong>{formatK(total / 1000)}</strong><small>{rangeLabel}</small></article><article className="packet-kpi"><span>Наличные + НДФЛ 22%</span><strong>{formatK(cashTotal / 1000)}</strong><small>{cashShare.toFixed(1)}% выручки · контроль сокращения</small></article><article className="packet-kpi"><span>Месяцы с дневными строками</span><strong>{cadence.monthlySources}</strong><small>продажи и операции — по фактическим датам</small></article><article className="packet-kpi"><span>Точные ручные строки</span><strong>{cadence.manualRows}</strong><small>не перераспределяются</small></article></section>
      <section className="packet-card"><div className="card-title"><div><span>РАСЧЕТНАЯ ДИНАМИКА · {scope}</span><h3>{granularity === "week" ? "Итог по календарным неделям" : "Итог по календарным дням"}</h3></div><div className="chart-control"><label>Детализация<select value={granularity} onChange={event => setGranularity(event.target.value as "week" | "day")}><option value="week">По неделям</option><option value="day">По дням</option></select></label><label>Показатель<select value={metric} onChange={event => setMetric(event.target.value as CadenceMetric)}>{metricGroups.map(group => <optgroup key={group.label} label={group.label}>{group.keys.map(key => <option value={key} key={key}>{metrics[key].label}</option>)}</optgroup>)}</select></label></div></div><MetricLineChart data={data} lines={[{ key: metric, name: metrics[metric].label, color: metrics[metric].color }]}/><p className="packet-note"><Calculator size={15}/> {metrics[metric].note} В селекторе доступны все рассчитанные финансовые и операционные показатели. Наличные расходы и НДФЛ 22% вынесены в отдельную контрольную группу; при неполной неделе берутся только дни внутри активного среза.</p></section>
      {metric === "cashExpenses" && <section className="packet-card cash-breakdown-card"><div className="card-title"><div><span>СОСТАВ ТРАТ НАЛ · {scope}</span><h3>Какие наличные статьи формируют расход</h3><small>Каждая линия — отдельная исходная статья, без включения НДФЛ 22%</small></div></div><MetricLineChart data={cashBreakdown} lines={[{key:"household",name:"Хоз. нужды нал",color:"#ff8b6f"},{key:"delivery",name:"Доставка нал",color:"#ffbf69"},{key:"cleaning",name:"Уборка нал",color:"#7dcbff"},{key:"bonus",name:"Премия нал",color:"#e88af0"},{key:"seniority",name:"Выслуга нал",color:"#b49bff"},{key:"supplement",name:"Доплата нал",color:"#ff7f9d"},{key:"driverCash",name:"Водитель нал",color:"#67d6b5"},{key:"utilitiesCash",name:"Ком. плат. нал",color:"#6ba4ff"},{key:"operatingCosts",name:"Расходы нал",color:"#d9d75c"}]}/><p className="packet-note"><Calculator size={15}/> Цель — снизить управляемые наличные траты и связанный с ними НДФЛ 22%, не теряя необходимых операционных действий.</p></section>}
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>КАК ЧИТАТЬ СРЕЗ</span><h3>Разделение источников</h3></div><Layers3 size={19}/></div><div className="detail-stat"><span>Продажи, закупки, списания, НДФЛ, банк и налоги</span><strong>фактический день</strong></div><div className="detail-stat"><span>Аренда, зарплата, отпускные и согласованные расходы</span><strong>материализованы по дням при импорте</strong></div><div className="detail-stat"><span>Итоговая чистая прибыль</span><strong>материализована по дням при импорте</strong></div><div className="detail-stat"><span>Остаток на начало / конец</span><strong>не входит</strong></div><p className="packet-note">Для управления темпом продаж, прибылью, закупками, товарными перемещениями и уценкой используйте этот раздел. Для остатков и покрытия используйте отдельную страницу «Остатки».</p></article><article className="packet-card"><div className="card-title"><div><span>ПОСЛЕДНИЕ ИНТЕРВАЛЫ</span><h3>{metrics[metric].label}</h3></div><CalendarDays size={19}/></div><div className="inline-table"><div className="inline-row header"><span>{granularity === "week" ? "Неделя" : "Дата"}</span><span>Значение</span></div>{tableRows.map(point => {const [period,year]=point.month.split(" · ");return <div className="inline-row cadence-interval" key={point.date}><span><b>{period}</b>{year&&<small>{year}</small>}</span><strong>{formatK(point[metric] / 1000)}</strong></div>})}</div></article></section>
    </>}
  </AuditShell>;
}
