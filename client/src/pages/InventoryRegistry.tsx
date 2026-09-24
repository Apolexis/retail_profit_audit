import { Boxes, ClipboardCheck, FilePlus2, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ExactDateControl } from "@/components/DateRangeControl";
import { FreeScrollSelect } from "@/components/FreeScrollSelect";
import { ThemedSelect } from "@/components/ui/themed-select";
import { formatBusinessDate, formatMoscowDateTime, normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/inventory-registry.css";

type InventoryUnit = "kg" | "l" | "piece";
type CatalogUnit = "fraction" | "l" | "piece" | "unknown";
type InventoryProduct = { id: number; internalCode: string; canonicalName: string; category: string | null; variant: string | null; baseUnit: CatalogUnit; accountingQuantity: number | null; vatRate?: "VAT_10" | "VAT_22"; evotorCostPrice?: string | null; internalCostPrice?: string | null };
type InventoryDetail = { id: number; storeId: number; storeName: string; businessDate: string; status: "draft" | "closed"; note: string | null; createdByName: string; closedByName: string | null; closedAt: Date | string | null; lines: Array<{ id: number; productId: number; countedQuantity: number; unit: InventoryUnit; internalCode: string; canonicalName: string; category: string | null; variant: string | null; accountingQuantity?: number | null }> };
type InventoryListItem = Omit<InventoryDetail, "lines" | "closedByName">;

const unitLabel: Record<InventoryUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const catalogUnitLabel: Record<CatalogUnit, string> = { fraction: "кг", l: "л", piece: "шт", unknown: "Ед." };
const toMoscowDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const displayDate = (value: string) => formatBusinessDate(value);
const displayMoscowTimestamp = (value: Date | string | null) => value ? formatMoscowDateTime(value) : "";
const quantityText = (value: number) => String(Math.round(value * 1000) / 1000);

export default function InventoryRegistry() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [note, setNote] = useState("");
  const [activeInventoryId, setActiveInventoryId] = useState<number>();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lineQuantityDraft, setLineQuantityDraft] = useState<Record<number, string>>({});
  const [isSavingLineChanges, setIsSavingLineChanges] = useState(false);
  const [lineSort, setLineSort] = useState<"code" | "product" | "category">("category");
  const openedFromStock = useRef(false);
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const routeParameters = new URLSearchParams(window.location.search);
  const requestedStoreId = Number(routeParameters.get("store"));
  const requestedProductId = Number(routeParameters.get("product"));
  const selectedStoreId = Number(storeId);
  const products = trpc.inventoryRegistry.products.useQuery(
    { storeId: selectedStoreId || undefined },
    { retry: false, enabled: Boolean(me.data) && (isSeller ? Boolean(selectedStoreId) : true) },
  );
  const history = trpc.inventoryRegistry.list.useQuery({ storeId: selectedStoreId || undefined, limit: isSeller ? 5 : 10 }, { enabled: Boolean(me.data && (isSeller || isManager || isAdmin)), retry: false });
  const detail = trpc.inventoryRegistry.detail.useQuery({ inventoryId: activeInventoryId ?? 0 }, { enabled: Boolean(activeInventoryId), retry: false });
  const active = detail.data as InventoryDetail | undefined;

  useEffect(() => {
    if (storeId || !stores.data?.length) return;
    if (isSeller && stores.data.length === 1) setStoreId(String(stores.data[0].id));
  }, [isSeller, storeId, stores.data]);

  useEffect(() => {
    if (!requestedStoreId || !stores.data?.some(store => store.id === requestedStoreId) || storeId === String(requestedStoreId)) return;
    setStoreId(String(requestedStoreId));
    setActiveInventoryId(undefined);
  }, [requestedStoreId, storeId, stores.data]);

  useEffect(() => {
    if (!requestedProductId || productId || !(products.data as InventoryProduct[] | undefined)?.some(product => product.id === requestedProductId)) return;
    setProductId(String(requestedProductId));
  }, [productId, products.data, requestedProductId]);

  const selectedProduct = (products.data as InventoryProduct[] | undefined)?.find(product => product.id === Number(productId));
  const accountingByProduct = useMemo(() => new Map(((products.data ?? []) as InventoryProduct[]).map(product => [product.id, product.accountingQuantity])), [products.data]);
  const sortedLines = useMemo(() => {
    if (!active?.lines) return [];
    return [...active.lines].sort((left, right) => {
      if (lineSort === "code") return Number(left.internalCode) - Number(right.internalCode) || left.canonicalName.localeCompare(right.canonicalName, "ru");
      if (lineSort === "product") return left.canonicalName.localeCompare(right.canonicalName, "ru");
      return `${left.category ?? ""}\u0000${left.canonicalName}`.localeCompare(`${right.category ?? ""}\u0000${right.canonicalName}`, "ru");
    });
  }, [active?.lines, lineSort]);
  const countedDraftValue = (line: InventoryDetail["lines"][number]) => lineQuantityDraft[line.productId] ?? quantityText(line.countedQuantity);
  const parsedCountedDraft = (line: InventoryDetail["lines"][number]) => {
    const text = countedDraftValue(line).trim();
    if (!text) return null;
    const parsed = Number(normalizeDecimalInputText(text));
    return Number.isFinite(parsed) && parsed >= 0 && Math.round(parsed * 1_000) === parsed * 1_000 ? parsed : null;
  };
  const changedLines = useMemo(() => (active?.status === "draft" ? active.lines : []).filter(line => {
    if (!(line.productId in lineQuantityDraft)) return false;
    const value = parsedCountedDraft(line);
    return value === null || value !== line.countedQuantity;
  }), [active?.lines, active?.status, lineQuantityDraft]);
  const hasInvalidLineQuantity = changedLines.some(line => parsedCountedDraft(line) === null);
  const revisionTotals = useMemo(() => {
    const totals = new Map<InventoryUnit, { accounting: number; counted: number; difference: number; positions: number; accountedPositions: number; hasAccounting: boolean }>();
    for (const line of active?.lines ?? []) {
      const row = totals.get(line.unit) ?? { accounting: 0, counted: 0, difference: 0, positions: 0, accountedPositions: 0, hasAccounting: false };
      const accounting = active?.status === "closed" ? line.accountingQuantity ?? null : accountingByProduct.get(line.productId) ?? null;
      const counted = parsedCountedDraft(line);
      row.positions += 1;
      if (counted !== null) row.counted += counted;
      if (!isSeller && accounting !== null) { row.accounting += accounting; row.accountedPositions += 1; row.hasAccounting = true; if (counted !== null) row.difference += counted - accounting; }
      totals.set(line.unit, row);
    }
    return Array.from(totals.entries()).map(([unit, total]) => ({ ...total, unit }));
  }, [active?.lines, active?.status, accountingByProduct, isSeller, lineQuantityDraft]);
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
  useEffect(() => {
    if (openedFromStock.current || !requestedProductId || !selectedStoreId || !selectedProduct || activeInventoryId || create.isPending) return;
    openedFromStock.current = true;
    create.mutate({ storeId: selectedStoreId, businessDate, note: "" });
  }, [activeInventoryId, businessDate, create, requestedProductId, selectedProduct, selectedStoreId]);
  const updateNote = trpc.inventoryRegistry.updateNote.useMutation({
    onError: error => toast.error("Комментарий не сохранен", { description: error.message }),
  });
  const fillFromAccounting = trpc.inventoryRegistry.fillFromAccounting.useMutation({
    onSuccess: async result => {
      await refresh();
      toast.success(result.added ? `Добавлено строк: ${result.added}` : "Нет новых строк с известным учетным остатком", { description: result.preserved ? `Существующие фактические строки сохранены: ${result.preserved}.` : undefined });
    },
    onError: error => toast.error("Не удалось заполнить пересчет", { description: error.message }),
  });
  const upsertLine = trpc.inventoryRegistry.upsertLine.useMutation({
    onSuccess: async () => { setProductId(""); setQuantity(""); await refresh(); toast.success("Фактический остаток сохранен в черновике"); },
    onError: error => toast.error("Строка не сохранена", { description: error.message }),
  });
  const updateDraftLine = trpc.inventoryRegistry.upsertLine.useMutation({
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
  const deleteDraft = trpc.inventoryRegistry.deleteDraft.useMutation({
    onSuccess: async () => {
      startNewInventory();
      await refresh();
      toast.success("Черновик удален", { description: "Учетные остатки и закрытые ревизии не изменились." });
    },
    onError: error => toast.error("Черновик не удален", { description: error.message }),
  });
  const archiveClosed = trpc.inventoryRegistry.archiveClosed.useMutation({
    onSuccess: async () => {
      startNewInventory();
      await refresh();
      toast.success("Закрытая инвентаризация убрана из рабочей истории", { description: "Строки пересчета и корректирующие движения сохранены в аудите." });
    },
    onError: error => toast.error("Инвентаризация не архивирована", { description: error.message }),
  });
  const openInventory = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoreId) { toast.error("Выберите магазин"); return; }
    create.mutate({ storeId: selectedStoreId, businessDate, note: "" });
  };
  const addLine = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeInventoryId || !selectedProduct) { toast.error("Выберите товар из внутреннего справочника"); return; }
    const parsed = Number(normalizeDecimalInputText(quantity));
    if (!Number.isFinite(parsed) || parsed < 0 || Math.round(parsed * 1_000) !== parsed * 1_000) { toast.error("Фактическое количество должно быть неотрицательным и содержать не более трех знаков после точки"); return; }
    upsertLine.mutate({ inventoryId: activeInventoryId, productId: selectedProduct.id, countedQuantity: parsed });
  };
  const startNewInventory = () => {
    setActiveInventoryId(undefined);
    setBusinessDate(toMoscowDate());
    setNote("");
    setProductId("");
    setQuantity("");
    setLineQuantityDraft({});
  };
  const noteChanged = active?.status === "draft" && note !== (active.note ?? "");
  const hasPendingDraftChanges = Boolean(changedLines.length || noteChanged);
  const closeBlocked = !active?.lines.length || close.isPending || hasPendingDraftChanges || hasInvalidLineQuantity || isSavingLineChanges;
  const quantityStep = (unit: InventoryUnit | CatalogUnit | undefined) => unit === "piece" ? 1 : 0.1;
  const displayDraftQuantity = (value: number) => String(Math.round(value * 1_000) / 1_000);
  const adjustDraftQuantity = (line: InventoryDetail["lines"][number], direction: -1 | 1) => {
    const next = Math.max(0, (parsedCountedDraft(line) ?? line.countedQuantity) + direction * quantityStep(line.unit));
    setLineQuantityDraft(current => ({ ...current, [line.productId]: displayDraftQuantity(next) }));
  };
  const adjustNewQuantity = (direction: -1 | 1) => {
    const current = Number(normalizeDecimalInputText(quantity));
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction * quantityStep(selectedProduct?.baseUnit));
    setQuantity(displayDraftQuantity(next));
  };
  const saveDraftChanges = async () => {
    if (!active || !hasPendingDraftChanges || hasInvalidLineQuantity) return;
    setIsSavingLineChanges(true);
    try {
      if (noteChanged) await updateNote.mutateAsync({ inventoryId: active.id, note });
      for (let offset = 0; offset < changedLines.length; offset += 6) {
        await Promise.all(changedLines.slice(offset, offset + 6).map(line => updateDraftLine.mutateAsync({ inventoryId: active.id, productId: line.productId, countedQuantity: parsedCountedDraft(line)! })));
      }
      setLineQuantityDraft({});
      await refresh();
      toast.success(changedLines.length === 1 ? "Пересчет сохранен" : changedLines.length ? `Сохранено строк: ${changedLines.length}` : "Комментарий к пересчету сохранен");
    } finally {
      setIsSavingLineChanges(false);
    }
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="25 / ИНВЕНТАРИЗАЦИИ" title="Инвентаризации"><section className="empty-state"><ClipboardCheck size={28}/><h2>Нет операционного доступа</h2><p>Пересчет доступен назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="25 / ИНВЕНТАРИЗАЦИИ" title="Инвентаризации">
    <section className="page-lede inventory-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Инвентаризация магазина</h2><p>Здесь проводится только ревизия: в пересчете фиксируется физический факт и показывается расхождение с учетным остатком. Номенклатура, остатки и себестоимость ведутся на отдельных страницах.</p></div></section>
    <details className="packet-card inventory-rule-disclosure"><summary><span>КАК ПРОВОДИТСЯ РЕВИЗИЯ</span><strong>Учетный остаток и факт — разные значения</strong></summary><div><ol><li>Номенклатура выбирается из отдельного подтвержденного рабочего справочника.</li><li>Учетный остаток складывается из закрытых инвентаризаций и будущих подтвержденных движений.</li><li>В пересчете вводится только физически посчитанный факт; ноль означает реально пустую позицию.</li><li>Расхождение рассчитывается как факт минус учетный остаток и попадает в общий журнал при закрытии.</li></ol><p className="packet-note">Если позиция еще не посчитана, система честно показывает «нет учетного остатка», а не рисует нули. Продавцу точные учетные остатки не раскрываются.</p></div></details>
    <section className="inventory-layout">
      <form className="packet-card inventory-create-card" onSubmit={openInventory}>
        <div className="card-title"><div><span>{active ? "ОТКРЫТЫЙ ПЕРЕСЧЕТ" : "НОВЫЙ ПЕРЕСЧЕТ"}</span><h3>{active ? `${active.storeName} · ${displayDate(active.businessDate)}` : "Открыть черновик"}</h3></div>{active ? <div className="inventory-draft-actions"><button type="button" className="subtle-button" onClick={startNewInventory}><X size={14}/>Отмена</button></div> : <ClipboardCheck size={20}/>}</div>
        <div className="inventory-meta-grid">{active ? <div className="inventory-store-readonly"><span>Дата</span><strong>{displayDate(active.businessDate)}</strong></div> : <label>Дата<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ИНВЕНТАРИЗАЦИИ" ariaLabel="Выбрать дату инвентаризации"/></label>}{isSeller && stores.data?.length === 1 ? <div className="inventory-store-readonly"><span>Магазин</span><strong>{stores.data[0].name}</strong></div> : active ? <div className="inventory-store-readonly"><span>Магазин</span><strong>{active.storeName}</strong></div> : <label>Магазин<ThemedSelect value={storeId} onChange={event => { setStoreId(event.target.value); setActiveInventoryId(undefined); }} required><option value="">Выберите магазин</option>{(stores.data ?? []).filter(store => !store.isHidden).map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label>}</div>
        {!active && <div className="inventory-create-actions"><button className="packet-link" disabled={!selectedStoreId || create.isPending}><FilePlus2 size={16}/>{create.isPending ? "Открываем…" : "Открыть пересчет"}</button></div>}
      </form>

      {active && <section className="packet-card inventory-draft-card">
	        <div className="card-title"><div><span>{active.status === "closed" ? "ЗАКРЫТАЯ ИНВЕНТАРИЗАЦИЯ" : "ЧЕРНОВИК ПЕРЕСЧЕТА"}</span><h3>{active.lines.length} {active.lines.length === 1 ? "позиция" : active.lines.length < 5 ? "позиции" : "позиций"}</h3></div>{active.status === "draft" && <div className="inventory-table-actions"><button type="button" className="packet-link inventory-save-lines" onClick={() => void saveDraftChanges()} disabled={!hasPendingDraftChanges || hasInvalidLineQuantity || isSavingLineChanges}><Save size={14}/>{isSavingLineChanges ? "Сохраняем…" : "Сохранить пересчет"}</button>{!isSeller && <button type="button" className="subtle-button inventory-fill-accounting" onClick={() => fillFromAccounting.mutate({ inventoryId: active.id })} disabled={fillFromAccounting.isPending}><Boxes size={14}/>{fillFromAccounting.isPending ? "Заполняем…" : active.lines.length ? "Добавить позиции из учетных остатков" : "Добавить все позиции из учетных остатков"}</button>}{!isSeller && <><ConfirmDangerDialog trigger={<button className="subtle-button subtle-danger inventory-close-trigger" type="button" disabled={closeBlocked}><ShieldCheck size={14}/>{close.isPending ? "Закрываем…" : "Закрыть инвентаризацию…"}</button>} title="Закрыть инвентаризацию?" description="После закрытия строки пересчета нельзя изменить. Система создаст отдельные корректирующие движения фактического остатка и запишет действие в общий журнал." confirmLabel="Создать корректировки и закрыть" disabled={closeBlocked} onConfirm={() => close.mutate({ inventoryId: active.id })}/>{(hasPendingDraftChanges || hasInvalidLineQuantity) && <small className="inventory-close-hint">Сначала сохраните изменения пересчета.</small>}</>}</div>}{active.status === "closed" ? <ShieldCheck size={20}/> : <Boxes size={20}/>}</div>
        {active.lines.length > 0 && <aside className="inventory-revision-totals" aria-label="Итоги ревизии"><span className="inventory-revision-totals-heading">ИТОГО</span>{revisionTotals.map(total => <div key={total.unit}><strong>{total.positions} {total.positions === 1 ? "позиция" : total.positions < 5 ? "позиции" : "позиций"} · {unitLabel[total.unit]}</strong><span>Факт: {quantityText(total.counted)} {unitLabel[total.unit]}</span>{!isSeller && total.hasAccounting && <><span>Учетный: {quantityText(total.accounting)} {unitLabel[total.unit]}</span><b className={total.difference === 0 ? "positive" : "negative"}>Разница: {total.difference > 0 ? "+" : ""}{quantityText(total.difference)} {unitLabel[total.unit]}</b>{total.accountedPositions < total.positions && <small>Учетный остаток есть для {total.accountedPositions} из {total.positions} позиций.</small>}</>}</div>)}</aside>}
        {active.status === "draft" && <label className="inventory-note-form"><span>Комментарий к пересчету <small>необязательно</small></span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000}/></label>}
        {active.status === "draft" && <form className="inventory-line-create" onSubmit={addLine}><label>Товар<FreeScrollSelect value={productId} onValueChange={setProductId} placeholder={products.isLoading ? "Загружаем справочник…" : "Выберите товар"} searchable searchPlaceholder="Название, № или категория" disabled={products.isLoading || !(products.data as InventoryProduct[] | undefined)?.length} options={((products.data ?? []) as InventoryProduct[]).map(product => ({ value: String(product.id), label: `${product.canonicalName}${product.variant ? ` · ${product.variant}` : ""} · ${catalogUnitLabel[product.baseUnit]} · № ${product.internalCode}`, group: product.category ?? "Без категории" }))}/></label>{!isSeller && <div className="inventory-accounting-readout"><span>Учетный остаток</span><strong>{selectedProduct?.accountingQuantity === null || !selectedProduct ? "Нет данных" : `${quantityText(selectedProduct.accountingQuantity)} ${catalogUnitLabel[selectedProduct.baseUnit]}`}</strong></div>}<label className="inventory-quantity-field"><span>Фактический остаток</span><div className="inventory-quantity-stepper"><button type="button" className="subtle-button" aria-label="Уменьшить фактический остаток" onClick={() => adjustNewQuantity(-1)} disabled={!selectedProduct}>−</button><div className="inventory-quantity-input"><input data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={quantity} onChange={event => setQuantity(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} placeholder="0" disabled={!selectedProduct}/><small>{selectedProduct ? catalogUnitLabel[selectedProduct.baseUnit] : "Ед."}</small></div><button type="button" className="subtle-button" aria-label="Увеличить фактический остаток" onClick={() => adjustNewQuantity(1)} disabled={!selectedProduct}>+</button></div></label><button className="packet-link" disabled={!selectedProduct || !quantity || upsertLine.isPending}><Plus size={16}/>{upsertLine.isPending ? "Добавляем…" : "Добавить в ревизию"}</button></form>}
	        {active.lines.length ? <div className="data-table-wrap inventory-lines-wrap"><table className="data-table inventory-lines"><thead><tr><th className="inventory-sort-heading" aria-sort={lineSort === "code" ? "ascending" : "none"} tabIndex={0} onClick={() => setLineSort("code")} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLineSort("code"); } }}>№</th><th className="inventory-sort-heading" aria-sort={lineSort === "product" ? "ascending" : "none"} tabIndex={0} onClick={() => setLineSort("product")} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLineSort("product"); } }}>Товар</th><th className="inventory-sort-heading" aria-sort={lineSort === "category" ? "ascending" : "none"} tabIndex={0} onClick={() => setLineSort("category")} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLineSort("category"); } }}>Категория</th>{!isSeller && <th>Учетный</th>}<th>Фактически</th>{!isSeller && <th>Расхождение</th>}{active.status === "draft" && <th>Действие</th>}</tr></thead><tbody>{sortedLines.map(line => { const accountingQuantity = active.status === "closed" ? line.accountingQuantity ?? null : accountingByProduct.get(line.productId) ?? null; const countedQuantity = parsedCountedDraft(line); const difference = accountingQuantity === null || countedQuantity === null ? null : Math.round((countedQuantity - accountingQuantity) * 1000) / 1000; return <tr key={line.id}><td data-label="№"><strong>{line.internalCode}</strong></td><td data-label="Товар"><strong>{line.canonicalName}</strong>{line.variant && <small>{line.variant}</small>}</td><td data-label="Категория">{line.category ?? "—"}</td>{!isSeller && <td data-label="Учетный">{accountingQuantity === null ? "Нет данных" : `${quantityText(accountingQuantity)} ${unitLabel[line.unit]}`}</td>}<td data-label="Фактически">{active.status === "draft" ? <label className="inventory-inline-quantity"><button type="button" className="subtle-button" aria-label={`Уменьшить фактический остаток: ${line.canonicalName}`} onClick={() => adjustDraftQuantity(line, -1)}>−</button><span><input aria-label={`Фактический остаток: ${line.canonicalName}`} data-decimal-input type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" value={countedDraftValue(line)} onChange={event => setLineQuantityDraft(current => ({ ...current, [line.productId]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))}/><small>{unitLabel[line.unit]}</small></span><button type="button" className="subtle-button" aria-label={`Увеличить фактический остаток: ${line.canonicalName}`} onClick={() => adjustDraftQuantity(line, 1)}>+</button></label> : <strong>{quantityText(line.countedQuantity)} {unitLabel[line.unit]}</strong>}</td>{!isSeller && <td data-label="Расхождение" className={difference === null ? "" : difference === 0 ? "positive" : "negative"}>{difference === null ? "—" : `${difference > 0 ? "+" : ""}${quantityText(difference)} ${unitLabel[line.unit]}`}</td>}{active.status === "draft" && <td data-label="Действие"><button type="button" className="subtle-button subtle-danger" onClick={() => removeLine.mutate({ inventoryId: active.id, productId: line.productId })} disabled={removeLine.isPending}><Trash2 size={14}/>Убрать</button></td>}</tr>; })}</tbody></table></div> : <div className="inventory-empty-lines"><Boxes size={24}/><div><strong>Позиции еще не добавлены</strong><p>Нажмите «Заполнить учетными остатками» или добавьте товар, которого нет в черновике.</p></div></div>}
        {active.status === "draft" && isSeller && <div className="inventory-close-actions"><p className="packet-note">Вы можете подготовить пересчет. Закрыть и создать корректировки может назначенный руководитель или администратор.</p></div>}
        {active.status === "closed" && <p className="inventory-closed-note"><ShieldCheck size={15}/>Закрыта {displayMoscowTimestamp(active.closedAt)} МСК{active.closedByName ? ` · ${active.closedByName}` : ""}. Данные пересчета неизменяемы.</p>}
      </section>}
    </section>
    <section className="packet-card inventory-history"><div className="card-title"><div><span>{isSeller ? "МОИ ПЕРЕСЧЕТЫ" : "ИСТОРИЯ ИНВЕНТАРИЗАЦИЙ"}</span><h3>{isSeller ? "До пяти последних пересчетов точки" : selectedStoreId ? "Последние пересчеты выбранной точки" : "Последние доступные пересчеты"}</h3></div></div>{history.isLoading ? <p className="packet-note">Загружаем историю пересчетов…</p> : (history.data as InventoryListItem[] | undefined)?.length ? <div className="inventory-history-list">{(history.data as InventoryListItem[]).map(item => <article className={item.id === activeInventoryId ? "selected" : ""} key={item.id}><button type="button" className="inventory-history-select" aria-current={item.id === activeInventoryId ? "true" : undefined} onClick={() => { setActiveInventoryId(item.id); setStoreId(String(item.storeId)); setBusinessDate(item.businessDate); setNote(item.note ?? ""); }}><span>{displayDate(item.businessDate)}</span><strong>{item.storeName}</strong><small>{item.status === "draft" ? "Черновик · доступно изменение" : "Закрыта · корректировки созданы"}</small><b>{item.status === "draft" ? "Черновик" : "Закрыта"}</b></button>{item.status === "draft" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={deleteDraft.isPending}><Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить"}</button>} title="Удалить черновик?" description="Черновик и его строки будут удалены. Учетные остатки не изменятся, потому что ревизия еще не закрыта. Действие останется в общем журнале." confirmLabel="Удалить черновик" disabled={deleteDraft.isPending} onConfirm={() => deleteDraft.mutate({ inventoryId: item.id })}/>} {item.status === "closed" && (isAdmin || isManager) && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={archiveClosed.isPending}><Trash2 size={14}/>{archiveClosed.isPending ? "Архивируем…" : "Удалить из истории"}</button>} title="Убрать закрытый пересчет из истории?" description="Закрытый пересчет будет архивирован: его строки и созданные движения останутся в аудите и не будут физически удалены." confirmLabel="Архивировать пересчет" disabled={archiveClosed.isPending} onConfirm={() => archiveClosed.mutate({ inventoryId: item.id })}/>}</article>)}</div> : <div className="empty-state compact"><ClipboardCheck size={25}/><h2>Пересчетов пока нет</h2><p>После открытия первого черновика здесь появится история вашей точки.</p></div>}</section>
  </AuditShell>;
}
