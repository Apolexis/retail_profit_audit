import { FilePlus2, PencilLine, Printer, ReceiptText, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { DateRangeControl, ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import type { DateRangeValue } from "@/contexts/AuditContext";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/revenue-registry.css";

type AmountField = "cash" | "cashless" | "cashExpenses" | "householdCash" | "cleaningCash" | "salaryCash" | "serviceCash" | "extraPaymentCash" | "bonusCash" | "vacationCash" | "utilitiesCash" | "deliveryCash";
type ExpenseField = Exclude<AmountField, "cash" | "cashless">;
type AmountDraft = Record<AmountField, string>;
type CommentDraft = Partial<Record<ExpenseField, string>>;
type RevenueRecord = Record<AmountField, number> & {
  id: number;
  storeId: number;
  storeName: string;
  businessDate: string;
  createdByAccountId: number;
  createdByName: string;
  currentVersion: number;
  expenseComments: CommentDraft;
  total: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const fields: Array<{ key: AmountField; label: string; kind: "receipt" | "expense" }> = [
  { key: "cash", label: "Нал", kind: "receipt" },
  { key: "cashless", label: "Б/Нал", kind: "receipt" },
  { key: "cashExpenses", label: "Расходы нал", kind: "expense" },
  { key: "householdCash", label: "Хоз. нужды нал", kind: "expense" },
  { key: "cleaningCash", label: "Уборка нал", kind: "expense" },
  { key: "salaryCash", label: "Зарплата нал", kind: "expense" },
  { key: "serviceCash", label: "Выслуга нал", kind: "expense" },
  { key: "extraPaymentCash", label: "Доплата нал", kind: "expense" },
  { key: "bonusCash", label: "Премия нал", kind: "expense" },
  { key: "vacationCash", label: "Отпускные нал", kind: "expense" },
  { key: "utilitiesCash", label: "Ком. плат. нал", kind: "expense" },
  { key: "deliveryCash", label: "Доставка нал", kind: "expense" },
];

const emptyAmounts = (): AmountDraft => Object.fromEntries(fields.map(field => [field.key, ""])) as AmountDraft;
const formatAmount = (value: number) => `${value.toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
const parseAmount = (value: string) => {
  const parsed = Number(normalizeDecimalInputText(value));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};
const entryFor = (amounts: AmountDraft, comments: CommentDraft) => ({ ...Object.fromEntries(fields.map(field => [field.key, parseAmount(amounts[field.key])])) as Record<AmountField, number>, expenseComments: comments });
const toMoscowDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const initialAdminRange = (): DateRangeValue => {
  const today = toMoscowDate();
  return { from: `${today.slice(0, 7)}-01`, to: today };
};
const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
const displayMoscowTimestamp = (value: Date | string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function RevenueRegistry() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [storeId, setStoreId] = useState("");
  const [amounts, setAmounts] = useState<AmountDraft>(emptyAmounts);
  const [comments, setComments] = useState<CommentDraft>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [editing, setEditing] = useState<RevenueRecord | null>(null);
  const [adminRange, setAdminRange] = useState<DateRangeValue>(initialAdminRange);
  const [adminStoreId, setAdminStoreId] = useState("");
  const isAdmin = me.data?.role === "admin";
  const isSeller = me.data?.role === "seller";
  const adminFilter = useMemo(() => ({ from: adminRange.from, to: adminRange.to, storeId: adminStoreId ? Number(adminStoreId) : undefined }), [adminRange, adminStoreId]);
  const myRecords = trpc.revenueRegistry.myLatest.useQuery(undefined, { retry: false, enabled: isSeller || isAdmin });
  const adminRecords = trpc.revenueRegistry.adminList.useQuery(adminFilter, { retry: false, enabled: isAdmin });
  const currentRecords = (isAdmin ? adminRecords.data : myRecords.data ?? []) as RevenueRecord[];

  useEffect(() => {
    if (storeId || !stores.data?.length) return;
    if (isSeller && stores.data.length === 1) setStoreId(String(stores.data[0].id));
    else if (isAdmin) setStoreId(String(stores.data[0].id));
  }, [isAdmin, isSeller, storeId, stores.data]);

  const resetForm = () => {
    setEditing(null);
    setBusinessDate(toMoscowDate());
    setAmounts(emptyAmounts());
    setComments({});
    setCorrectionReason("");
  };
  const fillEdit = (record: RevenueRecord) => {
    setEditing(record);
    setStoreId(String(record.storeId));
    setBusinessDate(record.businessDate);
    setAmounts(Object.fromEntries(fields.map(field => [field.key, record[field.key] ? String(record[field.key]) : ""])) as AmountDraft);
    setComments(record.expenseComments ?? {});
    setCorrectionReason("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const refresh = async () => {
    await Promise.all([utils.revenueRegistry.myLatest.invalidate(), utils.revenueRegistry.adminList.invalidate(), utils.audit.changes.invalidate()]);
  };
  const create = trpc.revenueRegistry.create.useMutation({ onSuccess: async () => { await refresh(); resetForm(); toast.success("Выручка передана", { description: "Операционная запись сохранена отдельно от финансового факта." }); }, onError: error => toast.error("Запись не передана", { description: error.message }) });
  const correct = trpc.revenueRegistry.correct.useMutation({ onSuccess: async () => { await refresh(); resetForm(); toast.success("Исправление сохранено новой версией"); }, onError: error => toast.error("Запись не исправлена", { description: error.message }) });
  const printRegistry = trpc.revenueRegistry.print.useMutation();
  const total = fields.reduce((sum, field) => sum + parseAmount(amounts[field.key]), 0);
  const expenseTotal = (record: RevenueRecord) => fields.filter(field => field.kind === "expense").reduce((sum, field) => sum + record[field.key], 0);
  const selectedStore = stores.data?.find(store => store.id === Number(storeId));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!storeId) { toast.error("Выберите магазин"); return; }
    const entry = entryFor(amounts, comments);
    if (editing) {
      if (!correctionReason.trim()) { toast.error("Укажите причину исправления"); return; }
      correct.mutate({ recordId: editing.id, correctionReason, entry });
      return;
    }
    create.mutate({ storeId: Number(storeId), businessDate, entry });
  };

  if (!isAdmin && !isSeller && !me.isLoading) return <AuditShell kicker="23 / ВЫРУЧКА" title="Операционный реестр «Выручка»"><section className="empty-state"><ReceiptText size={28}/><h2>Нет операционного доступа</h2><p>Эта страница доступна только назначенному продавцу или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="23 / ВЫРУЧКА" title="Операционный реестр «Выручка»">
    <section className="page-lede revenue-lede"><div><span>ОПЕРАЦИОННЫЙ КОНТУР</span><h2>{editing ? `Исправление записи · ${displayDate(editing.businessDate)}` : "Передача выручки за день"}</h2><p>Итог равен сумме сданных наличных, безналичных оплат и наличных расходов. Это отдельная операционная запись: она не меняет финансовый факт, P&L или Excel.</p></div>{editing && <button type="button" className="subtle-button" onClick={resetForm}><RotateCcw size={15}/>Новая запись</button>}</section>
    <details className="packet-card revenue-rule-disclosure"><summary><span>ПРАВИЛО РЕЕСТРА</span><strong>Расход — с обязательным объяснением</strong></summary><div className="revenue-rule-content"><ol><li>Введите нал и Б/Нал по кассе</li><li>Укажите отдельно каждую наличную трату</li><li>Для ненулевой траты обязательны куда / зачем / за что</li><li>Проверьте итог перед передачей</li></ol><p className="packet-note">Продавец создает запись только для своей назначенной точки и видит только пять собственных последних передач. Удаления нет.</p></div></details>
    <section className="revenue-layout">
      <form className="packet-card revenue-entry-card" onSubmit={submit}>
        <div className="card-title"><div><span>{editing ? "АДМИНИСТРАТИВНОЕ ИСПРАВЛЕНИЕ" : "ЕЖЕДНЕВНАЯ ПЕРЕДАЧА"}</span><h3>{selectedStore?.name ?? "Выберите магазин"}</h3></div><ReceiptText size={20}/></div>
        <div className="revenue-meta-row"><label>Дата<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ВЫРУЧКИ" ariaLabel="Выбрать дату выручки"/></label>{isAdmin || (stores.data?.length ?? 0) > 1 ? <label>Магазин<ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)}><option value="">Выберите магазин</option>{(stores.data ?? []).filter(store => !store.isHidden).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label> : <div className="revenue-store-readonly"><span>Магазин</span><strong>{selectedStore?.name ?? "Назначение загружается…"}</strong></div>}</div>
        <div className="revenue-input-grid">{fields.map(field => <label className="revenue-amount" key={field.key}><span>{field.label}</span><input data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={amounts[field.key]} onChange={event => setAmounts(current => ({ ...current, [field.key]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} placeholder="0" aria-label={field.label}/>{field.kind === "expense" && parseAmount(amounts[field.key]) > 0 && <textarea value={comments[field.key as ExpenseField] ?? ""} onChange={event => setComments(current => ({ ...current, [field.key as ExpenseField]: event.target.value }))} maxLength={500} required placeholder="Куда / зачем / за что" aria-label={`Комментарий: ${field.label}`}/>}</label>)}</div>
        <div className="revenue-total"><span>Итого</span><strong>{formatAmount(total)}</strong><small>Нал + Б/Нал + все наличные расходы</small></div>
        {editing && <label className="revenue-correction-reason"><span>Причина исправления</span><textarea value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} maxLength={500} required placeholder="Что и почему исправлено"/></label>}
        {(create.error || correct.error) && <p className="inline-error">{(create.error ?? correct.error)?.message}</p>}
        <div className="revenue-form-actions"><button className="packet-link" disabled={!storeId || create.isPending || correct.isPending}><FilePlus2 size={16}/>{editing ? "Сохранить новой версией" : "Передать выручку"}</button>{editing && <small>Версия {editing.currentVersion + 1}; исходная запись сохранится в истории.</small>}</div>
      </form>
    </section>
    {isAdmin && <section className="packet-card revenue-admin-register"><div className="card-title"><div><span>РЕЕСТР ВСЕХ МАГАЗИНОВ</span><h3>Печать, контроль и исправления</h3></div><div className="revenue-register-actions"><button type="button" className="subtle-button" disabled={printRegistry.isPending} onClick={() => printRegistry.mutate(adminFilter, { onSuccess: async () => { await refresh(); window.print(); }, onError: error => toast.error("Печать не выполнена", { description: error.message }) })}><Printer size={14}/>{printRegistry.isPending ? "Готовим…" : "Печать"}</button></div></div><div className="revenue-filter-row"><div><span>Период</span><DateRangeControl value={adminRange} onChange={setAdminRange} title="ПЕРИОД РЕЕСТРА ВЫРУЧКИ" ariaLabel="Изменить период реестра выручки"/></div><label>Магазин<ThemedSelect value={adminStoreId} onChange={event => setAdminStoreId(event.target.value)}><option value="">Все магазины</option>{(stores.data ?? []).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label></div>{adminRecords.isLoading ? <p className="packet-note">Загружаем операционный реестр…</p> : currentRecords.length ? <><div className="revenue-register-table-wrap"><table className="data-table revenue-register-table"><thead><tr><th>Дата</th><th>Магазин</th><th>Нал</th><th>Б/Нал</th><th>Расходы нал</th><th>Итого</th><th>Версия</th><th className="revenue-not-for-print">Детали и действие</th></tr></thead><tbody>{currentRecords.map(record => <tr key={record.id}><td>{displayDate(record.businessDate)}</td><td><strong>{record.storeName}</strong><small>{record.createdByName}</small></td><td>{formatAmount(record.cash)}</td><td>{formatAmount(record.cashless)}</td><td>{formatAmount(expenseTotal(record))}</td><td><strong>{formatAmount(record.total)}</strong></td><td>v{record.currentVersion}</td><td className="revenue-not-for-print"><details className="revenue-details"><summary>Расходы</summary><dl>{fields.filter(field => field.kind === "expense" && record[field.key] > 0).map(field => <div key={field.key}><dt>{field.label}</dt><dd>{formatAmount(record[field.key])}<small>{record.expenseComments[field.key as ExpenseField]}</small></dd></div>)}</dl></details><button type="button" className="subtle-button" onClick={() => fillEdit(record)}><PencilLine size={14}/>Исправить</button></td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Итого</th><td>{formatAmount(currentRecords.reduce((sum, record) => sum + record.cash, 0))}</td><td>{formatAmount(currentRecords.reduce((sum, record) => sum + record.cashless, 0))}</td><td>{formatAmount(currentRecords.reduce((sum, record) => sum + expenseTotal(record), 0))}</td><td>{formatAmount(currentRecords.reduce((sum, record) => sum + record.total, 0))}</td><td colSpan={2}/></tr></tfoot></table></div><div className="revenue-print-details">{currentRecords.map(record => <article key={record.id}><header><strong>{record.storeName}</strong><span>{displayDate(record.businessDate)} · {record.createdByName} · v{record.currentVersion}</span></header><dl>{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{formatAmount(record[field.key])}{field.kind === "expense" && record[field.key] > 0 && <small>{record.expenseComments[field.key as ExpenseField]}</small>}</dd></div>)}</dl><footer>Итого: {formatAmount(record.total)}</footer></article>)}</div></> : <div className="empty-state compact"><ReceiptText size={25}/><h2>Записей пока нет</h2><p>Переданные продавцами или администратором дневные суммы появятся здесь.</p></div>}</section>}
    {!isAdmin && <section className="packet-card revenue-own-history"><div className="card-title"><div><span>МОИ ПОСЛЕДНИЕ ПЕРЕДАЧИ</span><h3>До пяти собственных записей</h3></div></div>{myRecords.isLoading ? <p className="packet-note">Загружаем ваши записи…</p> : currentRecords.length ? <div className="revenue-history-list">{currentRecords.map(record => <article key={record.id}><div><span>{displayDate(record.businessDate)}</span><strong>{record.storeName}</strong><small>Нал {formatAmount(record.cash)} · Б/Нал {formatAmount(record.cashless)} · Расходы {formatAmount(expenseTotal(record))}</small><small>Передано {displayMoscowTimestamp(record.createdAt)} МСК</small></div><b>{formatAmount(record.total)}</b></article>)}</div> : <div className="empty-state compact"><ReceiptText size={25}/><h2>Передач еще нет</h2><p>После первой передачи здесь будут показаны пять последних записей этой учетной записи.</p></div>}</section>}
  </AuditShell>;
}
