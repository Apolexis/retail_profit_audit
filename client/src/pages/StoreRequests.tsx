import { Boxes, ChevronDown, ClipboardList, FilePlus2, Minus, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl, ExactDateControl } from "@/components/DateRangeControl";
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
  storeStockState: StockState;
  supplyStockState: StockState;
  supplyGroupName: string | null;
  maxStoreCoverDays: number;
  recommendedQuantity: number | null;
  recommendation: "order_soon" | "no_recent_sales" | "normal";
};
type RequestLine = {
  id: number;
  productId: number | null;
  catalogNumber: number;
  productName: string;
  manualProductName?: string | null;
  manualPrintCategoryGroupId?: number | null;
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
  comments: Array<{ id: number; slot: number; printCategoryGroupId: number; printCategoryGroupName: string; text: string }>;
};
type RequestListItem = Omit<RequestDetail, "lines" | "comments" | "closedAt"> & { lineCount: number };
type PrintGroup = { id: number; name: string; isActive: boolean };
type PrintProjection = {
  businessDate: string;
  zebraMode: "none" | "rows" | "columns";
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
      comments: Array<{ id: number; slot: number; text: string; requestNumber: number }>;
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
const quantityText = (value: string | number) => String(Math.round(Number(value) * 10) / 10);
const normalizeQuantity = (value: string) => {
  const normalized = normalizeDecimalInputText(value).replace(/[^0-9.]/g, "");
  const [whole, ...fractionParts] = normalized.split(".");
  if (!fractionParts.length) return whole;
  return `${whole}.${fractionParts.join("").slice(0, 1)}`;
};
const stockLabel: Record<StockState, string> = { unknown: "остаток не уточнен", low: "мало", sufficient: "достаточно", high: "много" };

function orderSignal(product: RequestProduct, rawQuantity: string) {
  const quantity = Number(normalizeQuantity(rawQuantity));
  if (!Number.isFinite(quantity) || quantity <= 0 || !product.dailySold || product.dailySold <= 0) return null;
  const plannedDays = Math.round((quantity / product.dailySold) * 10) / 10;
  if (product.storeStockState === "high" && plannedDays > product.maxStoreCoverDays) return `заказ избыточен при текущем запасе магазина`;
  if (plannedDays > 21) return `объем примерно на ${quantityText(plannedDays)} дн.`;
  if (product.storeStockState === "low" && plannedDays < 1) return `заказ меньше одного дня продаж`;
  return null;
}

export default function StoreRequests() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.inventoryRegistry.requestStores.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const canPrintRequests = Boolean(isManager || isAdmin);
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [historyRange, setHistoryRange] = useState(() => {
    const today = toMoscowDate();
    return { from: `${today.slice(0, 4)}-01-01`, to: today };
  });
  const [activeRequestId, setActiveRequestId] = useState<number>();
  const [query, setQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, { text: string }>>({
    1: { text: "" },
    2: { text: "" },
  });
  const [printProjection, setPrintProjection] = useState<PrintProjection | null>(null);

  const selectedStoreId = Number(storeId);
  const requestProducts = trpc.inventoryRegistry.requestProducts.useQuery({ storeId: selectedStoreId || 0 }, { enabled: Boolean(selectedStoreId), retry: false });
  const requestListInput = useMemo(() => ({ storeId: selectedStoreId || undefined, from: isSeller ? undefined : historyRange.from, to: isSeller ? undefined : historyRange.to, limit: isSeller ? 10 : 100 }), [historyRange.from, historyRange.to, isSeller, selectedStoreId]);
  const requestList = trpc.inventoryRegistry.requestList.useQuery(requestListInput, { enabled: Boolean(me.data), retry: false });
  const requestDetail = trpc.inventoryRegistry.requestDetail.useQuery({ requestId: activeRequestId ?? 0 }, { enabled: Boolean(activeRequestId), retry: false });
  const printCandidates = trpc.inventoryRegistry.requestPrintCandidates.useQuery({ businessDate, storeId: selectedStoreId || undefined }, { enabled: canPrintRequests, retry: false });
  const active = requestDetail.data as RequestDetail | undefined;
  const accessibleStores = stores.data ?? [];
  const products = (requestProducts.data ?? []) as RequestProduct[];
  const isAllStoresScope = Boolean(!isSeller && !selectedStoreId);

  useEffect(() => {
    if (storeId || !accessibleStores.length) return;
    if (isSeller && accessibleStores.length === 1) setStoreId(String(accessibleStores[0].id));
  }, [accessibleStores, isSeller, storeId]);

  useEffect(() => {
    if (!active) return;
    setQuantityDrafts(Object.fromEntries(active.lines.filter(line => line.productId !== null).map(line => [line.productId!, quantityText(line.requestedQuantity)])));
    setCommentDrafts({
      1: { text: active.comments.find(comment => comment.slot === 1)?.text ?? "" },
      2: { text: active.comments.find(comment => comment.slot === 2)?.text ?? "" },
    });
  }, [active?.id]);

  const productLines = useMemo(() => new Map((active?.lines ?? []).filter(line => line.productId !== null).map(line => [line.productId!, line])), [active?.lines]);
  const legacyManualLines = useMemo(() => (active?.lines ?? []).filter(line => line.productId === null), [active?.lines]);
  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const draftProductLines = useMemo(() => Object.entries(quantityDrafts)
    .map(([productId, raw]) => ({ productId: Number(productId), requestedQuantity: Number(normalizeQuantity(raw)) }))
    .filter(line => Number.isInteger(line.productId) && Number.isFinite(line.requestedQuantity) && line.requestedQuantity > 0)
    .map(line => {
      const product = productsById.get(line.productId);
      const persisted = productLines.get(line.productId);
      return {
        productId: line.productId,
        catalogNumber: product?.catalogNumber ?? persisted?.catalogNumber ?? 0,
        productName: product?.canonicalName ?? persisted?.productName ?? "Товар из сохраненной заявки",
        unit: product ? (product.baseUnit === "fraction" ? "kg" : product.baseUnit) : persisted?.unit ?? "kg",
        requestedQuantity: line.requestedQuantity,
      };
    }), [productLines, productsById, quantityDrafts]);
  const hasUnsavedDraftChanges = useMemo(() => {
    if (!active || active.status !== "draft") return false;
    const savedByProduct = new Map(active.lines.filter(line => line.productId !== null).map(line => [line.productId!, Number(line.requestedQuantity)]));
    if (savedByProduct.size !== draftProductLines.length) return true;
    if (draftProductLines.some(line => savedByProduct.get(line.productId) !== line.requestedQuantity)) return true;
    return ([1, 2] as const).some(slot => (active.comments.find(comment => comment.slot === slot)?.text ?? "") !== commentDrafts[slot].text);
  }, [active, commentDrafts, draftProductLines]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const previousQueryRef = useRef("");
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

  useEffect(() => {
    if (normalizedQuery && !previousQueryRef.current) setExpandedCategories(new Set(groupedProducts.map(([category]) => category)));
    previousQueryRef.current = normalizedQuery;
  }, [groupedProducts, normalizedQuery]);

  const refresh = async () => {
    await Promise.all([
      utils.inventoryRegistry.requestList.invalidate(),
      utils.inventoryRegistry.requestDetail.invalidate(),
      utils.inventoryRegistry.requestPrintCandidates.invalidate(),
      utils.audit.changes.invalidate(),
    ]);
  };
  const createRequest = trpc.inventoryRegistry.createRequest.useMutation({
    onSuccess: async result => {
      setActiveRequestId(result.request?.id);
      await refresh();
      toast.success(result.created ? "Заявка сохранена" : "Открыта сохраненная заявка");
    },
    onError: error => toast.error("Заявка не открыта", { description: error.message }),
  });
  const saveRequestDraft = trpc.inventoryRegistry.saveRequestDraft.useMutation({
    onSuccess: async (_result, variables) => {
      setQuantityDrafts(Object.fromEntries(variables.lines.map(line => [line.productId, quantityText(line.requestedQuantity)])));
      setCommentDrafts({
        1: { text: variables.comments.find(comment => comment.slot === 1)?.text.trim().replace(/\s+/g, " ") ?? "" },
        2: { text: variables.comments.find(comment => comment.slot === 2)?.text.trim().replace(/\s+/g, " ") ?? "" },
      });
      await refresh();
      toast.success("Черновик сохранен");
    },
    onError: error => toast.error("Черновик не сохранен", { description: error.message }),
  });
  const closeRequestsForPrint = trpc.inventoryRegistry.closeRequestsForPrint.useMutation({
    onSuccess: async result => {
      await refresh();
      if (!result.requests.length) { toast.error("Нет непустых черновиков для закрытия"); return; }
      toast.success(`Закрыто заявок: ${result.requests.length}`);
      printRequests.mutate({ businessDate: result.businessDate });
    },
    onError: error => toast.error("Заявки не закрыты", { description: error.message }),
  });
  const deleteDraft = trpc.inventoryRegistry.deleteRequestDraft.useMutation({
    onSuccess: async () => { setActiveRequestId(undefined); await refresh(); toast.success("Черновик заявки удален"); },
    onError: error => toast.error("Черновик не удален", { description: error.message }),
  });
  const printRequests = trpc.inventoryRegistry.printRequests.useMutation({
    onSuccess: result => {
      const projection = result as PrintProjection;
      if (!projection.sheets.length) {
        toast.error("Нет строк для печати", { description: "Проверьте строки заявки, назначение магазина группе печати и состав активных категорий." });
        return;
      }
      setPrintProjection(projection);
      requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    },
    onError: error => toast.error("Подборка для печати недоступна", { description: error.message }),
  });

  const openRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoreId) { toast.error("Выберите магазин"); return; }
    createRequest.mutate({ storeId: selectedStoreId, businessDate });
  };
  const setProductQuantity = (product: RequestProduct, raw: string) => {
    setQuantityDrafts(current => ({ ...current, [product.id]: normalizeQuantity(raw) }));
  };
  const normalizeProductQuantityDraft = (product: RequestProduct, preferred?: number) => {
    if (!active || active.status !== "draft") return;
    const raw = preferred === undefined ? quantityDrafts[product.id] ?? "" : String(preferred);
    const quantity = Number(normalizeQuantity(raw));
    setQuantityDrafts(current => ({ ...current, [product.id]: Number.isFinite(quantity) && quantity > 0 ? quantityText(quantity) : "" }));
  };
  const changeProductQuantity = (product: RequestProduct, delta: number) => {
    const current = Number(normalizeQuantity(quantityDrafts[product.id] ?? quantityText(productLines.get(product.id)?.requestedQuantity ?? 0))) || 0;
    const step = product.baseUnit === "fraction" ? 0.5 : 1;
    normalizeProductQuantityDraft(product, Math.max(0, Math.round((current + delta * step) * 10) / 10));
  };
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
  const saveDraft = () => {
    if (!active || active.status !== "draft") return;
    saveRequestDraft.mutate({
      requestId: active.id,
      lines: draftProductLines.map(line => ({ productId: line.productId, requestedQuantity: line.requestedQuantity })),
      comments: ([1, 2] as const).map(slot => ({ slot, text: commentDrafts[slot].text })),
    });
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов"><section className="empty-state"><ClipboardList size={28}/><h2>Нет операционного доступа</h2><p>Заявки доступны назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов">
    <section className="page-lede request-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Заявка магазина</h2><p>Соберите потребность по категориям. В заявку попадают только название и количество; цены и себестоимость не раскрываются.</p></div></section>

    {!isSeller && <section className="packet-card request-scope-control"><label>Магазин для заявки и списка<ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)} aria-label="Выбрать магазин для заявок"><option value="">Все магазины</option>{accessibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label><small>Для новой заявки выберите одну точку; «Все магазины» оставляет сводный список.</small></section>}

    {!active && <section className="packet-card request-create-card">
      <div className="card-title"><div><span>НОВАЯ ЗАЯВКА</span><h3>Создать заявку</h3></div><ClipboardList size={20}/></div>
      <form className="request-open-form" onSubmit={openRequest}>
        <label>Дата заявки
          {isSeller ? <strong className="request-today">{displayDate(businessDate)}</strong> : <ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ЗАЯВКИ" ariaLabel="Выбрать дату заявки"/>}
        </label>
        <label>Магазин
          {isSeller && accessibleStores.length === 1 ? <strong className="request-store-fixed">{accessibleStores[0].name}</strong> : <strong className="request-store-fixed">{accessibleStores.find(store => store.id === selectedStoreId)?.name ?? "Выберите магазин выше"}</strong>}
        </label>
        <button className="subtle-button request-open-action" disabled={!selectedStoreId || createRequest.isPending}><FilePlus2 size={16}/>{createRequest.isPending ? "Открываем…" : "Открыть заявку"}</button>
      </form>
    </section>}

    {active && <section className="packet-card request-draft-card">
      <div className="card-title request-draft-title"><div><span>{active.status === "draft" ? "СОХРАНЕННАЯ ЗАЯВКА" : "ЗАКРЫТАЯ ЗАЯВКА"}</span><h3>{active.storeName} · {displayDate(active.businessDate)}</h3></div></div>
      {active.status === "draft" && <div className="request-actions"><ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger request-delete-draft" disabled={deleteDraft.isPending || saveRequestDraft.isPending}><Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить черновик"}</button>} title="Удалить черновик заявки?" description="Черновик и его строки будут удалены. Несохраненные локальные изменения также не попадут в заявку. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить черновик" disabled={deleteDraft.isPending || saveRequestDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: active.id })}/><button type="button" className="subtle-button request-save-draft" disabled={saveRequestDraft.isPending || !hasUnsavedDraftChanges} onClick={saveDraft}><Save size={14}/>{saveRequestDraft.isPending ? "Сохраняем…" : "Сохранить черновик"}</button><button type="button" className="subtle-button request-cancel-draft" disabled={saveRequestDraft.isPending} onClick={() => setActiveRequestId(undefined)}><X size={14}/>К списку заявок</button></div>}
      {active.status === "draft" ? <>
        <div className="request-search-row"><label>Поиск товара<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название или код" autoComplete="off"/></label><span>{products.length} позиций</span></div>
        {requestProducts.isLoading ? <p className="packet-note">Загружаем доступную номенклатуру…</p> : <div className="request-catalog" aria-label="Категории товаров для заявки">{groupedProducts.map(([category, categoryProducts]) => {
            const isOpen = expandedCategories.has(category);
          return <section className="request-category" key={category}>
            <button type="button" className="request-category-trigger" onClick={() => toggleCategory(category)} aria-expanded={isOpen}><span>{category}</span><small>{categoryProducts.length}</small><ChevronDown size={17}/></button>
            {isOpen && <div className="request-category-products">{categoryProducts.map(product => {
              const line = productLines.get(product.id);
              const draft = quantityDrafts[product.id] ?? (line ? quantityText(line.requestedQuantity) : "");
              return <article className="request-product-row" key={product.id}>
                <div className="request-product-name"><span>№ {product.catalogNumber}</span><strong>{product.canonicalName}</strong>{!product.isVisibleInRequests && <small className="request-admin-only">видно только администратору</small>}<div className="request-product-signals"><i className={`request-stock ${product.supplyStockState}`}>{product.supplyGroupName ? `${product.supplyGroupName}: ` : "склад: "}{stockLabel[product.supplyStockState]}</i>{product.dailySold !== null && <small>Продажи за 7 дн.: {quantityText(product.weeklySold)} {catalogUnitLabel[product.baseUnit]} · в среднем {quantityText(product.dailySold)} {catalogUnitLabel[product.baseUnit]}/день</small>}{product.daysCover !== null && <small>В магазине запас примерно на {quantityText(product.daysCover)} дн.; норма категории — до {product.maxStoreCoverDays} дн.</small>}{product.recommendedQuantity !== null && <b>{product.recommendedQuantity > 0 ? `Рекомендуем заказать ${quantityText(product.recommendedQuantity)} ${catalogUnitLabel[product.baseUnit]}: средняя продажа за день + запас` : `Запаса в магазине достаточно: сегодня не заказывайте (норма — до ${product.maxStoreCoverDays} дн.)`}</b>}{product.recommendation === "order_soon" && product.recommendedQuantity === null && <b>Рекомендуем проверить наличие и заказать</b>}{orderSignal(product, draft) && <b className="request-order-signal">{orderSignal(product, draft)}</b>}</div></div>
                <div className="request-quantity-stepper"><button type="button" className="subtle-button" aria-label={`Уменьшить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, -1)} disabled={saveRequestDraft.isPending}><Minus size={15}/></button><label><input aria-label={`Количество: ${product.canonicalName}`} data-decimal-input type="text" inputMode="decimal" value={draft} onChange={event => setProductQuantity(product, event.target.value)} onBlur={() => normalizeProductQuantityDraft(product)} placeholder="0"/><small>{catalogUnitLabel[product.baseUnit]}</small></label><button type="button" className="subtle-button" aria-label={`Увеличить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, 1)} disabled={saveRequestDraft.isPending}><Plus size={15}/></button></div>
              </article>;
            })}</div>}
          </section>;
        })}</div>}
        {!groupedProducts.length && <div className="request-empty-lines"><Boxes size={24}/><div><strong>Ничего не найдено</strong><p>Измените запрос: в заявке доступны только товары общего справочника.</p></div></div>}
        <section className="request-comments" aria-label="Комментарии к печати"><div><span>КОММЕНТАРИИ</span><small>Сохраняются вместе с количеством одной кнопкой «Сохранить черновик»</small></div>{([1, 2] as const).map(slot => <div key={slot}><label>{slot === 1 ? "Комментарий к Мороженной продукции" : "Комментарий к Копченой продукции"}<textarea value={commentDrafts[slot].text} onChange={event => setCommentDrafts(current => ({ ...current, [slot]: { ...current[slot], text: event.target.value } }))} maxLength={2_000} placeholder={slot === 1 ? "Пожелания к мороженной продукции" : "Пожелания к копченой продукции"}/></label></div>)}</section>
        <div className="request-chosen-lines"><div><span>В ЗАЯВКЕ{hasUnsavedDraftChanges ? " · НЕ СОХРАНЕНО" : ""}</span><strong>{draftProductLines.length + legacyManualLines.length} поз.</strong></div>{draftProductLines.length || legacyManualLines.length ? <div>{draftProductLines.map(line => <article key={line.productId}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "без номера"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b><button type="button" className="subtle-button subtle-danger" aria-label={`Убрать ${line.productName}`} disabled={saveRequestDraft.isPending} onClick={() => setQuantityDrafts(current => ({ ...current, [line.productId]: "" }))}><Trash2 size={14}/></button></article>)}{legacyManualLines.map(line => <article key={`manual-${line.id}`}><span>вручную</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b></article>)}</div> : <p>Добавьте товары из раскрытой категории.</p>}</div>
        <div className="request-draft-footer"><span>{hasUnsavedDraftChanges ? "Изменения пока локальные: сохраните черновик перед печатью или выходом к списку." : "Черновик сохранен. Руководитель или администратор закроет его перед печатью."}</span></div>
      </> : <div className="request-closed-lines">{active.lines.map(line => <article key={line.id}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "вручную"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b></article>)}</div>}
    </section>}

    <section className="packet-card request-history"><div className="card-title"><div><span>{isSeller ? "МОИ ЗАЯВКИ" : "ИСТОРИЯ ЗАЯВОК"}</span><h3>{isSeller ? "Последние заявки точки" : selectedStoreId ? "Заявки выбранного магазина" : "Заявки всех доступных магазинов"}</h3></div>{!isSeller && <DateRangeControl value={historyRange} onChange={setHistoryRange} title="ПЕРИОД СПИСКА ЗАЯВОК" ariaLabel="Выбрать период списка заявок"/>}</div>{requestList.isLoading ? <p className="packet-note">Загружаем заявки…</p> : (requestList.data as RequestListItem[] | undefined)?.length ? <div className="request-history-list">{(requestList.data as RequestListItem[]).map(item => <article key={item.id} className={item.id === activeRequestId ? "selected" : ""}><button type="button" className="request-history-select" onClick={() => openFromHistory(item)}><span>{displayDate(item.businessDate)}</span><strong>{item.storeName}</strong><small>{item.status === "closed" ? "Нажмите, чтобы открыть сохраненную подборку" : "Можно изменить и распечатать"}</small><b className={item.status === "closed" ? "closed" : "draft"}>{item.status === "closed" ? "Закрыта" : "Заявка"}</b></button>{item.status === "draft" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger request-history-delete" disabled={deleteDraft.isPending}><Trash2 size={14}/><span>Удалить</span></button>} title="Удалить сохраненную заявку?" description="Заявка и ее строки будут удалены. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить заявку" disabled={deleteDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: item.id })}/>}</article>)}</div> : <div className="empty-state compact"><ClipboardList size={25}/><h2>Заявок пока нет</h2><p>После открытия первого черновика здесь появится история выбранного магазина.</p></div>}</section>

    {canPrintRequests && <section className="packet-card request-print-config"><div className="card-title"><div><span>ПЕЧАТЬ ЗАЯВОК</span><h3>{isAllStoresScope ? "Все доступные магазины" : "Выбранный магазин"}</h3></div><Printer size={20}/></div><label className="request-print-date">Дата заявок<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ПЕЧАТИ ЗАЯВОК" ariaLabel="Выбрать дату заявок для печати"/></label><div className="request-print-actions"><button type="button" className="subtle-button" disabled={printRequests.isPending} onClick={() => printRequests.mutate({ businessDate, storeId: selectedStoreId || undefined })}><Printer size={16}/>{printRequests.isPending ? "Готовим…" : isAllStoresScope ? "Распечатать заявки" : "Распечатать"}</button>{isAllStoresScope && (printCandidates.data?.count ?? 0) > 0 && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button" disabled={closeRequestsForPrint.isPending || printRequests.isPending}><Printer size={16}/>{closeRequestsForPrint.isPending || printRequests.isPending ? "Готовим…" : "Распечатать и закрыть"}</button>} title="Распечатать и закрыть все заявки?" description={`Будут закрыты все непустые черновики на выбранную дату (${printCandidates.data?.count ?? 0}); затем сформируется печать всех активных групп.`} confirmLabel="Распечатать и закрыть" disabled={closeRequestsForPrint.isPending || printRequests.isPending} onConfirm={() => closeRequestsForPrint.mutate({ businessDate })}/>}<small>Печатаются все активные группы магазинов и категории для сохраненных и уже закрытых заявок.</small></div></section>}

    {printProjection && <section className="store-request-print" data-zebra-mode={printProjection.zebraMode} aria-label="Печатная разметка заявок">{printProjection.sheets.map(sheet => <article className="store-request-print-sheet" key={sheet.id}><header><span>ЗАЯВКИ МАГАЗИНОВ</span><strong>{displayDate(printProjection.businessDate)}</strong><small>{sheet.storeGroupName} · {sheet.categoryGroupName}</small></header>{sheet.stores.map(store => <section key={store.storeId}><h1>{store.storeName}</h1><table><thead><tr><th>№</th><th>Товар</th><th>Количество</th>{sheet.printMode === "grouped_stores" && <th>Заявка</th>}</tr></thead><tbody>{store.lines.map(line => <tr key={`${store.storeId}:${line.id}`}><td>{line.catalogNumber || "—"}</td><td>{line.productName}</td><td>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</td>{sheet.printMode === "grouped_stores" && <td>№ {line.requestNumber}</td>}</tr>)}</tbody></table>{store.comments.length > 0 && <div className="store-request-print-comments">{store.comments.map(comment => <p key={comment.id}>{comment.text}</p>)}</div>}</section>)}</article>)}</section>}
  </AuditShell>;
}
