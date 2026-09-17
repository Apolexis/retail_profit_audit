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
type InventoryProduct = { id: number; internalCode: string; canonicalName: string; category: string | null; variant: string | null; baseUnit: InventoryUnit };
type InventoryDetail = { id: number; storeId: number; storeName: string; businessDate: string; status: "draft" | "closed"; note: string | null; createdByName: string; closedByName: string | null; closedAt: Date | string | null; lines: Array<{ id: number; productId: number; countedQuantity: number; unit: InventoryUnit; internalCode: string; canonicalName: string; category: string | null; variant: string | null }> };
type InventoryListItem = Omit<InventoryDetail, "lines" | "closedByName">;

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
  const products = trpc.inventoryRegistry.products.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [note, setNote] = useState("");
  const [activeInventoryId, setActiveInventoryId] = useState<number>();
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const selectedStoreId = Number(storeId);
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
    <section className="page-lede inventory-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Фактический пересчет остатков</h2><p>Это отдельный операционный регистр, а не старая аналитическая страница «Остатки». Черновик собирает введенный факт; закрытие доступно только руководителю или администратору и создает неизменяемые корректировки.</p></div></section>
    <details className="packet-card inventory-rule-disclosure"><summary><span>ПРАВИЛО ПЕРЕСЧЕТА</span><strong>Ноль — это посчитанный остаток, а не пустая строка</strong></summary><div><ol><li>Откройте черновик по своей точке и дате.</li><li>Добавляйте товар только из внутреннего справочника и указывайте фактическое количество.</li><li>До закрытия строку можно исправить или убрать из черновика.</li><li>Руководитель или администратор закрывает пересчет после проверки: изменять его затем нельзя.</li></ol><p className="packet-note">Точные остатки БМ и СРС здесь не раскрываются продавцу. Пока не загружен подтвержденный товарный справочник, система не создает вымышленных позиций.</p></div></details>
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
        {active.status === "draft" && <form className="inventory-line-create" onSubmit={addLine}><label>Поиск товара<div className="inventory-search"><Search size={15}/><input value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductId(""); }} placeholder="Название или внутренний код"/></div></label><label>Товар<ThemedSelect value={productId} onChange={event => setProductId(event.target.value)} disabled={!visibleProducts.length}><option value="">{products.isLoading ? "Загружаем справочник…" : visibleProducts.length ? "Выберите товар" : "Нет доступных товаров"}</option>{visibleProducts.map(product => <option key={product.id} value={product.id}>{product.canonicalName}{product.variant ? ` · ${product.variant}` : ""} · {unitLabel[product.baseUnit]}</option>)}</ThemedSelect></label><label>Фактический остаток<input data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={quantity} onChange={event => setQuantity(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} placeholder="0" disabled={!selectedProduct}/><small>{selectedProduct ? unitLabel[selectedProduct.baseUnit] : "Единица появится после выбора"}</small></label><button className="packet-link" disabled={!selectedProduct || !quantity || upsertLine.isPending}>{upsertLine.isPending ? "Добавляем…" : "Добавить факт"}</button></form>}
        {active.lines.length ? <div className="inventory-lines-wrap"><table className="data-table inventory-lines"><thead><tr><th>Товар</th><th>Категория</th><th>Фактически</th>{active.status === "draft" && <th>Действие</th>}</tr></thead><tbody>{active.lines.map(line => <tr key={line.id}><td><strong>{line.canonicalName}</strong><small>{line.internalCode}{line.variant ? ` · ${line.variant}` : ""}</small></td><td>{line.category ?? "—"}</td><td><strong>{quantityText(line.countedQuantity)} {unitLabel[line.unit]}</strong></td>{active.status === "draft" && <td><button type="button" className="subtle-button subtle-danger" onClick={() => removeLine.mutate({ inventoryId: active.id, productId: line.productId })} disabled={removeLine.isPending}><Trash2 size={14}/>Убрать</button></td>}</tr>)}</tbody></table></div> : <div className="inventory-empty-lines"><Boxes size={24}/><div><strong>Позиции еще не добавлены</strong><p>Поиск не подставляет товары сам: добавьте только реально посчитанные позиции.</p></div></div>}
        {active.status === "draft" && <div className="inventory-close-actions">{isSeller ? <p className="packet-note">Вы можете подготовить пересчет. Закрыть и создать корректировки может назначенный руководитель или администратор.</p> : <ConfirmDangerDialog trigger={<button className="packet-link" type="button" disabled={!active.lines.length || close.isPending}><ShieldCheck size={16}/>{close.isPending ? "Закрываем…" : "Проверить и закрыть"}</button>} title="Закрыть инвентаризацию?" description="После закрытия строки пересчета нельзя изменить. Система создаст отдельные корректирующие движения фактического остатка и запишет действие в общий журнал." confirmLabel="Закрыть инвентаризацию" disabled={!active.lines.length || close.isPending} onConfirm={() => close.mutate({ inventoryId: active.id })}/>}</div>}
        {active.status === "closed" && <p className="inventory-closed-note"><ShieldCheck size={15}/>Закрыта {displayMoscowTimestamp(active.closedAt)} МСК{active.closedByName ? ` · ${active.closedByName}` : ""}. Данные пересчета неизменяемы.</p>}
      </section>}
    </section>
    <section className="packet-card inventory-history"><div className="card-title"><div><span>{isSeller ? "МОИ ПЕРЕСЧЕТЫ" : "ИСТОРИЯ ИНВЕНТАРИЗАЦИЙ"}</span><h3>{isSeller ? "До пяти последних пересчетов точки" : "Последние пересчеты выбранной точки"}</h3></div></div>{history.isLoading ? <p className="packet-note">Загружаем историю пересчетов…</p> : (history.data as InventoryListItem[] | undefined)?.length ? <div className="inventory-history-list">{(history.data as InventoryListItem[]).map(item => <button type="button" className={item.id === activeInventoryId ? "selected" : ""} key={item.id} onClick={() => { setActiveInventoryId(item.id); setStoreId(String(item.storeId)); setBusinessDate(item.businessDate); setNote(item.note ?? ""); }}><span>{displayDate(item.businessDate)}</span><strong>{item.storeName}</strong><small>{item.status === "draft" ? "Черновик · доступно изменение" : "Закрыта · корректировки созданы"}</small><b>{item.status === "draft" ? "Черновик" : "Закрыта"}</b></button>)}</div> : <div className="empty-state compact"><ClipboardCheck size={25}/><h2>Пересчетов пока нет</h2><p>После открытия первого черновика здесь появится история вашей точки.</p></div>}</section>
  </AuditShell>;
}
