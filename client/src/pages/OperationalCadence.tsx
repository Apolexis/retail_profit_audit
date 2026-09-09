import { useMemo, useState } from "react";
import { CalendarDays, Calculator, FileSpreadsheet, Layers3 } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK } from "@/components/AuditCharts";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";
import { buildOperationalCadence, type CadenceMetric } from "@/lib/operationalCadence";

const metrics: Record<CadenceMetric, { label: string; color: string; note: string }> = {
  revenue: { label: "Выручка", color: "#ffcf7b", note: "Денежный приток от продаж." },
  netProfit: { label: "Чистая прибыль", color: "#38d6b0", note: "Результат после учтенных расходов." },
  purchases: { label: "Закупки", color: "#b694ff", note: "Объем пополнения товарного запаса." },
  expenses: { label: "Расходы", color: "#ff6d8c", note: "Сумма абсолютных значений расходных статей." },
  writeoffFrozen: { label: "Списания М.", color: "#e978ff", note: "Прямой расход по мороженой продукции." },
};

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
  const tableRows = [...source].slice(-8).reverse();

  return <AuditShell kicker="08 / ОПЕРАЦИОННЫЙ РИТМ" title="Неделя и день: расчетный срез">
    {facts.loading ? <section className="empty-state"><p>Загружаем факты…</p></section> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для расчетного среза</h2><p>Подтвердите импорт Excel, чтобы увидеть недельную и дневную динамику.</p></section> : <>
      <section className="page-lede"><div><h2>Операционный ритм без подмены первичных данных.</h2><p>Месячные потоки распределяются <b>равномерно по всем календарным дням</b>, поскольку магазины работают 7 дней в неделю. Это расчетная детализация, а не первичный дневной факт. Ручные дневные записи сохраняются точными. Остатки здесь не распределяются.</p></div><div className="page-controls"><label>Магазин<select value={all ? "__all__" : selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="__all__">Все магазины</option>{facts.storeNames.map(store => <option key={store} value={store}>{store}</option>)}</select></label></div></section>
      <section className="packet-kpis equal"><article className="packet-kpi"><span>{metrics[metric].label} · {scope}</span><strong>{formatK(total / 1000)}</strong><small>{rangeLabel}</small></article><article className="packet-kpi"><span>Масштаб среза</span><strong>{granularity === "week" ? cadence.weekly.length : cadence.daily.length}</strong><small>{granularity === "week" ? "календарных недель" : "календарных дней"}</small></article><article className="packet-kpi"><span>Месячные источники</span><strong>{cadence.monthlySources}</strong><small>равномерно распределены по дням</small></article><article className="packet-kpi"><span>Точные ручные строки</span><strong>{cadence.manualRows}</strong><small>не перераспределяются</small></article></section>
      <section className="packet-card"><div className="card-title"><div><span>РАСЧЕТНАЯ ДИНАМИКА · {scope}</span><h3>{granularity === "week" ? "Итог по календарным неделям" : "Итог по календарным дням"}</h3></div><div className="chart-control"><label>Детализация<select value={granularity} onChange={event => setGranularity(event.target.value as "week" | "day")}><option value="week">По неделям</option><option value="day">По дням</option></select></label><label>Показатель<select value={metric} onChange={event => setMetric(event.target.value as CadenceMetric)}>{Object.entries(metrics).map(([key, option]) => <option value={key} key={key}>{option.label}</option>)}</select></label></div></div><MetricLineChart data={data} lines={[{ key: metric, name: metrics[metric].label, color: metrics[metric].color }]}/><p className="packet-note"><Calculator size={15}/> {metrics[metric].note} Для месячного импорта значение каждого дня равно части месячного итога; при неполной неделе берутся только дни внутри активного среза.</p></section>
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>КАК ЧИТАТЬ СРЕЗ</span><h3>Разделение источников</h3></div><Layers3 size={19}/></div><div className="detail-stat"><span>Импортированная месячная строка</span><strong>расчетно</strong></div><div className="detail-stat"><span>Ручная запись с точной датой</span><strong>факт</strong></div><div className="detail-stat"><span>Остаток на начало / конец</span><strong>не входит</strong></div><p className="packet-note">Для управления темпом продаж, прибылью, закупками и расходами используйте этот раздел. Для остатков и покрытия используйте отдельную страницу «Остатки».</p></article><article className="packet-card"><div className="card-title"><div><span>ПОСЛЕДНИЕ ИНТЕРВАЛЫ</span><h3>{metrics[metric].label}</h3></div><CalendarDays size={19}/></div><div className="inline-table"><div className="inline-row header"><span>{granularity === "week" ? "Неделя" : "Дата"}</span><span>Значение</span></div>{tableRows.map(point => <div className="inline-row" key={point.date}><span>{point.month}</span><strong>{formatK(point[metric] / 1000)}</strong></div>)}</div></article></section>
    </>}
  </AuditShell>;
}
