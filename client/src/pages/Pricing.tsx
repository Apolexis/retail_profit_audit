import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { AuditShell } from "@/components/AuditShell";
import { BenchmarkBars, MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts, type FactSummary } from "@/hooks/useAuditFacts";

type Category = "smoked" | "frozen" | "all";
type PricingRecommendation = { title: string; detail: string; tone: "positive" | "risk" | "neutral" };

const info: Record<Category, { title: string; color: string }> = { smoked: { title: "Копченая", color: "#ff6d8c" }, frozen: { title: "Мороженая", color: "#b694ff" }, all: { title: "Общий", color: "#ffcf7b" } };
const pair = (summary: FactSummary, category: Category) => category === "smoked" ? { sales: summary.salesSmoked, purchase: summary.purchaseSmoked } : category === "frozen" ? { sales: summary.salesFrozen, purchase: summary.purchaseFrozen } : { sales: summary.salesSmoked + summary.salesFrozen, purchase: summary.purchaseSmoked + summary.purchaseFrozen };
const markup = (summary: FactSummary, category: Category) => category === "smoked" ? summary.markupSmoked : category === "frozen" ? summary.markupFrozen : summary.markupTotal;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0; };
const money = (value: number) => formatK(value / 1000);

function recommendationFor(latest: { month: string; markup: number } | undefined, previous: { month: string; markup: number } | undefined, medianMarkup: number, category: Category): PricingRecommendation {
  if (!latest) return { title: "Нет месяца с товарным потоком", detail: "В выбранном срезе нет закупок для расчета наценки. Импортируйте первичные продажи и закупки, затем оцените динамику.", tone: "neutral" };
  const delta = previous ? latest.markup - previous.markup : null;
  const belowMedian = latest.markup < medianMarkup - 1;
  if (delta !== null && delta <= -2) return { title: "Наценка заметно снижается", detail: `${latest.month}: ${formatPct(latest.markup)}; изменение к ${previous!.month} — ${formatPct(delta)}. Проверьте закупочную цену, скидки и структуру продаж ${info[category].title}.`, tone: "risk" };
  if (belowMedian) return { title: "Наценка ниже типичного уровня сети", detail: `${latest.month}: ${formatPct(latest.markup)} против медианы ${formatPct(medianMarkup)}. Проверьте ценовой коридор и закупочную цену до изменения объема закупки.`, tone: "risk" };
  if (delta !== null && delta >= 2) return { title: "Наценка усилилась", detail: `${latest.month}: ${formatPct(latest.markup)}; рост к ${previous!.month} — +${formatPct(delta)}. Сохраните условия, но проконтролируйте, что объем продаж не проседает.`, tone: "positive" };
  return { title: "Наценка без резкого сигнала", detail: `${latest.month}: ${formatPct(latest.markup)}${delta === null ? "; предыдущего месяца для сравнения нет." : `; изменение к ${previous!.month} — ${delta > 0 ? "+" : ""}${formatPct(delta)}.`} Сверяйте ее с объемом продаж и списаниями.`, tone: "neutral" };
}

export default function Pricing() {
  const facts = useAuditFacts();
  const { selectedStore, setSelectedStore, rangeLabel } = useAudit();
  const [category, setCategory] = useState<Category>("all");
  const all = selectedStore === "__all__" || !facts.storeNames.includes(selectedStore);
  const selected = all ? facts.network : (facts.summaries.find(summary => summary.store === selectedStore) ?? facts.network);
  const scopeLabel = all ? "Все магазины" : selected.store;
  const selectedPair = pair(selected, category);
  const networkPair = pair(facts.network, category);
  const market = useMemo(() => facts.summaries.map(summary => ({ store: summary.store, value: markup(summary, category), selected: summary.store === selectedStore })).sort((a, b) => b.value - a.value), [facts.summaries, category, selectedStore]);
  const medianMarkup = median(market.map(item => item.value));
  const monthly = facts.monthlyFor(all ? "__all__" : selectedStore).map(row => ({ month: row.month, "% наценки Коп.": markup(row, "smoked"), "% наценки Мор.": markup(row, "frozen"), "% наценки Общий": markup(row, "all") }));
  const currentKey = category === "smoked" ? "% наценки Коп." : category === "frozen" ? "% наценки Мор." : "% наценки Общий";
  const observedMonths = monthly.map(row => ({ month: row.month, markup: Number(row[currentKey]) })).filter(row => Number.isFinite(row.markup));
  const latest = observedMonths.at(-1);
  const previous = observedMonths.at(-2);
  const markupDelta = latest && previous ? latest.markup - previous.markup : null;
  const recommendation = recommendationFor(latest, previous, medianMarkup, category);
  const medianGap = latest ? latest.markup - medianMarkup : null;

  return <AuditShell kicker="02 / ЦЕНОВОЙ АУДИТ" title="Цены: категории и общий товарный поток">
    {facts.loading ? <FactsLoader/> : !facts.available ? <section className="empty-state live-empty"><FileSpreadsheet size={30}/><h2>Нет товарных данных для ценового аудита</h2><p>После импорта книги станут доступны закупки и продажи Коп. и Мор. по каждому магазину и месяцу.</p></section> : <>
      <section className="page-lede"><div><h2>Смотрите наценку вместе с объемом и списаниями.</h2><p>Срез: <b>{rangeLabel}</b>. Проценты наценки берутся из фактических строк импортированной книги; ценовой коридор — сигнал для пилота, не автоматическое изменение цены.</p></div><div className="page-controls"><label>Срез<select value={all ? "__all__" : selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="__all__">Все магазины</option>{facts.storeNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Категория<select value={category} onChange={event => setCategory(event.target.value as Category)}><option value="all">% наценки Общий</option><option value="smoked">% наценки Коп.</option><option value="frozen">% наценки Мор.</option></select></label></div></section>
      <section className="packet-kpis equal"><article className="packet-kpi"><span>Продажи · {scopeLabel}</span><strong>{money(selectedPair.sales)}</strong><small>сеть: {money(networkPair.sales)}</small></article><article className="packet-kpi"><span>Закупки · {scopeLabel}</span><strong>{money(selectedPair.purchase)}</strong><small>сеть: {money(networkPair.purchase)}</small></article><article className="packet-kpi"><span>Наценка · {scopeLabel}</span><strong>{formatPct(markup(selected, category))}</strong><small>медиана сети: {formatPct(medianMarkup)}</small></article><article className={markup(selected, category) - medianMarkup < 0 ? "packet-kpi pricing-median-gap risk" : "packet-kpi pricing-median-gap"}><span>Отклонение от медианы</span><strong>{markup(selected, category) - medianMarkup > 0 ? "+" : ""}{formatPct(markup(selected, category) - medianMarkup)}</strong><small>выбранный товарный поток</small></article></section>
      <section className="packet-split pricing-split"><article className="packet-card wide"><div className="card-title"><div><span>ЦЕНОВОЙ КОРИДОР · {info[category].title.toUpperCase()}</span><h3>Все магазины по наценке</h3></div><small>%</small></div><BenchmarkBars data={market} median={medianMarkup} selectedLabel={scopeLabel}/></article><article className="packet-card pricing-monthly-card"><div className="card-title"><div><span>ДИНАМИКА · {scopeLabel}</span><h3>Наценка по месяцам</h3></div><small>%</small></div><MetricLineChart data={monthly} percent lines={[{ key: "% наценки Коп.", name: "% наценки Коп.", color: "#ff6d8c" }, { key: "% наценки Мор.", name: "% наценки Мор.", color: "#b694ff" }, { key: "% наценки Общий", name: "% наценки Общий", color: "#ffcf7b" }]}/><div className="pricing-monthly-facts"><div><span>Последний месяц с наценкой</span><b>{latest?.month ?? "Нет данных"}</b></div><div><span>Изменение к прошлому месяцу</span><b className={markupDelta === null ? "" : markupDelta < 0 ? "negative" : markupDelta > 0 ? "positive" : ""}>{markupDelta === null ? "Нет базы" : `${markupDelta > 0 ? "+" : ""}${formatPct(markupDelta)}`}</b></div><div><span>Отклонение от медианы сети</span><b className={medianGap === null ? "" : medianGap < 0 ? "negative" : medianGap > 0 ? "positive" : ""}>{medianGap === null ? "Нет данных" : `${medianGap > 0 ? "+" : ""}${formatPct(medianGap)}`}</b></div></div><div className={`pricing-recommendation ${recommendation.tone}`}><span>РЕКОМЕНДАЦИЯ ПО ФАКТАМ</span><h4>{recommendation.title}</h4><p>{recommendation.detail}</p></div></article></section>
    </>}
  </AuditShell>;
}
