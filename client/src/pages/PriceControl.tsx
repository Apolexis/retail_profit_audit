import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, FileSearch, GitCompareArrows, Link2, Loader2, PackageSearch, Upload, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { trpc } from "@/lib/trpc";

type Preview = { fileName: string; sourceType: "xls" | "xlsx" | "pdf" | "docx"; detectedSupplierName: string | null; detectedSourceDate: string | null; rows: Array<{ rawName: string; packaging: string | null; priceOptions: Array<{ priceAmount: number; normalizedPrice: number | null; normalizedUnit: string }> }>; warningCount: number; warnings: string[] };
type PriceLevel = "none" | "view" | "upload" | "edit";

const formatMoney = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : "дата не указана";
const modeLabel: Record<string, string> = { standard: "основная", cash: "наличные", cashless_no_vat: "б/нал без НДС", cashless_vat: "б/нал с НДС", spb: "СПБ", moscow: "Москва", special: "спецпредложение", threshold: "цена от объема" };
const priceLabel = (price: { normalizedPrice: number; normalizedUnit: string }) => `${formatMoney(price.normalizedPrice)} ₽/${price.normalizedUnit === "kg" ? "кг" : price.normalizedUnit === "l" ? "л" : "шт"}`;

async function postPriceFile(path: string, file: File, query: Record<string, string>) {
  const queryString = new URLSearchParams(query).toString();
  const response = await fetch(`${path}?${queryString}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
  const body = await response.json().catch(() => ({ error: "Не удалось получить ответ сервера." }));
  if (!response.ok) throw new Error(body.error ?? "Не удалось обработать прайс‑лист.");
  return body;
}

export default function PriceControl() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const level: PriceLevel = me.data?.role === "admin" ? "edit" : (me.data?.priceAccessLevel ?? "none");
  const canView = level !== "none";
  const canUpload = level === "upload" || level === "edit";
  const canEdit = level === "edit";
  const overview = trpc.priceControl.overview.useQuery(undefined, { enabled: canView, retry: false });
  const createProduct = trpc.priceControl.createProduct.useMutation({ onSuccess: () => { utils.priceControl.overview.invalidate(); toast.success("Внутренний товар создан"); }, onError: error => toast.error(error.message) });
  const linkRow = trpc.priceControl.linkRow.useMutation({ onSuccess: () => { utils.priceControl.overview.invalidate(); toast.success("Связь поставщика сохранена", { description: "Следующие прайсы этого поставщика будут сопоставляться автоматически." }); }, onError: error => toast.error(error.message) });
  const reassignAlias = trpc.priceControl.reassignAlias.useMutation({ onSuccess: () => { utils.priceControl.overview.invalidate(); toast.success("Автосвязь поставщика переназначена"); }, onError: error => toast.error(error.message) });
  const unlinkAlias = trpc.priceControl.unlinkAlias.useMutation({ onSuccess: () => { utils.priceControl.overview.invalidate(); toast.success("Автосвязь поставщика отменена"); }, onError: error => toast.error(error.message) });
  const deleteImport = trpc.priceControl.deleteImport.useMutation({ onSuccess: () => { utils.priceControl.overview.invalidate(); toast.success("Прайс‑лист удален"); }, onError: error => toast.error(error.message) });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [linkTargets, setLinkTargets] = useState<Record<number, string>>({});
  const [aliasTargets, setAliasTargets] = useState<Record<number, string>>({});
  const [newNames, setNewNames] = useState<Record<number, string>>({});

  const filteredComparisons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return (overview.data?.comparisons ?? []).filter(item => !query || `${item.product.canonicalName} ${item.product.internalCode} ${item.product.variant ?? ""} ${item.product.sizeText ?? ""}`.toLocaleLowerCase("ru").includes(query));
  }, [overview.data?.comparisons, search]);
  const selected = filteredComparisons.find(item => item.product.id === selectedProductId) ?? filteredComparisons[0] ?? null;
  const chartData = (selected?.offers ?? []).map(offer => ({ name: offer.supplierName, price: offer.normalizedPrice, unit: offer.normalizedUnit, winner: selected?.recommendation?.supplierId === offer.supplierId }));

  const inspectFile = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const result = await postPriceFile("/api/price-import/preview", file, { fileName: file.name });
      setPreview(result);
      setSupplierName(result.detectedSupplierName ?? "");
      setSourceDate(result.detectedSourceDate ?? "");
      toast.success("Прайс‑лист разобран", { description: `Распознано строк с ценой: ${result.rows.length}.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось разобрать прайс‑лист.");
      setPreview(null);
    } finally { setPreviewing(false); }
  };
  const commitFile = async () => {
    if (!file || !preview || !supplierName.trim()) return;
    setCommitting(true);
    try {
      const result = await postPriceFile("/api/price-import/commit", file, { fileName: file.name, supplierName: supplierName.trim(), ...(sourceDate ? { sourceDate } : {}) });
      await utils.priceControl.overview.invalidate();
      toast.success("Прайс‑лист сохранен", { description: `Автосвязано: ${result.linked}; на проверке: ${result.suggested}; без связи: ${result.unmapped}.` });
      setFile(null); setPreview(null); setSupplierName(""); setSourceDate("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Не удалось сохранить прайс‑лист."); }
    finally { setCommitting(false); }
  };
  const linkExisting = (rowId: number) => { const productId = Number(linkTargets[rowId]); if (productId) linkRow.mutate({ rowId, productId, saveAlias: true }); };
  const reassignExistingAlias = (aliasId: number, currentProductId: number) => { const productId = Number(aliasTargets[aliasId] ?? currentProductId); if (productId && productId !== currentProductId) reassignAlias.mutate({ aliasId, productId }); };
  const createAndLink = async (rowId: number, rawName: string) => {
    const canonicalName = (newNames[rowId] || rawName).trim();
    if (!canonicalName) return;
    try { const product = await createProduct.mutateAsync({ canonicalName }); await linkRow.mutateAsync({ rowId, productId: product.id, saveAlias: true }); } catch { /* mutations show their own errors */ }
  };

  if (me.isLoading) return <AuditShell kicker="20 / ПРАЙС‑КОНТРОЛЬ" title="Прайс‑контроль"><section className="empty-state"><Loader2 className="animate-spin"/><p>Проверяем доступ к прайс‑контролю…</p></section></AuditShell>;
  if (!canView) return <AuditShell kicker="20 / ПРАЙС‑КОНТРОЛЬ" title="Прайс‑контроль"><section className="empty-state price-empty"><PackageSearch size={30}/><h2>Нет доступа к прайс‑контролю</h2><p>Администратор может назначить просмотр, загрузку или изменение на странице «Доступ». Права на финансовый импорт не меняются.</p></section></AuditShell>;

  return <AuditShell kicker="20 / ПРАЙС‑КОНТРОЛЬ" title="Предложения поставщиков">
    <section className="page-lede price-lede"><div><span>СРАВНЕНИЕ ЗАКУПКИ</span><h2>Одна позиция — все актуальные предложения</h2><p>Каждый прайс сохраняет исходную строку поставщика. После подтверждения связи с внутренним кодом будущие файлы автоматически попадают в нужный товар, а сравнение учитывает фасовку и цену за кг/л.</p></div><div className="price-scope"><span>Контур доступа</span><strong>{level === "edit" ? "Изменение" : level === "upload" ? "Загрузка" : "Просмотр"}</strong></div></section>

    <section className="price-summary-grid" aria-label="Сводка прайс-контроля"><article><span>Поставщики</span><strong>{overview.data?.suppliers.length ?? 0}</strong><small>в сохраненной базе</small></article><article><span>Прайс‑листы</span><strong>{overview.data?.imports.length ?? 0}</strong><small>с историей строк</small></article><article><span>Сопоставленные товары</span><strong>{overview.data?.comparisons.length ?? 0}</strong><small>готовы к сравнению</small></article><article><span>Нужны связи</span><strong>{overview.data?.unmappedRows.length ?? 0}</strong><small>строк на проверке</small></article></section>

    {canUpload && <section className="packet-card price-upload"><div className="card-title"><div><span>НОВЫЙ ПРАЙС‑ЛИСТ</span><h3>Сначала проверить, затем сохранить</h3></div><FileSearch size={21}/></div><p className="packet-note">Поддерживаются `.xls`, `.xlsx`, `.pdf`, `.docx`. Старый импорт финансовых фактов не используется и не изменяется.</p><div className="price-upload-form"><label className="price-file-input"><span>Файл поставщика</span><input type="file" accept=".xls,.xlsx,.pdf,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} /><strong>{file ? file.name : "Выберите прайс‑лист"}</strong></label><button type="button" className="packet-link" onClick={inspectFile} disabled={!file || previewing}>{previewing ? <Loader2 className="animate-spin"/> : <FileSearch size={16}/>}Проверить файл</button></div>{preview && <div className="price-preview"><div><span>Распознано строк</span><strong>{preview.rows.length}</strong></div><label>Поставщик<input value={supplierName} onChange={event => setSupplierName(event.target.value)} placeholder="Укажите поставщика" maxLength={160}/></label><label>Дата прайса<input type="date" value={sourceDate} onChange={event => setSourceDate(event.target.value)}/></label><div className="price-preview-actions"><small>{preview.warningCount ? `Требуют проверки: ${preview.warningCount}` : "Поля цены и фасовки распознаны"}</small><button type="button" className="packet-link" onClick={commitFile} disabled={committing || !supplierName.trim()}>{committing ? <Loader2 className="animate-spin"/> : <Upload size={16}/>}Сохранить прайс‑лист</button></div>{preview.warnings.map(warning => <p key={warning} className="inline-error">{warning}</p>)}</div>}</section>}

    <section className="packet-card price-comparison"><div className="card-title"><div><span>ГДЕ ВЫГОДНЕЕ КУПИТЬ</span><h3>Сравнение текущих предложений</h3></div><GitCompareArrows size={21}/></div><div className="price-toolbar"><label>Найти товар<input value={search} onChange={event => { setSearch(event.target.value); setSelectedProductId(null); }} placeholder="Название или внутренний код"/></label><small>Рекомендация появляется только при сопоставимых вариантах с определенной нормализованной ценой.</small></div>{overview.isLoading ? <div className="empty-state"><Loader2 className="animate-spin"/><p>Собираем предложения поставщиков…</p></div> : !filteredComparisons.length ? <div className="empty-state price-empty"><GitCompareArrows size={30}/><h2>Пока нечего сравнивать</h2><p>Импортируйте прайс‑листы и свяжите одинаковые позиции поставщиков с одним внутренним товаром.</p></div> : <div className="price-comparison-body"><div className="price-product-list" role="list" aria-label="Сопоставленные товары">{filteredComparisons.map(item => <button type="button" key={item.product.id} className={selected?.product.id === item.product.id ? "price-product-choice active" : "price-product-choice"} onClick={() => setSelectedProductId(item.product.id)}><span>{item.product.internalCode}</span><strong>{item.product.canonicalName}</strong><small>{item.offers.length} {item.offers.length === 1 ? "предложение" : "предложения"}{item.recommendation ? ` · выгода до ${formatMoney(item.recommendation.savings)} ₽/${item.recommendation.normalizedUnit === "kg" ? "кг" : item.recommendation.normalizedUnit === "l" ? "л" : "шт"}` : " · нужна сверка"}</small></button>)}</div>{selected && <div className="price-detail"><div className="price-detail-heading"><div><span>{selected.product.internalCode}</span><h4>{selected.product.canonicalName}</h4>{(selected.product.sizeText || selected.product.variant) && <small>{[selected.product.sizeText, selected.product.variant].filter(Boolean).join(" · ")}</small>}</div>{selected.recommendation ? <aside className="price-winner"><span>ВЫГОДНЕЕ КУПИТЬ</span><strong>{selected.recommendation.supplierName}</strong><small>{priceLabel(selected.recommendation)} · экономия {formatMoney(selected.recommendation.savings)} ₽/{selected.recommendation.normalizedUnit === "kg" ? "кг" : selected.recommendation.normalizedUnit === "l" ? "л" : "шт"} ({selected.recommendation.savingsPercent}%)</small></aside> : <aside className="price-winner neutral"><span>НУЖНА СВЕРКА</span><strong>Недостаточно сопоставимых цен</strong><small>Проверьте вариант, фасовку или цену за единицу.</small></aside>}</div><div className="price-chart"><ResponsiveContainer width="100%" height={250}><BarChart data={chartData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }}/><YAxis tickLine={false} axisLine={false} tickFormatter={value => `${formatMoney(value)} ₽`}/><Tooltip formatter={(value: number) => [priceLabel({ normalizedPrice: Number(value), normalizedUnit: selected.offers[0]?.normalizedUnit ?? "kg" }), "Цена"]}/><Bar dataKey="price" radius={[7,7,2,2]}>{chartData.map(item => <Cell key={item.name} fill={item.winner ? "var(--price-accent)" : "var(--price-bar)"}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="price-offer-table"><div className="price-offer-head"><span>Поставщик и исходная строка</span><span>Фасовка</span><span>Цена</span><span>Нормализация</span></div>{selected.offers.map(offer => <div className={selected.recommendation?.supplierId === offer.supplierId ? "price-offer winner" : "price-offer"} key={`${offer.rowId}-${offer.priceMode}`}><span><strong>{offer.supplierName}</strong><small>{offer.rawName} · {modeLabel[offer.priceMode ?? "standard"]}</small></span><span>{offer.packaging || "Не указана"}</span><span>{formatMoney(offer.priceAmount)} ₽/{offer.priceBasis === "kg" ? "кг" : offer.priceBasis === "l" ? "л" : offer.priceBasis === "piece" ? "шт" : "уп."}</span><span><strong>{priceLabel({ normalizedPrice: offer.normalizedPrice, normalizedUnit: offer.normalizedUnit ?? "unknown" })}</strong>{offer.minimumQuantityKg && <small>от {formatMoney(offer.minimumQuantityKg)} кг</small>}</span></div>)}</div></div>}</div>}</section>

    {canEdit && <section className="packet-card price-mapping"><div className="card-title"><div><span>СВЯЗАТЬ НАЗВАНИЯ ПОСТАВЩИКА</span><h3>Один раз подтвердить — затем сопоставляется автоматически</h3></div><Link2 size={21}/></div><p className="packet-note">Точная связь «поставщик → наш товар» имеет приоритет над автоматической нормализацией. Исходное название и фасовка сохраняются для контроля.</p>{!(overview.data?.unmappedRows.length) ? <div className="empty-state compact"><CheckCircle2 size={22}/><p>Все распознанные строки уже связаны с внутренними товарами.</p></div> : <div className="price-mapping-list">{overview.data?.unmappedRows.map(row => <article key={row.rowId}><div><span>{row.supplierName}</span><strong>{row.rawName}</strong><small>{row.rawPackaging || "Фасовка не указана"} · {row.mappingStatus === "suggested" ? `кандидат: ${row.suggestedProduct?.name ?? "не определен"} (${row.matchConfidence ?? 0}%)` : "новое название"}</small></div><div className="price-map-actions"><select value={linkTargets[row.rowId] ?? row.suggestedProduct?.id ?? ""} onChange={event => setLinkTargets(current => ({ ...current, [row.rowId]: event.target.value }))}><option value="">Выберите наш товар</option>{overview.data?.products.map(product => <option value={product.id} key={product.id}>{product.internalCode} · {product.canonicalName}</option>)}</select><button type="button" className="packet-link compact" onClick={() => linkExisting(row.rowId)} disabled={linkRow.isPending || !Number(linkTargets[row.rowId] ?? row.suggestedProduct?.id)}>Связать</button><details><summary>Создать новый товар</summary><div><input value={newNames[row.rowId] ?? row.rawName} onChange={event => setNewNames(current => ({ ...current, [row.rowId]: event.target.value }))}/><button type="button" className="packet-link compact" onClick={() => createAndLink(row.rowId, row.rawName)} disabled={createProduct.isPending || linkRow.isPending}><WandSparkles size={14}/>Создать и связать</button></div></details></div></article>)}</div>}</section>}

    {canEdit && (overview.data?.aliases.length ?? 0) > 0 && <section className="packet-card price-aliases"><div className="card-title"><div><span>ПОДТВЕРЖДЕННЫЕ АВТОСВЯЗИ</span><h3>Названия поставщиков и наши товары</h3></div><Link2 size={21}/></div><p className="packet-note">Эти связи применяются к новым прайс‑листам в первую очередь. Переназначение и отмена не меняют сохраненные строки прошлых импортов.</p><div className="price-alias-list">{overview.data?.aliases.map(alias => <article key={alias.aliasId}><div><span>{alias.supplierName}</span><strong>{alias.normalizedName}</strong><small>{alias.packagingSignature || "Фасовка не уточнена"} · сейчас: {alias.internalCode} · {alias.canonicalName}</small></div><div className="price-alias-actions"><select value={aliasTargets[alias.aliasId] ?? alias.productId} onChange={event => setAliasTargets(current => ({ ...current, [alias.aliasId]: event.target.value }))}>{overview.data?.products.map(product => <option value={product.id} key={product.id}>{product.internalCode} · {product.canonicalName}</option>)}</select><button type="button" className="packet-link compact" onClick={() => reassignExistingAlias(alias.aliasId, alias.productId)} disabled={reassignAlias.isPending || Number(aliasTargets[alias.aliasId] ?? alias.productId) === alias.productId}>Переназначить</button><button type="button" className="packet-link compact subtle" onClick={() => unlinkAlias.mutate({ aliasId: alias.aliasId })} disabled={unlinkAlias.isPending}>Отменить автосвязь</button></div></article>)}</div></section>}

    {(overview.data?.imports.length ?? 0) > 0 && <section className="packet-card price-history"><div className="card-title"><div><span>ИСТОРИЯ ИМПОРТОВ</span><h3>Исходные прайс‑листы</h3></div></div><div>{overview.data?.imports.map(importItem => <article key={importItem.id}><div><strong>{importItem.supplierName}</strong><span>{importItem.fileName}</span><small>{dateLabel(importItem.sourceDate)} · {importItem.rowCount} строк · {importItem.sourceType.toUpperCase()}</small></div>{canEdit && <button type="button" className="row-delete" onClick={() => deleteImport.mutate({ importId: importItem.id })} disabled={deleteImport.isPending}>Удалить</button>}</article>)}</div></section>}
  </AuditShell>;
}
