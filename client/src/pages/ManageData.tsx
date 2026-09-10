import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, PencilLine, Plus, ShieldAlert, Tag, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ExactDateControl } from "@/components/DateRangeControl";
import { trpc } from "@/lib/trpc";

const choices = ["revenue", "gross_profit", "net_profit", "purchases", "purchase_smoked", "purchase_frozen", "sales_smoked", "sales_frozen", "writeoff_smoked", "writeoff_frozen", "movement", "discount", "revaluation", "household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs", "cash_operating_costs", "driver_cashless", "utilities_cashless", "rent", "bank_fee", "gross_profit_tax", "salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_22", "stock_open", "stock_close"] as const;
const labels: Record<string, string> = { revenue: "Выручка", gross_profit: "Валовая прибыль", net_profit: "Чистая прибыль", purchases: "Закупки", purchase_smoked: "Закупка Коп.", purchase_frozen: "Закупка Мор.", sales_smoked: "Продажи Коп.", sales_frozen: "Продажи Мор.", writeoff_smoked: "Списания К.", writeoff_frozen: "Списания М.", movement: "Перемещения", discount: "Уценка", revaluation: "Переоценка", household: "Хоз. нужды нал", delivery: "Доставка нал", cleaning: "Уборка нал", bonus: "Премия нал", seniority: "Выслуга нал", supplement: "Доплата нал", driver_cash: "Водитель нал", utilities_cash: "Коммунальные нал", operating_costs: "Расходы нал", cash_operating_costs: "Траты нал", driver_cashless: "Водитель б/нал", utilities_cashless: "Коммунальные б/нал", rent: "Аренда б/нал", bank_fee: "-% банк", gross_profit_tax: "Налоги", salary_cashless: "Зарплата б/нал", payroll_tax: "Налоги з/п", vacation_cashless: "Отпускные", vacation_tax: "Налоги отпуск.", salary_cash: "Зарплата нал", vacation_cash: "Отпускные нал", personal_income_tax_22: "НДФЛ 22%", stock_open: "Остаток на начало", stock_close: "Остаток на конец" };
const today = () => new Date().toISOString().slice(0, 10);

function FactDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <ExactDateControl value={value} onChange={onChange} />;
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
  const [changingMetricType, setChangingMetricType] = useState(false);
  const [renamingStore, setRenamingStore] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [storeListSort, setStoreListSort] = useState<"name" | "visible" | "hidden">("name");
  const [message, setMessage] = useState("");
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
        setMessage("Открыта дата из центра сигналов. Для изменения существующей строки выберите «Изменить» в таблице.");
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
  const refresh = () => { utils.audit.metrics.invalidate(); utils.audit.storeEntries.invalidate(); utils.audit.dashboard.invalidate(); utils.audit.imports.invalidate(); };

  const visibility = trpc.audit.setVisibility.useMutation({ onSuccess: () => { utils.audit.stores.invalidate(); utils.audit.dashboard.invalidate(); } });
  const renameStore = trpc.audit.renameStore.useMutation({ onSuccess: result => { setMessage(result.unchanged ? "Название магазина не изменилось." : `Магазин переименован: «${result.previousName}» → «${result.name}». Все его даты, доступы и связи сохранены.`); setRenamingStore(false); setStoreName(result.name); utils.audit.stores.invalidate(); utils.audit.dashboard.invalidate(); utils.audit.storeEntries.invalidate(); }, onError: error => setMessage(error.message) });
  const factVisibility = trpc.audit.setMetricVisibility.useMutation({ onSuccess: result => { setMessage(result.isHidden ? "Факт скрыт из аналитики, но сохранен в базе." : "Факт снова участвует в аналитике."); refresh(); }, onError: error => setMessage(error.message) });
  const update = trpc.audit.updateMetric.useMutation({ onSuccess: () => { setMessage(editingCode ? "Сумма сохранена. Аналитика пересчитана по выбранной дате." : "Новый показатель добавлен. Аналитика пересчитана по выбранной дате."); resetEditor(); refresh(); }, onError: error => setMessage(error.message) });
  const renameMetric = trpc.audit.renameMetric.useMutation({ onSuccess: result => { setMessage(result.unchanged ? "Тип показателя не изменился." : "Тип показателя изменен. Его сумма и статус видимости сохранены."); setEditingCode(result.metricCode); setCode(result.metricCode); setNextMetricCode(result.metricCode); setChangingMetricType(false); refresh(); }, onError: error => setMessage(error.message) });
  const remove = trpc.audit.deleteMetric.useMutation({ onSuccess: () => { setMessage("Показатель удален. Если это была последняя строка даты, сама запись периода также удалена."); resetEditor(); refresh(); }, onError: error => setMessage(error.message) });

  const resetEditor = () => { setEditingCode(null); setEditingEntryDate(null); setCode("revenue"); setNextMetricCode("revenue"); setChangingMetricType(false); setAmount("0"); };
  const selected = stores.data?.find(item => item.id === storeId);
  useEffect(() => { setStoreName(selected?.name ?? ""); setRenamingStore(false); }, [selected?.name, storeId]);
  const sortedMetrics = useMemo(() => [...(metrics.data ?? [])].sort((a, b) => (labels[a.metricCode] ?? a.metricCode).localeCompare(labels[b.metricCode] ?? b.metricCode, "ru")), [metrics.data]);
  const sortedStoreList = useMemo(() => [...(stores.data ?? [])].sort((left, right) => {
    if (storeListSort === "visible" && left.isHidden !== right.isHidden) return Number(left.isHidden) - Number(right.isHidden);
    if (storeListSort === "hidden" && left.isHidden !== right.isHidden) return Number(right.isHidden) - Number(left.isHidden);
    return left.name.localeCompare(right.name, "ru");
  }), [stores.data, storeListSort]);
  const existingNewMetric = !editingCode ? sortedMetrics.find(item => item.metricCode === code) : undefined;
  const editingLabel = editingCode ? labels[editingCode] ?? editingCode : null;

  const save = () => {
    if (!storeId) return;
    if (existingNewMetric) { setMessage(`Показатель «${labels[code] ?? code}» уже добавлен на эту дату. Для изменения суммы откройте его кнопкой «Изменить» в таблице.`); return; }
    update.mutate({ storeId, entryDate: editingEntryDate ?? entryDate, metricCode: editingCode ?? code, amount: Number(amount) });
  };
  const chooseDate = (date: string) => { setEntryDate(date); resetEditor(); };
  const selectMetric = (metricCode: string, value: string) => { setEditingCode(metricCode); setEditingEntryDate(resolvedEntryDate); setCode(metricCode); setNextMetricCode(metricCode); setChangingMetricType(false); setAmount(value); setMessage(`Открыто редактирование показателя «${labels[metricCode] ?? metricCode}».`); window.requestAnimationFrame(() => document.getElementById("fact-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const submitMetricRename = () => { if (storeId && editingCode) renameMetric.mutate({ storeId, entryDate: editingEntryDate ?? resolvedEntryDate, metricCode: editingCode, nextMetricCode }); };
  const submitStoreRename = () => { if (storeId) renameStore.mutate({ id: storeId, name: storeName }); };

  if (me.data?.role !== "admin") return <AuditShell kicker="11 / БАЗА" title="Магазины и записи"><section className="empty-state"><ShieldAlert size={30}/><h2>Управление базой доступно администратору</h2><p>Аналитик работает только с назначенными магазинами и разрешенными действиями.</p></section></AuditShell>;

  return <AuditShell kicker="11 / УПРАВЛЕНИЕ БАЗОЙ" title="Магазины и факты">
    <section className="page-lede"><div><h2>Точная запись: магазин, дата, показатель, сумма</h2><p>Импортные месяцы хранятся датой первого числа. Выберите дату календарем: если в выбранном месяце уже есть импорт, показатели появятся ниже. Любой факт можно скрыть из аналитики без удаления из базы.</p></div></section>
    {!stores.data?.length ? <section className="empty-state"><h2>База фактов пока пуста</h2><p>Подтвердите первый импорт книги Excel — здесь появятся магазины, даты и показатели.</p><Link href="/import" className="packet-link">Перейти к импорту</Link></section> : <section className="manage-grid">
      <article className="packet-card"><div className="card-title manage-store-title"><div><span>МАГАЗИНЫ</span><h3>Видимость в анализе</h3></div><label className="store-list-sort">Сортировка<select value={storeListSort} onChange={event => setStoreListSort(event.target.value as typeof storeListSort)}><option value="name">По названию А—Я</option><option value="visible">Сначала в анализе</option><option value="hidden">Сначала скрытые</option></select></label></div><div className="store-manage-list">{sortedStoreList.map(item => <div key={item.id}><span><b>{item.name}</b><small>{item.isHidden ? "скрыт из срезов" : "включен в срезы"}</small></span><button type="button" className="store-action" onClick={() => visibility.mutate({ id: item.id, isHidden: !item.isHidden })} title={item.isHidden ? "Показать" : "Скрыть"}>{item.isHidden ? <EyeOff size={17}/> : <Eye size={17}/>}</button><button type="button" onClick={() => { setStoreId(item.id); initializedStoreId.current = null; resetEditor(); }} className={storeId === item.id ? "store-action active" : "store-action"} title="Редактировать факты"><PencilLine size={16}/></button></div>)}</div></article>
      <article id="fact-editor" className="packet-card manage-editor"><div className="card-title"><div><span>{editingCode ? "РЕДАКТИРОВАНИЕ ПОКАЗАТЕЛЯ" : "НОВЫЙ ПОКАЗАТЕЛЬ"}</span><h3>{selected?.name ?? "Выберите магазин"}</h3></div><button type="button" className="subtle-action store-rename-toggle" onClick={() => setRenamingStore(value => !value)} disabled={!selected}>{renamingStore ? <X size={14}/> : <PencilLine size={14}/>}{renamingStore ? "Отмена" : "Переименовать магазин"}</button></div>
        {renamingStore && <div className="store-rename-form"><label>Новое название магазина<input value={storeName} maxLength={128} onChange={event => setStoreName(event.target.value)} autoFocus/></label><button type="button" className="packet-link compact store-rename-save" disabled={renameStore.isPending || !storeName.trim()} onClick={submitStoreRename}>{renameStore.isPending ? "Сохраняем…" : "Сохранить название"}</button><small>Переименование сохраняет историю, даты и доступы. Если такое имя уже есть, используйте «Объединение точек» на странице импорта.</small></div>}
        <div className="edit-controls manage-date-control"><label>Дата записи<FactDatePicker value={entryDate} onChange={chooseDate}/><small className="date-picker-hint">Выбрано: {entryDate}{resolvedEntryDate !== entryDate ? ` · импортные показатели за месяц хранятся ${resolvedEntryDate}` : ""}</small></label></div>
        {editingCode ? <><div className="editing-metric manage-editing-metric"><span>Редактируемая строка</span><strong>{editingLabel}</strong><small>Сумму можно сохранить отдельно. Тип меняется только после явного подтверждения ниже.</small></div><div className="edit-controls fact-editor"><label>Сумма, ₽<input type="number" value={amount} onChange={event => setAmount(event.target.value)}/></label><button type="button" className="subtle-action metric-rename-action" onClick={() => { setNextMetricCode(editingCode); setChangingMetricType(value => !value); }}><Tag size={14}/>{changingMetricType ? "Отменить смену типа" : "Изменить тип"}</button></div>{changingMetricType && <div className="metric-type-panel"><label>Новый тип показателя<select value={nextMetricCode} onChange={event => setNextMetricCode(event.target.value)}>{choices.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><small>Сумма и статус видимости сохранятся.</small></label><div className="metric-type-actions"><button type="button" className="packet-link compact metric-rename-action" disabled={renameMetric.isPending || nextMetricCode === editingCode} onClick={submitMetricRename}><Tag size={14}/>{renameMetric.isPending ? "Сохраняем…" : "Подтвердить тип"}</button></div></div>}</> : <div className="edit-controls fact-editor"><label>Новый показатель<select value={code} onChange={event => { setCode(event.target.value); setMessage(""); }}>{choices.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><small>Добавляется новая строка на выбранную дату.</small></label><label>Сумма, ₽<input type="number" value={amount} onChange={event => setAmount(event.target.value)}/><small>Для изменения уже добавленного показателя используйте кнопку в таблице.</small></label></div>}
        {!editingCode && existingNewMetric && <p className="manage-editor-notice">«{labels[code] ?? code}» уже есть на выбранную дату. Откройте его кнопкой «Изменить» в таблице ниже.</p>}
        <div className="editor-actions"><button type="button" className="packet-link" disabled={!storeId || update.isPending || !entryDate || Boolean(existingNewMetric)} onClick={save}><Plus size={15}/>{editingCode ? "Сохранить сумму" : "Добавить новый показатель"}</button>{editingCode && <button type="button" className="subtle-action" onClick={resetEditor}><Plus size={15}/>Вернуться к добавлению</button>}</div>
        {message && <p className="import-message">{message}</p>}
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Показатель</th><th>Текущее значение, ₽</th><th>Статус</th><th>Действие</th></tr></thead><tbody>{sortedMetrics.length ? sortedMetrics.map(item => <tr key={item.id} className={item.isHidden ? "row-hidden" : ""}><td><strong>{labels[item.metricCode] ?? item.metricCode}</strong><small className="metric-code">{item.metricCode}</small></td><td>{Number(item.amount).toLocaleString("ru-RU")}</td><td>{item.isHidden ? <small className="hidden-status">Скрыт из аналитики</small> : <small>В аналитике</small>}</td><td><div className="row-actions"><button type="button" className="row-edit" onClick={() => selectMetric(item.metricCode, String(item.amount))}><PencilLine size={14}/>Изменить</button><button type="button" className="row-edit" disabled={factVisibility.isPending} onClick={() => storeId && factVisibility.mutate({ storeId, entryDate: resolvedEntryDate, metricCode: item.metricCode, isHidden: !item.isHidden })}>{item.isHidden ? <Eye size={14}/> : <EyeOff size={14}/>} {item.isHidden ? "Вернуть" : "Скрыть"}</button><ConfirmDangerDialog trigger={<button type="button" className="row-delete" disabled={remove.isPending}><Trash2 size={14}/>Удалить</button>} title="Удалить показатель?" description={`Показатель «${labels[item.metricCode] ?? item.metricCode}» за ${resolvedEntryDate} будет удален из базы. Если он последний на эту дату, будет удалена и сама запись даты.`} onConfirm={() => storeId && remove.mutate({ storeId, entryDate: resolvedEntryDate, metricCode: item.metricCode })}/></div></td></tr>) : <tr><td colSpan={4}>На выбранную дату показателей нет. Выберите показатель и добавьте первый факт через форму выше.</td></tr>}</tbody></table></div>
      </article>
    </section>}
  </AuditShell>;
}
