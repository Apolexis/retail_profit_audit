import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, History, LoaderCircle, Merge, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import { Link } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl } from "@/components/DateRangeControl";
import { importStatusMeta, type ImportStage } from "@/lib/importStatus";
import { trpc } from "@/lib/trpc";
import type { DateRangeValue } from "@/contexts/AuditContext";

type Uploaded = { fileName: string; fileBase64: string };
type Resolution = "replace" | "skip" | "preserve_manual";
const asBase64 = (file: File) => new Promise<Uploaded>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Не удалось прочитать файл")); reader.onload = () => resolve({ fileName: file.name, fileBase64: String(reader.result).split(",")[1] ?? "" }); reader.readAsDataURL(file); });
const dateTime = (value: Date | string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
const fullYearFor = (fileName: string): DateRangeValue => { const year = Number(fileName.match(/(20\d{2})/)?.[1] ?? new Date().getFullYear()); return { from: `${year}-01-01`, to: `${year}-12-31` }; };

export default function ImportData() {
  const fileInput = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const imports = trpc.audit.imports.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [payload, setPayload] = useState<Uploaded | null>(null);
  const [drag, setDrag] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("preserve_manual");
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<ImportStage>("idle");
  const [sourceStoreId, setSourceStoreId] = useState<number>();
  const [targetStoreId, setTargetStoreId] = useState<number>();
  const [mergeResolution, setMergeResolution] = useState<"replace" | "skip">("replace");
  const [importRange, setImportRange] = useState<DateRangeValue>(() => fullYearFor(""));
  const preview = trpc.audit.previewImport.useMutation({ onSuccess: () => setStage("ready"), onError: error => { setStage("error"); setMessage(error.message); } });
  const commit = trpc.audit.commitImport.useMutation({
    onMutate: () => { setStage("saving"); setMessage(""); },
    onSuccess: data => { setStage("done"); setMessage(`Импорт завершен: новых магазинов — ${data.createdStores}, новых дат — ${data.createdPeriods}, обновлено дат — ${data.updatedPeriods}${data.protectedMetricCount ? `, сохранено ручных правок — ${data.protectedMetricCount}` : ""}.`); utils.audit.dashboard.invalidate(); utils.audit.stores.invalidate(); utils.audit.imports.invalidate(); },
    onError: error => { setStage("error"); setMessage(error.message); },
  });
  const deleteImport = trpc.audit.deleteImport.useMutation({ onSuccess: data => { setMessage(`Импорт «${data.fileName}» удален: дат — ${data.deletedPeriods}, пустых магазинов — ${data.deletedStores}.`); utils.audit.dashboard.invalidate(); utils.audit.stores.invalidate(); utils.audit.imports.invalidate(); }, onError: error => setMessage(error.message) });
  const mergeStores = trpc.audit.mergeStores.useMutation({ onSuccess: data => { setMessage(`Объединение выполнено: перенесено — ${data.moved}, заменено совпадений — ${data.replaced}, пропущено — ${data.skipped}.`); setSourceStoreId(undefined); utils.audit.dashboard.invalidate(); utils.audit.stores.invalidate(); utils.audit.imports.invalidate(); }, onError: error => setMessage(error.message) });

  const accept = async (file?: File) => { if (!file) return; if (!/\.(xlsx|xlsm)$/i.test(file.name)) { setStage("error"); setMessage("Поддерживается книга Excel .xlsx или .xlsm."); return; } try { setStage("reading"); const next = await asBase64(file); setPayload(next); setImportRange(fullYearFor(file.name)); setMessage(""); setStage("checking"); preview.mutate(next); } catch (error) { setStage("error"); setMessage(error instanceof Error ? error.message : "Ошибка чтения файла"); } };
  const inRange = (entryDate: string) => entryDate >= importRange.from && entryDate <= importRange.to;
  const selectedPeriods = useMemo(() => preview.data?.periods.filter(item => inRange(item.entryDate)) ?? [], [preview.data, importRange.from, importRange.to]);
  const conflicts = useMemo(() => preview.data?.conflicts.filter(item => inRange(item.entryDate)) ?? [], [preview.data, importRange.from, importRange.to]);
  const protectedMetrics = useMemo(() => preview.data?.protectedMetrics.filter(item => inRange(item.entryDate)) ?? [], [preview.data, importRange.from, importRange.to]);
  const recognitionIssues = preview.data?.recognitionIssues ?? [];
  const importRows = imports.data ?? [];
  const storeOptions = stores.data ?? [];
  const sourceStore = storeOptions.find(store => store.id === sourceStoreId);
  const targetStore = storeOptions.find(store => store.id === targetStoreId);
  const canMerge = Boolean(sourceStoreId && targetStoreId && sourceStoreId !== targetStoreId);
  const stageMeta = importStatusMeta[stage];
  const submitImport = () => payload && commit.mutate({ ...payload, resolution, dateRange: importRange });
  const resetFile = () => { setPayload(null); preview.reset(); setMessage(""); setStage("idle"); };
  if (me.data?.role !== "admin") return <AuditShell kicker="10 / ИМПОРТ" title="Импорт Excel: обновить факты"><section className="empty-state"><ShieldAlert size={30}/><h2>Импорт доступен администратору</h2><p>Аналитик работает с назначенными магазинами. Для загрузки или удаления книги войдите под учетной записью администратора.</p></section></AuditShell>;

  return <AuditShell kicker="10 / ИМПОРТ И БАЗА" title="Импорт Excel: обновить факты">
    <section className="page-lede"><div><h2>Загрузите обновленную книгу без отправки в чат.</h2><p>Перед записью система покажет новые магазины, даты, совпадения и ошибки распознавания. Показатели в базу сохраняются только после явного подтверждения.</p></div><Link href="/manage" className="packet-link compact">Открыть управление базой <ArrowRight size={15}/></Link></section>
    {!imports.isLoading && !importRows.some(item => Number(item.periods) > 0) && <section className="data-source-banner"><FileSpreadsheet size={19}/><div><strong>В базе пока нет импортированных фактов.</strong><span>Данные аналитики появятся после первого подтвержденного импорта.</span></div></section>}
    <section className="import-layout">
      <article className="packet-card import-drop">
        <input ref={fileInput} type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12" hidden onChange={event => accept(event.target.files?.[0])}/>
        <button className={drag ? "drop-target dragging" : "drop-target"} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={event => { event.preventDefault(); setDrag(false); accept(event.dataTransfer.files?.[0]); }}><UploadCloud size={32}/><b>Перетащите книгу Excel сюда</b><span>или выберите файл с компьютера</span><small>Поддерживаются .xlsx и .xlsm</small></button>
        <div className={`upload-status stage-${stage}`} aria-live="polite">
          {["Файл", "Проверка", "Запись"].map((label, index) => <div key={label}><span className={stageMeta.step >= index + 1 ? "done" : ""}>{index + 1}</span><p><b>{label}</b><small>{index === 0 ? (stage === "reading" ? "читаем из браузера" : payload?.fileName ?? "ожидание") : index === 1 ? (stage === "checking" ? "распознаем листы и даты" : stageMeta.step >= 2 ? "предпросмотр готов" : "после выбора файла") : (stage === "saving" ? "сохраняем выбранные даты" : stage === "done" ? "готово" : "после подтверждения")}</small></p></div>)}
          <strong>{["reading", "checking", "saving"].includes(stage) && <LoaderCircle size={14} className="upload-spin"/>}{stageMeta.label}</strong>
        </div>
        {payload && <div className="upload-file"><FileSpreadsheet size={18}/><span>{payload.fileName}</span><button onClick={resetFile}>Убрать файл</button></div>}
        {message && <p className={message.startsWith("Импорт завершен") ? "import-message success" : "import-message"}>{message}</p>}
      </article>
      <article className="packet-card import-requirements"><div className="card-title"><div><span>ТРЕБОВАНИЯ К ФАЙЛУ</span><h3>Как система читает книгу</h3></div></div><div className="requirement-list"><div><b>1</b><p><strong>Год берется из имени файла.</strong> Например, <code>2026.xlsx</code> создает даты 2026 года.</p></div><div><b>2</b><p><strong>Первые три листа пропускаются.</strong> Они считаются техническими или сводными.</p></div><div><b>3</b><p><strong>Каждый лист начиная с 4-го — отдельный магазин.</strong> Переименованный лист создаст новую точку, которую можно объединить ниже.</p></div><div><b>4</b><p><strong>Книга читается по дням.</strong> Продажи, закупки, списания и другие ежедневные строки остаются на своей дате.</p></div><div><b>5</b><p><strong>Ежемесячные статьи материализуются в базе по дням.</strong> Согласованные расходы и итоговая чистая прибыль, записанные один раз в месяц, распределяются по календарным дням уже при импорте; исходная строка книги не изменяется.</p></div><div><b>6</b><p><strong>Совпадение «магазин + дата» — конфликт.</strong> Выберите замену, пропуск или сохранение ручных правок.</p></div></div></article>
    </section>
    {preview.data && <section className="packet-card"><div className="card-title"><div><span>ПРЕДПРОСМОТР ИМПОРТА</span><h3>Файл распознан: {preview.data.year} год</h3></div><small>{selectedPeriods.length} магазин-дата к импорту</small></div>
      {recognitionIssues.length > 0 && <div className="recognition-issues conflict-box"><AlertTriangle size={18}/><div><b>Проверьте распознавание листов</b>{recognitionIssues.map((issue, index) => <p key={`${issue.sheet}-${index}`}><strong>{issue.sheet}</strong> · {issue.message}</p>)}</div></div>}
      <div className="import-date-filter"><div><span>ДАТЫ ДЛЯ ЗАГРУЗКИ</span><strong>Выберите календарный диапазон</strong><small>В базу попадут только распознанные даты файла внутри интервала. Исходная книга не изменяется.</small></div><DateRangeControl value={importRange} onChange={setImportRange} title="ДАТЫ ДЛЯ ИМПОРТА" ariaLabel="Выбрать даты импорта"/></div>
      <div className="import-summary"><div><span>Магазины в файле</span><strong>{preview.data.stores.length}</strong><small>{preview.data.stores.join(", ")}</small></div><div><span>Даты в выбранном диапазоне</span><strong>{selectedPeriods.length}</strong><small>{importRange.from} — {importRange.to}</small></div><div className={conflicts.length ? "risk" : ""}><span>Совпадения дат</span><strong>{conflicts.length}</strong><small>{conflicts.length ? "нужно выбрать действие" : "конфликтов нет"}</small></div><div className={protectedMetrics.length ? "warning" : ""}><span>Ручные правки</span><strong>{protectedMetrics.length}</strong><small>{protectedMetrics.length ? "можно сохранить при обновлении" : "защищать нечего"}</small></div></div>
      {conflicts.length > 0 && <><div className="conflict-box"><AlertTriangle size={18}/><div><b>В выбранном диапазоне есть сохраненные даты</b><span>{conflicts.slice(0, 8).map(item => `${item.store} · ${item.entryDate ?? item.monthDate}`).join("; ")}{conflicts.length > 8 ? " …" : ""}</span></div></div><div className="conflict-actions"><label><input type="radio" checked={resolution === "preserve_manual"} onChange={() => setResolution("preserve_manual")}/> Обновить импортные данные, сохранить ручные правки</label><label><input type="radio" checked={resolution === "replace"} onChange={() => setResolution("replace")}/> Полностью заменить сохраненные значения</label><label><input type="radio" checked={resolution === "skip"} onChange={() => setResolution("skip")}/> Пропустить совпадающие даты</label><Link href="/manage">Открыть точечное редактирование</Link></div></>}
      {conflicts.length > 0 && resolution !== "skip" ? <ConfirmDangerDialog trigger={<button className="packet-link" disabled={commit.isPending || !selectedPeriods.length}><CheckCircle2 size={15}/>{commit.isPending ? "Сохраняем…" : resolution === "preserve_manual" ? "Подтвердить обновление" : "Подтвердить замену"}</button>} title={resolution === "preserve_manual" ? "Обновить данные, сохранив ручные правки?" : "Заменить совпадающие факты?"} description={`Будут обновлены даты ${importRange.from} — ${importRange.to}. ${resolution === "preserve_manual" ? `${protectedMetrics.length} вручную отредактированных показателей останутся как есть.` : "Прежние значения сохранятся в журнале изменений."}`} confirmLabel={resolution === "preserve_manual" ? "Обновить и сохранить правки" : "Заменить и импортировать"} onConfirm={submitImport}/> : <button className="packet-link" disabled={commit.isPending || !payload || !selectedPeriods.length} onClick={submitImport}>{commit.isPending ? "Сохраняем…" : "Подтвердить импорт"}<CheckCircle2 size={15}/></button>}
    </section>}
    <section className="packet-card import-history"><div className="card-title"><div><span><History size={15}/> ИСТОРИЯ ИМПОРТОВ</span><h3>Какие книги сейчас формируют базу</h3></div><small>Удаление убирает только факты, принадлежащие выбранной книге.</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Книга</th><th>Год</th><th>Даты</th><th>Магазины</th><th>Загружено</th><th/></tr></thead><tbody>{importRows.length ? importRows.map(item => <tr key={item.id}><td><strong>{item.fileName}</strong></td><td>{item.sourceYear}</td><td>{item.periods}</td><td>{item.stores}</td><td>{dateTime(item.createdAt)}</td><td><ConfirmDangerDialog trigger={<button className="row-delete" disabled={deleteImport.isPending}><Trash2 size={14}/>Удалить импорт</button>} title="Удалить импорт и его факты?" description={`Будут удалены только даты, которые по-прежнему принадлежат книге «${item.fileName}».`} onConfirm={() => deleteImport.mutate({ importId: item.id })}/></td></tr>) : <tr><td colSpan={6}>Подтвержденных импортов пока нет.</td></tr>}</tbody></table></div></section>
    <section className="packet-card store-merge"><div className="card-title"><div><span><Merge size={15}/> ОБЪЕДИНЕНИЕ ТОЧЕК</span><h3>Связать переименованный лист с существующим магазином</h3></div></div><p className="packet-note">Переносит все даты и права из исходного магазина в целевой. При совпадении дат выберите правило обработки.</p><div className="edit-controls"><label>Переименованный / исходный магазин<select value={sourceStoreId ?? ""} onChange={event => setSourceStoreId(Number(event.target.value) || undefined)}><option value="">Выберите магазин</option>{storeOptions.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Целевой магазин<select value={targetStoreId ?? ""} onChange={event => setTargetStoreId(Number(event.target.value) || undefined)}><option value="">Выберите магазин</option>{storeOptions.filter(store => store.id !== sourceStoreId).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Совпадающие даты<select value={mergeResolution} onChange={event => setMergeResolution(event.target.value as "replace" | "skip")}><option value="replace">Заменить целевые данными исходного</option><option value="skip">Оставить целевые, убрать исходные</option></select></label></div><ConfirmDangerDialog trigger={<button className="packet-link" disabled={!canMerge || mergeStores.isPending}><Merge size={15}/>{mergeStores.isPending ? "Объединяем…" : `Объединить ${sourceStore?.name ?? ""} → ${targetStore?.name ?? ""}`}</button>} title="Объединить магазины?" description={`Все даты и права точки «${sourceStore?.name ?? ""}» будут перенесены в «${targetStore?.name ?? ""}».`} confirmLabel="Объединить точки" onConfirm={() => sourceStoreId && targetStoreId && mergeStores.mutate({ sourceStoreId, targetStoreId, resolution: mergeResolution })}/></section>
  </AuditShell>;
}
