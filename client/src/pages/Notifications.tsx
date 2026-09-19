import { ArrowUpRight, BellRing, CheckCheck, CircleAlert, Info, Megaphone, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";
import { ThemedSelect } from "@/components/ui/themed-select";
import { formatLocalAccountLogin } from "@/lib/accountLogin";

const severityIcon = { critical: CircleAlert, warning: TriangleAlert, info: Info };
const severityLabel = { critical: "Критично", warning: "Контроль", info: "Информация" };
const cashControlRuleKeys = new Set(["cash_expense_daily", "ndfl_22_daily"]);

type ThresholdDraft = { threshold: string; isEnabled: boolean };
type BroadcastTarget = "all" | "account" | "role";
type AccountRole = "admin" | "analyst" | "seller" | "manager";
type ThresholdRule = { ruleKey: string; label: string; description: string; comparison: "gte" | "lte"; threshold: number; isEnabled: boolean; unit: string };
const importIdFromAddress = () => {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("import");
  return value && /^\d+$/.test(value) ? Number(value) : null;
};

function ThresholdRuleCard({ rule, draft, onDraftChange, onSave, isSaving }: { rule: ThresholdRule; draft: ThresholdDraft; onDraftChange: (next: ThresholdDraft) => void; onSave: () => void; isSaving: boolean }) {
  const step = rule.unit === "₽" ? 100 : 0.5;
  return <form className={`threshold-rule ${draft.isEnabled ? "" : "is-disabled"}`} onSubmit={event => { event.preventDefault(); onSave(); }}>
    <div className="threshold-copy"><strong>{rule.label}</strong><small>{rule.comparison === "gte" ? "Сигнал при значении не ниже" : "Сигнал при значении не выше"} порога · {rule.description}</small></div>
    <label className="threshold-enabled"><input type="checkbox" checked={draft.isEnabled} onChange={event => onDraftChange({ ...draft, isEnabled: event.target.checked })}/><span>{draft.isEnabled ? "Включен" : "Отключен"}</span></label>
    <label className="threshold-amount">Порог<input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" aria-label={`Порог: ${rule.label}`} value={draft.threshold} onChange={event => onDraftChange({ ...draft, threshold: event.target.value.replace(/[^0-9.,]/g, "") })}/><span>{rule.unit}</span></label>
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
  const firstUnreadRef = useRef<HTMLElement | null>(null);
  const importAlertDetails = trpc.localAuth.importAlertDetails.useInfiniteQuery({ importId:activeImportId ?? 0, limit:50 }, { enabled:activeImportId!==null, getNextPageParam:page=>page.nextCursor ?? undefined, retry:false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const thresholds = trpc.audit.alertThresholds.useQuery(undefined, { enabled: me.data?.role === "admin", retry: false });
  const accounts = trpc.localAuth.list.useQuery(undefined, { enabled: me.data?.role === "admin", retry: false });
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, ThresholdDraft>>({});
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState<BroadcastTarget>("all");
  const [broadcastAccountId, setBroadcastAccountId] = useState("");
  const [broadcastRole, setBroadcastRole] = useState<AccountRole>("analyst");

  useEffect(() => {
    if (thresholds.data) setThresholdDrafts(Object.fromEntries(thresholds.data.map(rule => [rule.ruleKey, { threshold: String(rule.threshold), isEnabled: rule.isEnabled }])));
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
  const broadcast = trpc.localAuth.adminBroadcast.useMutation({ onSuccess: result => { setBroadcastText(""); utils.localAuth.notifications.invalidate(); utils.localAuth.notificationSummary.invalidate(); toast.success("Сообщение отправлено", { description: `В ленту: ${result.recipientAccounts}. Push принял сервис для устройств: ${result.pushSubscriptionsAccepted}.` }); }, onError: error => toast.error(error.message) });
  const notificationItems = notifications.data?.pages.flatMap(page => page.items) ?? [];
  const importDetailItems = importAlertDetails.data?.pages.flatMap(page => page.items) ?? [];
  const unread = notificationSummary.data?.unread ?? 0;
  const firstUnreadId = notificationItems.find(item => !item.isRead)?.id;
  const allRules = (thresholds.data ?? []) as ThresholdRule[];
  const activeAccounts = (accounts.data ?? []).filter(account => account.isActive);
  const broadcastAudience = broadcastTarget === "account" ? { kind: "account" as const, accountId: Number(broadcastAccountId) } : broadcastTarget === "role" ? { kind: "role" as const, role: broadcastRole } : { kind: "all" as const };
  const cashControlRules = allRules.filter(rule => cashControlRuleKeys.has(rule.ruleKey));
  const otherRules = allRules.filter(rule => !cashControlRuleKeys.has(rule.ruleKey));
  const setDraft = (ruleKey: string, next: ThresholdDraft) => setThresholdDrafts(current => ({ ...current, [ruleKey]: next }));
  const draftFor = (rule: ThresholdRule) => thresholdDrafts[rule.ruleKey] ?? { threshold: String(rule.threshold), isEnabled: rule.isEnabled };
  const saveRule = (rule: ThresholdRule) => { const draft = draftFor(rule); const threshold = Number(draft.threshold.replace(",", ".")); if (!Number.isFinite(threshold) || threshold < 0) { toast.error("Введите неотрицательное значение порога"); return; } saveThreshold.mutate({ ruleKey: rule.ruleKey, threshold, isEnabled: draft.isEnabled }); };
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
  const revealFirstUnread = () => {
    const target = firstUnreadRef.current;
    if (!target) { toast.info("Непрочитанное событие еще загружается", { description: "Нажмите «Показать еще», если оно не появится в текущей части ленты." }); return; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 260);
  };

  const openSource = (item: { id: number; entityType: string | null; entityId: string | null }) => {
    if (!item.entityType || !item.entityId) return;
    markRead.mutate({ id: item.id });
    if (item.entityType === "import") { setLocation("/import"); return; }
    if (item.entityType === "price") { setLocation("/price-control"); return; }
    if (item.entityType === "alert_feed") { openImportDetails(item.entityId); return; }
    if (item.entityType === "weekly_report") { setLocation(`/reports?report=${item.entityId}`); return; }
    if (item.entityType === "metric") { const [storeId, entryDate, metricCode] = item.entityId.split(":"); sessionStorage.setItem("auditManageTarget", JSON.stringify({ storeId: Number(storeId), entryDate, metricCode })); setLocation("/manage"); return; }
    if (item.entityType === "threshold") { const [storeId, entryDate] = item.entityId.split(":"); if (entryDate) { sessionStorage.setItem("auditManageTarget", JSON.stringify({ storeId: Number(storeId), entryDate })); setLocation("/manage"); return; } const store = stores.data?.find(row => row.id === Number(storeId)); if (store) setSelectedStore(store.name); setLocation("/stores"); return; }
    if (item.entityType === "operational_signal") { setLocation(item.entityId?.startsWith("request_missing:") ? "/requests" : "/revenue"); return; }
    if (item.entityType === "store") { const store = stores.data?.find(row => row.id === Number(item.entityId)); if (store) setSelectedStore(store.name); setLocation("/stores"); }
  };

  const sourceLabel = (item: { entityType: string | null }) => item.entityType === "import" ? "Открыть импорт" : item.entityType === "price" ? "Открыть прайс‑контроль" : item.entityType === "alert_feed" ? "Открыть детали" : item.entityType === "metric" ? "Открыть факт" : item.entityType === "threshold" ? "Открыть источник" : item.entityType === "operational_signal" ? "Открыть реестр" : item.entityType === "store" ? "Открыть магазин" : item.entityType === "weekly_report" ? "Открыть отчет" : null;

  return <AuditShell kicker="15 / УВЕДОМЛЕНИЯ" title="Сигналы и контроль">
    <section className="page-lede"><div><span>ЦЕНТР СОБЫТИЙ</span><h2>Критичные изменения под контролем</h2><p>Сигналы появляются при нарушении выбранных порогов, существенных ручных изменениях и замене периодов при импорте. Их получают администраторы и назначенные пользователи магазина.</p></div></section>
    <section className="packet-kpis equal notification-kpis"><button type="button" className="packet-kpi notification-unread-kpi" disabled={!unread} onClick={revealFirstUnread} aria-label={unread ? `Перейти к первому из ${unread} непрочитанных событий` : "Непрочитанных событий нет"}><span>НЕПРОЧИТАННО</span><strong>{unread}</strong><small>{unread ? "Нажмите, чтобы открыть первое событие" : "событий требуют просмотра"}</small></button><article className="packet-kpi"><span>РУЧНЫЕ ИЗМЕНЕНИЯ</span><strong>25%</strong><small>при выполнении абсолютного порога метрики</small></article><article className="packet-kpi risk"><span>ПОРОГИ РИСКА</span><strong>{allRules.filter(rule => rule.isEnabled).length}</strong><small>включенных правил контроля</small></article><article className="packet-kpi"><span>ДОСТАВКА</span><strong>Сайт + телефон</strong><small>при включенных уведомлениях устройства</small></article></section>
    {me.data?.role === "admin" && <section className="packet-card admin-broadcast"><div className="card-title"><div><span>СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯМ</span><h3>Рассылка в ленту сигналов</h3></div><Megaphone size={20}/></div><p className="packet-note">Сообщение попадет в ленту активных получателей. Push‑уведомление придет только на устройство с добровольно включенной браузерной подпиской.</p><form className="stack-form" onSubmit={event => { event.preventDefault(); if (broadcastText.trim() && (broadcastTarget !== "account" || broadcastAccountId)) broadcast.mutate({ message: broadcastText.trim(), audience: broadcastAudience }); }}><div className="broadcast-targeting"><span>Получатели</span><div className="broadcast-target-buttons" role="group" aria-label="Кому отправить сообщение"><button type="button" className={broadcastTarget === "all" ? "active" : ""} aria-pressed={broadcastTarget === "all"} onClick={() => setBroadcastTarget("all")}>Всем</button><button type="button" className={broadcastTarget === "account" ? "active" : ""} aria-pressed={broadcastTarget === "account"} onClick={() => setBroadcastTarget("account")}>Пользователю</button><button type="button" className={broadcastTarget === "role" ? "active" : ""} aria-pressed={broadcastTarget === "role"} onClick={() => setBroadcastTarget("role")}>По роли</button></div>{broadcastTarget === "account" && <label>Учетная запись<ThemedSelect value={broadcastAccountId} onChange={event => setBroadcastAccountId(event.target.value)} required><option value="">Выберите пользователя</option>{activeAccounts.map(account => <option key={account.id} value={account.id}>{formatLocalAccountLogin(account.username)}</option>)}</ThemedSelect></label>}{broadcastTarget === "role" && <label>Роль<ThemedSelect value={broadcastRole} onChange={event => setBroadcastRole(event.target.value as AccountRole)}><option value="analyst">Аналитики</option><option value="seller">Продавцы</option><option value="manager">Руководители</option><option value="admin">Администраторы</option></ThemedSelect></label>}</div><label>Текст сообщения<textarea value={broadcastText} onChange={event => setBroadcastText(event.target.value)} maxLength={360} placeholder="Например: завтра сверяем списания и остатки до 11:00." required/></label><div className="admin-broadcast-actions"><small>{broadcastText.trim().length}/360</small><button className="packet-link compact" disabled={!broadcastText.trim() || broadcast.isPending || (broadcastTarget === "account" && !broadcastAccountId)}><Megaphone size={15}/>{broadcast.isPending ? "Отправляем…" : "Отправить"}</button></div></form></section>}
    {me.data?.role === "admin" && <section className="packet-card alert-thresholds"><div className="card-title"><div><span>НАСТРОЙКИ ПОРОГОВ</span><h3>Когда отправлять сигнал</h3></div></div><p className="packet-note">Пороги базовых метрик проверяются при ручном изменении факта и после импорта. Отклонение наценки рассчитывается после импорта по доступным точкам на одну дату. Отключенное правило не формирует системные и телефонные уведомления.</p>
      {cashControlRules.length > 0 && <div className="threshold-grid threshold-grid-cash">{cashControlRules.map(rule => <ThresholdRuleCard key={rule.ruleKey} rule={rule} draft={draftFor(rule)} onDraftChange={next => setDraft(rule.ruleKey, next)} onSave={() => saveRule(rule)} isSaving={saveThreshold.isPending}/>)}</div>}
      <div className="threshold-grid">{otherRules.map(rule => <ThresholdRuleCard key={rule.ruleKey} rule={rule} draft={draftFor(rule)} onDraftChange={next => setDraft(rule.ruleKey, next)} onSave={() => saveRule(rule)} isSaving={saveThreshold.isPending}/>)}</div>
    </section>}
    {activeImportId !== null && <section className="packet-card import-alert-details"><div className="card-title"><div><span>ДЕТАЛИ ИМПОРТА</span><h3>Пороговые события выбранной книги</h3></div><button className="subtle-button" onClick={closeImportDetails}>Скрыть детали</button></div><p className="packet-note">Показаны фактические события этой книги в пределах ваших прав на магазины. Это детали итогового уведомления, а не новые непрочитанные сообщения.</p>{importAlertDetails.isLoading ? <p className="packet-note">Загружаем детали импорта…</p> : importAlertDetails.error ? <p className="packet-note">Не удалось открыть детали импорта.</p> : importDetailItems.length ? <div className="import-alert-detail-list">{importDetailItems.map(item => { const Icon=severityIcon[item.rule.severity]; return <article key={`${item.storeId}:${item.entryDate}:${item.rule.ruleKey}`} className="notification-item import-alert-detail"><div className={`notification-icon ${item.rule.severity}`}><Icon size={18}/></div><div><div className="notification-title"><strong>{item.rule.label}</strong><span>{severityLabel[item.rule.severity]}</span></div><p><b>{item.store}</b> · {new Date(`${item.entryDate}T00:00:00`).toLocaleDateString("ru-RU")}: {item.rule.description} — <strong>{item.amount.toLocaleString("ru-RU")} {item.rule.unit}</strong></p></div></article>; })}</div> : <p className="packet-note">Для этой книги доступных пороговых событий не найдено.</p>}{importAlertDetails.hasNextPage && <button className="packet-link compact notification-load-more" onClick={() => importAlertDetails.fetchNextPage()} disabled={importAlertDetails.isFetchingNextPage}>{importAlertDetails.isFetchingNextPage ? "Загружаем…" : "Показать еще"}</button>}</section>}
    <section className="packet-card notification-list"><div className="card-title"><div><span>ИСТОРИЯ СОБЫТИЙ</span><h3>Лента уведомлений</h3></div><div className="notification-list-actions">{unread > 0 && <><span className="unread-pill"><BellRing size={14}/>{unread} непрочит.</span><button className="subtle-button notification-mark-all" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}><CheckCheck size={14}/>Прочитать все</button></>}</div></div>{notifications.isLoading ? <p className="packet-note">Загружаем события…</p> : notificationItems.length ? <>{notificationItems.map(item => { const Icon = severityIcon[item.severity]; const link = sourceLabel(item); const isFirstUnread = item.id === firstUnreadId; return <article key={item.id} ref={isFirstUnread ? firstUnreadRef : undefined} tabIndex={isFirstUnread ? -1 : undefined} className={`notification-item ${item.isRead ? "is-read" : ""} ${isFirstUnread ? "notification-first-unread" : ""}`}><div className={`notification-icon ${item.severity}`}><Icon size={18}/></div><div><div className="notification-title"><strong>{item.title}</strong><span>{severityLabel[item.severity]}</span></div><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("ru-RU")}</small></div><div className="notification-actions">{link && <button className="subtle-button notification-open" onClick={() => openSource(item)}><ArrowUpRight size={14}/>{link}</button>}{!item.isRead && <button className="subtle-button" onClick={() => markRead.mutate({ id: item.id })} disabled={markRead.isPending}>Прочитано</button>}</div></article>; })}{notifications.hasNextPage && <button className="packet-link compact notification-load-more" onClick={() => notifications.fetchNextPage()} disabled={notifications.isFetchingNextPage}>{notifications.isFetchingNextPage ? "Загружаем…" : "Показать еще"}</button>}</> : <div className="empty-state"><BellRing size={28}/><h2>Сигналов пока нет</h2><p>После импорта или существенного изменения фактов события появятся здесь.</p></div>}</section>
  </AuditShell>;
}
