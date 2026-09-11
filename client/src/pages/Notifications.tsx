import { ArrowUpRight, BellRing, CheckCheck, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";

const severityIcon = { critical: CircleAlert, warning: TriangleAlert, info: Info };
const severityLabel = { critical: "Критично", warning: "Контроль", info: "Информация" };
const cashControlRuleKeys = new Set(["cash_expense_daily", "ndfl_22_daily"]);

type ThresholdDraft = { threshold: number; isEnabled: boolean };
type ThresholdRule = { ruleKey: string; label: string; description: string; comparison: "gte" | "lte"; threshold: number; isEnabled: boolean; unit: string };
const importIdFromAddress = () => {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("import");
  return value && /^\d+$/.test(value) ? Number(value) : null;
};

function ThresholdRuleCard({ rule, draft, onDraftChange, onSave, isSaving }: { rule: ThresholdRule; draft: ThresholdDraft; onDraftChange: (next: ThresholdDraft) => void; onSave: () => void; isSaving: boolean }) {
  return <form className={`threshold-rule ${draft.isEnabled ? "" : "is-disabled"}`} onSubmit={event => { event.preventDefault(); onSave(); }}>
    <div className="threshold-copy"><strong>{rule.label}</strong><small>{rule.comparison === "gte" ? "Сигнал при значении не ниже" : "Сигнал при значении не выше"} порога · {rule.description}</small></div>
    <label className="threshold-enabled"><input type="checkbox" checked={draft.isEnabled} onChange={event => onDraftChange({ ...draft, isEnabled: event.target.checked })}/><span>{draft.isEnabled ? "Включен" : "Отключен"}</span></label>
    <label className="threshold-amount">Порог<input type="number" min="0" step="100" value={draft.threshold} onChange={event => onDraftChange({ ...draft, threshold: Number(event.target.value) || 0 })}/><span>{rule.unit}</span></label>
    <button className="packet-link compact" disabled={isSaving}>Сохранить</button>
  </form>;
}

export default function Notifications() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { setSelectedStore } = useAudit();
  const me = trpc.localAuth.me.useQuery();
  const notificationSummary = trpc.localAuth.notificationSummary.useQuery(undefined, { retry: false });
  const notifications = trpc.localAuth.notifications.useInfiniteQuery({ limit: 50 }, { getNextPageParam: page => page.nextCursor ?? undefined, retry: false });
  const [activeImportId, setActiveImportId] = useState<number | null>(importIdFromAddress);
  const importAlertDetails = trpc.localAuth.importAlertDetails.useInfiniteQuery({ importId:activeImportId ?? 0, limit:50 }, { enabled:activeImportId!==null, getNextPageParam:page=>page.nextCursor ?? undefined, retry:false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const thresholds = trpc.audit.alertThresholds.useQuery(undefined, { enabled: me.data?.role === "admin", retry: false });
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, ThresholdDraft>>({});

  useEffect(() => {
    if (thresholds.data) setThresholdDrafts(Object.fromEntries(thresholds.data.map(rule => [rule.ruleKey, { threshold: rule.threshold, isEnabled: rule.isEnabled }])));
  }, [thresholds.data]);
  useEffect(() => {
    const syncFromAddress = () => setActiveImportId(importIdFromAddress());
    window.addEventListener("popstate", syncFromAddress);
    return () => window.removeEventListener("popstate", syncFromAddress);
  }, []);

  const refreshNotifications = () => Promise.all([utils.localAuth.notifications.invalidate(), utils.localAuth.notificationSummary.invalidate()]);
  const markRead = trpc.localAuth.markNotificationRead.useMutation({ onSuccess: refreshNotifications });
  const markAllRead = trpc.localAuth.markAllNotificationsRead.useMutation({ onSuccess: () => { refreshNotifications(); toast.success("Все доступные уведомления отмечены как прочитанные"); } });
  const saveThreshold = trpc.audit.updateAlertThreshold.useMutation({ onSuccess: () => { utils.audit.alertThresholds.invalidate(); toast.success("Порог сигнала сохранен"); } });
  const notificationItems = notifications.data?.pages.flatMap(page => page.items) ?? [];
  const importDetailItems = importAlertDetails.data?.pages.flatMap(page => page.items) ?? [];
  const unread = notificationSummary.data?.unread ?? 0;
  const allRules = (thresholds.data ?? []) as ThresholdRule[];
  const cashControlRules = allRules.filter(rule => cashControlRuleKeys.has(rule.ruleKey));
  const otherRules = allRules.filter(rule => !cashControlRuleKeys.has(rule.ruleKey));
  const setDraft = (ruleKey: string, next: ThresholdDraft) => setThresholdDrafts(current => ({ ...current, [ruleKey]: next }));
  const draftFor = (rule: ThresholdRule) => thresholdDrafts[rule.ruleKey] ?? { threshold: rule.threshold, isEnabled: rule.isEnabled };
  const saveRule = (rule: ThresholdRule) => { const draft = draftFor(rule); saveThreshold.mutate({ ruleKey: rule.ruleKey, threshold: draft.threshold, isEnabled: draft.isEnabled }); };
  const openImportDetails = (importId: string | null) => {
    if (!importId || !/^\d+$/.test(importId)) return;
    const next = Number(importId);
    window.history.pushState(null, "", `/notifications?import=${next}`);
    setActiveImportId(next);
  };
  const closeImportDetails = () => {
    window.history.pushState(null, "", "/notifications");
    setActiveImportId(null);
  };

  const openSource = (item: { id: number; entityType: string | null; entityId: string | null }) => {
    if (!item.entityType || !item.entityId) return;
    markRead.mutate({ id: item.id });
    if (item.entityType === "import") { setLocation("/import"); return; }
    if (item.entityType === "alert_feed") { openImportDetails(item.entityId); return; }
    if (item.entityType === "weekly_report") { setLocation(`/reports?report=${item.entityId}`); return; }
    if (item.entityType === "metric") { const [storeId, entryDate, metricCode] = item.entityId.split(":"); sessionStorage.setItem("auditManageTarget", JSON.stringify({ storeId: Number(storeId), entryDate, metricCode })); setLocation("/manage"); return; }
    if (item.entityType === "threshold") { const [storeId, entryDate] = item.entityId.split(":"); if (entryDate) { sessionStorage.setItem("auditManageTarget", JSON.stringify({ storeId: Number(storeId), entryDate })); setLocation("/manage"); return; } const store = stores.data?.find(row => row.id === Number(storeId)); if (store) setSelectedStore(store.name); setLocation("/stores"); return; }
    if (item.entityType === "store") { const store = stores.data?.find(row => row.id === Number(item.entityId)); if (store) setSelectedStore(store.name); setLocation("/stores"); }
  };

  const sourceLabel = (item: { entityType: string | null }) => item.entityType === "import" ? "Открыть импорт" : item.entityType === "alert_feed" ? "Открыть детали" : item.entityType === "metric" ? "Открыть факт" : item.entityType === "threshold" ? "Открыть источник" : item.entityType === "store" ? "Открыть магазин" : item.entityType === "weekly_report" ? "Открыть отчет" : null;

  return <AuditShell kicker="15 / УВЕДОМЛЕНИЯ" title="Сигналы и контроль">
    <section className="page-lede"><div><span>ЦЕНТР СОБЫТИЙ</span><h2>Критичные изменения под контролем</h2><p>Сигналы появляются при нарушении выбранных порогов, существенных ручных изменениях и замене периодов при импорте. Их получают администраторы и назначенные пользователи магазина.</p></div></section>
    <section className="packet-kpis equal"><article className="packet-kpi"><span>НЕПРОЧИТАННО</span><strong>{unread}</strong><small>событий требуют просмотра</small></article><article className="packet-kpi"><span>РУЧНЫЕ ИЗМЕНЕНИЯ</span><strong>25%</strong><small>при выполнении абсолютного порога метрики</small></article><article className="packet-kpi risk"><span>ПОРОГИ РИСКА</span><strong>{allRules.filter(rule => rule.isEnabled).length}</strong><small>включенных правил контроля</small></article><article className="packet-kpi"><span>ДОСТАВКА</span><strong>Сайт + телефон</strong><small>при включенных уведомлениях устройства</small></article></section>
    {me.data?.role === "admin" && <section className="packet-card alert-thresholds"><div className="card-title"><div><span>НАСТРОЙКИ ПОРОГОВ</span><h3>Когда отправлять сигнал</h3></div></div><p className="packet-note">Порог применяется при ручном изменении факта и после импорта. Отключенное правило не формирует системные и телефонные уведомления.</p>
      {cashControlRules.length > 0 && <div className="threshold-grid threshold-grid-cash">{cashControlRules.map(rule => <ThresholdRuleCard key={rule.ruleKey} rule={rule} draft={draftFor(rule)} onDraftChange={next => setDraft(rule.ruleKey, next)} onSave={() => saveRule(rule)} isSaving={saveThreshold.isPending}/>)}</div>}
      <div className="threshold-grid">{otherRules.map(rule => <ThresholdRuleCard key={rule.ruleKey} rule={rule} draft={draftFor(rule)} onDraftChange={next => setDraft(rule.ruleKey, next)} onSave={() => saveRule(rule)} isSaving={saveThreshold.isPending}/>)}</div>
    </section>}
    {activeImportId !== null && <section className="packet-card import-alert-details"><div className="card-title"><div><span>ДЕТАЛИ ИМПОРТА</span><h3>Пороговые события выбранной книги</h3></div><button className="subtle-button" onClick={closeImportDetails}>Скрыть детали</button></div><p className="packet-note">Показаны фактические события этой книги в пределах ваших прав на магазины. Это детали итогового уведомления, а не новые непрочитанные сообщения.</p>{importAlertDetails.isLoading ? <p className="packet-note">Загружаем детали импорта…</p> : importAlertDetails.error ? <p className="packet-note">Не удалось открыть детали импорта.</p> : importDetailItems.length ? <div className="import-alert-detail-list">{importDetailItems.map(item => { const Icon=severityIcon[item.rule.severity]; return <article key={`${item.storeId}:${item.entryDate}:${item.rule.ruleKey}`} className="notification-item import-alert-detail"><div className={`notification-icon ${item.rule.severity}`}><Icon size={18}/></div><div><div className="notification-title"><strong>{item.rule.label}</strong><span>{severityLabel[item.rule.severity]}</span></div><p><b>{item.store}</b> · {new Date(`${item.entryDate}T00:00:00`).toLocaleDateString("ru-RU")}: {item.rule.description} — <strong>{item.amount.toLocaleString("ru-RU")} {item.rule.unit}</strong></p></div></article>; })}</div> : <p className="packet-note">Для этой книги доступных пороговых событий не найдено.</p>}{importAlertDetails.hasNextPage && <button className="packet-link compact notification-load-more" onClick={() => importAlertDetails.fetchNextPage()} disabled={importAlertDetails.isFetchingNextPage}>{importAlertDetails.isFetchingNextPage ? "Загружаем…" : "Показать еще"}</button>}</section>}
    <section className="packet-card notification-list"><div className="card-title"><div><span>ИСТОРИЯ СОБЫТИЙ</span><h3>Лента уведомлений</h3></div><div className="notification-list-actions">{unread > 0 && <><span className="unread-pill"><BellRing size={14}/>{unread} непрочит.</span><button className="subtle-button notification-mark-all" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}><CheckCheck size={14}/>Прочитать все</button></>}</div></div>{notifications.isLoading ? <p className="packet-note">Загружаем события…</p> : notificationItems.length ? <>{notificationItems.map(item => { const Icon = severityIcon[item.severity]; const link = sourceLabel(item); return <article key={item.id} className={`notification-item ${item.isRead ? "is-read" : ""}`}><div className={`notification-icon ${item.severity}`}><Icon size={18}/></div><div><div className="notification-title"><strong>{item.title}</strong><span>{severityLabel[item.severity]}</span></div><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("ru-RU")}</small></div><div className="notification-actions">{link && <button className="subtle-button notification-open" onClick={() => openSource(item)}><ArrowUpRight size={14}/>{link}</button>}{!item.isRead && <button className="subtle-button" onClick={() => markRead.mutate({ id: item.id })} disabled={markRead.isPending}>Прочитано</button>}</div></article>; })}{notifications.hasNextPage && <button className="packet-link compact notification-load-more" onClick={() => notifications.fetchNextPage()} disabled={notifications.isFetchingNextPage}>{notifications.isFetchingNextPage ? "Загружаем…" : "Показать еще"}</button>}</> : <div className="empty-state"><BellRing size={28}/><h2>Сигналов пока нет</h2><p>После импорта или существенного изменения фактов события появятся здесь.</p></div>}</section>
  </AuditShell>;
}
