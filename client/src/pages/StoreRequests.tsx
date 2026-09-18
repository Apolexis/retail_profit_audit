import { Boxes, Check, ChevronDown, ClipboardList, FilePlus2, Minus, PackagePlus, Plus, Printer, Save, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/store-requests.css";

type RequestUnit = "kg" | "l" | "piece";
type CatalogUnit = "fraction" | "l" | "piece";
type StockState = "unknown" | "low" | "sufficient" | "high";
type RequestProduct = {
  id: number;
  catalogNumber: number;
  canonicalName: string;
  categoryName: string | null;
  baseUnit: CatalogUnit;
  isVisibleInRequests: boolean;
  weeklySold: number;
  dailySold: number | null;
  daysCover: number | null;
  stockState: StockState;
  recommendation: "order_soon" | "no_recent_sales" | "normal";
};
type RequestLine = {
  id: number;
  productId: number | null;
  catalogNumber: number;
  productName: string;
  manualProductName?: string | null;
  categoryName: string | null;
  requestedQuantity: number;
  unit: RequestUnit;
  note: string | null;
};
type RequestDetail = {
  id: number;
  requestNumber: number;
  storeId: number;
  storeName: string;
  businessDate: string;
  status: "draft" | "closed";
  note: string | null;
  closedAt: Date | string | null;
  updatedAt?: Date | string;
  lines: RequestLine[];
};
type RequestListItem = Omit<RequestDetail, "lines" | "closedAt"> & { lineCount: number };
type PrintGroup = { id: number; name: string; isActive: boolean };
type PrintCategoryGroup = { id: number; name: string; printMode: "per_store" | "grouped_stores" };
type PrintProjection = {
  businessDate: string;
  totalRequests: number;
  totalLines: number;
  sheets: Array<{
    id: string;
    storeGroupName: string;
    categoryGroupName: string;
    printMode: "per_store" | "grouped_stores";
    stores: Array<{
      storeId: number;
      storeName: string;
      lines: Array<{ id: number; catalogNumber: number; productName: string; categoryName: string | null; requestedQuantity: string | number; unit: RequestUnit; note: string | null; requestNumber: number }>;
    }>;
  }>;
};

const unitLabel: Record<RequestUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const catalogUnitLabel: Record<CatalogUnit, string> = { fraction: "кг", l: "л", piece: "шт" };
const toMoscowDate = () => {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => values.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
const quantityText = (value: string | number) => String(Math.round(Number(value) * 1_000) / 1_000);
const normalizeQuantity = (value: string) => normalizeDecimalInputText(value).replace(/[^0-9.]/g, "");
const stockLabel: Record<StockState, string> = { unknown: "остаток не уточнен", low: "мало", sufficient: "достаточно", high: "много" };

function orderSignal(product: RequestProduct, rawQuantity: string) {
  const quantity = Number(normalizeQuantity(rawQuantity));
  if (!Number.isFinite(quantity) || quantity <= 0 || !product.dailySold || product.dailySold <= 0) return null;
  const plannedDays = Math.round((quantity / product.dailySold) * 10) / 10;
  if (product.stockState === "high" && plannedDays > 7) return `объем выше недели при высоком остатке`;
  if (plannedDays > 21) return `объем примерно на ${quantityText(plannedDays)} дн.`;
  if (product.stockState === "low" && plannedDays < 4) return `заказ примерно на ${quantityText(plannedDays)} дн.`;
  return null;
}

export default function StoreRequests() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.inventoryRegistry.requestStores.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [newRequestNote, setNewRequestNote] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<number>();
  const [query, setQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [requestNote, setRequestNote] = useState("");
  const [manualProductName, setManualProductName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("");
  const [manualUnit, setManualUnit] = useState<RequestUnit>("kg");
  const [manualNote, setManualNote] = useState("");
  const [showManualLine, setShowManualLine] = useState(false);
  const [printGroupIds, setPrintGroupIds] = useState<number[]>([]);
  const [printCategoryGroupIds, setPrintCategoryGroupIds] = useState<number[]>([]);
  const [printProjection, setPrintProjection] = useState<PrintProjection | null>(null);

  const selectedStoreId = Number(storeId);
  const requestProducts = trpc.inventoryRegistry.requestProducts.useQuery({ storeId: selectedStoreId || 0 }, { enabled: Boolean(selectedStoreId), retry: false });
  const requestListInput = useMemo(() => ({ storeId: selectedStoreId || undefined, limit: isSeller ? 10 : 30 }), [isSeller, selectedStoreId]);
  const requestList = trpc.inventoryRegistry.requestList.useQuery(requestListInput, { enabled: Boolean(me.data && selectedStoreId), retry: false });
  const requestDetail = trpc.inventoryRegistry.requestDetail.useQuery({ requestId: activeRequestId ?? 0 }, { enabled: Boolean(activeRequestId), retry: false });
  const printGroups = trpc.inventoryRegistry.printGroups.useQuery(undefined, { enabled: isAdmin, retry: false });
  const printCategoryGroups = trpc.inventoryRegistry.printCategoryGroups.useQuery(undefined, { enabled: isAdmin, retry: false });
  const active = requestDetail.data as RequestDetail | undefined;
  const accessibleStores = stores.data ?? [];
  const products = (requestProducts.data ?? []) as RequestProduct[];
  const activePrintGroups = ((printGroups.data ?? []) as PrintGroup[]).filter(group => group.isActive);
  const availableCategoryGroups = (printCategoryGroups.data ?? []) as PrintCategoryGroup[];
  const isStoreRole = Boolean(isSeller || isManager);

  useEffect(() => {
    if (storeId || !accessibleStores.length) return;
    if (isSeller && accessibleStores.length === 1) setStoreId(String(accessibleStores[0].id));
    else if ((isManager || isAdmin) && accessibleStores.length) setStoreId(String(accessibleStores[0].id));
  }, [accessibleStores, isAdmin, isManager, isSeller, storeId]);

  useEffect(() => {
    if (!active) return;
    setRequestNote(active.note ?? "");
    setQuantityDrafts(Object.fromEntries(active.lines.filter(line => line.productId !== null).map(line => [line.productId!, quantityText(line.requestedQuantity)])));
  }, [active?.id, active?.updatedAt]);

  useEffect(() => {
    if (!activePrintGroups.length || printGroupIds.length) return;
    setPrintGroupIds(activePrintGroups.map(group => group.id));
  }, [activePrintGroups, printGroupIds.length]);

  useEffect(() => {
    if (!availableCategoryGroups.length || printCategoryGroupIds.length) return;
    setPrintCategoryGroupIds(availableCategoryGroups.map(group => group.id));
  }, [availableCategoryGroups, printCategoryGroupIds.length]);

  const productLines = useMemo(() => new Map((active?.lines ?? []).filter(line => line.productId !== null).map(line => [line.productId!, line])), [active?.lines]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, RequestProduct[]>();
    for (const product of products) {
      const haystack = `${product.catalogNumber} ${product.canonicalName} ${product.categoryName ?? ""}`.toLocaleLowerCase("ru-RU");
      if (normalizedQuery && !haystack.includes(normalizedQuery)) continue;
      const category = product.categoryName || "Без категории";
      groups.set(category, [...(groups.get(category) ?? []), product]);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right, "ru"));
  }, [normalizedQuery, products]);

  const refresh = async () => {
    await Promise.all([
      utils.inventoryRegistry.requestList.invalidate(),
      utils.inventoryRegistry.requestDetail.invalidate(),
      utils.audit.changes.invalidate(),
    ]);
  };
  const createRequest = trpc.inventoryRegistry.createRequest.useMutation({
    onSuccess: async result => {
      setActiveRequestId(result.request?.id);
      setNewRequestNote("");
      await refresh();
      toast.success(result.created ? "Черновик заявки открыт" : "Открыт существующий черновик");
    },
    onError: error => toast.error("Заявка не открыта", { description: error.message }),
  });
  const updateRequestNote = trpc.inventoryRegistry.updateRequestNote.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Комментарий к заявке сохранен"); },
    onError: error => toast.error("Комментарий не сохранен", { description: error.message }),
  });
  const upsertLine = trpc.inventoryRegistry.upsertRequestLine.useMutation({
    onSuccess: async () => { await refresh(); },
    onError: error => toast.error("Позиция не сохранена", { description: error.message }),
  });
  const addManualLine = trpc.inventoryRegistry.addRequestManualLine.useMutation({
    onSuccess: async () => {
      setManualProductName("");
      setManualQuantity("");
      setManualNote("");
      setShowManualLine(false);
      await refresh();
      toast.success("Строка добавлена только в эту заявку");
    },
    onError: error => toast.error("Строка не добавлена", { description: error.message }),
  });
  const removeLine = trpc.inventoryRegistry.removeRequestLine.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Позиция убрана из заявки"); },
    onError: error => toast.error("Позиция не убрана", { description: error.message }),
  });
  const closeRequest = trpc.inventoryRegistry.closeRequest.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Заявка закрыта и готова к печати"); },
    onError: error => toast.error("Заявка не закрыта", { description: error.message }),
  });
  const deleteDraft = trpc.inventoryRegistry.deleteRequestDraft.useMutation({
    onSuccess: async () => { setActiveRequestId(undefined); await refresh(); toast.success("Черновик заявки удален"); },
    onError: error => toast.error("Черновик не удален", { description: error.message }),
  });
  const printRequests = trpc.inventoryRegistry.printRequests.useMutation({
    onSuccess: result => {
      setPrintProjection(result as PrintProjection);
      window.setTimeout(() => window.print(), 80);
    },
    onError: error => toast.error("Подборка для печати недоступна", { description: error.message }),
  });

  const openRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoreId) { toast.error("Выберите магазин"); return; }
    createRequest.mutate({ storeId: selectedStoreId, businessDate, note: newRequestNote });
  };
  const setProductQuantity = (product: RequestProduct, raw: string) => {
    setQuantityDrafts(current => ({ ...current, [product.id]: normalizeQuantity(raw) }));
  };
  const persistProductQuantity = (product: RequestProduct, preferred?: number) => {
    if (!active || active.status !== "draft") return;
    const raw = preferred === undefined ? quantityDrafts[product.id] ?? "" : String(preferred);
    const quantity = Number(normalizeQuantity(raw));
    const line = productLines.get(product.id);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      if (line) removeLine.mutate({ requestId: active.id, lineId: line.id });
      setQuantityDrafts(current => ({ ...current, [product.id]: "" }));
      return;
    }
    setQuantityDrafts(current => ({ ...current, [product.id]: quantityText(quantity) }));
    upsertLine.mutate({ requestId: active.id, productId: product.id, requestedQuantity: quantity });
  };
  const changeProductQuantity = (product: RequestProduct, delta: number) => {
    const current = Number(normalizeQuantity(quantityDrafts[product.id] ?? quantityText(productLines.get(product.id)?.requestedQuantity ?? 0))) || 0;
    const step = product.baseUnit === "fraction" ? 0.1 : 1;
    persistProductQuantity(product, Math.max(0, Math.round((current + delta * step) * 1_000) / 1_000));
  };
  const addManual = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    const quantity = Number(normalizeQuantity(manualQuantity));
    if (!manualProductName.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Укажите название и количество больше нуля");
      return;
    }
    addManualLine.mutate({ requestId: active.id, productName: manualProductName, requestedQuantity: quantity, unit: manualUnit, note: manualNote || undefined });
  };
  const toggleSelection = (id: number, selection: number[], setSelection: (next: number[]) => void) => setSelection(selection.includes(id) ? selection.filter(current => current !== id) : [...selection, id]);
  const toggleCategory = (category: string) => setExpandedCategories(current => {
    const next = new Set(current);
    if (next.has(category)) next.delete(category); else next.add(category);
    return next;
  });
  const openFromHistory = (item: RequestListItem) => {
    setActiveRequestId(item.id);
    setStoreId(String(item.storeId));
    setBusinessDate(item.businessDate);
  };
  const startNewRequest = () => {
    setActiveRequestId(undefined);
    setQuery("");
    setQuantityDrafts({});
    setNewRequestNote("");
    setShowManualLine(false);
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов"><section className="empty-state"><ClipboardList size={28}/><h2>Нет операционного доступа</h2><p>Заявки доступны назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов">
    <section className="page-lede request-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Заявка магазина</h2><p>Соберите потребность по категориям. В заявку попадают только название, количество и комментарий; цены, себестоимость и финансовые данные не раскрываются.</p></div></section>

    {!active && <section className="packet-card request-create-card">
      <div className="card-title"><div><span>НОВАЯ ЗАЯВКА</span><h3>Открыть черновик</h3></div><ClipboardList size={20}/></div>
      <form className="request-open-form" onSubmit={openRequest}>
        <label>Дата заявки
          {isStoreRole ? <strong className="request-today">{displayDate(businessDate)}</strong> : <ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ЗАЯВКИ" ariaLabel="Выбрать дату заявки"/>}
        </label>
        <label>Магазин
          {isSeller && accessibleStores.length === 1 ? <strong className="request-store-fixed">{accessibleStores[0].name}</strong> : <ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)} required><option value="">Выберите магазин</option>{accessibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect>}
        </label>
        <label className="request-open-note">Комментарий <small>необязательно</small><input value={newRequestNote} onChange={event => setNewRequestNote(event.target.value)} maxLength={4_000} placeholder="Например: поставка к выходным"/></label>
        <button className="subtle-button request-open-action" disabled={!selectedStoreId || createRequest.isPending}><FilePlus2 size={16}/>{createRequest.isPending ? "Открываем…" : "Открыть заявку"}</button>
      </form>
    </section>}

    {active && <section className="packet-card request-draft-card">
      <div className="card-title request-draft-title"><div><span>{active.status === "draft" ? "ЧЕРНОВИК ЗАЯВКИ" : "ЗАКРЫТАЯ ЗАЯВКА"}</span><h3>{active.storeName} · {displayDate(active.businessDate)}</h3><small>№ {active.requestNumber} · {active.lines.length} поз.</small></div>{active.status === "draft" && <div className="request-actions"><button type="button" className="subtle-button" onClick={startNewRequest}><X size={14}/>Отмена</button>{!isSeller && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button" disabled={!active.lines.length || closeRequest.isPending}><Send size={14}/>{closeRequest.isPending ? "Закрываем…" : "Готово к печати"}</button>} title="Закрыть заявку?" description="После закрытия позиции и количество нельзя изменить. Печатная подборка построится по сохраненному снимку заявки." confirmLabel="Закрыть заявку" disabled={!active.lines.length || closeRequest.isPending} onConfirm={() => closeRequest.mutate({ requestId: active.id })}/>}</div>}</div>
      {active.status === "draft" ? <>
        <div className="request-search-row"><label>Поиск товара<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или код" autoComplete="off"/></label><span>{products.length} позиций</span></div>
        {requestProducts.isLoading ? <p className="packet-note">Загружаем доступную номенклатуру…</p> : <div className="request-catalog" aria-label="Категории товаров для заявки">{groupedProducts.map(([category, categoryProducts]) => {
          const isOpen = expandedCategories.has(category) || Boolean(normalizedQuery);
          return <section className="request-category" key={category}>
            <button type="button" className="request-category-trigger" onClick={() => toggleCategory(category)} aria-expanded={isOpen}><span>{category}</span><small>{categoryProducts.length}</small><ChevronDown size={17}/></button>
            {isOpen && <div className="request-category-products">{categoryProducts.map(product => {
              const line = productLines.get(product.id);
              const draft = quantityDrafts[product.id] ?? (line ? quantityText(line.requestedQuantity) : "");
              return <article className="request-product-row" key={product.id}>
                <div className="request-product-name"><span>№ {product.catalogNumber}</span><strong>{product.canonicalName}</strong>{!product.isVisibleInRequests && <small className="request-admin-only">видно только администратору</small>}<div className="request-product-signals"><i className={`request-stock ${product.stockState}`}>остаток: {stockLabel[product.stockState]}</i>{product.dailySold !== null && <small>за 7 дн: {quantityText(product.weeklySold)} {catalogUnitLabel[product.baseUnit]}</small>}{product.daysCover !== null && <small>запас ~ {product.daysCover} дн.</small>}{product.recommendation === "order_soon" && <b>рекомендуем заказать</b>}{orderSignal(product, draft) && <b className="request-order-signal">{orderSignal(product, draft)}</b>}</div></div>
                <div className="request-quantity-stepper"><button type="button" className="subtle-button" aria-label={`Уменьшить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, -1)} disabled={upsertLine.isPending || removeLine.isPending}><Minus size={15}/></button><label><input aria-label={`Количество: ${product.canonicalName}`} data-decimal-input type="text" inputMode="decimal" value={draft} onChange={event => setProductQuantity(product, event.target.value)} onBlur={() => persistProductQuantity(product) } placeholder="0"/><small>{catalogUnitLabel[product.baseUnit]}</small></label><button type="button" className="subtle-button" aria-label={`Увеличить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, 1)} disabled={upsertLine.isPending || removeLine.isPending}><Plus size={15}/></button></div>
              </article>;
            })}</div>}
          </section>;
        })}</div>}
        {!groupedProducts.length && <div className="request-empty-lines"><Boxes size={24}/><div><strong>Ничего не найдено</strong><p>Измените запрос или добавьте строку вручную — общий справочник при этом не меняется.</p></div></div>}
        <div className="request-manual-area"><button type="button" className="subtle-button" onClick={() => setShowManualLine(value => !value)}><PackagePlus size={15}/>{showManualLine ? "Скрыть ручную строку" : "Не нашли товар? Добавить строку"}</button>{showManualLine && <form className="request-manual-form" onSubmit={addManual}><label>Название товара<input value={manualProductName} onChange={event => setManualProductName(event.target.value)} maxLength={512} placeholder="Товар, которого нет в справочнике"/></label><label>Количество<input data-decimal-input type="text" inputMode="decimal" value={manualQuantity} onChange={event => setManualQuantity(normalizeQuantity(event.target.value))} placeholder="0"/></label><label>Ед. изм.<ThemedSelect value={manualUnit} onChange={event => setManualUnit(event.target.value as RequestUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>Комментарий <small>необязательно</small><input value={manualNote} onChange={event => setManualNote(event.target.value)} maxLength={512} placeholder="Например: новая позиция"/></label><button className="subtle-button" disabled={addManualLine.isPending}><Plus size={15}/>{addManualLine.isPending ? "Добавляем…" : "Добавить"}</button></form>}</div>
        <form className="request-note-form" onSubmit={event => { event.preventDefault(); updateRequestNote.mutate({ requestId: active.id, note: requestNote }); }}><label>Комментарий к заявке <small>необязательно</small><textarea value={requestNote} onChange={event => setRequestNote(event.target.value)} maxLength={4_000} placeholder="Общее примечание к заказу"/></label><button className="subtle-button" disabled={updateRequestNote.isPending}><Save size={14}/>{updateRequestNote.isPending ? "Сохраняем…" : "Сохранить"}</button></form>
        <div className="request-chosen-lines"><div><span>В ЗАЯВКЕ</span><strong>{active.lines.length} поз.</strong></div>{active.lines.length ? <div>{active.lines.map(line => <article key={line.id}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "вручную"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b><button type="button" className="subtle-button subtle-danger" aria-label={`Убрать ${line.productName}`} disabled={removeLine.isPending} onClick={() => removeLine.mutate({ requestId: active.id, lineId: line.id })}><Trash2 size={14}/></button></article>)}</div> : <p>Добавьте товары из раскрытой категории.</p>}</div>
        <div className="request-draft-footer"><span>Заполнение сохраняется в черновике. Закрытие выполняет руководитель или администратор.</span><ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={deleteDraft.isPending}><Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить черновик"}</button>} title="Удалить черновик заявки?" description="Черновик и его строки будут удалены. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить черновик" disabled={deleteDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: active.id })}/></div>
      </> : <div className="request-closed-lines">{active.lines.map(line => <article key={line.id}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "вручную"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b></article>)}</div>}
    </section>}

    <section className="packet-card request-history"><div className="card-title"><div><span>{isSeller ? "МОИ ЗАЯВКИ" : "ИСТОРИЯ ЗАЯВОК"}</span><h3>{isSeller ? "Последние заявки точки" : "Заявки выбранного магазина"}</h3></div></div>{requestList.isLoading ? <p className="packet-note">Загружаем заявки…</p> : (requestList.data as RequestListItem[] | undefined)?.length ? <div className="request-history-list">{(requestList.data as RequestListItem[]).map(item => <article key={item.id} className={item.id === activeRequestId ? "selected" : ""}><button type="button" className="request-history-select" onClick={() => openFromHistory(item)}><span>№ {item.requestNumber}</span><strong>{item.storeName}</strong><small>{displayDate(item.businessDate)} · {item.lineCount} поз.</small><b className={item.status === "closed" ? "closed" : "draft"}>{item.status === "closed" ? "Готово к печати" : "Черновик"}</b></button></article>)}</div> : <div className="empty-state compact"><ClipboardList size={25}/><h2>Заявок пока нет</h2><p>После открытия первого черновика здесь появится история выбранного магазина.</p></div>}</section>

    {isAdmin && <section className="packet-card request-print-config"><div className="card-title"><div><span>ПЕЧАТЬ ЗАКРЫТЫХ ЗАЯВОК</span><h3>Подборка по группам</h3></div><Printer size={20}/></div><p className="packet-note">В печать попадают только закрытые заявки выбранной даты. Для режима «Отдельный лист на магазин» создается самостоятельный лист; для «Все магазины вместе» — одна общая подборка.</p><label className="request-print-date">Дата заявок<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ПЕЧАТИ ЗАЯВОК" ariaLabel="Выбрать дату заявок для печати"/></label><div className="request-print-selections"><fieldset><legend>Группы магазинов</legend><div>{activePrintGroups.map(group => <label key={group.id}><input type="checkbox" checked={printGroupIds.includes(group.id)} onChange={() => toggleSelection(group.id, printGroupIds, setPrintGroupIds)}/><span>{group.name}</span></label>)}</div></fieldset><fieldset><legend>Категории печати</legend><div>{availableCategoryGroups.map(group => <label key={group.id}><input type="checkbox" checked={printCategoryGroupIds.includes(group.id)} onChange={() => toggleSelection(group.id, printCategoryGroupIds, setPrintCategoryGroupIds)}/><span>{group.name}<small>{group.printMode === "per_store" ? "отдельный лист" : "все магазины вместе"}</small></span></label>)}</div></fieldset></div><div className="request-print-actions"><button type="button" className="subtle-button" disabled={!printGroupIds.length || !printCategoryGroupIds.length || printRequests.isPending} onClick={() => printRequests.mutate({ businessDate, printGroupIds, printCategoryGroupIds })}><Printer size={16}/>{printRequests.isPending ? "Готовим…" : "Распечатать заявки"}</button><small>Последняя подборка: {printProjection ? `${printProjection.sheets.length} листов` : "еще не сформирована"}</small></div></section>}

    {printProjection && <section className="store-request-print" aria-label="Печатная разметка заявок">{printProjection.sheets.map(sheet => <article className="store-request-print-sheet" key={sheet.id}><header><span>ЗАЯВКИ МАГАЗИНОВ</span><strong>{displayDate(printProjection.businessDate)}</strong><small>{sheet.storeGroupName} · {sheet.categoryGroupName}</small></header>{sheet.stores.map(store => <section key={store.storeId}><h1>{store.storeName}</h1><table><thead><tr><th>№</th><th>Товар</th><th>Количество</th><th>Комментарий</th>{sheet.printMode === "grouped_stores" && <th>Заявка</th>}</tr></thead><tbody>{store.lines.map(line => <tr key={`${store.storeId}:${line.id}`}><td>{line.catalogNumber || "—"}</td><td>{line.productName}</td><td>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</td><td>{line.note ?? ""}</td>{sheet.printMode === "grouped_stores" && <td>№ {line.requestNumber}</td>}</tr>)}</tbody></table></section>)}</article>)}</section>}
  </AuditShell>;
}
