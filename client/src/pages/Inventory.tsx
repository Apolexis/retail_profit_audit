import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { BenchmarkBars, MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";

const money = (value: number) => formatK(value / 1000);
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return 0; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };

const trendOptions = {
  stockOpen: { label: "Остаток на начало", group: "Уровень запаса" },
  stockClose: { label: "Остаток на конец", group: "Уровень запаса" },
  stockChange: { label: "Изменение остатка", group: "Уровень запаса" },
  purchases: { label: "Закупки", group: "Товарный поток" },
  salesSmoked: { label: "Продажи Коп.", group: "Товарный поток" },
  salesFrozen: { label: "Продажи Мор.", group: "Товарный поток" },
  movement: { label: "Перемещения", group: "Товарный поток" },
  discount: { label: "Уценка", group: "Потери запаса" },
  writeoffSmoked: { label: "Списания К.", group: "Потери запаса" },
  writeoffFrozen: { label: "Списания М.", group: "Потери запаса" },
  writeoffsTotal: { label: "Списания всего", group: "Потери запаса" },
  lossesTotal: { label: "Уценка + списания", group: "Потери запаса" },
} as const;
type TrendKey = keyof typeof trendOptions;

export default function Inventory() {
  const facts = useAuditFacts();
  const { selectedStore, setSelectedStore, rangeLabel } = useAudit();
  const [trend, setTrend] = useState<TrendKey>("stockClose");
  const all = selectedStore === "__all__" || !facts.storeNames.includes(selectedStore);
  const selected = all ? facts.network : (facts.summaries.find(summary => summary.store === selectedStore) ?? facts.network);
  const coverage = useMemo(() => facts.summaries.map(summary => ({ store: summary.store, value: summary.coverDays, selected: summary.store === selectedStore })).sort((a, b) => b.value - a.value), [facts.summaries, selectedStore]);
  const coverageMedian = median(facts.summaries.map(summary => summary.coverDays));
  const monthly = (store: string) => facts.monthlyFor(store).map(row => {
    const movement = row.raw.reduce((total, period) => total + Number(period.movement ?? 0), 0);
    const discount = row.raw.reduce((total, period) => total + Number(period.discount ?? 0), 0);
    const writeoffsTotal = row.writeoffSmoked + row.writeoffFrozen;
    return { month: row.month, stockOpen: row.stockOpen / 1000, stockClose: row.stockClose / 1000, stockChange: (row.stockClose - row.stockOpen) / 1000, purchases: row.purchases / 1000, salesSmoked: row.salesSmoked / 1000, salesFrozen: row.salesFrozen / 1000, movement: movement / 1000, discount: discount / 1000, writeoffSmoked: row.writeoffSmoked / 1000, writeoffFrozen: row.writeoffFrozen / 1000, writeoffsTotal: writeoffsTotal / 1000, lossesTotal: (Math.abs(discount) + Math.abs(writeoffsTotal)) / 1000 };
  });
  const networkMonthly = monthly("__all__");
  const storeMonthly = monthly(all ? "__all__" : selectedStore);
  const trendData = all ? networkMonthly : storeMonthly;
  const scope = all ? "вся сеть" : selected.store;
  const lossTotal = Math.abs(selected.writeoffSmoked) + Math.abs(selected.writeoffFrozen) + Math.abs(facts.rowsFor(all ? "__all__" : selectedStore).reduce((total, row) => total + Number(row.metrics.discount ?? 0), 0));
  const netChange = selected.stockClose - selected.stockOpen;
  const selectedTrend = trendOptions[trend];
  const coverageGap = selected.coverDays - coverageMedian;
  const lossShare = selected.revenue ? lossTotal / selected.revenue * 100 : 0;
  const profileInsight = coverageGap > 5
    ? `Покрытие выше медианы на ${coverageGap.toFixed(1)} дн. Проверьте оборачиваемость и план закупок.`
    : lossShare >= 1
      ? `Потери запаса составляют ${formatPct(lossShare)} выручки. Проверьте уценку и списания до следующей закупки.`
      : coverageGap < -3
        ? `Покрытие ниже медианы на ${Math.abs(coverageGap).toFixed(1)} дн. Проверьте риск дефицита по ходовым позициям.`
        : "Уровень запаса близок к сетевой медиане. Контролируйте покрытие вместе со списаниями.";

  return <AuditShell kicker="04 / ОСТАТКИ И СПИСАНИЯ" title="Остаток: уровень, поток, потери">
    {facts.loading ? <FactsLoader/> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для анализа остатков</h2><p>Подтвердите импорт Excel — данные по остаткам, перемещениям, уценке и списаниям появятся в этом разделе.</p></section> : <>
      <section className="page-lede"><div><h2>Отделяйте уровень запаса от потока товара и его потерь.</h2><p><b>Остаток</b> — деньги, находящиеся в товаре на границе периода. <b>Закупки, продажи и перемещения</b> — поток внутри периода. <b>Уценка и списания</b> — снижение стоимости или прямой расход P&amp;L. Количественные остатки в книге не ведутся, поэтому все значения здесь — в деньгах.</p></div><div className="page-controls"><label>Магазин<select value={all ? "__all__" : selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="__all__">Все магазины</option>{facts.storeNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label></div></section>
      <section className="packet-kpis equal"><article className="packet-kpi"><span>Конечный остаток · {scope}</span><strong>{money(selected.stockClose)}</strong><small>{selected.coverDays.toFixed(1)} дня покрытия</small></article><article className="packet-kpi"><span>Изменение остатка</span><strong>{netChange > 0 ? "+" : ""}{money(netChange)}</strong><small>{netChange < 0 ? "высвобождение денег из товара" : "рост денег, вложенных в товар"}</small></article><article className="packet-kpi"><span>Перемещения · {scope}</span><strong>{money(facts.rowsFor(all ? "__all__" : selectedStore).reduce((total, row) => total + Number(row.metrics.movement ?? 0), 0))}</strong><small>чистый внутрисетевой поток</small></article><article className="packet-kpi risk"><span>Уценка + списания</span><strong>{money(lossTotal)}</strong><small>снижение стоимости и расход P&amp;L</small></article></section>
      <section className="packet-split"><article className="packet-card wide"><div className="card-title"><div><span>ПОКРЫТИЕ ПРОДАЖ</span><h3>Все магазины: дней запаса на конечный остаток</h3></div><small>Медиана покрытия сети: {coverageMedian.toFixed(1)} дня</small></div><BenchmarkBars data={coverage} median={coverageMedian} mode="number" selectedLabel={all ? "" : selected.store}/><p className="packet-note">Медиана — середина распределения покрытия: у половины доступных точек покрытие ниже, у половины выше. Она не складывается с остатками и отображается в днях.</p></article><article className="packet-card inventory-profile-card"><div className="card-title"><div><span>{scope}</span><h3>Остаточный профиль</h3></div><small>управленческий вывод</small></div><div className="inventory-profile-grid"><div><span>Конечный остаток</span><strong>{money(selected.stockClose)}</strong></div><div><span>Изменение за период</span><strong className={netChange < 0 ? "negative" : ""}>{netChange > 0 ? "+" : ""}{money(netChange)}</strong></div><div><span>Покрытие</span><strong>{selected.coverDays.toFixed(1)} дн.</strong><small>{coverageGap === 0 ? "на уровне медианы" : `${coverageGap > 0 ? "+" : "−"}${Math.abs(coverageGap).toFixed(1)} дн. к медиане`}</small></div><div><span>Уценка + списания</span><strong>{money(lossTotal)}</strong><small>{formatPct(lossShare)} выручки</small></div></div><p className={coverageGap > 5 || lossShare >= 1 ? "inventory-profile-insight risk" : "inventory-profile-insight"}>{profileInsight}</p></article></section>
      <section className="packet-card"><div className="card-title"><div><span>{selectedTrend.group.toUpperCase()} · {scope}</span><h3>Динамика выбранного показателя</h3></div><label className="chart-control">Показатель<select value={trend} onChange={event => setTrend(event.target.value as TrendKey)}>{Object.entries(trendOptions).map(([key, option]) => <option key={key} value={key}>{option.group} · {option.label}</option>)}</select></label></div><MetricLineChart data={trendData} lines={[{ key: trend, name: selectedTrend.label, color: "#ff8b6f" }]}/><p className="packet-note">Суммы отображаются в млн/тыс. ₽. «Изменение остатка» — разница между концом и началом периода; отрицательное значение означает высвобождение денег из запаса. Продажи, закупки, перемещения и потери — финансовые потоки, не количество товара.</p></section>
      <section className="packet-card inventory-detail-table"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ · {scope}</span><h3>{selectedTrend.label} по месяцам</h3></div><small>млн / тыс. ₽</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Месяц</th><th className="numeric-column">{selectedTrend.label}</th></tr></thead><tbody>{trendData.map(row => <tr key={row.month}><td>{row.month}</td><td className={trend === "stockChange" && Number(row[trend]) < 0 ? "numeric-column negative" : "numeric-column"}>{trend === "stockChange" && Number(row[trend]) > 0 ? "+" : ""}{formatK(Number(row[trend] ?? 0))}</td></tr>)}</tbody></table></div></section>
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>СЕТЬ · УРОВЕНЬ ЗАПАСА</span><h3>Остаток на начало и конец</h3></div><small>млн / тыс. ₽</small></div><MetricLineChart data={networkMonthly} lines={[{ key: "stockOpen", name: "На начало", color: "#b694ff" }, { key: "stockClose", name: "На конец", color: "#ffcf7b" }]}/></article><article className="packet-card"><div className="card-title"><div><span>{scope} · ТОВАРНЫЙ ПОТОК</span><h3>Закупки, продажи и перемещения</h3></div><small>млн / тыс. ₽</small></div><MetricLineChart data={storeMonthly} lines={[{ key: "purchases", name: "Закупки", color: "#b694ff" }, { key: "salesSmoked", name: "Продажи Коп.", color: "#7dcbff" }, { key: "salesFrozen", name: "Продажи Мор.", color: "#67d6b5" }, { key: "movement", name: "Перемещения", color: "#ffcf7b" }]}/></article></section>
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>СЕТЕВЫЕ ПОТЕРИ · ПО МЕСЯЦАМ</span><h3>Уценка и списания</h3></div><small>млн / тыс. ₽</small></div><MetricLineChart data={networkMonthly} lines={[{ key: "discount", name: "Уценка", color: "#ff6d8c" }, { key: "writeoffSmoked", name: "Списания К.", color: "#b694ff" }, { key: "writeoffFrozen", name: "Списания М.", color: "#e978ff" }]}/></article><article className="packet-card"><div className="card-title"><div><span>{scope} · ПОТЕРИ ЗАПАСА</span><h3>Уценка + списания</h3></div><small>млн / тыс. ₽</small></div><MetricLineChart data={storeMonthly} lines={[{ key: "lossesTotal", name: "Потери запаса", color: "#ff6d8c" }, { key: "writeoffsTotal", name: "Списания всего", color: "#b694ff" }, { key: "discount", name: "Уценка", color: "#ffcf7b" }]}/></article></section>
      <p className="packet-note">Срез: {rangeLabel}. Все суммы рассчитываются только по импортированным и доступным для пользователя магазинам.</p>
    </>}
  </AuditShell>;
}
