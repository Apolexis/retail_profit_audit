import { Boxes, ClipboardList, Eye, FilePlus2, PackagePlus, Printer, Save, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ExactDateControl } from "@/components/DateRangeControl";
import { FreeScrollSelect } from "@/components/FreeScrollSelect";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/store-requests.css";

type RequestUnit = "kg" | "l" | "piece";
type RequestProduct = { id: number; catalogNumber: number; canonicalName: string; categoryName: string | null; baseUnit: RequestUnit };
type RequestLine = { id: number; productId: number; catalogNumber: number; productName: string; categoryName: string | null; requestedQuantity: number; unit: RequestUnit; note: string | null };
type RequestDetail = { id: number; requestNumber: number; storeId: number; storeName: string; businessDate: string; status: "draft" | "closed"; note: string | null; closedAt: Date | string | null; updatedAt?: Date | string; lines: RequestLine[] };
type RequestListItem = Omit<RequestDetail, "lines" | "closedAt"> & { lineCount: number };
type PrintGroup = { id: number; name: string; isActive: boolean };
type PrintCategoryGroup = { id: number; name: string; printMode: "per_store" | "grouped_stores" };
type PrintProjection = { businessDate: string; totalRequests: number; totalLines: number; sheets: Array<{ id: string; storeGroupName: string; categoryGroupName: string; printMode: "per_store" | "grouped_stores"; stores: Array<{ storeId: number; storeName: string; lines: Array<{ id: number; catalogNumber: number; productName: string; categoryName: string | null; requestedQuantity: string | number; unit: RequestUnit; note: string | null; requestNumber: number }> }> }> };

const unitLabel: Record<RequestUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const toMoscowDate = () => {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => values.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
const quantityText = (value: string | number) => String(Math.round(Number(value) * 1_000) / 1_000);

export default function StoreRequests() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [newRequestNote, setNewRequestNote] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<number>();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newLineNote, setNewLineNote] = useState("");
  const [lineDrafts, setLineDrafts] = useState<Record<number, { quantity: string; note: string }>>({});
  const [requestNote, setRequestNote] = useState("");
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
  const accessibleStores = (stores.data ?? []).filter(store => !store.isHidden);
  const products = (requestProducts.data ?? []) as RequestProduct[];
  const selectedProduct = products.find(product => product.id === Number(selectedProductId));
  const productOptions = useMemo(() => products.map(product => ({ value: String(product.id), label: `№ ${product.catalogNumber} · ${product.canonicalName} · ${unitLabel[product.baseUnit]}`, group: product.categoryName ?? "Без категории" })), [products]);
  const activePrintGroups = ((printGroups.data ?? []) as PrintGroup[]).filter(group => group.isActive);
  const availableCategoryGroups = (printCategoryGroups.data ?? []) as PrintCategoryGroup[];

  useEffect(() => {
    if (storeId || !accessibleStores.length) return;
    if (isSeller && accessibleStores.length === 1) setStoreId(String(accessibleStores[0].id));
    else if ((isManager || isAdmin) && accessibleStores.length) setStoreId(String(accessibleStores[0].id));
  }, [accessibleStores, isAdmin, isManager, isSeller, storeId]);

  useEffect(() => {
    if (!active) return;
    setRequestNote(active.note ?? "");
    setLineDrafts(Object.fromEntries(active.lines.map(line => [line.productId, { quantity: quantityText(line.requestedQuantity), note: line.note ?? "" }])));
  }, [active?.id, active?.updatedAt]);

  useEffect(() => {
    if (printGroupIds.length || !activePrintGroups.length) return;
    setPrintGroupIds(activePrintGroups.map(group => group.id));
  }, [activePrintGroups, printGroupIds.length]);

  useEffect(() => {
    if (printCategoryGroupIds.length || !availableCategoryGroups.length) return;
    setPrintCategoryGroupIds(availableCategoryGroups.map(group => group.id));
  }, [availableCategoryGroups, printCategoryGroupIds.length]);

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
      toast.success(result.created ? "Черновик заявки открыт" : "Открыт существующий черновик", { description: "В черновике можно добавлять позиции и менять количество до закрытия." });
    },
    onError: error => toast.error("Заявка не открыта", { description: error.message }),
  });
  const updateRequestNote = trpc.inventoryRegistry.updateRequestNote.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Комментарий к заявке сохранен"); },
    onError: error => toast.error("Комментарий не сохранен", { description: error.message }),
  });
  const upsertLine = trpc.inventoryRegistry.upsertRequestLine.useMutation({
    onSuccess: async () => {
      setSelectedProductId("");
      setNewQuantity("");
      setNewLineNote("");
      await refresh();
      toast.success("Позиция сохранена в заявке");
    },
    onError: error => toast.error("Позиция не сохранена", { description: error.message }),
  });
  const removeLine = trpc.inventoryRegistry.removeRequestLine.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Позиция убрана из заявки"); },
    onError: error => toast.error("Позиция не убрана", { description: error.message }),
  });
  const closeRequest = trpc.inventoryRegistry.closeRequest.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Заявка закрыта и готова к печати", { description: "Строки сохранены неизменяемым снимком для печатных групп." }); },
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
    if (!selectedStoreId) { toast.error("Выберите склад"); return; }
    createRequest.mutate({ storeId: selectedStoreId, businessDate, note: newRequestNote });
  };
  const addLine = (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !selectedProduct) { toast.error("Выберите товар из общего справочника"); return; }
    const quantity = Number(normalizeDecimalInputText(newQuantity));
    if (!Number.isFinite(quantity) || quantity <= 0) { toast.error("Введите количество больше нуля"); return; }
    upsertLine.mutate({ requestId: active.id, productId: selectedProduct.id, requestedQuantity: quantity, note: newLineNote });
  };
  const saveChangedLines = async () => {
    if (!active || active.status !== "draft") return;
    const changes = active.lines.filter(line => {
      const draft = lineDrafts[line.productId];
      if (!draft) return false;
      const quantity = Number(normalizeDecimalInputText(draft.quantity));
      return Number.isFinite(quantity) && quantity > 0 && (quantity !== line.requestedQuantity || draft.note !== (line.note ?? ""));
    });
    if (!changes.length) return;
    try {
      for (let index = 0; index < changes.length; index += 6) {
        await Promise.all(changes.slice(index, index + 6).map(line => {
          const draft = lineDrafts[line.productId];
          return upsertLine.mutateAsync({ requestId: active.id, productId: line.productId, requestedQuantity: Number(normalizeDecimalInputText(draft.quantity)), note: draft.note });
        }));
      }
      await refresh();
      toast.success(changes.length === 1 ? "Изменение сохранено" : `Сохранено позиций: ${changes.length}`);
    } catch {
      // Mutation error is presented by its own handler; the remaining drafts stay visible.
    }
  };
  const toggleSelection = (id: number, selection: number[], setSelection: (next: number[]) => void) => setSelection(selection.includes(id) ? selection.filter(current => current !== id) : [...selection, id]);
  const openFromHistory = (item: RequestListItem) => {
    setActiveRequestId(item.id);
    setStoreId(String(item.storeId));
    setBusinessDate(item.businessDate);
  };
  const startNewRequest = () => {
    setActiveRequestId(undefined);
    setSelectedProductId("");
    setNewQuantity("");
    setNewLineNote("");
    setLineDrafts({});
    setNewRequestNote("");
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов"><section className="empty-state"><ClipboardList size={28}/><h2>Нет операционного доступа</h2><p>Заявки доступны назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов">
    <section className="page-lede request-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Заявка магазина</h2><p>Магазин собирает потребность по общему справочнику, руководитель закрывает черновик, а администратор печатает подборки по группам магазинов и категориям. Себестоимость и финансовые показатели в заявку не попадают.</p></div></section>
    <section className="request-layout">
      <form className="packet-card request-create-card" onSubmit={openRequest}>
        <div className="card-title"><div><span>{active ? "ОТКРЫТАЯ ЗАЯВКА" : "НОВАЯ ЗАЯВКА"}</span><h3>{active ? `№ ${active.requestNumber} · ${active.storeName}` : "Открыть черновик"}</h3></div>{active ? <button type="button" className="subtle-button" onClick={startNewRequest}><X size={14}/>Отмена</button> : <ClipboardList size={20}/>}</div>
        <div className="request-meta-grid">
          {active ? <div className="request-readonly"><span>Дата заявки</span><strong>{displayDate(active.businessDate)}</strong></div> : <label>Дата заявки<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ЗАЯВКИ" ariaLabel="Выбрать дату заявки"/></label>}
          {isSeller && accessibleStores.length === 1 ? <div className="request-readonly"><span>Склад</span><strong>{accessibleStores[0].name}</strong></div> : active ? <div className="request-readonly"><span>Склад</span><strong>{active.storeName}</strong></div> : <label>Склад<ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)} required><option value="">Выберите склад</option>{accessibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label>}
        </div>
        {!active && <label className="request-note">Комментарий к заявке <small>необязательно</small><textarea value={newRequestNote} onChange={event => setNewRequestNote(event.target.value)} maxLength={4000} placeholder="Например: поставка к выходным"/></label>}
        {!active && <div className="request-create-actions"><button className="packet-link" disabled={!selectedStoreId || createRequest.isPending}><FilePlus2 size={16}/>{createRequest.isPending ? "Открываем…" : "Открыть заявку"}</button></div>}
      </form>

      {active && <section className="packet-card request-draft-card">
        <div className="card-title"><div><span>{active.status === "draft" ? "ЧЕРНОВИК ЗАЯВКИ" : "ЗАКРЫТАЯ ЗАЯВКА"}</span><h3>№ {active.requestNumber} · {active.lines.length} {active.lines.length === 1 ? "позиция" : active.lines.length < 5 ? "позиции" : "позиций"}</h3></div>{active.status === "draft" ? <div className="request-actions"><button type="button" className="packet-link" onClick={() => void saveChangedLines()} disabled={upsertLine.isPending}><Save size={14}/>Сохранить</button>{!isSeller && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button" disabled={!active.lines.length || closeRequest.isPending}><Send size={14}/>{closeRequest.isPending ? "Закрываем…" : "Готово к печати"}</button>} title="Закрыть заявку?" description="После закрытия позиции и количество нельзя изменить. Печатная подборка будет строиться по сохраненному снимку заявки." confirmLabel="Закрыть заявку" disabled={!active.lines.length || closeRequest.isPending} onConfirm={() => closeRequest.mutate({ requestId: active.id })}/>}</div> : <span className="request-status closed">Готово к печати</span>}</div>
        {active.status === "draft" && <form className="request-note-form" onSubmit={event => { event.preventDefault(); updateRequestNote.mutate({ requestId: active.id, note: requestNote }); }}><label>Комментарий <small>необязательно</small><textarea value={requestNote} onChange={event => setRequestNote(event.target.value)} maxLength={4000} placeholder="Контекст заявки"/></label><button className="subtle-button" disabled={updateRequestNote.isPending}><Save size={14}/>{updateRequestNote.isPending ? "Сохраняем…" : "Сохранить"}</button></form>}
        {active.status === "draft" && <form className="request-line-create" onSubmit={addLine}><label>Товар<FreeScrollSelect value={selectedProductId} onValueChange={setSelectedProductId} placeholder={requestProducts.isLoading ? "Загружаем справочник…" : "Выберите товар"} options={productOptions} searchable searchPlaceholder="Поиск товара или номера" disabled={requestProducts.isLoading} ariaLabel="Выбрать товар для заявки"/></label><label className="request-quantity-field">Количество<div className="request-quantity-input"><input data-decimal-input type="text" inputMode="decimal" value={newQuantity} onChange={event => setNewQuantity(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} placeholder="0" disabled={!selectedProduct}/><small>{selectedProduct ? unitLabel[selectedProduct.baseUnit] : "ед."}</small></div></label><label>Комментарий к позиции <small>необязательно</small><input value={newLineNote} onChange={event => setNewLineNote(event.target.value)} maxLength={512} placeholder="Например: нужная фасовка" disabled={!selectedProduct}/></label><button className="packet-link" disabled={!selectedProduct || !newQuantity || upsertLine.isPending}><PackagePlus size={16}/>{upsertLine.isPending ? "Добавляем…" : "Добавить"}</button></form>}
        {active.lines.length ? <div className="data-table-wrap request-lines-wrap"><table className="data-table request-lines"><thead><tr><th>Товар</th><th>Категория</th><th>Количество</th><th>Комментарий</th>{active.status === "draft" && <th aria-label="Действие"/>}</tr></thead><tbody>{active.lines.map(line => { const draft = lineDrafts[line.productId] ?? { quantity: quantityText(line.requestedQuantity), note: line.note ?? "" }; return <tr key={line.id}><td data-label="Товар"><strong>№ {line.catalogNumber} · {line.productName}</strong></td><td data-label="Категория">{line.categoryName ?? "Без категории"}</td><td data-label="Количество">{active.status === "draft" ? <label className="request-inline-quantity"><input aria-label={`Количество: ${line.productName}`} data-decimal-input type="text" inputMode="decimal" value={draft.quantity} onChange={event => setLineDrafts(current => ({ ...current, [line.productId]: { ...draft, quantity: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") } }))}/><small>{unitLabel[line.unit]}</small></label> : <strong>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</strong>}</td><td data-label="Комментарий">{active.status === "draft" ? <input className="request-inline-note" value={draft.note} maxLength={512} onChange={event => setLineDrafts(current => ({ ...current, [line.productId]: { ...draft, note: event.target.value } }))} placeholder="—"/> : line.note ?? "—"}</td>{active.status === "draft" && <td data-label="Действие"><button type="button" className="subtle-button subtle-danger" disabled={removeLine.isPending} onClick={() => removeLine.mutate({ requestId: active.id, productId: line.productId })}><Trash2 size={14}/>Убрать</button></td>}</tr>; })}</tbody></table></div> : <div className="request-empty-lines"><Boxes size={24}/><div><strong>Позиции еще не добавлены</strong><p>Выберите товар из общего справочника и укажите количество.</p></div></div>}
        {active.status === "draft" && <div className="request-draft-danger"><ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={deleteDraft.isPending}><Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить черновик"}</button>} title="Удалить черновик заявки?" description="Черновик и его строки будут удалены. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить черновик" disabled={deleteDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: active.id })}/></div>}
      </section>}
    </section>

    <section className="packet-card request-history"><div className="card-title"><div><span>{isSeller ? "МОИ ЗАЯВКИ" : "ИСТОРИЯ ЗАЯВОК"}</span><h3>{isSeller ? "Последние заявки точки" : "Заявки выбранного склада"}</h3></div></div>{requestList.isLoading ? <p className="packet-note">Загружаем заявки…</p> : (requestList.data as RequestListItem[] | undefined)?.length ? <div className="request-history-list">{(requestList.data as RequestListItem[]).map(item => <article key={item.id} className={item.id === activeRequestId ? "selected" : ""}><button type="button" className="request-history-select" onClick={() => openFromHistory(item)}><span>№ {item.requestNumber}</span><strong>{item.storeName}</strong><small>{displayDate(item.businessDate)} · {item.lineCount} поз.</small><b className={item.status === "closed" ? "closed" : "draft"}>{item.status === "closed" ? "Готово к печати" : "Черновик"}</b></button></article>)}</div> : <div className="empty-state compact"><ClipboardList size={25}/><h2>Заявок пока нет</h2><p>После открытия первого черновика здесь появится история выбранного склада.</p></div>}</section>

    {isAdmin && <section className="packet-card request-print-config"><div className="card-title"><div><span>ПЕЧАТЬ ЗАКРЫТЫХ ЗАЯВОК</span><h3>Подборка по группам</h3></div><Printer size={20}/></div><p className="packet-note">В печать попадают только закрытые заявки за выбранную дату. Для категории «Отдельный лист на магазин» создается самостоятельный лист; для режима «Все магазины вместе» — одна общая подборка.</p><label className="request-print-date">Дата заявок<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ПЕЧАТИ ЗАЯВОК" ariaLabel="Выбрать дату заявок для печати"/></label><div className="request-print-selections"><fieldset><legend>Группы магазинов</legend><div>{activePrintGroups.map(group => <label key={group.id}><input type="checkbox" checked={printGroupIds.includes(group.id)} onChange={() => toggleSelection(group.id, printGroupIds, setPrintGroupIds)}/><span>{group.name}</span></label>)}</div></fieldset><fieldset><legend>Категории печати</legend><div>{availableCategoryGroups.map(group => <label key={group.id}><input type="checkbox" checked={printCategoryGroupIds.includes(group.id)} onChange={() => toggleSelection(group.id, printCategoryGroupIds, setPrintCategoryGroupIds)}/><span>{group.name}<small>{group.printMode === "per_store" ? "отдельный лист" : "все магазины вместе"}</small></span></label>)}</div></fieldset></div><div className="request-print-actions"><button type="button" className="packet-link" disabled={!printGroupIds.length || !printCategoryGroupIds.length || printRequests.isPending} onClick={() => printRequests.mutate({ businessDate, printGroupIds, printCategoryGroupIds })}><Printer size={16}/>{printRequests.isPending ? "Готовим…" : "Распечатать заявки"}</button><small>Последняя подборка: {printProjection ? `${printProjection.sheets.length} листов` : "еще не сформирована"}</small></div></section>}

    {printProjection && <section className="store-request-print" aria-label="Печатная разметка заявок">{printProjection.sheets.map(sheet => <article className="store-request-print-sheet" key={sheet.id}><header><span>ЗАЯВКИ МАГАЗИНОВ</span><strong>{displayDate(printProjection.businessDate)}</strong><small>{sheet.storeGroupName} · {sheet.categoryGroupName}</small></header>{sheet.stores.map(store => <section key={store.storeId}><h1>{store.storeName}</h1><table><thead><tr><th>№</th><th>Товар</th><th>Количество</th><th>Комментарий</th>{sheet.printMode === "grouped_stores" && <th>Заявка</th>}</tr></thead><tbody>{store.lines.map(line => <tr key={`${store.storeId}:${line.id}`}><td>{line.catalogNumber}</td><td>{line.productName}</td><td>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</td><td>{line.note ?? ""}</td>{sheet.printMode === "grouped_stores" && <td>№ {line.requestNumber}</td>}</tr>)}</tbody></table></section>)}</article>)}</section>}
  </AuditShell>;
}
