import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, History, LoaderCircle, Merge, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { Link } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl } from "@/components/DateRangeControl";
import { importStatusMeta, type ImportStage } from "@/lib/importStatus";
import { trpc } from "@/lib/trpc";
import type { DateRangeValue } from "@/contexts/AuditContext";

type Uploaded = { fileName: string; file: File };
type Resolution = "replace" | "skip" | "preserve_manual";
type PreviewThreshold = { store: string; entryDate: string; amount: number; rule: { ruleKey: string; label: string; severity: "info" | "warning" | "critical"; description: string; threshold: number } };
type TechnicalPreviewDay = { entryDate: string; periodCount: number; conflictCount: number; protectedMetricCount: number };
type ControlPreviewDay = TechnicalPreviewDay & { cashTotals: Record<string, number>; ndflTotal: number; thresholdBreachCount: number };
type ImportPreview = { year: number; stores: string[]; periodCount: number; recognitionIssues: Array<{ sheet: string; message: string }>; technicalDays: TechnicalPreviewDay[]; dailyTotals: ControlPreviewDay[]; conflictCount: number; conflictSamples: Array<{ store: string; monthDate: string; entryDate: string }>; protectedMetricCount: number; protectedMetricSamples: Array<{ store: string; entryDate: string; metricCode: string }>; thresholdBreachCount: number; thresholdBreaches: PreviewThreshold[]; canViewImportControls: boolean };

const cashArticleLabels: Record<string, string> = { household: "Хоз. нужды нал", delivery: "Доставка нал", cleaning: "Уборка нал", bonus: "Премия нал", seniority: "Выслуга нал", supplement: "Доплата нал", driver_cash: "Водитель нал", utilities_cash: "Коммунальные нал", operating_costs: "Расходы нал" };
const cashArticleCodes = Object.keys(cashArticleLabels);
const dateTime = (value: Date | string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
const fullYearFor = (fileName: string): DateRangeValue => {
  const year = Number(fileName.match(/(20\d{2})/)?.[1] ?? new Date().getFullYear());
  return { from: `${year}-01-01`, to: `${year}-12-31` };
};
const postWorkbook = async <T,>(path: string, payload: Uploaded, params: Record<string, string>) => {
  const response = await fetch(`${path}?${new URLSearchParams(params).toString()}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: payload.file });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось обработать книгу Excel.");
  return body as T;
};

export default function ImportData() {
  const fileInput = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const importAccess = me.data?.role === "admin" ? "edit" : me.data?.importAccessLevel ?? "none";
  const canUpload = importAccess === "upload" || importAccess === "edit";
  const canEditImport = importAccess === "edit";
  const imports = trpc.audit.imports.useQuery(undefined, { retry: false, enabled: canUpload });
  const materialization = trpc.audit.importMaterializationSettings.useQuery(undefined, { retry: false, enabled: canUpload });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const credentialStatus = trpc.audit.importCredentialStatus.useQuery(undefined, { retry: false, enabled: me.data?.role === "admin" });
  const [payload, setPayload] = useState<Uploaded | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [drag, setDrag] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("preserve_manual");
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<ImportStage>("idle");
  const [sourceStoreId, setSourceStoreId] = useState<number>();
  const [targetStoreId, setTargetStoreId] = useState<number>();
  const [mergeResolution, setMergeResolution] = useState<"replace" | "skip">("replace");
  const [importRange, setImportRange] = useState<DateRangeValue>(() => fullYearFor(""));
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [workbookPassword, setWorkbookPassword] = useState("");
  const [unprotectPassword, setUnprotectPassword] = useState("");
  const [credentialMessage, setCredentialMessage] = useState("");

  const deleteImport = trpc.audit.deleteImport.useMutation({ onSuccess: data => { setMessage(`Импорт «${data.fileName}» удален: дат — ${data.deletedPeriods}, пустых магазинов — ${data.deletedStores}.`); utils.audit.dashboard.invalidate(); utils.audit.stores.invalidate(); utils.audit.imports.invalidate(); }, onError: error => setMessage(error.message) });
  const downloadImport = trpc.audit.downloadImport.useMutation({ onSuccess: data => { setMessage(`Скачиваем исходную книгу «${data.fileName}» без преобразования данных.`); window.location.assign(data.url); }, onError: error => setMessage(error.message) });
  const updateMaterialization = trpc.audit.updateImportMaterializationSettings.useMutation({ onSuccess: () => { utils.audit.importMaterializationSettings.invalidate(); setMessage("Список ежедневной материализации сохранен: он будет применен только к следующим импортам."); }, onError: error => setMessage(error.message) });
  const updateImportCredentials = trpc.audit.updateImportCredentials.useMutation({ onSuccess: () => { setWorkbookPassword(""); setUnprotectPassword(""); setCredentialMessage("Пароли сохранены в защищенной конфигурации и будут использоваться для следующих импортов."); credentialStatus.refetch(); }, onError: () => setCredentialMessage("Не удалось сохранить пароли. Проверьте подключение и повторите попытку.") });
  const mergeStores = trpc.audit.mergeStores.useMutation({ onSuccess: data => { setMessage(`Объединение выполнено: перенесено — ${data.moved}, заменено совпадений — ${data.replaced}, пропущено — ${data.skipped}.`); setSourceStoreId(undefined); utils.audit.dashboard.invalidate(); utils.audit.stores.invalidate(); utils.audit.imports.invalidate(); }, onError: error => setMessage(error.message) });

  const accept = async (file?: File) => {
    if (!file || !canUpload) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setStage("error");
      setMessage("Поддерживается книга Excel .xlsx или .xlsm.");
      return;
    }
    const next = { fileName: file.name, file };
    try {
      setStage("checking");
      setPayload(next);
      setPreviewData(null);
      setImportRange(fullYearFor(file.name));
      setResolution(canEditImport ? "preserve_manual" : "skip");
      setMessage("");
      setIsPreviewing(true);
      setPreviewData(await postWorkbook<ImportPreview>("/api/audit-import/preview", next, { fileName: next.fileName }));
      setStage("ready");
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Ошибка чтения файла");
    } finally {
      setIsPreviewing(false);
    }
  };
  const inRange = (entryDate: string) => entryDate >= importRange.from && entryDate <= importRange.to;
  const selectedDays = useMemo(() => previewData?.technicalDays.filter(day => inRange(day.entryDate)) ?? [], [previewData, importRange]);
  const controlDays = useMemo(() => previewData?.dailyTotals.filter(day => inRange(day.entryDate)) ?? [], [previewData, importRange]);
  const selectedPeriodCount = useMemo(() => selectedDays.reduce((total, day) => total + day.periodCount, 0), [selectedDays]);
  const conflictCount = useMemo(() => selectedDays.reduce((total, day) => total + day.conflictCount, 0), [selectedDays]);
  const protectedMetricCount = useMemo(() => selectedDays.reduce((total, day) => total + day.protectedMetricCount, 0), [selectedDays]);
  const thresholdBreachCount = useMemo(() => controlDays.reduce((total, day) => total + day.thresholdBreachCount, 0), [controlDays]);
  const conflicts = useMemo(() => (previewData?.conflictSamples.filter(item => inRange(item.entryDate)) ?? []).slice(0, conflictCount), [previewData, importRange, conflictCount]);
  const thresholdBreaches = useMemo(() => (previewData?.thresholdBreaches.filter(item => inRange(item.entryDate)) ?? []).slice(0, thresholdBreachCount), [previewData, importRange, thresholdBreachCount]);
  const cashBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    controlDays.forEach(day => cashArticleCodes.forEach(code => totals.set(code, (totals.get(code) ?? 0) + Number(day.cashTotals[code] ?? 0))));
    return cashArticleCodes.map(code => ({ code, label: cashArticleLabels[code], amount: totals.get(code) ?? 0 })).filter(item => item.amount > 0.005).sort((left, right) => right.amount - left.amount);
  }, [controlDays]);
  const cashTotal = cashBreakdown.reduce((total, item) => total + item.amount, 0);
  const ndflTotal = useMemo(() => controlDays.reduce((total, day) => total + Number(day.ndflTotal), 0), [controlDays]);
  const recognitionIssues = previewData?.recognitionIssues ?? [];
  const importRows = imports.data ?? [];
  const storeOptions = stores.data ?? [];
  const sourceStore = storeOptions.find(store => store.id === sourceStoreId);
  const targetStore = storeOptions.find(store => store.id === targetStoreId);
  const canMerge = Boolean(sourceStoreId && targetStoreId && sourceStoreId !== targetStoreId);
  const openConflictEditor = () => {
    const first = conflicts[0];
    const target = first ? storeOptions.find(store => store.name === first.store) : undefined;
    if (first && target) sessionStorage.setItem("auditManageTarget", JSON.stringify({ storeId: target.id, entryDate: first.entryDate ?? first.monthDate }));
  };
  const stageMeta = importStatusMeta[stage];
  const selectedMaterializationCodes = materialization.data?.metricCodes ?? [];
  const materializedLabels = (materialization.data?.supportedMetrics ?? []).filter(metric => selectedMaterializationCodes.includes(metric.code)).map(metric => metric.label);
  const toggleMaterialization = (code: string) => {
    if (me.data?.role !== "admin" || updateMaterialization.isPending) return;
    const next = selectedMaterializationCodes.includes(code) ? selectedMaterializationCodes.filter(current => current !== code) : [...selectedMaterializationCodes, code];
    updateMaterialization.mutate({ metricCodes: next });
  };
  const submitImport = async () => {
    if (!payload || isCommitting) return;
    try {
      setStage("saving");
      setMessage("");
      setIsCommitting(true);
      const data = await postWorkbook<{ createdStores: number; createdPeriods: number; updatedPeriods: number; protectedMetricCount: number }>("/api/audit-import/commit", payload, { fileName: payload.fileName, resolution, from: importRange.from, to: importRange.to });
      setStage("done");
      setMessage(`Импорт завершен: новых магазинов — ${data.createdStores}, новых дат — ${data.createdPeriods}, обновлено дат — ${data.updatedPeriods}${data.protectedMetricCount ? `, сохранено ручных правок — ${data.protectedMetricCount}` : ""}.`);
      utils.audit.dashboard.invalidate();
      utils.audit.stores.invalidate();
      utils.audit.imports.invalidate();
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Не удалось подтвердить импорт.");
    } finally {
      setIsCommitting(false);
    }
  };
  const resetFile = () => {
    setPayload(null);
    setPreviewData(null);
    setMessage("");
    setStage("idle");
    if (fileInput.current) fileInput.current.value = "";
  };
  const saveCredentials = () => {
    const next = { workbookPassword: workbookPassword.trim() || undefined, unprotectPassword: unprotectPassword.trim() || undefined };
    if (!next.workbookPassword && !next.unprotectPassword) return setCredentialMessage("Введите хотя бы один новый пароль, который нужно сохранить.");
    setCredentialMessage("");
    updateImportCredentials.mutate(next);
  };

  if (me.isLoading) return <AuditShell kicker="10 / ИМПОРТ" title="Импорт Excel: обновить факты"><section className="empty-state"><LoaderCircle className="upload-spin" size={30}/><h2>Проверяем права импорта</h2></section></AuditShell>;
  if (!canUpload) return <AuditShell kicker="10 / ИМПОРТ" title="Импорт Excel: обновить факты"><section className="empty-state"><ShieldAlert size={30}/><h2>Нет доступа к импорту</h2><p>Администратор может назначить уровень «Загрузка» для добавления новых данных или «Изменение» для замены и удаления импорта.</p></section></AuditShell>;

  return <AuditShell kicker="10 / ИМПОРТ И БАЗА" title="Импорт Excel: обновить факты">
    <section className="page-lede">
      <div><h2>Загрузите обновленную книгу без отправки в чат.</h2><p>Перед записью система покажет новые магазины, даты, совпадения и ошибки распознавания. Показатели в базу сохраняются только после явного подтверждения.</p></div>
      <Link href="/manage" className="packet-link compact">Открыть управление базой <ArrowRight size={15}/></Link>
    </section>
    {!imports.isLoading && !importRows.some(item => Number(item.periods) > 0) && <section className="data-source-banner"><FileSpreadsheet size={19}/><div><strong>В базе пока нет импортированных фактов.</strong><span>Данные аналитики появятся после первого подтвержденного импорта.</span></div></section>}
    {me.data?.role === "admin" && <section className="import-credentials" aria-label="Пароли защищенной книги">
      <button type="button" className="import-credentials-toggle" aria-expanded={credentialsOpen} onClick={() => setCredentialsOpen(value => !value)}><span><b>Защищенные книги Excel</b><small>Пароль открытия скрыт и применяется при импорте; защищенные листы читаются без снятия защиты.</small></span><span className="credential-status">{credentialStatus.data?.workbookPasswordConfigured ? "Открытие настроено" : "Нет пароля открытия"} · чтение листов без снятия защиты</span></button>
      {credentialsOpen && <div className="import-credentials-form"><p>Введите только те значения, которые хотите заменить. Сохраненные символы не отображаются и не попадут в журнал действий. При чтении система не снимает защиту с листов и не изменяет исходную книгу.</p><label>Пароль открытия книги<input type="password" value={workbookPassword} onChange={event => setWorkbookPassword(event.target.value)} autoComplete="new-password" placeholder="Оставьте пустым, чтобы не менять"/></label><label>Пароль защиты листов и структуры (резерв)<input type="password" value={unprotectPassword} onChange={event => setUnprotectPassword(event.target.value)} autoComplete="new-password" placeholder="Оставьте пустым, чтобы не менять"/></label><button type="button" className="subtle-action" disabled={updateImportCredentials.isPending} onClick={saveCredentials}>{updateImportCredentials.isPending ? "Сохраняем…" : "Сохранить замену"}</button>{credentialMessage && <small className="credential-message" aria-live="polite">{credentialMessage}</small>}</div>}
    </section>}
    <section className="import-layout">
      <article className="packet-card import-drop">
        <input ref={fileInput} className="import-file-input" type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" hidden onChange={event => accept(event.target.files?.[0])}/>
        <button type="button" className={drag ? "drop-target dragging" : "drop-target"} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={event => { event.preventDefault(); setDrag(false); accept(event.dataTransfer.files?.[0]); }}><UploadCloud size={32}/><b>Перетащите книгу Excel сюда</b><span>или выберите файл с компьютера</span><small>Поддерживаются .xlsx и .xlsm</small></button>
        <div className={`upload-status stage-${stage}`} aria-live="polite">{["Файл", "Проверка", "Запись"].map((label, index) => <div key={label}><span className={stageMeta.step >= index + 1 ? "done" : ""}>{index + 1}</span><p><b>{label}</b><small>{index === 0 ? payload?.fileName ?? "ожидание" : index === 1 ? (stage === "checking" ? "распознаем листы и даты" : stageMeta.step >= 2 ? "предпросмотр готов" : "после выбора файла") : (stage === "saving" ? "сохраняем выбранные даты" : stage === "done" ? "готово" : "после подтверждения")}</small></p></div>)}<strong>{["checking", "saving"].includes(stage) && <LoaderCircle size={14} className="upload-spin"/>}{stageMeta.label}</strong></div>
        {payload && <div className="upload-file"><FileSpreadsheet size={18}/><span>{payload.fileName}</span><button type="button" onClick={resetFile}>Убрать файл</button></div>}
        {message && <p className={message.startsWith("Импорт завершен") ? "import-message success" : "import-message"}>{message}</p>}
      </article>
      <article className="packet-card import-requirements">
        <div className="card-title"><div><span>ТРЕБОВАНИЯ К ФАЙЛУ</span><h3>Как система читает книгу</h3></div></div>
        <div className="requirement-list">
          <div><b>1</b><p><strong>Год берется из имени файла.</strong> Например, <code>2026.xlsx</code> создает даты 2026 года.</p></div>
          <div><b>2</b><p><strong>Первые три листа пропускаются.</strong> Они считаются техническими или сводными.</p></div>
          <div><b>3</b><p><strong>Каждый лист начиная с 4-го — отдельный магазин.</strong> Переименованный лист создаст новую точку, которую можно объединить ниже.</p></div>
          <div><b>4</b><p><strong>Книга читается по дням.</strong> Продажи, закупки, списания и другие ежедневные строки сохраняются на своей фактической дате.</p></div>
          <div className="materialization-requirement"><b>5</b><div><p><strong>Ежемесячные статьи материализуются в дневные записи только при новом импорте.</strong> Для выбранных ниже согласованных расходов месячная сумма распределяется по календарным дням с сохранением точной суммы месяца. <strong>Чистая прибыль — особое правило:</strong> она не делится поровну, а распределяется пропорционально фактической дневной расходной нагрузке, также с точным месячным итогом. Исходная книга Excel не изменяется.</p><p className="materialization-fixed">НДФЛ 22%, банк и налоги остаются на их фактической дате; чистая прибыль не выбирается как статья, потому что ее расчет фиксирован.</p><div className="materialization-summary"><span>Сейчас выбрано: <b>{materializedLabels.length ? materializedLabels.join(" · ") : materialization.isLoading ? "загружаем список…" : "ни одной статьи"}</b></span><small>Изменение действует только на следующие подтвержденные импорты и не меняет существующие факты.</small></div>{me.data?.role === "admin" && <div className="materialization-picker" aria-label="Статьи будущей ежедневной материализации"><span>Статьи для следующих импортов</span><div>{(materialization.data?.supportedMetrics ?? []).map(metric => <button type="button" key={metric.code} className={selectedMaterializationCodes.includes(metric.code) ? "materialization-chip active" : "materialization-chip"} aria-pressed={selectedMaterializationCodes.includes(metric.code)} disabled={updateMaterialization.isPending} onClick={() => toggleMaterialization(metric.code)}>{metric.label}</button>)}</div><small>{updateMaterialization.isPending ? "Сохраняем настройку…" : "Нажмите на статью, чтобы включить или исключить ее из будущей ежедневной материализации."}</small></div>}</div></div>
          <div><b>6</b><p><strong>Совпадение «магазин + дата» — конфликт.</strong> Выберите замену, пропуск или сохранение ручных правок.</p></div>
        </div>
      </article>
    </section>
    {previewData && <section className="packet-card import-preview">
      <div className="card-title"><div><span>ПРЕДПРОСМОТР ИМПОРТА</span><h3>Файл распознан: {previewData.year} год</h3></div><small>{selectedPeriodCount} магазин-дата к импорту</small></div>
      {recognitionIssues.length > 0 && <div className="recognition-issues conflict-box"><AlertTriangle size={18}/><div><b>Проверьте распознавание листов</b>{recognitionIssues.map((issue, index) => <p key={`${issue.sheet}-${index}`}><strong>{issue.sheet}</strong> · {issue.message}</p>)}</div></div>}
      <div className="import-date-filter"><div className="import-date-copy"><span>ДАТЫ ДЛЯ ЗАГРУЗКИ</span><strong>Выберите календарный диапазон</strong><small>В базу попадут только распознанные даты файла внутри интервала. Исходная книга не изменяется.</small></div><DateRangeControl value={importRange} onChange={setImportRange} title="ДАТЫ ДЛЯ ИМПОРТА" ariaLabel="Выбрать даты импорта"/></div>
      <div className="import-summary"><div><span>Магазины в файле</span><strong>{previewData.stores.length}</strong><small>{previewData.stores.join(", ")}</small></div><div><span>Даты в выбранном диапазоне</span><strong>{selectedPeriodCount}</strong><small>{importRange.from} — {importRange.to}</small></div><div className={conflicts.length ? "risk" : ""}><span>Совпадения дат</span><strong>{conflictCount}</strong><small>{conflictCount ? "нужно выбрать действие" : "конфликтов нет"}</small></div><div className={protectedMetricCount ? "warning" : ""}><span>Ручные правки</span><strong>{protectedMetricCount}</strong><small>{protectedMetricCount ? "можно сохранить при обновлении" : "защищать нечего"}</small></div></div>
      {previewData.canViewImportControls && <section className="import-risk-control" aria-label="Сигналы и контроль импорта"><div className="card-title"><div><span>СИГНАЛЫ И КОНТРОЛЬ</span><h3>Операционные риски выбранных дат</h3></div><small>Только до подтверждения</small></div><div className="import-risk-overview"><article><span>Наличные статьи</span><strong>{cashTotal.toLocaleString("ru-RU")} ₽</strong><small>{cashBreakdown.length ? `${cashBreakdown.length} статей в разрезе ниже` : "в выбранных датах нет наличных статей"}</small></article><article><span>НДФЛ 22%</span><strong>{ndflTotal.toLocaleString("ru-RU")} ₽</strong><small>отдельно от наличных расходов</small></article><article className={thresholdBreaches.length ? "risk" : ""}><span>Пороговые риски</span><strong>{thresholdBreachCount}</strong><small>{thresholdBreachCount ? "по активным правилам сигналов" : "активных нарушений нет"}</small></article></div><div className="import-risk-detail"><div className="import-cash-breakdown"><h4>Из чего состоят траты нал</h4>{cashBreakdown.length ? cashBreakdown.map(item => <div key={item.code}><span>{item.label}</span><b>{item.amount.toLocaleString("ru-RU")} ₽</b></div>) : <p>Наличные статьи не распознаны в выбранном диапазоне.</p>}</div><div className="import-threshold-list"><h4>Сработавшие правила</h4>{thresholdBreaches.length ? thresholdBreaches.slice(0, 12).map((breach, index) => <div key={`${breach.store}-${breach.entryDate}-${breach.rule.ruleKey}-${index}`} className={breach.rule.severity}><span><b>{breach.rule.label}</b><small>{breach.store} · {breach.entryDate}</small></span><strong>{Number(breach.amount).toLocaleString("ru-RU")} ₽</strong></div>) : <p>После импорта система продолжит контролировать наличные статьи, НДФЛ 22%, остаток, чистую прибыль и списания М. по включенным порогам.</p>}</div></div></section>}
      {conflictCount > 0 && <><div className="conflict-box"><AlertTriangle size={18}/><div><b>В выбранном диапазоне есть сохраненные даты</b><span>{conflicts.slice(0, 8).map(item => `${item.store} · ${item.entryDate ?? item.monthDate}`).join("; ")}{conflictCount > 8 ? " …" : ""}</span></div></div>{canEditImport ? <div className="conflict-actions"><label><input type="radio" checked={resolution === "preserve_manual"} onChange={() => setResolution("preserve_manual")}/> Обновить импортные данные, сохранить ручные правки</label><label><input type="radio" checked={resolution === "replace"} onChange={() => setResolution("replace")}/> Полностью заменить сохраненные значения</label><label><input type="radio" checked={resolution === "skip"} onChange={() => setResolution("skip")}/> Пропустить совпадающие даты</label><Link href="/manage" className="subtle-action conflict-edit-link" onClick={openConflictEditor}>Открыть точечное редактирование <ArrowRight size={14}/></Link></div> : <p className="packet-note">Ваш уровень «Загрузка» сохранит только новые даты: совпадающие значения будут пропущены.</p>}</>}
      {conflictCount > 0 && resolution !== "skip" ? <ConfirmDangerDialog trigger={<button className="packet-link" disabled={isCommitting || !selectedPeriodCount}><CheckCircle2 size={15}/>{isCommitting ? "Сохраняем…" : resolution === "preserve_manual" ? "Подтвердить обновление" : "Подтвердить замену"}</button>} title={resolution === "preserve_manual" ? "Обновить данные, сохранив ручные правки?" : "Заменить совпадающие факты?"} description={`Будут обновлены даты ${importRange.from} — ${importRange.to}. ${resolution === "preserve_manual" ? `${protectedMetricCount} вручную отредактированных показателей останутся как есть.` : "Прежние значения сохранятся в журнале изменений."}`} confirmLabel={resolution === "preserve_manual" ? "Обновить и сохранить правки" : "Заменить и импортировать"} onConfirm={submitImport}/> : <button type="button" className="packet-link" disabled={isCommitting || !payload || !selectedPeriodCount} onClick={submitImport}>{isCommitting ? "Сохраняем…" : "Подтвердить импорт"}<CheckCircle2 size={15}/></button>}
    </section>}
    <section className="packet-card import-history"><div className="card-title"><div><span><History size={15}/> ИСТОРИЯ ИМПОРТОВ</span><h3>Какие книги сейчас формируют базу</h3></div><small>{canEditImport ? "Скачивание возвращает точную исходную книгу; удаление убирает только принадлежащие ей факты." : "Уровень «Загрузка» позволяет просматривать историю без скачивания и удаления."}</small></div><div className="import-history-mobile" aria-label="История импортов: мобильная версия">{importRows.length ? importRows.map(item => <article key={item.id} className="import-history-card"><strong>{item.fileName}</strong><dl><div><dt>Год</dt><dd>{item.sourceYear}</dd></div><div><dt>Даты</dt><dd>{item.periods}</dd></div><div><dt>Магазины</dt><dd>{item.stores}</dd></div><div><dt>Загружено</dt><dd>{dateTime(item.createdAt)}</dd></div></dl>{canEditImport && <div className="import-history-card-actions"><button type="button" className="subtle-action" disabled={downloadImport.isPending} onClick={() => downloadImport.mutate({ importId: item.id })}><Download size={14}/>{downloadImport.isPending ? "Готовим…" : "Скачать исходник"}</button><ConfirmDangerDialog trigger={<button className="row-delete" disabled={deleteImport.isPending}><Trash2 size={14}/>Удалить импорт</button>} title="Удалить импорт и его факты?" description={`Будут удалены только даты, которые по-прежнему принадлежат книге «${item.fileName}».`} onConfirm={() => deleteImport.mutate({ importId: item.id })}/></div>}</article>) : <p className="packet-note">Подтвержденных импортов пока нет.</p>}</div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Книга</th><th>Год</th><th>Даты</th><th>Магазины</th><th>Загружено</th>{canEditImport && <th/>}</tr></thead><tbody>{importRows.length ? importRows.map(item => <tr key={item.id}><td><strong>{item.fileName}</strong></td><td>{item.sourceYear}</td><td>{item.periods}</td><td>{item.stores}</td><td>{dateTime(item.createdAt)}</td>{canEditImport && <td className="import-row-actions"><button type="button" className="subtle-action" disabled={downloadImport.isPending} onClick={() => downloadImport.mutate({ importId: item.id })}><Download size={14}/>{downloadImport.isPending ? "Готовим…" : "Скачать исходник"}</button><ConfirmDangerDialog trigger={<button className="row-delete" disabled={deleteImport.isPending}><Trash2 size={14}/>Удалить импорт</button>} title="Удалить импорт и его факты?" description={`Будут удалены только даты, которые по-прежнему принадлежат книге «${item.fileName}».`} onConfirm={() => deleteImport.mutate({ importId: item.id })}/></td>}</tr>) : <tr><td colSpan={canEditImport ? 6 : 5}>Подтвержденных импортов пока нет.</td></tr>}</tbody></table></div></section>
    {me.data?.role === "admin" && <section className="packet-card store-merge"><div className="card-title"><div><span><Merge size={15}/> ОБЪЕДИНЕНИЕ ТОЧЕК</span><h3>Связать переименованный лист с существующим магазином</h3></div></div><p className="packet-note">Переносит все даты и права из исходного магазина в целевой. При совпадении дат выберите правило обработки.</p><div className="edit-controls"><label>Переименованный / исходный магазин<select value={sourceStoreId ?? ""} onChange={event => setSourceStoreId(Number(event.target.value) || undefined)}><option value="">Выберите магазин</option>{storeOptions.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Целевой магазин<select value={targetStoreId ?? ""} onChange={event => setTargetStoreId(Number(event.target.value) || undefined)}><option value="">Выберите магазин</option>{storeOptions.filter(store => store.id !== sourceStoreId).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Совпадающие даты<select value={mergeResolution} onChange={event => setMergeResolution(event.target.value as "replace" | "skip")}><option value="replace">Заменить целевые данными исходного</option><option value="skip">Оставить целевые, убрать исходные</option></select></label></div><ConfirmDangerDialog trigger={<button className="packet-link" disabled={!canMerge || mergeStores.isPending}><Merge size={15}/>{mergeStores.isPending ? "Объединяем…" : `Объединить ${sourceStore?.name ?? ""} → ${targetStore?.name ?? ""}`}</button>} title="Объединить магазины?" description={`Все даты и права точки «${sourceStore?.name ?? ""}» будут перенесены в «${targetStore?.name ?? ""}».`} confirmLabel="Объединить точки" onConfirm={() => sourceStoreId && targetStoreId && mergeStores.mutate({ sourceStoreId, targetStoreId, resolution: mergeResolution })}/></section>}
  </AuditShell>;
}
