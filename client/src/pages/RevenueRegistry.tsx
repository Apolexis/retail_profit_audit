import { FilePlus2, PencilLine, Printer, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AuditShell } from "@/components/AuditShell";
import { ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import { formatMoneyRubles } from "@/lib/displayFormat";
import { formatBusinessDate, formatMoscowDateTime, normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/revenue-registry.css";

type AmountField = "cash" | "cashless" | "cashExpenses" | "householdCash" | "cleaningCash" | "salaryCash" | "serviceCash" | "extraPaymentCash" | "bonusCash" | "vacationCash" | "utilitiesCash" | "deliveryCash";
type ExpenseField = Exclude<AmountField, "cash" | "cashless">;
type AmountDraft = Record<AmountField, string>;
type CommentDraft = Partial<Record<ExpenseField, string>>;
type RevenuePrintProjection = { records: RevenueRecord[]; zebraMode: "none" | "rows" | "columns"; headingFontSize: number; bodyFontSize: number; totalFontSize: number; headingBold: boolean; bodyBold: boolean; totalBold: boolean };
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
const commentRequiredExpenseFields = new Set<ExpenseField>([
  "cashExpenses",
  "householdCash",
  "cleaningCash",
  "serviceCash",
  "extraPaymentCash",
  "deliveryCash",
]);
const printCoreExpenseFields = new Set<ExpenseField>(["cashExpenses", "deliveryCash", "householdCash", "salaryCash"]);

const emptyAmounts = (): AmountDraft => Object.fromEntries(fields.map(field => [field.key, ""])) as AmountDraft;
const formatAmount = (value: number) => formatMoneyRubles(value);
const parseAmount = (value: string) => {
  const parsed = Number(normalizeDecimalInputText(value));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};
const entryFor = (amounts: AmountDraft, comments: CommentDraft) => ({
  ...Object.fromEntries(fields.map(field => [field.key, parseAmount(amounts[field.key])])) as Record<AmountField, number>,
  expenseComments: comments,
});
const toMoscowDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const displayDate = (value: string) => formatBusinessDate(value);
const displayMoscowTimestamp = (value: Date | string) => formatMoscowDateTime(value);

export default function RevenueRegistry() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const revenueStores = trpc.inventoryRegistry.requestStores.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [storeId, setStoreId] = useState("");
  const [amounts, setAmounts] = useState<AmountDraft>(emptyAmounts);
  const [comments, setComments] = useState<CommentDraft>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [editing, setEditing] = useState<RevenueRecord | null>(null);
  const [registryDate, setRegistryDate] = useState(toMoscowDate);
  const [adminStoreId, setAdminStoreId] = useState("");
  const [voidCandidate, setVoidCandidate] = useState<RevenueRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [printProjection, setPrintProjection] = useState<RevenuePrintProjection | null>(null);
  const entryCardRef = useRef<HTMLDetailsElement>(null);
  const registerScrollRef = useRef<{ startX: number; scrollLeft: number; pointerId: number } | null>(null);
  const isAdmin = me.data?.role === "admin";
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdministrative = isAdmin || me.data?.role === "analyst" || isManager;
  const canSubmitRevenue = isSeller || isAdmin;
  const permittedRevenueStores = isAdmin ? (stores.data ?? []).filter(store => !store.isHidden) : (revenueStores.data ?? []);
  const adminFilter = useMemo(() => ({ from: registryDate, to: registryDate, storeId: adminStoreId ? Number(adminStoreId) : undefined }), [registryDate, adminStoreId]);
  const myRecords = trpc.revenueRegistry.myLatest.useQuery(undefined, { retry: false, enabled: isSeller || isAdmin });
  const adminRecords = trpc.revenueRegistry.adminList.useQuery(adminFilter, { retry: false, enabled: isAdministrative });
  const currentRecords = ((isAdministrative ? adminRecords.data : myRecords.data) ?? []) as RevenueRecord[];
  const visibleExpenseFields = fields.filter(field => field.kind === "expense" && (printCoreExpenseFields.has(field.key as ExpenseField) || currentRecords.some(record => record[field.key] !== 0)));
  const screenPrintComments = currentRecords.flatMap(record => fields.filter(field => field.kind === "expense" && record[field.key] > 0 && record.expenseComments[field.key as ExpenseField]).map(field => ({ record, field })));
  const hasExpenseComments = screenPrintComments.length > 0;
  const formatRecordComments = (record: RevenueRecord) => fields
    .filter(field => field.kind === "expense" && record[field.key] > 0 && record.expenseComments[field.key as ExpenseField])
    .map(field => `${field.label}: ${record.expenseComments[field.key as ExpenseField]}`)
    .join(" · ");

  useEffect(() => {
    if (storeId || !permittedRevenueStores.length) return;
    if (isSeller && permittedRevenueStores.length === 1) setStoreId(String(permittedRevenueStores[0].id));
    else if (isAdmin) setStoreId(String(permittedRevenueStores[0].id));
  }, [isAdmin, isSeller, storeId, permittedRevenueStores]);

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
    entryCardRef.current?.setAttribute("open", "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const refresh = async () => {
    await Promise.all([
      utils.revenueRegistry.myLatest.invalidate(),
      utils.revenueRegistry.adminList.invalidate(),
      utils.audit.changes.invalidate(),
      utils.audit.dashboard.invalidate(),
      utils.audit.dashboardAvailability.invalidate(),
    ]);
  };
  const create = trpc.revenueRegistry.create.useMutation({
    onSuccess: async () => { await refresh(); resetForm(); entryCardRef.current?.removeAttribute("open"); toast.success("Выручка передана", { description: "Нал, Б/Нал и общая выручка появились в «Ритме» для этой точки и даты." }); },
    onError: error => toast.error("Запись не передана", { description: error.message }),
  });
  const correct = trpc.revenueRegistry.correct.useMutation({
    onSuccess: async () => { await refresh(); resetForm(); toast.success("Изменение сохранено новой версией"); },
    onError: error => toast.error("Запись не изменена", { description: error.message }),
  });
  const voidRevenue = trpc.revenueRegistry.remove.useMutation({
    onSuccess: async () => { await refresh(); if (editing?.id === voidCandidate?.id) resetForm(); setVoidCandidate(null); setVoidReason(""); toast.success("Передача удалена из реестра", { description: "Исходная версия сохранена в общем журнале." }); },
    onError: error => toast.error("Передача не удалена", { description: error.message }),
  });
  const printRegistry = trpc.revenueRegistry.print.useMutation();
  const openRevenuePrint = () => {
    document.body.dataset.printTarget = "revenue";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const sheet = document.getElementById("revenue-print-root");
      const rowCount = sheet?.querySelectorAll(".revenue-print-table tbody tr").length ?? 0;
      /** The portal is intentionally display:none on screen until print media applies; rows are the reliable readiness signal. */
      if (!sheet || !rowCount) {
        delete document.body.dataset.printTarget;
        toast.error("Печать не сформирована", { description: "Сервер не вернул строки для печати. Обновите реестр и повторите попытку." });
        return;
      }
      const clearPrintTarget = () => {
        delete document.body.dataset.printTarget;
        window.removeEventListener("afterprint", clearPrintTarget);
      };
      window.addEventListener("afterprint", clearPrintTarget);
      window.print();
    }));
  };
  const total = fields.reduce((sum, field) => sum + parseAmount(amounts[field.key]), 0);
  const expenseTotal = (record: RevenueRecord) => fields.filter(field => field.kind === "expense").reduce((sum, field) => sum + record[field.key], 0);
  const selectedStore = permittedRevenueStores.find(store => store.id === Number(storeId));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!storeId) { toast.error("Выберите магазин"); return; }
    const entry = entryFor(amounts, comments);
    if (editing) {
      if (!correctionReason.trim()) { toast.error("Укажите причину изменения"); return; }
      correct.mutate({ recordId: editing.id, businessDate, correctionReason, entry });
      return;
    }
    create.mutate({ storeId: Number(storeId), businessDate, entry });
  };
  const beginRegisterDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button, summary")) return;
    const container = event.currentTarget;
    if (container.scrollWidth <= container.clientWidth) return;
    registerScrollRef.current = { startX: event.clientX, scrollLeft: container.scrollLeft, pointerId: event.pointerId };
    container.setPointerCapture(event.pointerId);
    container.classList.add("is-dragging");
  };
  const moveRegisterDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = registerScrollRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
  };
  const endRegisterDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (registerScrollRef.current?.pointerId !== event.pointerId) return;
    registerScrollRef.current = null;
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const printRecords = printProjection?.records ?? [];
  const printVisibleExpenseFields = fields.filter(field => field.kind === "expense" && (printCoreExpenseFields.has(field.key as ExpenseField) || printRecords.some(record => record[field.key] !== 0)));
  const printComments = printRecords.flatMap(record => fields.filter(field => field.kind === "expense" && record[field.key] > 0 && record.expenseComments[field.key as ExpenseField]).map(field => ({ record, field })));
  const printSheet = isAdministrative && printProjection && printRecords.length ? createPortal(
    <section id="revenue-print-root" className="revenue-print-sheet" data-zebra-mode={printProjection.zebraMode} style={{ "--revenue-print-heading-size": `${printProjection.headingFontSize}pt`, "--revenue-print-body-size": `${printProjection.bodyFontSize}pt`, "--revenue-print-total-size": `${printProjection.totalFontSize}pt`, "--revenue-print-heading-weight": printProjection.headingBold ? 700 : 400, "--revenue-print-body-weight": printProjection.bodyBold ? 700 : 400, "--revenue-print-total-weight": printProjection.totalBold ? 700 : 400 } as React.CSSProperties} aria-hidden="true">
      <p>{displayDate(registryDate)}</p>
      <table className="revenue-print-table">
        <thead><tr><th>Магазин</th><th>Нал</th><th>Б/Нал</th>{printVisibleExpenseFields.map(field => <th key={field.key}>{field.label}</th>)}<th>Итого</th></tr></thead>
        <tbody>{printRecords.map(record => <tr key={`print-${record.id}`}><td>{record.storeName}</td><td>{formatAmount(record.cash)}</td><td>{formatAmount(record.cashless)}</td>{printVisibleExpenseFields.map(field => <td key={field.key}>{formatAmount(record[field.key])}</td>)}<td>{formatAmount(record.total)}</td></tr>)}</tbody>
        <tfoot><tr><th>Итого</th><td>{formatAmount(printRecords.reduce((sum, record) => sum + record.cash, 0))}</td><td>{formatAmount(printRecords.reduce((sum, record) => sum + record.cashless, 0))}</td>{printVisibleExpenseFields.map(field => <td key={field.key}>{formatAmount(printRecords.reduce((sum, record) => sum + record[field.key], 0))}</td>)}<td>{formatAmount(printRecords.reduce((sum, record) => sum + record.total, 0))}</td></tr></tfoot>
      </table>
      {printComments.length > 0 && <div className="revenue-print-comments">{printComments.map(({ record, field }) => <p key={`${record.id}:${field.key}`}><strong>{record.storeName} — {field.label}:</strong> {record.expenseComments[field.key as ExpenseField]}</p>)}</div>}
    </section>, document.body
  ) : null;

  if (!isAdministrative && !isSeller && !me.isLoading) return <AuditShell kicker="23 / ВЫРУЧКА" title="Операционный реестр «Выручка»"><section className="empty-state"><ReceiptText size={28}/><h2>Нет операционного доступа</h2><p>Эта страница доступна назначенному продавцу или административному персоналу.</p></section></AuditShell>;

  return <AuditShell kicker="23 / ВЫРУЧКА" title="Операционный реестр «Выручка»">
    <section className="page-lede revenue-lede"><div><span>ОПЕРАЦИОННЫЙ КОНТУР</span><h2>{editing ? `Изменение записи · ${displayDate(editing.businessDate)}` : "Передача выручки за день"}</h2><p>Итог равен сумме сданных наличных, безналичных оплат и наличных расходов. Это отдельная операционная запись: она не меняет финансовый факт, P&L или Excel.</p></div>{editing && <button type="button" className="subtle-button" onClick={resetForm}><RotateCcw size={15}/>Новая запись</button>}</section>
    <details className="packet-card revenue-rule-disclosure"><summary><span>ПРАВИЛО РЕЕСТРА</span><strong>Пояснение нужно только для нецелевых наличных расходов</strong></summary><div className="revenue-rule-content"><ol><li>Введите нал и Б/Нал по кассе</li><li>Укажите отдельно каждую наличную трату</li><li>Для расходов, кроме зарплаты, премии, отпуска и коммунальных платежей, укажите куда / зачем / за что</li><li>Проверьте итог перед передачей</li></ol><p className="packet-note">Продавец создает запись только для своей назначенной точки и видит только пять собственных последних передач. Удаления нет.</p></div></details>
    {canSubmitRevenue && <section className="revenue-layout"><details className="packet-card revenue-entry-card" ref={entryCardRef}>
      <summary className="revenue-entry-summary"><div><span>{editing ? "АДМИНИСТРАТИВНОЕ ИЗМЕНЕНИЕ" : "ЕЖЕДНЕВНАЯ ПЕРЕДАЧА"}</span><h3>{selectedStore?.name ?? "Выберите магазин"}</h3><small>{editing ? `Версия ${editing.currentVersion + 1}` : "Нажмите, чтобы свернуть или продолжить передачу"}</small></div><ReceiptText size={20}/></summary>
      <form className="revenue-entry-form" onSubmit={submit}>
      <div className="revenue-meta-row"><label>Дата<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ВЫРУЧКИ" ariaLabel="Выбрать дату выручки"/></label>{isAdmin || (permittedRevenueStores.length ?? 0) > 1 ? <label>Магазин<ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)}><option value="">Выберите магазин</option>{permittedRevenueStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label> : <div className="revenue-store-readonly"><span>Магазин</span><strong>{selectedStore?.name ?? "Назначение загружается…"}</strong></div>}</div>
      <div className="revenue-field-sections">{(["receipt", "expense"] as const).map(kind => <section className="revenue-field-section" key={kind}><div className="revenue-field-section-title"><span>{kind === "receipt" ? "ОПЛАТЫ" : "НАЛИЧНЫЕ РАСХОДЫ"}</span><small>{kind === "receipt" ? "По данным кассы" : "Каждая трата отдельной строкой"}</small></div><div className="revenue-input-grid">{fields.filter(field => field.kind === kind).map(field => { const commentRequired = field.kind === "expense" && commentRequiredExpenseFields.has(field.key as ExpenseField); return <label className="revenue-amount" key={field.key}><span>{field.label}</span><input data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={amounts[field.key]} onChange={event => setAmounts(current => ({ ...current, [field.key]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} placeholder="0" aria-label={field.label}/>{commentRequired && parseAmount(amounts[field.key]) > 0 && <textarea value={comments[field.key as ExpenseField] ?? ""} onChange={event => setComments(current => ({ ...current, [field.key as ExpenseField]: event.target.value }))} maxLength={500} required placeholder="Куда / зачем / за что" aria-label={`Комментарий: ${field.label}`}/>}</label>; })}</div></section>)}</div>
      <div className="revenue-total"><span>Итого</span><strong>{formatAmount(total)}</strong><small>Нал + Б/Нал + все наличные расходы</small></div>
      {editing && <label className="revenue-correction-reason"><span>Причина изменения</span><textarea value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} maxLength={500} required placeholder="Что и почему изменено"/></label>}
      {(create.error || correct.error) && <p className="inline-error">{(create.error ?? correct.error)?.message}</p>}
      <div className="revenue-form-actions"><button className="packet-link" disabled={!storeId || create.isPending || correct.isPending}><FilePlus2 size={16}/>{editing ? "Сохранить новой версией" : "Передать выручку"}</button>{editing && <small>Версия {editing.currentVersion + 1}; исходная запись сохранится в истории.</small>}</div>
      </form>
    </details></section>}
    {isAdministrative && <section className="packet-card revenue-admin-register">
      <div className="card-title"><div><span>РЕЕСТР ВСЕХ МАГАЗИНОВ</span><h3>Печать, контроль и изменения</h3></div></div>
      <div className="revenue-filter-row"><div><span>Дата</span><ExactDateControl value={registryDate} onChange={setRegistryDate} title="ДАТА РЕЕСТРА ВЫРУЧКИ" ariaLabel="Изменить дату реестра выручки"/></div><label>Магазин<ThemedSelect value={adminStoreId} onChange={event => setAdminStoreId(event.target.value)}><option value="">Все доступные магазины</option>{permittedRevenueStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label></div>
      <div className="revenue-register-actions">{currentRecords.length ? <button type="button" className="subtle-button" disabled={printRegistry.isPending} onClick={() => printRegistry.mutate(adminFilter, { onSuccess: async result => { if (!result.records.length) { setPrintProjection(null); await refresh(); toast.error("Нет строк для печати", { description: "Сервер не нашёл действующих записей для этого среза. Реестр обновлён — проверьте дату или магазин." }); return; } setPrintProjection({ records: result.records as RevenueRecord[], zebraMode: result.zebraMode, headingFontSize: result.headingFontSize, bodyFontSize: result.bodyFontSize, totalFontSize: result.totalFontSize, headingBold: result.headingBold, bodyBold: result.bodyBold, totalBold: result.totalBold }); void utils.audit.changes.invalidate(); openRevenuePrint(); }, onError: error => toast.error("Печать не выполнена", { description: error.message }) })}><Printer size={14}/>{printRegistry.isPending ? "Готовим…" : "Печать"}</button> : <p className="revenue-print-empty-explanation" role="status">Печать недоступна: для выбранной даты и магазина нет действующих строк реестра.</p>}</div>
      {adminRecords.isLoading ? <p className="packet-note">Загружаем операционный реестр…</p> : currentRecords.length ? <>
        <div className="data-table-wrap revenue-register-table-wrap" onPointerDown={beginRegisterDrag} onPointerMove={moveRegisterDrag} onPointerUp={endRegisterDrag} onPointerCancel={endRegisterDrag}>
          <table className="data-table revenue-register-table">
            <thead><tr><th>Магазин</th><th className="numeric-column">Нал</th><th className="numeric-column">Б/Нал</th>{visibleExpenseFields.map(field => <th className="numeric-column" key={field.key}>{field.label}</th>)}<th className="numeric-column">Итого</th>{hasExpenseComments && <th className="revenue-comment-column">Комментарии расходов</th>}<th>Версия</th><th>Действия</th></tr></thead>
            <tbody>{currentRecords.map(record => <tr key={record.id}><td data-label="Магазин"><strong>{record.storeName}</strong></td><td data-label="Нал" className="numeric-column">{formatAmount(record.cash)}</td><td data-label="Б/Нал" className="numeric-column">{formatAmount(record.cashless)}</td>{visibleExpenseFields.map(field => <td data-label={field.label} className="numeric-column" key={field.key}>{formatAmount(record[field.key])}</td>)}<td data-label="Итого" className="numeric-column"><strong>{formatAmount(record.total)}</strong></td>{hasExpenseComments && <td data-label="Комментарии расходов" className="revenue-comment-cell">{formatRecordComments(record) || "—"}</td>}<td data-label="Версия">v{record.currentVersion}</td><td data-label="Действия">{isAdmin ? <div className="revenue-row-actions"><button type="button" className="subtle-button" onClick={() => fillEdit(record)}><PencilLine size={14}/>Изменить</button><button type="button" className="subtle-button subtle-danger" onClick={() => { setVoidCandidate(record); setVoidReason(""); }}><Trash2 size={14}/>Удалить</button></div> : <span className="packet-note">Только печать</span>}</td></tr>)}</tbody>
            <tfoot><tr className="table-total"><th scope="row">Итого</th><td className="numeric-column">{formatAmount(currentRecords.reduce((sum, record) => sum + record.cash, 0))}</td><td className="numeric-column">{formatAmount(currentRecords.reduce((sum, record) => sum + record.cashless, 0))}</td>{visibleExpenseFields.map(field => <td className="numeric-column" key={field.key}>{formatAmount(currentRecords.reduce((sum, record) => sum + record[field.key], 0))}</td>)}<td className="revenue-total-cell numeric-column">{formatAmount(currentRecords.reduce((sum, record) => sum + record.total, 0))}</td>{hasExpenseComments && <td/>}<td colSpan={2}/></tr></tfoot>
          </table>
        </div>
        {printSheet}
      </> : <div className="empty-state compact"><ReceiptText size={25}/><h2>Записей пока нет</h2><p>Переданные продавцами или администратором дневные суммы появятся здесь.</p></div>}
    </section>}
    {isSeller && <section className="packet-card revenue-own-history"><div className="card-title"><div><span>МОИ ПОСЛЕДНИЕ ПЕРЕДАЧИ</span><h3>До пяти собственных записей</h3></div></div>{myRecords.isLoading ? <p className="packet-note">Загружаем ваши записи…</p> : currentRecords.length ? <div className="revenue-history-list">{currentRecords.map(record => <article key={record.id}><div><span>{displayDate(record.businessDate)}</span><strong>{record.storeName}</strong><small>Нал {formatAmount(record.cash)} · Б/Нал {formatAmount(record.cashless)} · Расходы {formatAmount(expenseTotal(record))}</small><small>Передано {displayMoscowTimestamp(record.createdAt)} МСК</small></div><b>{formatAmount(record.total)}</b></article>)}</div> : <div className="empty-state compact"><ReceiptText size={25}/><h2>Передач еще нет</h2><p>После первой передачи здесь будут показаны пять последних записей этой учетной записи.</p></div>}</section>}
    <AlertDialog open={Boolean(voidCandidate)} onOpenChange={open => { if (!open) { setVoidCandidate(null); setVoidReason(""); } }}><AlertDialogContent className="danger-confirm-dialog"><AlertDialogHeader><AlertDialogTitle>Удалить передачу из реестра?</AlertDialogTitle><AlertDialogDescription>Запись за {voidCandidate ? displayDate(voidCandidate.businessDate) : "выбранную дату"} исчезнет из рабочего реестра. Ее исходная версия и причина удаления останутся в общем журнале и истории версий.</AlertDialogDescription></AlertDialogHeader><label className="revenue-void-reason"><span>Причина удаления</span><textarea value={voidReason} onChange={event => setVoidReason(event.target.value)} maxLength={500} required placeholder="Почему запись нужно удалить из рабочего реестра"/></label><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="danger-confirm-action" disabled={!voidCandidate || !voidReason.trim() || voidRevenue.isPending} onClick={() => { if (voidCandidate) voidRevenue.mutate({ recordId: voidCandidate.id, reason: voidReason }); }}>{voidRevenue.isPending ? "Удаляем…" : "Удалить из реестра"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AuditShell>;
}
