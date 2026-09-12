import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { BenchmarkBars, MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { expenseDefinitions, useAuditFacts, type ExpenseCode } from "@/hooks/useAuditFacts";

const cashCodes: ExpenseCode[] = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs"];
const trendColors = ["#ff8b6f", "#b694ff", "#7dcbff", "#67d6b5", "#ffbf69", "#e88af0", "#6ba4ff", "#e69a7c", "#73d5b1", "#b2a0ec", "#d08bff", "#49b6d8"];
const money = (amount: number) => formatK(amount / 1000);
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0; };
const nameFor = (code: ExpenseCode) => expenseDefinitions.find(([key]) => key === code)?.[1] ?? code;
const monthLabel = (month: string) => new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
type DetailLevel = "days" | "weeks" | "months";
const weekStart = (value: string) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return date.toISOString().slice(0, 10); };
const detailLabel = (key: string, level: DetailLevel) => level === "days" ? new Date(`${key}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : level === "weeks" ? `Нед. ${new Date(`${key}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}` : monthLabel(key);

export default function Expenses() {
  const facts = useAuditFacts();
  const { selectedStore, rangeLabel } = useAudit();
  const [selectedFields, setSelectedFields] = useState<ExpenseCode[]>([expenseDefinitions[0][0]]);
  const [detail, setDetail] = useState<DetailLevel>("months");
  const [selectedStores, setSelectedStores] = useState<string[]>(() => selectedStore !== "__all__" ? [selectedStore] : ["__all__"]);
  const [pickersOpen, setPickersOpen] = useState(false);
  const selectedConcreteStores = useMemo(() => selectedStores.filter(store => store !== "__all__"), [selectedStores]);
  const networkSelected = selectedStores.includes("__all__");
  const scope = networkSelected ? "Все магазины" : selectedConcreteStores.length === 1 ? selectedConcreteStores[0] : `${selectedConcreteStores.length} магазина`;
  const singleStoreComparison = !networkSelected && selectedConcreteStores.length === 1;
  const rows = useMemo(() => networkSelected ? facts.rowsFor("__all__") : selectedConcreteStores.flatMap(store => facts.rowsFor(store)), [facts.rowsFor, networkSelected, selectedConcreteStores]);
  const store = useMemo(() => facts.summaryFor(rows, scope), [facts.summaryFor, rows, scope]);
  const primaryField = selectedFields[0] ?? expenseDefinitions[0][0];
  const primaryLabel = nameFor(primaryField);
  const share = (amount: number, revenue: number) => revenue ? Math.abs(amount) / revenue * 100 : 0;
  const cashExpenses = cashCodes.reduce((sum, code) => sum + Math.abs(store.expenseByCode[code] ?? 0), 0);
  const cashTax = Math.abs(store.expenseByCode.personal_income_tax_22 ?? 0);
  const cashTotal = cashExpenses + cashTax;
  const ranking = useMemo(() => facts.summaries.map(summary => ({ store: summary.store, value: share(summary.expenseByCode[primaryField] ?? 0, summary.revenue), selected: !networkSelected && selectedConcreteStores.includes(summary.store) })).sort((a, b) => b.value - a.value), [facts.summaries, primaryField, networkSelected, selectedConcreteStores]);
  const expenseMedian = median(facts.summaries.map(summary => summary.expenses));
  const expenseGap = singleStoreComparison ? store.expenses - expenseMedian : null;
  const articleAmount = Math.abs(store.expenseByCode[primaryField] ?? 0);
  const articleMedian = median(facts.summaries.map(summary => share(summary.expenseByCode[primaryField] ?? 0, summary.revenue)));
  const ledger = expenseDefinitions.map(([code, name]) => { const amount = Math.abs(store.expenseByCode[code] ?? 0), currentShare = share(amount, store.revenue), benchmark = median(facts.summaries.map(summary => share(summary.expenseByCode[code] ?? 0, summary.revenue))); return { code, name, amount, share: currentShare, medianShare: benchmark, gap: currentShare - benchmark }; }).sort((a, b) => b.amount - a.amount);
  const cashLedger = ledger.filter(row => cashCodes.includes(row.code));
  const aggregateTrend = (sourceRows: typeof rows, fields: readonly ExpenseCode[]): Array<{ month: string } & Partial<Record<ExpenseCode, number>>> => { const groups = new Map<string, typeof rows>(); sourceRows.forEach(row => { const key = detail === "months" ? row.monthDate : detail === "weeks" ? weekStart(row.entryDate) : row.entryDate; groups.set(key, [...(groups.get(key) ?? []), row]); }); return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, periodRows]) => ({ month: detailLabel(key, detail), ...Object.fromEntries(fields.map(field => [field, periodRows.reduce((sum, row) => sum + Math.abs(Number(row.metrics[field] ?? 0)), 0) / 1000])) })) as Array<{ month: string } & Partial<Record<ExpenseCode, number>>>; };
  const monthlyTrend = useMemo(() => aggregateTrend(rows, selectedFields), [rows, selectedFields, detail]);
  const cashTrend = useMemo(() => aggregateTrend(rows, cashCodes), [rows, detail]);
  const storeComparisonTrend = useMemo(() => {
    if (!networkSelected || selectedFields.length !== 1) return null;
    const field = selectedFields[0];
    const byPeriod = new Map<string, Record<string, number | string>>();
    facts.storeNames.forEach(storeName => aggregateTrend(facts.rowsFor(storeName), [field]).forEach(row => {
      const current = byPeriod.get(row.month) ?? { month: row.month };
      current[storeName] = Number(row[field] ?? 0);
      byPeriod.set(row.month, current);
    }));
    return Array.from(byPeriod.values());
  }, [aggregateTrend, facts.rowsFor, facts.storeNames, networkSelected, selectedFields]);
  const trendData = storeComparisonTrend ?? monthlyTrend;
  const trendLines = storeComparisonTrend ? facts.storeNames.map((storeName, index) => ({ key: storeName, name: storeName, color: trendColors[index % trendColors.length] })) : selectedFields.map((field, index) => ({ key: field, name: nameFor(field), color: trendColors[index % trendColors.length] }));

  const togglePickers = () => setPickersOpen(current => !current);
  const toggleField = (field: ExpenseCode) => setSelectedFields(current => current.includes(field) ? current.length === 1 ? current : current.filter(value => value !== field) : [...current, field]);
  const toggleStore = (storeName: string) => setSelectedStores(current => {
    if (storeName === "__all__") return ["__all__"];
    const concrete = current.filter(value => value !== "__all__");
    return concrete.includes(storeName) ? concrete.length === 1 ? concrete : concrete.filter(value => value !== storeName) : [...concrete, storeName];
  });

  return <AuditShell kicker="03 / РАСХОДНЫЙ АУДИТ" title="Расходы: статьи и магазины в одном срезе">
    {facts.loading ? <FactsLoader /> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет фактов для расходного аудита</h2><p>Подтвердите импорт Excel: все доступные статьи расходов будут добавлены автоматически.</p></section> : <>
      <section className="page-lede"><div><h2>Не только ФОТ и аренда — весь расходный P&amp;L выбранных магазинов.</h2><p>В общем графике можно одновременно сравнивать нужное число статей и магазинов. Первичные факты выбранных точек суммируются по календарным месяцам; бенчмарк справа остается сравнением доли основной статьи с сетью.</p></div></section>
      <div className="expense-scope-grid">
        <section className={`expense-picker ${pickersOpen ? "open" : ""}`}>
          <button type="button" className="expense-picker-toggle" aria-expanded={pickersOpen} onClick={togglePickers}><span>Магазины расходного среза</span><b>{scope}</b><small>{pickersOpen ? "свернуть оба выбора" : "выбрать магазины и статьи"}</small></button>
          {pickersOpen && <div className="expense-picker-options"><p>Выберите нужные магазины. Их первичные факты суммируются в одном срезе; для сравнения точек между собой используйте раздел «Сравнить».</p><button type="button" aria-pressed={networkSelected} onClick={() => toggleStore("__all__")} className={networkSelected ? "cadence-metric-chip active" : "cadence-metric-chip"}>Вся сеть</button>{facts.storeNames.map(storeName => { const selected = selectedConcreteStores.includes(storeName); return <button type="button" key={storeName} aria-pressed={selected} onClick={() => toggleStore(storeName)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}>{storeName}</button>; })}</div>}
        </section>
        <section className={`expense-picker ${pickersOpen ? "open" : ""}`}>
          <button type="button" className="expense-picker-toggle" aria-expanded={pickersOpen} onClick={togglePickers}><span>Статьи на графике</span><b>{selectedFields.map(nameFor).join(" · ")}</b><small>{pickersOpen ? "свернуть оба выбора" : "выбрать магазины и статьи"}</small></button>
          {pickersOpen && <div className="expense-picker-options"><p>Выберите нужные расходные статьи. Хотя бы одна статья остается активной.</p>{expenseDefinitions.map(([code, name]) => { const selected = selectedFields.includes(code); return <button type="button" key={code} aria-pressed={selected} onClick={() => toggleField(code)} className={selected ? "cadence-metric-chip active" : "cadence-metric-chip"}>{name}</button>; })}</div>}
        </section>
      </div>
      <section className="packet-kpis equal"><article className="packet-kpi"><span>Все расходы · {scope}</span><strong>{money(store.expenses)}</strong><small>{rangeLabel}</small></article><article className="packet-kpi"><span>Нал + НДФЛ 22%</span><strong>{money(cashTotal)}</strong><small>{formatPct(share(cashTotal, store.revenue))} выручки</small></article><article className={expenseGap !== null && expenseGap > 0 ? "packet-kpi risk" : "packet-kpi"}><span>Разница к медиане сети</span><strong>{expenseGap === null ? "—" : <>{expenseGap > 0 ? "+" : ""}{money(expenseGap)}</>}</strong><small>{expenseGap === null ? "выберите один магазин для сравнения" : "расходы точки против медианы сети"}</small></article><article className="packet-kpi"><span>Основная статья · {primaryLabel}</span><strong>{money(articleAmount)}</strong><small>{formatPct(share(articleAmount, store.revenue))} выручки</small></article></section>
      <section className="packet-card"><div className="card-title"><div><span>ДИНАМИКА РАСХОДОВ · {scope}</span><h3>{detail === "days" ? "По дням" : detail === "weeks" ? "По неделям" : "Помесячно"}: {storeComparisonTrend ? `${primaryLabel} по магазинам` : selectedFields.length === 1 ? primaryLabel : `${selectedFields.length} статьи`}</h3></div><div className="chart-controls"><div className="chart-view-control" aria-label="Детализация расходов">{(["days", "weeks", "months"] as DetailLevel[]).map(level => <button type="button" key={level} className={detail === level ? "chart-view-button active" : "chart-view-button"} onClick={() => setDetail(level)}>{level === "days" ? "Дни" : level === "weeks" ? "Недели" : "Месяцы"}</button>)}</div><small>млн / тыс. ₽</small></div></div><MetricLineChart data={trendData} lines={trendLines}/></section>
      <section className="packet-card expense-detail-table"><div className="card-title"><div><span>ДАННЫЕ ПОД ГРАФИКОМ</span><h3>{storeComparisonTrend ? `${primaryLabel}: каждый магазин отдельно` : "Расходы выбранных магазинов"} по {detail === "days" ? "дням" : detail === "weeks" ? "неделям" : "месяцам"}</h3></div><small>млн / тыс. ₽</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>{detail === "days" ? "День" : detail === "weeks" ? "Неделя" : "Месяц"}</th>{trendLines.map(line => <th className="numeric-column" key={line.key}>{line.name}</th>)}</tr></thead><tbody>{trendData.map(row => { const numericRow = row as Record<string, string | number | undefined>; return <tr key={String(row.month)}><td>{String(row.month)}</td>{trendLines.map(line => <td className="numeric-column" key={line.key}>{formatK(Number(numericRow[line.key] ?? 0))}</td>)}</tr>; })}</tbody></table></div></section>
      <section className="packet-card cash-breakdown-card"><div className="card-title"><div><span>СОСТАВ ТРАТ НАЛ · {scope}</span><h3>Какие наличные статьи формируют расход</h3></div><small>{detail === "days" ? "по дням" : detail === "weeks" ? "по неделям" : "помесячно"} · млн / тыс. ₽</small></div><MetricLineChart data={cashTrend} lines={cashCodes.map((code, index) => ({ key: code, name: nameFor(code), color: trendColors[index % trendColors.length] }))}/><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Наличная статья</th><th className="numeric-column">Сумма</th><th className="numeric-column">Доля выручки</th></tr></thead><tbody>{cashLedger.map(row => <tr key={row.code}><td>{row.name}</td><td className="numeric-column">{money(row.amount)}</td><td className="numeric-column">{formatPct(row.share)}</td></tr>)}</tbody></table></div><div className="expense-mobile-ledger" aria-label="Наличные статьи: мобильная версия">{cashLedger.map(row => <article key={row.code}><strong>{row.name}</strong><dl><div><dt>Сумма</dt><dd>{money(row.amount)}</dd></div><div><dt>Доля выручки</dt><dd>{formatPct(row.share)}</dd></div></dl></article>)}</div></section>
      <section className="packet-card cash-control-card"><div className="card-title"><div><span>КОНТРОЛЬ НАЛИЧНЫХ РАСХОДОВ</span><h3>Управляемые траты и НДФЛ 22%</h3></div></div><div className="detail-stat"><span>Операционные траты нал</span><strong>{money(cashExpenses)}</strong></div><div className="detail-stat"><span>НДФЛ 22%</span><strong>{money(cashTax)}</strong></div><div className="detail-stat"><span>Управленческий фокус</span><strong>Сокращать наличные выплаты без потери критичных операций</strong></div><p className="packet-note">Выше показан постоянный помесячный состав наличных расходов. В «Ритме» та же структура доступна на дневном, недельном и месячном уровне.</p></section>
      <section className="packet-split"><article className="packet-card wide"><div className="card-title"><div><span>БЕНЧМАРК · {primaryLabel.toUpperCase()}</span><h3>Доля выручки: все магазины</h3></div><small>%</small></div><BenchmarkBars data={ranking} median={articleMedian} selectedLabel={scope}/></article><article className="packet-card"><div className="card-title"><div><span>{scope}</span><h3>Основная статья: {primaryLabel}</h3></div></div><div className="detail-stat"><span>Сумма · {primaryLabel}</span><strong>{money(articleAmount)}</strong></div><div className="detail-stat"><span>Доля выручки</span><strong>{formatPct(share(articleAmount, store.revenue))}</strong></div><div className="detail-stat"><span>Медиана сети</span><strong>{formatPct(articleMedian)}</strong></div><div className={share(articleAmount, store.revenue) - articleMedian > 0 ? "detail-stat negative" : "detail-stat positive"}><span>Отклонение</span><strong>{share(articleAmount, store.revenue) - articleMedian > 0 ? "+" : ""}{formatPct(share(articleAmount, store.revenue) - articleMedian)}</strong></div></article></section>
      <section className="packet-card expense-ledger-card"><div className="card-title"><div><span>ПОЛНЫЙ РАСХОДНЫЙ P&amp;L · {scope}</span><h3>Сумма, доля выручки и сетевой бенчмарк</h3></div><small>млн / тыс. ₽</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Статья</th><th className="numeric-column">Сумма</th><th className="numeric-column">Доля</th><th className="numeric-column">Медиана</th><th className="numeric-column">Отклонение</th></tr></thead><tbody>{ledger.map(row => <tr key={row.code}><td>{row.name}</td><td className="numeric-column">{money(row.amount)}</td><td className="numeric-column">{formatPct(row.share)}</td><td className="numeric-column">{formatPct(row.medianShare)}</td><td className={row.gap > 0 ? "numeric-column negative" : "numeric-column positive"}>{row.gap > 0 ? "+" : ""}{formatPct(row.gap)}</td></tr>)}</tbody></table></div><div className="expense-mobile-ledger" aria-label="Полный расходный P&L: мобильная версия">{ledger.map(row => <article key={row.code}><strong>{row.name}</strong><dl><div><dt>Сумма</dt><dd>{money(row.amount)}</dd></div><div><dt>Доля</dt><dd>{formatPct(row.share)}</dd></div><div><dt>Медиана</dt><dd>{formatPct(row.medianShare)}</dd></div><div><dt>Отклонение</dt><dd className={row.gap > 0 ? "negative" : "positive"}>{row.gap > 0 ? "+" : ""}{formatPct(row.gap)}</dd></div></dl></article>)}</div></section>
    </>}
  </AuditShell>;
}
