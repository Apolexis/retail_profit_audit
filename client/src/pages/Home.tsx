import { ThemedSelect } from "@/components/ui/themed-select";
import { useMemo } from "react";
import { ArrowRight, Boxes, ChartNoAxesCombined, CircleDollarSign, FileSpreadsheet, GitCompareArrows } from "lucide-react";
import { Link } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { FactsLoader } from "@/components/OceanLoader";
import { useAudit } from "@/contexts/AuditContext";
import { useAuditFacts } from "@/hooks/useAuditFacts";
import { evotorAnalyticsQueryOptions } from "@/lib/evotorAnalyticsQuery";
import { formatMoneyWithKopecks } from "@/lib/displayFormat";
import { trpc } from "@/lib/trpc";

const money = (value: number) => formatK(value / 1000);
const evotorMoney = (value: number | null | undefined) => formatMoneyWithKopecks(value);

function Kpi({ label, value, note, risk = false }: { label: string; value: string; note: string; risk?: boolean }) {
  return <article className={risk ? "packet-kpi risk" : "packet-kpi"}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function EmptyFacts() {
  return <section className="empty-state live-empty home-empty-facts"><FileSpreadsheet size={30}/><h2>Импортируйте первую книгу Excel</h2><p>База фактов пока пуста, поэтому сводка не подменяет ваши данные встроенным примером. После подтверждения импорта все показатели, рейтинги и периоды будут рассчитаны по книге.</p><Link href="/import" className="packet-link">Перейти к импорту <ArrowRight size={15}/></Link></section>;
}

export default function Home() {
  const { selectedStore, setSelectedStore, range, rangeLabel, demoMode } = useAudit();
  const facts = useAuditFacts();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const isAll = selectedStore === "__all__" || !facts.storeNames.includes(selectedStore);
  const scope = isAll ? facts.network : (facts.summaries.find(item => item.store === selectedStore) ?? facts.network);
  const scopeLabel = isAll ? "Все магазины" : scope.store;
  const evotorStoreIds = useMemo(() => selectedStore === "__all__" ? undefined : (stores.data ?? [])
    .filter(store => !store.isHidden && store.name === selectedStore)
    .map(store => store.id)
    .filter((storeId): storeId is number => Number.isInteger(storeId)), [selectedStore, stores.data]);
  const evotorScope = evotorStoreIds?.length === 1 ? (stores.data ?? []).find(store => store.id === evotorStoreIds[0])?.name ?? "Выбранный магазин" : "Все магазины";
  const evotorRange = useMemo(() => ({ from: range.from < "2025-01-01" ? "2025-01-01" : range.from, to: range.to }), [range.from, range.to]);
  const mayReadEvotorFacts = me.data?.role === "admin" && !demoMode && range.to >= "2025-01-01";
  const evotorFacts = trpc.inventoryRegistry.evotorSalesAnalytics.useQuery({ ...evotorRange, granularity: "month", storeIds: evotorStoreIds, includeProducts: false }, { ...evotorAnalyticsQueryOptions, enabled: mayReadEvotorFacts });
  const evotorSummary = evotorFacts.data?.summary;
  const evotorResponseMs = evotorFacts.data?.performance?.serviceMs;
  const evotorStoreCoverage = useMemo(() => evotorFacts.data ? new Set(evotorFacts.data.timeline.map(item => item.storeId)).size : 0, [evotorFacts.data]);
  const evotorPaymentNote = !evotorSummary?.checks
    ? "за выбранный период нет чеков"
    : evotorSummary.paymentCapture.complete === evotorSummary.checks
      ? `оплаты сверены у всех ${evotorSummary.checks.toLocaleString("ru-RU")} чек.`
      : `сверенная часть: ${evotorSummary.paymentCapture.complete.toLocaleString("ru-RU")} из ${evotorSummary.checks.toLocaleString("ru-RU")} чек.`;
  const evotorPaymentCoverageText = !evotorSummary?.checks
    ? "За выбранный период чеков нет."
    : evotorSummary.paymentCapture.complete === evotorSummary.checks
      ? "Оплаты извлечены и сверены по всем загруженным чекам выбранного среза."
      : `Детализация оплат доступна у ${evotorSummary.paymentCapture.complete.toLocaleString("ru-RU")} из ${evotorSummary.checks.toLocaleString("ru-RU")} чеков. Наличные и безналичные показатели содержат только эту подтвержденную часть; отсутствующие платежи не оцениваются и не ожидают фоновой проверки.`;
  const evotorCoverageNote = evotorFacts.data
    ? evotorSummary?.checks
      ? `чеки есть у ${evotorStoreCoverage} из ${evotorFacts.data.stores.length} точек · ${evotorFacts.data.coverage.from ?? "—"} — ${evotorFacts.data.coverage.to ?? "—"} · агрегат ${evotorResponseMs ?? "—"} мс`
      : `за выбранный период нет импортированных чеков у ${evotorFacts.data.stores.length} точек · агрегат ${evotorResponseMs ?? "—"} мс`
    : "загружаем только уже нормализованные чеки";
  const timeline = useMemo(() => facts.monthlyFor(isAll ? "__all__" : selectedStore), [facts.monthlyFor, isAll, selectedStore]);
  const chartData = useMemo(() => timeline.map(row => ({ month: row.month, revenue: row.revenue / 1_000_000, netProfit: row.netProfit / 1_000_000 })), [timeline]);
  const paymentTrend = useMemo(() => timeline.map(row => ({ month: row.month, cashRevenue: row.cashRevenue / 1_000_000, cashlessRevenue: row.cashlessRevenue / 1_000_000 })), [timeline]);
  const markupTrend = useMemo(() => timeline.map(row => ({ month: row.month, markupSmoked: row.markupSmoked, markupFrozen: row.markupFrozen, markupTotal: row.markupTotal })), [timeline]);
  const paymentBase = scope.receiptsTotal || scope.cashRevenue + scope.cashlessRevenue;
  const cashShare = paymentBase ? scope.cashRevenue / paymentBase * 100 : 0;
  const cashlessShare = paymentBase ? scope.cashlessRevenue / paymentBase * 100 : 0;
  const ranked = [...facts.summaries].sort((a, b) => b.netProfit - a.netProfit);
  const leaders = ranked.slice(0, 3);
  const risks = [...ranked].sort((a, b) => a.netProfit - b.netProfit).slice(0, 3);
  const evotorCard = mayReadEvotorFacts && <section className="packet-card home-evotor-summary" aria-label="Read-only факты Эвотор"><div className="card-title"><div><span>ФАКТЫ ЭВОТОР · READ-ONLY</span><h3>Чеки и оплаты в выбранном срезе</h3></div><Link href="/cadence" className="card-link">Ритм <ArrowRight size={14}/></Link></div><p className="packet-note">{evotorCoverageNote}. Это отдельный источник: он не заменяет выручку и P&amp;L из импортированной книги.</p>{evotorFacts.isLoading || !evotorSummary ? <p className="packet-note home-evotor-loading">Загружаем агрегаты чеков Эвотор…</p> : <><div className="packet-kpis home-kpis home-evotor-kpis"><Kpi label="Выручка общая Эвотор" value={evotorSummary.checks ? evotorMoney(evotorSummary.amount) : "—"} note={`${evotorSummary.checks.toLocaleString("ru-RU")} чек.`}/><Kpi label="Выручка нал Эвотор" value={evotorSummary.checks ? evotorMoney(evotorSummary.cashAmount) : "—"} note={evotorPaymentNote}/><Kpi label="Выручка б/нал Эвотор" value={evotorSummary.checks ? evotorMoney(evotorSummary.cashlessAmount) : "—"} note={evotorPaymentNote}/><Kpi label="Возвраты Эвотор" value={evotorMoney(evotorSummary.returnAmount)} note={`${evotorSummary.returns.toLocaleString("ru-RU")} возвратн. док.`}/><Kpi label="Чеки Эвотор" value={evotorSummary.checks.toLocaleString("ru-RU")} note={evotorCoverageNote}/><Kpi label="Средний чек Эвотор" value={evotorSummary.checks ? evotorMoney(evotorSummary.amount / evotorSummary.checks) : "—"} note="только по уже импортированным чекам"/></div><p className="packet-note home-evotor-payment-note">{evotorPaymentCoverageText}</p></>}</section>;

  return <AuditShell kicker="00 / СЕТЕВОЙ ОБЗОР" title="Операционный пакет сети">
    {!facts.available ? mayReadEvotorFacts ? <><section className="page-lede home-evotor-only"><div><span>ОПЕРАЦИОННЫЙ СРЕЗ · ЭВОТОР</span><h2>Загруженные чеки доступны без книги Excel.</h2><p>Ни выручка из Excel, ни P&amp;L, ни расходы не подставляются. Ниже показан только отдельный read-only факт Эвотор по срезу «{evotorScope}».</p></div></section>{evotorCard}</> : facts.loading || me.isLoading ? <FactsLoader/> : <EmptyFacts/> : <>
      <section className="cover"><div><p className="packet-kicker">ФАКТИЧЕСКИЕ ДАННЫЕ · {facts.storeNames.length} МАГАЗИНОВ</p><h2>Прибыль, запас и риск — в одном управленческом контуре.</h2><p>Выберите сеть или одну точку, затем откройте временной ряд, расходы, товарный поток или профиль. Крупные суммы показаны в <b>млн ₽</b>, малые — в <b>тыс. ₽</b>.</p><Link href="/months" className="packet-link">Открыть месячное сравнение <ArrowRight size={16}/></Link></div><div className="cover-note"><span>{isAll ? "Чистая маржа сети" : `Профиль · ${scope.store}`}</span><strong>{formatPct(scope.netMargin)}</strong><small>{isAll ? `${facts.summaries.filter(item => item.netProfit < 0).length} убыточных магазинов` : "выбранный магазин в текущем срезе"}</small></div></section>
      <section className="packet-kpis home-kpis"><Kpi label="Выручка" value={money(scope.revenue)} note={isAll ? `${facts.storeNames.length} магазина в охвате` : `${scope.store} · ${rangeLabel}`}/><Kpi label="Валовая прибыль" value={money(scope.grossProfit)} note={`маржа ${formatPct(scope.grossMargin)}`}/><Kpi label="Чистая прибыль" value={money(scope.netProfit)} note={`маржа ${formatPct(scope.netMargin)}`} risk={scope.netProfit < 0}/><Kpi label="Конечный остаток" value={money(scope.stockClose)} note={`${scope.coverDays.toFixed(1)} дня покрытия`}/><Kpi label="Доля наличной выручки" value={formatPct(cashShare)} note={`${money(scope.cashRevenue)} из выручки общей`}/><Kpi label="Доля безналичной выручки" value={formatPct(cashlessShare)} note={`${money(scope.cashlessRevenue)} из выручки общей`}/></section>
      {evotorCard}
      <section className="packet-split"><article className="packet-card wide"><div className="card-title"><div><span>{isAll ? "ДИНАМИКА СЕТИ" : `ДИНАМИКА · ${scope.store}`}</span><h3>Выручка и чистая прибыль по месяцам</h3></div><small>млн ₽</small></div><MetricLineChart data={chartData} unit="m" lines={[{ key: "revenue", name: "Выручка", color: "#c16c86" }, { key: "netProfit", name: "Чистая прибыль", color: "#ffcf7b" }]}/></article><article className="packet-card"><div className="card-title"><div><span>БЫСТРЫЙ СРЕЗ</span><h3>{scopeLabel}</h3></div></div><label className="quick-select">Срез<ThemedSelect value={isAll ? "__all__" : selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="__all__">Все магазины</option>{facts.storeNames.map(name => <option key={name} value={name}>{name}</option>)}</ThemedSelect></label><div className="quick-grid"><span>Выручка <b>{money(scope.revenue)}</b></span><span>Прибыль <b>{money(scope.netProfit)}</b></span><span>Расходы <b>{money(scope.expenses)}</b></span><span>Покрытие <b>{scope.coverDays.toFixed(1)} дн.</b></span></div>{isAll ? <Link href="/portfolio" className="packet-link compact home-portfolio-link">Перейти к портфелю <ArrowRight size={15}/></Link> : <Link href="/stores" className="packet-link compact home-portfolio-link">Перейти в профиль магазина <ArrowRight size={15}/></Link>}</article></section>
      <section className="packet-card payment-trend-card"><div className="card-title"><div><span>СПОСОБЫ ОПЛАТЫ · ПО МЕСЯЦАМ</span><h3>Наличная и безналичная выручка</h3></div><small>млн ₽ · фактические строки</small></div><MetricLineChart data={paymentTrend} unit="m" chartTitle="Тренд способов оплаты" lines={[{ key: "cashRevenue", name: "Выручка нал", color: "#00A3A3" }, { key: "cashlessRevenue", name: "Выручка б/нал", color: "#5E5CE6" }]}/></section>
      <section className="packet-card markup-trend-card"><div className="card-title"><div><span>НАЦЕНКА · ПО МЕСЯЦАМ</span><h3>Копченая, мороженая и общий товарный поток</h3></div><small>расчет из фактических продаж и закупок</small></div><MetricLineChart data={markupTrend} percent chartTitle="Динамика наценки" lines={[{ key: "markupSmoked", name: "% наценки Коп.", color: "#FF765F" }, { key: "markupFrozen", name: "% наценки Мор.", color: "#5E5CE6" }, { key: "markupTotal", name: "% наценки Общий", color: "#FFB04A" }]}/></section>
      <section className="launch-grid"><Link href="/months" className="launch-card"><ChartNoAxesCombined/><div><b>Месячный разбор</b><small>факты против медианы сети</small></div><ArrowRight size={16}/></Link><Link href="/expenses" className="launch-card"><CircleDollarSign/><div><b>Расходы</b><small>каждая строка против сети</small></div><ArrowRight size={16}/></Link><Link href="/inventory" className="launch-card"><Boxes/><div><b>Остатки</b><small>запас, списания, движение</small></div><ArrowRight size={16}/></Link><Link href="/compare" className="launch-card"><GitCompareArrows/><div><b>Сравнить точки</b><small>два магазина на одном экране</small></div><ArrowRight size={16}/></Link></section>
      <section className="packet-split"><article className="packet-card"><div className="card-title"><div><span>ТОП-3 ПО ЧИСТОЙ ПРИБЫЛИ</span><h3>Лидеры сети</h3></div><Link href="/portfolio" className="card-link">Вся карта <ArrowRight size={14}/></Link></div>{leaders.map((item, index) => <div className="rank-row" key={item.store}><b>#{index + 1}</b><span>{item.store}</span><strong className="positive">{money(item.netProfit)}</strong><small>{formatPct(item.netMargin)}</small></div>)}</article><article className="packet-card"><div className="card-title"><div><span>АНТИРЕЙТИНГ</span><h3>Точки с максимальным риском</h3></div><Link href="/portfolio" className="card-link">Вся карта <ArrowRight size={14}/></Link></div>{risks.map((item, index) => <div className="rank-row" key={item.store}><b>#{facts.summaries.length - index}</b><span>{item.store}</span><strong className={item.netProfit < 0 ? "negative" : ""}>{money(item.netProfit)}</strong><small>{formatPct(item.netMargin)}</small></div>)}</article></section>
    </>}
  </AuditShell>;
}
