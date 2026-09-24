import { Gift, PencilLine, Sparkles, Target, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { MonthPicker } from "@/components/MonthPicker";
import { ThemedSelect } from "@/components/ui/themed-select";
import { FactsLoader } from "@/components/OceanLoader";
import { trpc } from "@/lib/trpc";
import { formatBusinessMonth } from "@/lib/utils";
import "@/revenue-plan.css";

type RevenuePlanRow = {
  storeId: number;
  storeName: string;
  planAmount: number | null;
  actualAmount: number;
  checks: number;
  percent: number | null;
  reachedMilestones: number[];
  rewardText: string | null;
  recommendation: RevenuePlanRecommendation;
};

type Reward = Pick<RevenuePlanRow, "storeName" | "rewardText">;
type RevenuePlanRecommendation = {
  recommendedAmount: number | null;
  mode: "growth" | "preserve" | "history" | "forecast" | "unavailable";
  lastYearAmount: number | null;
  currentYearAmount: number | null;
  currentYearForecast: number | null;
};

const MOSCOW = "Europe/Moscow";
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function currentMoscowMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MOSCOW, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const take = (kind: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === kind)?.value ?? "01";
  return `${take("year")}-${take("month")}`;
}

function percentText(percent: number | null) {
  if (percent === null) return "План не задан";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(percent)}%`;
}

function recommendationCopy(recommendation: RevenuePlanRecommendation) {
  const proposed = recommendation.recommendedAmount === null ? null : money.format(recommendation.recommendedAmount);
  if (recommendation.mode === "preserve") return { proposed, explanation: `Темп этого месяца ${money.format(recommendation.currentYearForecast ?? 0)} — ниже ${money.format(recommendation.lastYearAmount ?? 0)} за тот же месяц прошлого года. Цель: сохранить прошлогодний уровень.` };
  if (recommendation.mode === "growth") return { proposed, explanation: recommendation.currentYearForecast !== null ? `Темп этого месяца ${money.format(recommendation.currentYearForecast)}; предложение включает умеренный рост 3%.` : `Факт выбранного месяца ${money.format(recommendation.currentYearAmount ?? 0)}; предложение включает умеренный рост 3%.` };
  if (recommendation.mode === "history") return { proposed, explanation: `Основа — ${money.format(recommendation.lastYearAmount ?? 0)} за тот же месяц прошлого года; предложение включает рост 3%.` };
  if (recommendation.mode === "forecast") return { proposed, explanation: `Основа — текущий прогноз ${money.format(recommendation.currentYearForecast ?? 0)}; предложение включает рост 3%.` };
  return { proposed: null, explanation: "Недостаточно нормализованных продаж Эвотор за текущий и соответствующий месяц прошлого года — рекомендация не выдумывается." };
}

function ProgressScale({ row, showAmounts, onOpenReward }: { row: RevenuePlanRow; showAmounts: boolean; onOpenReward: (row: RevenuePlanRow) => void }) {
  const rawPercent = row.percent ?? 0;
  const displayPercent = Math.max(0, Math.min(rawPercent, 100));
  const achieved = rawPercent >= 100 && Boolean(row.rewardText);
  return <div className="revenue-plan-scale" aria-label={row.percent === null ? "Месячный план не задан" : `Выполнено ${percentText(row.percent)} месячного плана`}>
    <div className="revenue-plan-track" aria-hidden="true"><i style={{ width: `${displayPercent}%` }}/></div>
    {[75, 95, 100].map(marker => <span key={marker} className={rawPercent >= marker ? "revenue-plan-marker is-reached" : "revenue-plan-marker"} style={{ left: `${marker}%` }}><b>{marker}%</b></span>)}
    <button type="button" className={achieved ? "revenue-plan-chest is-ready" : "revenue-plan-chest"} disabled={!achieved} onClick={() => onOpenReward(row)} aria-label={achieved ? `Открыть награду: ${row.storeName}` : row.rewardText ? "Награда откроется после 100%" : "Награда не задана"} title={achieved ? "Открыть награду" : row.rewardText ? "Откроется после 100%" : "Награда не задана"}><Gift size={18}/><Sparkles size={11}/></button>
    <div className="revenue-plan-progress-copy"><strong>{percentText(row.percent)}</strong>{showAmounts && row.planAmount !== null && <span>{money.format(row.actualAmount)} из {money.format(row.planAmount)}</span>}</div>
  </div>;
}

function RewardDialog({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return <div className="revenue-plan-reward-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="revenue-plan-reward-dialog" role="dialog" aria-modal="true" aria-labelledby="revenue-plan-reward-title">
      <button type="button" className="revenue-plan-reward-close" onClick={onClose} aria-label="Закрыть награду"><X size={17}/></button>
      <div className="revenue-plan-fireworks" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      <div className="revenue-plan-reward-icon"><Gift size={35}/><Sparkles size={17}/></div>
      <span>ПЛАН ВЫПОЛНЕН</span>
      <h2 id="revenue-plan-reward-title">{reward.storeName}</h2>
      <p>{reward.rewardText}</p>
      <button type="button" className="packet-link compact" onClick={onClose}>Забрать награду</button>
    </section>
  </div>;
}

export default function RevenuePlan() {
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const [monthDate, setMonthDate] = useState(currentMoscowMonth);
  const plans = trpc.audit.evotorRevenuePlans.useQuery({ monthDate }, { retry: false });
  const utils = trpc.useUtils();
  const [storeScope, setStoreScope] = useState("__all__");
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftReward, setDraftReward] = useState("");
  const [reward, setReward] = useState<Reward | null>(null);
  const isSeller = session.data?.role === "seller";
  const canEdit = session.data?.role === "admin" || session.data?.role === "manager";
  const rows = (plans.data?.rows ?? []) as RevenuePlanRow[];
  const filteredRows = useMemo(() => storeScope === "__all__" ? rows : rows.filter(row => String(row.storeId) === storeScope), [rows, storeScope]);
  const editingRow = rows.find(row => row.storeId === editingStoreId) ?? null;
  const updatePlan = trpc.audit.upsertEvotorRevenuePlan.useMutation({
    onSuccess: async () => {
      await utils.audit.evotorRevenuePlans.invalidate({ monthDate });
      toast.success("Месячный план сохранен");
      setEditingStoreId(null);
      setDraftAmount("");
      setDraftReward("");
    },
    onError: error => toast.error(error.message),
  });

  const openEditor = (row: RevenuePlanRow) => {
    setEditingStoreId(row.storeId);
    setDraftAmount(row.planAmount === null && row.recommendation.recommendedAmount !== null ? String(row.recommendation.recommendedAmount) : row.planAmount === null ? "" : String(row.planAmount));
    setDraftReward(row.rewardText ?? "");
  };
  const save = () => {
    if (!editingStoreId) return;
    const amount = Number(draftAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Укажите план больше нуля"); return; }
    if (!draftReward.trim()) { toast.error("Укажите текст награды"); return; }
    updatePlan.mutate({ storeId: editingStoreId, monthDate, metricCode: "evotor_revenue", amount, rewardText: draftReward.trim() });
  };
  const periodCaption = plans.data?.throughDate
    ? plans.data.isCurrentMonth ? `Факт по Эвотор на ${plans.data.throughDate.split("-").reverse().join(".")} МСК` : `Факт за месяц до ${plans.data.throughDate.split("-").reverse().join(".")}`
    : "Будущий месяц: фактов Эвотор пока нет";

  if (session.isLoading || plans.isLoading) return <AuditShell kicker="36 / ПЛАН" title="План выручки"><section className="empty-state"><FactsLoader label="Готовим план выручки…"/></section></AuditShell>;
  if (plans.error) return <AuditShell kicker="36 / ПЛАН" title="План выручки"><section className="empty-state"><Target size={28}/><h2>План выручки недоступен</h2><p>{plans.error.message}</p></section></AuditShell>;

  return <AuditShell kicker="36 / ПЛАН" title="План выручки Эвотор">
    <section className="page-lede revenue-plan-lede"><div><span>МЕСЯЧНАЯ ЦЕЛЬ МАГАЗИНА</span><h2>Продажи Эвотор — к цели месяца</h2><p>Факт строится только по нормализованным чекам продажи Эвотор. Возвраты остаются отдельными документами и не вычитаются скрыто. Продавец видит процент выполнения, руководитель и администратор — также суммы.</p></div><div className="revenue-plan-filter"><label>Месяц<MonthPicker value={monthDate} onChange={setMonthDate}/></label>{!isSeller && <label>Магазины<ThemedSelect value={storeScope} onChange={event => setStoreScope(event.target.value)}><option value="__all__">Все доступные магазины</option>{rows.map(row => <option key={row.storeId} value={row.storeId}>{row.storeName}</option>)}</ThemedSelect></label>}</div></section>
    <p className="packet-note revenue-plan-source-note">{periodCaption}. Уведомления создаются при достижении 25%, 50%, 75% и 100%; никаких тестовых продаж или начислений эта страница не формирует.</p>

    {canEdit && <section className="packet-card revenue-plan-editor-card"><div className="card-title"><div><span>НАСТРОЙКА</span><h3>{editingRow ? `План · ${editingRow.storeName}` : "Выберите магазин для плана"}</h3></div>{editingRow && <button type="button" className="subtle-action" onClick={() => setEditingStoreId(null)}>Закрыть</button>}</div>{editingRow ? <form className="revenue-plan-editor" onSubmit={event => { event.preventDefault(); save(); }}><label>Месяц<MonthPicker value={monthDate} onChange={setMonthDate}/></label><label>План выручки, ₽<input value={draftAmount} onChange={event => setDraftAmount(event.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="Например, 1200000"/></label><aside className="revenue-plan-suggestion"><span>РЕКОМЕНДАЦИЯ</span>{editingRow.recommendation.recommendedAmount === null ? <p>{recommendationCopy(editingRow.recommendation).explanation}</p> : <><strong>{recommendationCopy(editingRow.recommendation).proposed}</strong><p>{recommendationCopy(editingRow.recommendation).explanation}</p><button type="button" className="subtle-action" onClick={() => setDraftAmount(String(editingRow.recommendation.recommendedAmount))}>Подставить</button></>}</aside><label className="revenue-plan-reward-field">Награда за 100%<textarea value={draftReward} onChange={event => setDraftReward(event.target.value.slice(0, 280))} placeholder="Например: премия по итогам месяца" maxLength={280}/><small>{draftReward.length}/280 · станет доступна в сундуке после 100%</small></label><button className="packet-link compact" disabled={updatePlan.isPending}>{updatePlan.isPending ? "Сохраняем…" : "Сохранить план"}</button></form> : <p className="packet-note">Выберите «Настроить план» у нужного магазина. План и награда задаются отдельно для каждого месяца.</p>}</section>}

    <section className="revenue-plan-list" aria-label="Планы выручки по магазинам">{filteredRows.length ? filteredRows.map(row => <article key={row.storeId} className={row.percent !== null && row.percent >= 100 ? "revenue-plan-card is-complete" : "revenue-plan-card"}><div className="revenue-plan-card-head"><div><span>{formatBusinessMonth(monthDate, { month: "long", year: "numeric" })}</span><h3>{row.storeName}</h3></div>{canEdit && <button type="button" className="subtle-action revenue-plan-edit" onClick={() => openEditor(row)}><PencilLine size={15}/>{row.planAmount === null ? "Настроить план" : "Изменить"}</button>}</div><ProgressScale row={row} showAmounts={!isSeller} onOpenReward={current => setReward({ storeName: current.storeName, rewardText: current.rewardText })}/>{!isSeller && <div className="revenue-plan-stats"><span>Чеки продажи: <b>{integer.format(row.checks)}</b></span><span>{row.planAmount === null ? "План не задан" : `Осталось: ${money.format(Math.max(0, row.planAmount - row.actualAmount))}`}</span></div>}{canEdit && row.planAmount === null && <p className="revenue-plan-card-suggestion">{row.recommendation.recommendedAmount === null ? "Рекомендация не сформирована: недостаточно сопоставимых продаж." : <>Рекомендованная цель: <b>{money.format(row.recommendation.recommendedAmount)}</b></>}</p>}<div className="revenue-plan-milestones"><span className={row.reachedMilestones.includes(25) ? "is-reached" : ""}>25%</span><span className={row.reachedMilestones.includes(50) ? "is-reached" : ""}>50%</span><span className={row.reachedMilestones.includes(75) ? "is-reached" : ""}>75%</span><span className={row.reachedMilestones.includes(100) ? "is-reached" : ""}>100%</span></div></article>) : <section className="empty-state"><Target size={28}/><h2>Нет доступных магазинов</h2><p>План появится после назначения доступа к магазину.</p></section>}</section>
    {reward && <RewardDialog reward={reward} onClose={() => setReward(null)}/>} 
  </AuditShell>;
}
