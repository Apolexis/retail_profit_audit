import { Boxes, ClipboardCheck, FilePlus2, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/inventory-registry.css";

type InventoryUnit = "kg" | "l" | "piece";
type InventoryProduct = { id: number; internalCode: string; canonicalName: string; category: string | null; variant: string | null; baseUnit: InventoryUnit; accountingQuantity: number | null; vatRate?: "VAT_10" | "VAT_22"; evotorCostPrice?: string | null; internalCostPrice?: string | null };
type InventoryDetail = { id: number; storeId: number; storeName: string; businessDate: string; status: "draft" | "closed"; note: string | null; createdByName: string; closedByName: string | null; closedAt: Date | string | null; lines: Array<{ id: number; productId: number; countedQuantity: number; unit: InventoryUnit; internalCode: string; canonicalName: string; category: string | null; variant: string | null; accountingQuantity?: number | null }> };
type InventoryListItem = Omit<InventoryDetail, "lines" | "closedByName">;
type EvotorCatalogPreviewItem = { id: string; code: string | null; name: string; barcodes: string[]; unit: string | null; tax: string | null; vatRate: "VAT_10" | "VAT_22"; type: string | null; parentId: string | null };
type EvotorCatalogPreview = { mapping: { storeId: number; internalStoreName: string; evotorStoreName: string }; products: EvotorCatalogPreviewItem[] };
type EvotorStoreMapping = { storeId: number; internalStoreName: string };

const unitLabel: Record<InventoryUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const toMoscowDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const displayDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
const displayMoscowTimestamp = (value: Date | string | null) => value ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
const quantityText = (value: number) => String(Math.round(value * 1000) / 1000);

export default function InventoryRegistry() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [note, setNote] = useState("");
  const [activeInventoryId, setActiveInventoryId] = useState<number>();
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [evotorSearch, setEvotorSearch] = useState("");
  const [visibleEvotorProducts, setVisibleEvotorProducts] = useState(40);
  const [visibleCatalogCosts, setVisibleCatalogCosts] = useState(20);
  const [catalogCostDrafts, setCatalogCostDrafts] = useState<Record<number, string>>({});
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const selectedStoreId = Number(storeId);
  const evotorPreview = trpc.evotorCatalog.previewForStore.useQuery({ storeId: selectedStoreId || 0 }, { enabled: isAdmin && Boolean(selectedStoreId), retry: false });
  const evotorMapping = trpc.evotorCatalog.mappingForStore.useQuery({ storeId: selectedStoreId || 0 }, { enabled: isAdmin && Boolean(selectedStoreId), retry: false });
  const products = trpc.inventoryRegistry.products.useQuery({ storeId: selectedStoreId || undefined }, { retry: false, enabled: Boolean(selectedStoreId) });
  const history = trpc.inventoryRegistry.list.useQuery({ storeId: selectedStoreId || undefined, limit: isSeller ? 5 : 10 }, { enabled: Boolean(me.data && (isSeller || isManager || isAdmin)), retry: false });
  const detail = trpc.inventoryRegistry.detail.useQuery({ inventoryId: activeInventoryId ?? 0 }, { enabled: Boolean(activeInventoryId), retry: false });
  const active = detail.data as InventoryDetail | undefined;

  useEffect(() => {
    if (storeId || !stores.data?.length) return;
    if (isSeller && stores.data.length === 1) setStoreId(String(stores.data[0].id));
    else if ((isManager || isAdmin) && stores.data.length) setStoreId(String(stores.data[0].id));
  }, [isAdmin, isManager, isSeller, storeId, stores.data]);

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("ru-RU");
    const list = (products.data ?? []) as InventoryProduct[];
    if (!query) return list.slice(0, 80);
    return list.filter(product => `${product.canonicalName} ${product.internalCode} ${product.category ?? ""} ${product.variant ?? ""}`.toLocaleLowerCase("ru-RU").includes(query)).slice(0, 80);
  }, [productSearch, products.data]);
  const selectedProduct = (products.data as InventoryProduct[] | undefined)?.find(product => product.id === Number(productId));
  const accountingByProduct = useMemo(() => new Map(((products.data ?? []) as InventoryProduct[]).map(product => [product.id, product.accountingQuantity])), [products.data]);
  const filteredEvotorCatalog = useMemo(() => {
    const query = evotorSearch.trim().toLocaleLowerCase("ru-RU");
    const rows = ((evotorPreview.data as EvotorCatalogPreview | undefined)?.products ?? []);
    return query ? rows.filter(product => `${product.name} ${product.code ?? ""} ${product.barcodes.join(" ")} ${product.unit ?? ""}`.toLocaleLowerCase("ru-RU").includes(query)) : rows;
  }, [evotorPreview.data, evotorSearch]);
  const visibleEvotorCatalog = filteredEvotorCatalog.slice(0, visibleEvotorProducts);
  const refresh = async () => {
    await Promise.all([utils.inventoryRegistry.list.invalidate(), utils.inventoryRegistry.detail.invalidate(), utils.audit.changes.invalidate()]);
  };
  const create = trpc.inventoryRegistry.create.useMutation({
    onSuccess: async result => {
      setActiveInventoryId(result.inventory.id);
      setNote(result.detail?.note ?? "");
      await refresh();
      toast.success(result.created ? "Черновик пересчета открыт" : "Открыт существующий черновик", { description: "Фактические остатки появятся только после ручного добавления строк." });
    },
    onError: error => toast.error("Пересчет не открыт", { description: error.message }),
  });
  const updateNote = trpc.inventoryRegistry.updateNote.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Комментарий к пересчету сохранен"); },
    onError: error => toast.error("Комментарий не сохранен", { description: error.message }),
  });
  const upsertLine = trpc.inventoryRegistry.upsertLine.useMutation({
    onSuccess: async () => { setProductId(""); setQuantity(""); setProductSearch(""); await refresh(); toast.success("Фактический остаток сохранен в черновике"); },
    onError: error => toast.error("Строка не сохранена", { description: error.message }),
  });
  const removeLine = trpc.inventoryRegistry.removeLine.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Строка удалена из черновика"); },
    onError: error => toast.error("Строка не удалена", { description: error.message }),
  });
  const close = trpc.inventoryRegistry.close.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Инвентаризация закрыта", { description: "Корректирующие движения зафиксированы отдельно и не редактируются." }); },
    onError: error => toast.error("Инвентаризация не закрыта", { description: error.message }),
  });
  const confirmEvotorCatalog = trpc.inventoryRegistry.confirmEvotorCatalog.useMutation({
    onSuccess: async result => {
      await utils.inventoryRegistry.products.invalidate();
      toast.success("Номенклатура подтверждена", { description: `${result.imported} позиций из «${result.evotorStoreName}» сохранены только во внутреннем операционном справочнике.` });
    },
    onError: error => toast.error("Номенклатура не сохранена", { description: error.message }),
  });
  const updateInternalCost = trpc.inventoryRegistry.updateInternalCost.useMutation({
    onSuccess: async () => {
      await utils.inventoryRegistry.products.invalidate();
      toast.success("Внутренняя себестоимость сохранена");
    },
    onError: error => toast.error("Себестоимость не сохранена", { description: error.message }),
  });

  const openInventory = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoreId) { toast.error("Выберите магазин"); return; }
    create.mutate({ storeId: selectedStoreId, businessDate, note });
  };
  const addLine = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeInventoryId || !selectedProduct) { toast.error("Выберите товар из внутреннего справочника"); return; }
    const parsed = Number(normalizeDecimalInputText(quantity));
    if (!Number.isFinite(parsed) || parsed < 0) { toast.error("Введите фактически посчитанное неотрицательное количество"); return; }
    upsertLine.mutate({ inventoryId: activeInventoryId, productId: selectedProduct.id, countedQuantity: Math.round(parsed * 1000) / 1000 });
  };
  const startNewInventory = () => {
    setActiveInventoryId(undefined);
    setBusinessDate(toMoscowDate());
    setNote("");
    setProductId("");
    setProductSearch("");
    setQuantity("");
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="24 / ИНВЕНТАРИЗАЦИИ" title="Инвентаризации"><section className="empty-state"><ClipboardCheck size={28}/><h2>Нет операционного доступа</h2><p>Пересчет доступен назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="24 / ИНВЕНТАРИЗАЦИИ" title="Инвентаризации">
    <section className="page-lede inventory-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Учет остатков и инвентаризация</h2><p>Сначала формируется рабочая номенклатура и учетный остаток точки. В пересчете фиксируется физический факт и показывается расхождение; продажные цены магазинов и себестоимость в этот экран не подмешиваются.</p></div></section>
    <details className="packet-card inventory-rule-disclosure"><summary><span>КАК УСТРОЕН ОСТАТОК</span><strong>Учетный остаток и факт — разные значения</strong></summary><div><ol><li>Номенклатура приходит из подтвержденного каталога и дополняется только в рабочем справочнике.</li><li>Учетный остаток складывается из закрытых инвентаризаций и будущих подтвержденных движений.</li><li>В пересчете вводится только физически посчитанный факт; ноль означает реально пустую позицию.</li><li>Расхождение рассчитывается как факт минус учетный остаток и попадает в общий журнал при закрытии.</li></ol><p className="packet-note">До загрузки исходной номенклатуры и первого закрытого пересчета система честно показывает «нет учетного остатка», а не рисует нули. Продавцу точные учетные остатки не раскрываются.</p></div></details>
    {isAdmin && <section className="packet-card evotor-catalog-preview">
      <div className="card-title"><div><span>ЭВОТОР · READ-ONLY PREVIEW</span><h3>Номенклатура кассы без сохранения</h3></div></div>
      <p className="packet-note">Каталог открывается только по подтвержденному соответствию выбранной внутренней точки и ее магазина Эвотор. Произвольно выбрать другой магазин нельзя. Это Cloud API V2 read-only: позиции, цены, себестоимость и остатки не создаются и не меняются ни в приложении, ни в Эвоторе.</p>
      {!selectedStoreId ? <p className="packet-note">Сначала выберите внутренний магазин для пересчета.</p> : <div className="evotor-catalog-controls"><div className="inventory-store-readonly"><span>Соответствие</span><strong>{evotorMapping.data ? `${(evotorMapping.data as EvotorStoreMapping).internalStoreName} ↔ назначенная касса Эвотор` : evotorMapping.isError ? "Соответствие не задано" : "Проверяем соответствие…"}</strong></div><label>Поиск в preview<div className="inventory-search"><input value={evotorSearch} onChange={event => { setEvotorSearch(event.target.value); setVisibleEvotorProducts(40); }} placeholder="Название, код или штрихкод"/><Search size={15}/></div></label></div>}
      {evotorPreview.isLoading && <p className="packet-note">Читаем каталог назначенного магазина Эвотор…</p>}
      {evotorPreview.isError && <p className="packet-note">Preview каталога недоступен: {evotorPreview.error.message}</p>}
      {evotorPreview.data && <div className="evotor-catalog-results"><div className="evotor-catalog-summary"><strong>{filteredEvotorCatalog.length} позиций в preview</strong><span>Себестоимость Эвотор: 0 / скрыта · внутренняя себестоимость задается позже вручную</span></div><div className="evotor-catalog-list">{visibleEvotorCatalog.map((product, index) => <article key={product.id}><span>№ {index + 1}</span><div><strong>{product.name}</strong><small>{[product.code, product.unit === "дроб" ? "кг" : product.unit, product.vatRate === "VAT_22" ? "НДС 22%" : "НДС 10%"].filter(Boolean).join(" · ") || "Параметры не указаны"}</small></div><small>{product.barcodes.length ? `${product.barcodes.length} штрихкодов` : "Без штрихкода"}</small></article>)}</div>{visibleEvotorCatalog.length < filteredEvotorCatalog.length && <button type="button" className="subtle-button" onClick={() => setVisibleEvotorProducts(limit => limit + 40)}>Показать еще</button>}<button type="button" className="packet-link compact" onClick={() => confirmEvotorCatalog.mutate({ storeId: selectedStoreId })} disabled={confirmEvotorCatalog.isPending}>{confirmEvotorCatalog.isPending ? "Сохраняем номенклатуру…" : `Сохранить ${((evotorPreview.data as EvotorCatalogPreview).products ?? []).length} подтвержденных позиций`}</button></div>}
    </section>}
    {isAdmin && (products.data as InventoryProduct[] | undefined)?.length ? <section className="packet-card inventory-cost-register"><div className="card-title"><div><span>ВНУТРЕННЯЯ СЕБЕСТОИМОСТЬ</span><h3>Себестоимость рабочей номенклатуры</h3></div></div><p className="packet-note">«Себестоимость Эвотор» остается нулевой и скрытой. Здесь задается только внутренняя себестоимость; она не передается обратно в Эвотор.</p><div className="inventory-cost-list">{((products.data as InventoryProduct[]).slice(0, visibleCatalogCosts)).map(product => <article key={product.id}><div><strong>{product.canonicalName}</strong><small>{product.internalCode} · {product.vatRate === "VAT_22" ? "НДС 22%" : "НДС 10%"} · {unitLabel[product.baseUnit]}</small></div><label>Себестоимость<input data-decimal-input value={catalogCostDrafts[product.id] ?? product.internalCostPrice ?? ""} onChange={event => setCatalogCostDrafts(current => ({ ...current, [product.id]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label><button type="button" className="subtle-button" disabled={updateInternalCost.isPending} onClick={() => { const text = (catalogCostDrafts[product.id] ?? product.internalCostPrice ?? "").trim(); const value = text ? Number(text) : null; if (value !== null && (!Number.isFinite(value) || value < 0)) { toast.error("Введите неотрицательную себестоимость."); return; } updateInternalCost.mutate({ id: product.id, internalCostPrice: value }); }}>Сохранить</button></article>)}</div>{visibleCatalogCosts < (products.data as InventoryProduct[]).length && <button type="button" className="subtle-button" onClick={() => setVisibleCatalogCosts(limit => limit + 20)}>Показать еще</button>}</section> : null}
    <section className="inventory-layout">
      <form className="packet-card inventory-create-card" onSubmit={openInventory}>
        <div className="card-title"><div><span>{active ? "ОТКРЫТЫЙ ПЕРЕСЧЕТ" : "НОВЫЙ ПЕРЕСЧЕТ"}</span><h3>{active ? `${active.storeName} · ${displayDate(active.businessDate)}` : "Открыть черновик"}</h3></div>{active ? <button type="button" className="subtle-button" onClick={startNewInventory}>Новый пересчет</button> : <ClipboardCheck size={20}/>}</div>
        <div className="inventory-meta-grid">{active ? <div className="inventory-store-readonly"><span>Дата</span><strong>{displayDate(active.businessDate)}</strong></div> : <label>Дата<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ИНВЕНТАРИЗАЦИИ" ariaLabel="Выбрать дату инвентаризации"/></label>}{isSeller && stores.data?.length === 1 ? <div className="inventory-store-readonly"><span>Магазин</span><strong>{stores.data[0].name}</strong></div> : active ? <div className="inventory-store-readonly"><span>Магазин</span><strong>{active.storeName}</strong></div> : <label>Магазин<ThemedSelect value={storeId} onChange={event => { setStoreId(event.target.value); setActiveInventoryId(undefined); }} required><option value="">Выберите магазин</option>{(stores.data ?? []).filter(store => !store.isHidden).map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label>}</div>
        {!active && <label className="inventory-note">Комментарий к пересчету <small>необязательно</small><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} placeholder="Например: полный пересчет перед приемкой накладной"/></label>}
        {!active && <div className="inventory-create-actions"><button className="packet-link" disabled={!selectedStoreId || create.isPending}><FilePlus2 size={16}/>{create.isPending ? "Открываем…" : "Открыть пересчет"}</button></div>}
      </form>

      {active && <section className="packet-card inventory-draft-card">
        <div className="card-title"><div><span>{active.status === "closed" ? "ЗАКРЫТАЯ ИНВЕНТАРИЗАЦИЯ" : "ЧЕРНОВИК ПЕРЕСЧЕТА"}</span><h3>{active.lines.length} {active.lines.length === 1 ? "позиция" : active.lines.length < 5 ? "позиции" : "позиций"}</h3></div>{active.status === "closed" ? <ShieldCheck size={20}/> : <Boxes size={20}/>}</div>
        {active.status === "draft" && <form className="inventory-note-form" onSubmit={event => { event.preventDefault(); updateNote.mutate({ inventoryId: active.id, note }); }}><label>Комментарий к пересчету <small>необязательно</small><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} placeholder="Контекст пересчета"/></label><button className="subtle-button" disabled={updateNote.isPending}>{updateNote.isPending ? "Сохраняем…" : "Сохранить комментарий"}</button></form>}
        {active.status === "draft" && <form className="inventory-line-create" onSubmit={addLine}><label>Поиск товара<div className="inventory-search"><input value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductId(""); }} placeholder="Название или внутренний код"/><Search size={15}/></div></label><label>Товар<ThemedSelect value={productId} onChange={event => setProductId(event.target.value)} disabled={!visibleProducts.length}><option value="">{products.isLoading ? "Загружаем справочник…" : visibleProducts.length ? "Выберите товар" : "Нет доступных товаров"}</option>{visibleProducts.map(product => <option key={product.id} value={product.id}>{product.canonicalName}{product.variant ? ` · ${product.variant}` : ""} · {unitLabel[product.baseUnit]}</option>)}</ThemedSelect></label>{!isSeller && <div className="inventory-accounting-readout"><span>Учетный остаток</span><strong>{selectedProduct?.accountingQuantity === null || !selectedProduct ? "Нет данных" : `${quantityText(selectedProduct.accountingQuantity)} ${unitLabel[selectedProduct.baseUnit]}`}</strong></div>}<label>Фактический остаток<input data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={quantity} onChange={event => setQuantity(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} placeholder="0" disabled={!selectedProduct}/><small>{selectedProduct ? unitLabel[selectedProduct.baseUnit] : "Единица появится после выбора"}</small></label><button className="packet-link" disabled={!selectedProduct || !quantity || upsertLine.isPending}>{upsertLine.isPending ? "Добавляем…" : "Добавить факт"}</button></form>}
        {active.lines.length ? <div className="inventory-lines-wrap"><table className="data-table inventory-lines"><thead><tr><th>Товар</th><th>Категория</th>{!isSeller && <th>Учетный</th>}<th>Фактически</th>{!isSeller && <th>Расхождение</th>}{active.status === "draft" && <th>Действие</th>}</tr></thead><tbody>{active.lines.map(line => { const accountingQuantity = active.status === "closed" ? line.accountingQuantity ?? null : accountingByProduct.get(line.productId) ?? null; const difference = accountingQuantity === null ? null : Math.round((line.countedQuantity - accountingQuantity) * 1000) / 1000; return <tr key={line.id}><td><strong>{line.canonicalName}</strong><small>{line.internalCode}{line.variant ? ` · ${line.variant}` : ""}</small></td><td>{line.category ?? "—"}</td>{!isSeller && <td>{accountingQuantity === null ? "Нет данных" : `${quantityText(accountingQuantity)} ${unitLabel[line.unit]}`}</td>}<td><strong>{quantityText(line.countedQuantity)} {unitLabel[line.unit]}</strong></td>{!isSeller && <td className={difference === null ? "" : difference === 0 ? "positive" : "negative"}>{difference === null ? "—" : `${difference > 0 ? "+" : ""}${quantityText(difference)} ${unitLabel[line.unit]}`}</td>}{active.status === "draft" && <td><button type="button" className="subtle-button subtle-danger" onClick={() => removeLine.mutate({ inventoryId: active.id, productId: line.productId })} disabled={removeLine.isPending}><Trash2 size={14}/>Убрать</button></td>}</tr>; })}</tbody></table></div> : <div className="inventory-empty-lines"><Boxes size={24}/><div><strong>Позиции еще не добавлены</strong><p>Поиск не подставляет товары сам: добавьте только реально посчитанные позиции.</p></div></div>}
        {active.status === "draft" && <div className="inventory-close-actions">{isSeller ? <p className="packet-note">Вы можете подготовить пересчет. Закрыть и создать корректировки может назначенный руководитель или администратор.</p> : <ConfirmDangerDialog trigger={<button className="packet-link" type="button" disabled={!active.lines.length || close.isPending}><ShieldCheck size={16}/>{close.isPending ? "Закрываем…" : "Проверить и закрыть"}</button>} title="Закрыть инвентаризацию?" description="После закрытия строки пересчета нельзя изменить. Система создаст отдельные корректирующие движения фактического остатка и запишет действие в общий журнал." confirmLabel="Закрыть инвентаризацию" disabled={!active.lines.length || close.isPending} onConfirm={() => close.mutate({ inventoryId: active.id })}/>}</div>}
        {active.status === "closed" && <p className="inventory-closed-note"><ShieldCheck size={15}/>Закрыта {displayMoscowTimestamp(active.closedAt)} МСК{active.closedByName ? ` · ${active.closedByName}` : ""}. Данные пересчета неизменяемы.</p>}
      </section>}
    </section>
    <section className="packet-card inventory-history"><div className="card-title"><div><span>{isSeller ? "МОИ ПЕРЕСЧЕТЫ" : "ИСТОРИЯ ИНВЕНТАРИЗАЦИЙ"}</span><h3>{isSeller ? "До пяти последних пересчетов точки" : "Последние пересчеты выбранной точки"}</h3></div></div>{history.isLoading ? <p className="packet-note">Загружаем историю пересчетов…</p> : (history.data as InventoryListItem[] | undefined)?.length ? <div className="inventory-history-list">{(history.data as InventoryListItem[]).map(item => <button type="button" className={item.id === activeInventoryId ? "selected" : ""} key={item.id} onClick={() => { setActiveInventoryId(item.id); setStoreId(String(item.storeId)); setBusinessDate(item.businessDate); setNote(item.note ?? ""); }}><span>{displayDate(item.businessDate)}</span><strong>{item.storeName}</strong><small>{item.status === "draft" ? "Черновик · доступно изменение" : "Закрыта · корректировки созданы"}</small><b>{item.status === "draft" ? "Черновик" : "Закрыта"}</b></button>)}</div> : <div className="empty-state compact"><ClipboardCheck size={25}/><h2>Пересчетов пока нет</h2><p>После открытия первого черновика здесь появится история вашей точки.</p></div>}</section>
  </AuditShell>;
}
