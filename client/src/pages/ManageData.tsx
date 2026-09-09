import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Eye, EyeOff, PencilLine, Plus, ShieldAlert, Tag, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl } from "@/components/DateRangeControl";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRangeValue } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";

const choices = ["revenue", "gross_profit", "net_profit", "purchases", "purchase_smoked", "purchase_frozen", "sales_smoked", "sales_frozen", "writeoff_smoked", "writeoff_frozen", "movement", "discount", "revaluation", "household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs", "cash_operating_costs", "driver_cashless", "utilities_cashless", "rent", "bank_fee", "gross_profit_tax", "salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_22", "stock_open", "stock_close"] as const;
const labels: Record<string, string> = { revenue: "Выручка", gross_profit: "Валовая прибыль", net_profit: "Чистая прибыль", purchases: "Закупки", purchase_smoked: "Закупка Коп.", purchase_frozen: "Закупка Мор.", sales_smoked: "Продажи Коп.", sales_frozen: "Продажи Мор.", writeoff_smoked: "Списания К.", writeoff_frozen: "Списания М.", movement: "Перемещения", discount: "Уценка", revaluation: "Переоценка", household: "Хоз. нужды", delivery: "Доставка", cleaning: "Уборка", bonus: "Премия", seniority: "Выслуга", supplement: "Доплата", driver_cash: "Водитель", utilities_cash: "Коммунальные", operating_costs: "Расходы", cash_operating_costs: "Траты нал", driver_cashless: "Водитель б/нал", utilities_cashless: "Коммунальные б/нал", rent: "Аренда", bank_fee: "Банк", gross_profit_tax: "Налоги", salary_cashless: "Зарплата б/нал", payroll_tax: "Налоги з/п", vacation_cashless: "Отпускные", vacation_tax: "Налоги отпуск.", salary_cash: "Зарплата нал", vacation_cash: "Отпускные нал", personal_income_tax_22: "НДФЛ 22%", stock_open: "Остаток на начало", stock_close: "Остаток на конец" };
const today = () => new Date().toISOString().slice(0, 10);

function FactDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined;
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="fact-date-trigger"><CalendarDays size={15}/>{date ? format(date, "d MMMM yyyy", { locale: ru }) : "Выбрать дату"}</button></PopoverTrigger><PopoverContent className="fact-date-popover" align="start" sideOffset={8}><Calendar mode="single" locale={ru} selected={date} defaultMonth={date} onSelect={next => { if (next) { onChange(format(next, "yyyy-MM-dd")); setOpen(false); } }}/><p>Дата выбрана. Если сохраненных показателей нет, создайте новый факт ниже.</p></PopoverContent></Popover>;
}

export default function ManageData() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState<number>();
  const [entryDate, setEntryDate] = useState(today());
  const [code, setCode] = useState<string>("revenue");
  const [amount, setAmount] = useState("0");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingEntryDate, setEditingEntryDate] = useState<string | null>(null);
  const [nextMetricCode, setNextMetricCode] = useState("revenue");
  const [renamingStore, setRenamingStore] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [message, setMessage] = useState("");
  const [deleteScope, setDeleteScope] = useState<"all" | "store">("all");
  const [deletionRange, setDeletionRange] = useState<DateRangeValue>(() => ({ from: today(), to: today() }));
  const initializedStoreId = useRef<number | null>(null);
  const restoredTarget = useRef(false);

  useEffect(() => {
    if (!stores.data?.length || restoredTarget.current) return;
    const raw = sessionStorage.getItem("auditManageTarget");
    if (!raw) return;
    try {
      const target = JSON.parse(raw) as { storeId: number; entryDate: string; metricCode?: string };
      if (stores.data.some(store => store.id === target.storeId)) {
        restoredTarget.current = true;
        initializedStoreId.current = target.storeId;
        setStoreId(target.storeId);
        setEntryDate(target.entryDate);
        if (target.metricCode) setCode(target.metricCode);
        setMessage("Открыта дата из центра сигналов. Выберите нужный показатель в таблице.");
      }
      sessionStorage.removeItem("auditManageTarget");
    } catch { sessionStorage.removeItem("auditManageTarget"); }
  }, [stores.data]);
  useEffect(() => { if (!storeId && stores.data?.[0]) setStoreId(stores.data[0].id); }, [stores.data, storeId]);

  const entries = trpc.audit.storeEntries.useQuery({ storeId: storeId ?? 0 }, { enabled: Boolean(storeId), retry: false });
  useEffect(() => {
    if (storeId && entries.data?.[0] && initializedStoreId.current !== storeId) {
      initializedStoreId.current = storeId;
      setEntryDate(entries.data[0].entryDate);
    }
  }, [entries.data, storeId]);
  const resolvedEntryDate = entries.data?.find(item => item.entryDate === entryDate)?.entryDate ?? entries.data?.find(item => item.monthDate === entryDate.slice(0, 7))?.entryDate ?? entryDate;
  const metrics = trpc.audit.metrics.useQuery({ storeId: storeId ?? 0, entryDate: resolvedEntryDate }, { enabled: Boolean(storeId && resolvedEntryDate), retry: false });
  const previewRangeDelete = trpc.audit.previewRangeDelete.useQuery({ range: deletionRange, storeId: deleteScope === "store" ? storeId : undefined }, { retry: false });

  const refresh = () => { utils.audit.metrics.invalidate(); utils.audit.storeEntries.invalidate(); utils.audit.dashboard.invalidate(); utils.audit.imports.invalidate(); };
  const visibility = trpc.audit.setVisibility.useMutation({ onSuccess: () => { utils.audit.stores.invalidate(); utils.audit.dashboard.invalidate(); } });
  const renameStore = trpc.audit.renameStore.useMutation({ onSuccess: result => { setMessage(result.unchanged ? "Название магазина не изменилось." : `Магазин переименован: «${result.previousName}» → «${result.name}». Все его даты, доступы и связи сохранены.`); setRenamingStore(false); setStoreName(result.name); utils.audit.stores.invalidate(); utils.audit.dashboard.invalidate(); utils.audit.storeEntries.invalidate(); }, onError: error => setMessage(error.message) });
  const factVisibility = trpc.audit.setMetricVisibility.useMutation({ onSuccess: result => { setMessage(result.isHidden ? "Факт скрыт из аналитики, но сохранен в базе." : "Факт снова участвует в аналитике."); refresh(); }, onError: error => setMessage(error.message) });
  const update = trpc.audit.updateMetric.useMutation({ onSuccess: () => { setMessage("Запись сохранена. Аналитика пересчитана по выбранной дате."); setEditingCode(null); setAmount("0"); refresh(); }, onError: error => setMessage(error.message) });
  const renameMetric = trpc.audit.renameMetric.useMutation({ onSuccess: result => { setMessage(result.unchanged ? "Вид показателя не изменился." : "Показатель переименован. Его сумма и статус видимости сохранены."); setEditingCode(result.metricCode); setCode(result.metricCode); setNextMetricCode(result.metricCode); refresh(); }, onError: error => setMessage(error.message) });
  const remove = trpc.audit.deleteMetric.useMutation({ onSuccess: () => { setMessage("Показатель удален. Если это была последняя строка даты, сама запись периода также удалена."); resetEditor(); refresh(); }, onError: error => setMessage(error.message) });
  const deleteRange = trpc.audit.deleteRange.useMutation({ onSuccess: result => { setMessage(`Удалено за период ${result.range.from} — ${result.range.to}: ${result.periods} дат, ${result.metrics} показателей по ${result.stores.length} магазинам.`); refresh(); previewRangeDelete.refetch(); }, onError: error => setMessage(error.message) });

  const resetEditor = () => { setEditingCode(null); setEditingEntryDate(null); setCode("revenue"); setNextMetricCode("revenue"); setAmount("0"); };
  const selected = stores.data?.find(item => item.id === storeId);
  useEffect(() => { setStoreName(selected?.name ?? ""); setRenamingStore(false); }, [selected?.name, storeId]);
  const editingLabel = editingCode ? labels[editingCode] ?? editingCode : null;
  const sortedMetrics = useMemo(() => [...(metrics.data ?? [])].sort((a, b) => (labels[a.metricCode] ?? a.metricCode).localeCompare(labels[b.metricCode] ?? b.metricCode, "ru")), [metrics.data]);
  const save = () => { if (!storeId) return; const existing = !editingCode ? sortedMetrics.find(item => item.metricCode === code) : undefined; if (existing) { selectMetric(existing.metricCode, String(existing.amount)); setMessage(`Показатель «${labels[code] ?? code}» уже существует на выбранную дату. Открыт режим его изменения — дубликат не будет создан.`); return; } update.mutate({ storeId, entryDate: editingEntryDate ?? entryDate, metricCode: editingCode ?? code, amount: Number(amount) }); };
  const chooseDate = (date: string) => { setEntryDate(date); resetEditor(); };
  const selectMetric = (metricCode: string, value: string) => { setEditingCode(metricCode); setEditingEntryDate(resolvedEntryDate); setCode(metricCode); setNextMetricCode(metricCode); setAmount(value); setMessage(`Открыто редактирование показателя «${labels[metricCode] ?? metricCode}».`); window.requestAnimationFrame(() => document.getElementById("fact-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const submitMetricRename = () => { if (storeId && editingCode) renameMetric.mutate({ storeId, entryDate: editingEntryDate ?? resolvedEntryDate, metricCode: editingCode, nextMetricCode }); };
  const submitStoreRename = () => { if (storeId) renameStore.mutate({ id: storeId, name: storeName }); };
  const deletionPreview = previewRangeDelete.data;

  if (me.data?.role !== "admin") return <AuditShell kicker="11 / БАЗА" title="Магазины и записи"><section className="empty-state"><ShieldAlert size={30}/><h2>Управление базой доступно администратору</h2><p>Аналитик работает только с назначенными магазинами и разрешенными действиями.</p></section></AuditShell>;

  return <AuditShell kicker="11 / УПРАВЛЕНИЕ БАЗОЙ" title="Магазины и факты">
    <section className="page-lede"><div><h2>Точная запись: магазин, дата, показатель, сумма.</h2><p>Импортные месяцы хранятся датой первого числа. Выберите дату календарем: если в выбранном месяце уже есть импорт, показатели появятся ниже. Любой факт можно скрыть из аналитики без удаления из базы.</p></div></section>
    {!stores.data?.length ? <section className="empty-state"><h2>База фактов пока пуста</h2><p>Подтвердите первый импорт книги Excel — здесь появятся магазины, даты и показатели.</p><Link href="/import" className="packet-link">Перейти к импорту</Link></section> : <>
      <section className="manage-grid"><article className="packet-card"><div className="card-title"><div><span>МАГАЗИНЫ</span><h3>Видимость в анализе</h3></div></div><div className="store-manage-list">{stores.data.map(item => <div key={item.id}><span><b>{item.name}</b><small>{item.isHidden ? "скрыт из срезов" : "включен в срезы"}</small></span><button className="store-action" onClick={() => visibility.mutate({ id: item.id, isHidden: !item.isHidden })} title={item.isHidden ? "Показать" : "Скрыть"}>{item.isHidden ? <EyeOff size={17}/> : <Eye size={17}/>}</button><button onClick={() => { setStoreId(item.id); initializedStoreId.current = null; resetEditor(); }} className={storeId === item.id ? "store-action active" : "store-action"} title="Редактировать факты"><PencilLine size={16}/></button></div>)}</div></article>
        <article id="fact-editor" className="packet-card"><div className="card-title"><div><span>РЕДАКТИРОВАНИЕ ФАКТА</span><h3>{selected?.name ?? "Выберите магазин"}</h3></div><button type="button" className="subtle-action store-rename-toggle" onClick={() => setRenamingStore(value => !value)} disabled={!selected}>{renamingStore ? <X size={14}/> : <PencilLine size={14}/>}{renamingStore ? "Отмена" : "Переименовать магазин"}</button></div>{renamingStore && <div className="edit-controls"><label>Новое название магазина<input value={storeName} maxLength={128} onChange={event => setStoreName(event.target.value)} autoFocus/></label><button className="packet-link compact store-rename-save" disabled={renameStore.isPending || !storeName.trim()} onClick={submitStoreRename}>{renameStore.isPending ? "Сохраняем…" : "Сохранить название"}</button><small>Переименование сохраняет историю, даты и доступы. Если такое имя уже есть, используйте «Объединение точек» на странице импорта.</small></div>}<div className="edit-controls"><label>Дата записи<FactDatePicker value={entryDate} onChange={chooseDate}/><small className="date-picker-hint">Выбрано: {entryDate}{resolvedEntryDate !== entryDate ? ` · импортные показатели за месяц хранятся ${resolvedEntryDate}` : ""}</small></label></div><div className="edit-controls fact-editor">{editingCode ? <label className="editing-metric">Изменяемый показатель<strong>{editingLabel}</strong><small>Код: {editingCode}. Эта операция изменит только выбранную строку.</small></label> : <label>Добавить показатель<select value={code} onChange={event => setCode(event.target.value)}>{choices.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><small>Факт — это выбранный показатель и сумма на указанную дату. Если показатель уже существует, откроется его изменение вместо создания дубликата.</small></label>}<label>Сумма, ₽<input type="number" value={amount} onChange={event => setAmount(event.target.value)}/></label></div>{editingCode && <div className="edit-controls"><label>Переименовать показатель в<select value={nextMetricCode} onChange={event => setNextMetricCode(event.target.value)}>{choices.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><small>Меняет вид выбранной строки, но не ее сумму. Доступны только стандартные показатели, которые участвуют в аналитике.</small></label><button type="button" className="subtle-action" disabled={renameMetric.isPending || nextMetricCode === editingCode} onClick={submitMetricRename}><Tag size={14}/>{renameMetric.isPending ? "Сохраняем…" : "Переименовать показатель"}</button></div>}<div className="editor-actions"><button className="packet-link" disabled={!storeId || update.isPending || !entryDate} onClick={save}><Plus size={15}/>{editingCode ? "Сохранить сумму" : "Добавить показатель"}</button>{editingCode && <button type="button" className="subtle-action" onClick={resetEditor}><Plus size={15}/>Добавить другой показатель</button>}</div>{message && <p className="import-message">{message}</p>}<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Показатель</th><th>Текущее значение, ₽</th><th>Статус</th><th>Действие</th></tr></thead><tbody>{sortedMetrics.length ? sortedMetrics.map(item => <tr key={item.id} className={item.isHidden ? "row-hidden" : ""}><td><strong>{labels[item.metricCode] ?? item.metricCode}</strong><small className="metric-code">{item.metricCode}</small></td><td>{Number(item.amount).toLocaleString("ru-RU")}</td><td>{item.isHidden ? <small className="hidden-status">Скрыт из аналитики</small> : <small>В аналитике</small>}</td><td><div className="row-actions"><button className="row-edit" onClick={() => selectMetric(item.metricCode, String(item.amount))}><PencilLine size={14}/>Изменить</button><button className="row-edit" disabled={factVisibility.isPending} onClick={() => storeId && factVisibility.mutate({ storeId, entryDate: resolvedEntryDate, metricCode: item.metricCode, isHidden: !item.isHidden })}>{item.isHidden ? <Eye size={14}/> : <EyeOff size={14}/>} {item.isHidden ? "Вернуть" : "Скрыть"}</button><ConfirmDangerDialog trigger={<button className="row-delete" disabled={remove.isPending}><Trash2 size={14}/>Удалить</button>} title="Удалить показатель?" description={`Показатель «${labels[item.metricCode] ?? item.metricCode}» за ${resolvedEntryDate} будет удален из базы. Если он последний на эту дату, будет удалена и сама запись даты.`} onConfirm={() => storeId && remove.mutate({ storeId, entryDate: resolvedEntryDate, metricCode: item.metricCode })}/></div></td></tr>) : <tr><td colSpan={4}>На выбранную дату показателей нет. Выберите показатель и добавьте первый факт через форму выше.</td></tr>}</tbody></table></div></article></section>
      <section className="packet-card range-delete-panel"><div className="card-title"><div><span>МАССОВОЕ УДАЛЕНИЕ</span><h3>Удалить данные за диапазон</h3></div></div><p className="packet-note">Используйте только для неактуальных дат. Операция удалит выбранные периоды и их показатели без затрагивания фактов за пределами диапазона.</p><div className="range-delete-controls"><label>Область удаления<select value={deleteScope} onChange={event => setDeleteScope(event.target.value as "all" | "store")}><option value="all">Все магазины</option><option value="store" disabled={!storeId}>{selected ? `Только ${selected.name}` : "Сначала выберите магазин"}</option></select></label><DateRangeControl value={deletionRange} onChange={setDeletionRange} title="ДАТЫ ДЛЯ УДАЛЕНИЯ" ariaLabel="Выбрать даты для удаления"/></div><div className="range-delete-preview"><strong>Предпросмотр: {deletionPreview?.periods ?? 0} дат · {deletionPreview?.metrics ?? 0} показателей · {deletionPreview?.stores.length ?? 0} магазинов</strong><small>{deletionPreview?.stores?.length ? deletionPreview.stores.map(store => store.name).join(", ") : "В выбранном диапазоне сохраненных данных нет."}</small></div><ConfirmDangerDialog trigger={<button className="row-delete" disabled={deleteRange.isPending || !deletionPreview?.periods}><Trash2 size={15}/>Удалить даты и факты</button>} title="Удалить все данные выбранного диапазона?" description={`Будет удалено: ${deletionPreview?.periods ?? 0} дат и ${deletionPreview?.metrics ?? 0} показателей${deleteScope === "store" && selected ? ` магазина «${selected.name}»` : " по всем магазинам"} за период ${deletionRange.from} — ${deletionRange.to}. Это действие не затрагивает другие даты; результат будет зафиксирован в журнале.`} confirmLabel="Удалить выбранные данные" onConfirm={() => deleteRange.mutate({ range: deletionRange, storeId: deleteScope === "store" ? storeId : undefined })}/></section>
    </>}
  </AuditShell>;
}
