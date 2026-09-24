import { ArrowLeft, ArrowRightLeft, Boxes, ClipboardCheck, Minus, Plus, RotateCcw, Save, SendHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl, ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import type { DateRangeValue } from "@/contexts/AuditContext";
import { formatBusinessDate, formatMoscowDateTime, normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/stock-transfers.css";

type Unit = "kg" | "l" | "piece";
type CatalogUnit = "fraction" | "l" | "piece" | "unknown";
type Store = { id: number; name: string; isHidden?: boolean };
type TransferLine = { id: number; productId: number; quantity: number; unit: Unit; internalCode: string; canonicalName: string; category: string | null; sourceQuantity: number | null; destinationQuantity: number | null };
type TransferStatus = "draft" | "posted" | "reversed";
type TransferDetail = { id: number; transferNumber: number; sourceStoreId: number; destinationStoreId: number; sourceStoreName: string; destinationStoreName: string; businessDate: string; status: TransferStatus; reversalOfTransferId: number | null; note: string | null; lines: TransferLine[] };
type TransferHistory = Omit<TransferDetail, "lines"> & { lineCount: number; postedAt: Date | string | null };
type SourceProduct = { id: number; canonicalName: string; catalogNumber: number; category: string | null; baseUnit: CatalogUnit; accountingQuantity: number | null; isActive: boolean };

const unitLabel: Record<Unit, string> = { kg: "кг", l: "л", piece: "шт" };
const toMoscowDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const quantityText = (value: number | null) => value === null ? "не уточнен" : String(Math.round(value * 1_000) / 1_000);
const dateText = (value: string) => formatBusinessDate(value);
const quantityInput = (value: string) => {
  const normalized = normalizeDecimalInputText(value).replace(/[^0-9.]/g, "");
  const [whole, ...fraction] = normalized.split(".");
  return fraction.length ? `${whole}.${fraction.join("").slice(0, 3)}` : whole;
};
const snapTransferQuantity = (raw: string, step: number) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(Math.round(value / step) * step);
};
const transferStatusLabel = (status: TransferStatus, isReversalDraft = false) => status === "draft" ? isReversalDraft ? "Черновик сторно" : "Черновик" : status === "posted" ? "Проведено" : "Сторнировано";
const transferHistoryMoment = (item: TransferHistory) => item.postedAt ? `${dateText(item.businessDate)} · ${formatMoscowDateTime(item.postedAt)} МСК` : dateText(item.businessDate);
const initialHistoryRange = (): DateRangeValue => {
  const today = toMoscowDate();
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
};

export default function StockTransfers() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [sourceStoreId, setSourceStoreId] = useState("");
  const [destinationStoreId, setDestinationStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [transferId, setTransferId] = useState<number | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [historyRange, setHistoryRange] = useState<DateRangeValue>(initialHistoryRange);
  const isAdmin = me.data?.role === "admin";
  const isManager = me.data?.role === "manager";
  const allowed = isAdmin || isManager;
  const visibleStores = useMemo(() => ((stores.data ?? []) as Store[]).filter(store => !store.isHidden), [stores.data]);
  const sourceId = Number(sourceStoreId);
  const destinationId = Number(destinationStoreId);
  const products = trpc.inventoryRegistry.products.useQuery({ storeId: sourceId || undefined }, { enabled: allowed && Boolean(sourceId), retry: false });
  const historyInput = useMemo(() => ({ from: historyRange.from, to: historyRange.to, limit: 50 }), [historyRange.from, historyRange.to]);
  const history = trpc.inventoryRegistry.stockTransfers.useQuery(historyInput, { enabled: allowed, retry: false });
  const detail = trpc.inventoryRegistry.stockTransferDetail.useQuery({ transferId: transferId ?? 0 }, { enabled: allowed && transferId !== null, retry: false });
  const recommendation = trpc.inventoryRegistry.stockTransferRecommendation.useQuery({ sourceStoreId: sourceId, destinationStoreId: destinationId, productId: Number(productId) }, { enabled: allowed && Boolean(sourceId && destinationId && productId) && sourceId !== destinationId, retry: false });
  const create = trpc.inventoryRegistry.createStockTransfer.useMutation({
    onSuccess: async result => {
      setTransferId(result.transfer.id);
      toast.success("Черновик перемещения создан");
      await utils.inventoryRegistry.stockTransfers.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const upsertLine = trpc.inventoryRegistry.upsertStockTransferLine.useMutation({
    onSuccess: async () => {
      setProductId("");
      setQuantity("");
      toast.success("Позиция добавлена в черновик");
      await utils.inventoryRegistry.stockTransferDetail.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeLine = trpc.inventoryRegistry.removeStockTransferLine.useMutation({
    onSuccess: async () => {
      toast.success("Позиция удалена из черновика");
      await utils.inventoryRegistry.stockTransferDetail.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeDraft = trpc.inventoryRegistry.deleteStockTransferDraft.useMutation({
    onSuccess: async () => {
      setTransferId(null);
      setProductId("");
      setQuantity("");
      toast.success("Черновик перемещения удален");
      await Promise.all([utils.inventoryRegistry.stockTransfers.invalidate(), utils.inventoryRegistry.stockTransferDetail.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const post = trpc.inventoryRegistry.postStockTransfer.useMutation({
    onSuccess: async result => {
      toast.success(result.before.reversalOfTransferId ? "Обратное сторно проведено: остатки возвращены" : "Перемещение проведено: остатки обновлены с обеих сторон");
      await Promise.all([utils.inventoryRegistry.stockTransfers.invalidate(), utils.inventoryRegistry.stockTransferDetail.invalidate(), utils.inventoryRegistry.stock.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const createReversal = trpc.inventoryRegistry.createStockTransferReversal.useMutation({
    onSuccess: async result => {
      setTransferId(result.transfer.id);
      setSourceStoreId(String(result.transfer.sourceStoreId));
      setDestinationStoreId(String(result.transfer.destinationStoreId));
      setBusinessDate(result.transfer.businessDate);
      setProductId("");
      setQuantity("");
      toast.success(`Создан обратный черновик сторно № ${result.transfer.transferNumber}`);
      await Promise.all([utils.inventoryRegistry.stockTransfers.invalidate(), utils.inventoryRegistry.stockTransferDetail.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (sourceStoreId || !visibleStores.length) return;
    if (visibleStores.length === 1) setSourceStoreId(String(visibleStores[0].id));
  }, [sourceStoreId, visibleStores]);

  const catalog = ((products.data ?? []) as SourceProduct[]).filter(product => product.isActive && product.baseUnit !== "unknown");
  const selectedProduct = catalog.find(product => product.id === Number(productId));
  const active = detail.data as TransferDetail | undefined;
  const isReversalDraft = active?.status === "draft" && active.reversalOfTransferId !== null;
  const selectedUnit = selectedProduct ? selectedProduct.baseUnit === "fraction" ? "кг" : selectedProduct.baseUnit === "l" ? "л" : "шт" : "";
  const quantityStep = selectedProduct?.baseUnit === "piece" ? 1 : 0.5;
  const plannedQuantity = Number(quantity);
  const hasPlannedQuantity = Number.isFinite(plannedQuantity) && plannedQuantity > 0;
  const projectedSourceQuantity = recommendation.data?.sourceQuantity ?? selectedProduct?.accountingQuantity ?? null;
  const projectedDestinationQuantity = recommendation.data?.destinationQuantity ?? null;
  const hasNewTransferChoice = Boolean(sourceStoreId || destinationStoreId || businessDate !== toMoscowDate());
  const projectedLineBalance = (value: number | null, delta: number, unit: Unit) => {
    if (value === null) return "Нет подтвержденного остатка";
    const before = `${quantityText(value)}${unitLabel[unit]}`;
    return active?.status === "draft" ? `${before} → ${quantityText(value + delta)}${unitLabel[unit]}` : before;
  };
  const openingDraft = transferId !== null && (detail.isLoading || !active);
  const hasUnconfirmedSource = Boolean(active?.lines.some(line => line.sourceQuantity === null));
  const busy = create.isPending || upsertLine.isPending || removeLine.isPending || removeDraft.isPending || post.isPending || createReversal.isPending;
  const createDraft = () => {
    if (!sourceId || !destinationId) return toast.error("Выберите склад-отправитель и склад-получатель.");
    if (sourceId === destinationId) return toast.error("Склад-отправитель и склад-получатель должны различаться.");
    create.mutate({ sourceStoreId: sourceId, destinationStoreId: destinationId, businessDate });
  };
  const cancelNewTransfer = () => {
    setSourceStoreId("");
    setDestinationStoreId("");
    setBusinessDate(toMoscowDate());
    setProductId("");
    setQuantity("");
  };
  const closeTransferDraft = () => {
    setTransferId(null);
    setProductId("");
    setQuantity("");
  };
  const adjustQuantity = (delta: number) => {
    const current = Number(quantity || 0);
    const next = Math.max(0, Math.round((current + delta) * 1_000) / 1_000);
    setQuantity(next ? String(next) : "");
  };
  const addLine = () => {
    if (!transferId || !selectedProduct) return toast.error("Выберите товар для перемещения.");
    const normalizedQuantity = Number(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return toast.error("Укажите количество больше нуля.");
    if (projectedSourceQuantity !== null && normalizedQuantity > projectedSourceQuantity) return toast.error(`Нельзя переместить больше подтвержденного остатка: доступно ${quantityText(projectedSourceQuantity)}${selectedUnit}.`);
    upsertLine.mutate({ transferId, productId: selectedProduct.id, quantity: normalizedQuantity });
  };
  const openTransfer = (item: TransferHistory) => {
    setTransferId(item.id);
    setSourceStoreId(String(item.sourceStoreId));
    setDestinationStoreId(String(item.destinationStoreId));
    setBusinessDate(item.businessDate);
    setProductId("");
    setQuantity("");
  };

  if (!me.isLoading && !allowed) {
    return <AuditShell kicker="32 / ПЕРЕМЕЩЕНИЯ" title="Перемещения"><section className="empty-state"><ArrowRightLeft size={28}/><h2>Нет доступа к перемещениям</h2><p>Перемещения между складами проводит только руководитель с доступом к обеим точкам или администратор.</p></section></AuditShell>;
  }

  return <AuditShell kicker="32 / ПЕРЕМЕЩЕНИЯ" title="Перемещения остатков">
    <section className="page-lede transfer-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Из склада в склад</h2><p>Черновик не меняет остатки. После проведения система фиксирует две неизменяемые записи: списание на складе-отправителе и приход на складе-получателе. Нельзя провести больше подтвержденного остатка.</p></div></section>
    <section className="packet-card transfer-card">
      <div className="card-title"><div><span>НОВОЕ ПЕРЕМЕЩЕНИЕ</span><h3>{active ? `${active.status === "draft" ? isReversalDraft ? "Черновик обратного сторно" : "Черновик перемещения" : active.status === "posted" ? "Проведенное перемещение" : "Сторнированное перемещение"} № ${active.transferNumber}` : "Выберите склады"}</h3></div>{active && <span className={active.status === "posted" ? "transfer-status is-posted" : active.status === "reversed" ? "transfer-status is-reversed" : isReversalDraft ? "transfer-status is-reversal-draft" : "transfer-status"}>{transferStatusLabel(active.status, isReversalDraft)}</span>}</div>
      {transferId === null && <div className="transfer-form">
        <label>Склад-отправитель<ThemedSelect searchable searchPlaceholder="Найти склад" value={sourceStoreId} onChange={event => { setSourceStoreId(event.target.value); setProductId(""); }}><option value="">Выберите склад</option>{visibleStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label>
        <label>Склад-получатель<ThemedSelect searchable searchPlaceholder="Найти склад" value={destinationStoreId} onChange={event => setDestinationStoreId(event.target.value)}><option value="">Выберите склад</option>{visibleStores.filter(store => store.id !== sourceId).map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect></label>
        <div className="transfer-date-control"><span>Дата</span><ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ПЕРЕМЕЩЕНИЯ" ariaLabel="Выбрать дату перемещения"/></div>
        <div className={hasNewTransferChoice ? "transfer-form-actions" : "transfer-form-actions is-pristine"}><button type="button" className="subtle-button transfer-create" onClick={createDraft} disabled={busy}><ClipboardCheck size={15}/>Создать черновик</button>{hasNewTransferChoice && <button type="button" className="subtle-button transfer-cancel" onClick={cancelNewTransfer} disabled={busy}><ArrowLeft size={15}/>Отмена</button>}</div>
          <p className="transfer-form-hint">Сначала выберите пару складов. Черновик не меняет остатки; после выбора товара система покажет доступный учетный остаток отправителя и рекомендацию по получателю.</p>
      </div>}
      {openingDraft && <p className="packet-note">Открываем черновик перемещения…</p>}
      {active && <>
        <div className="transfer-route"><div><span>ОТКУДА</span><strong>{active.sourceStoreName}</strong></div><ArrowRightLeft aria-hidden="true" size={19}/><div><span>КУДА</span><strong>{active.destinationStoreName}</strong></div><small>{dateText(active.businessDate)}</small></div>
        {isReversalDraft && <p className="transfer-reversal-draft-note"><RotateCcw size={15}/> Это обратный черновик к проведенному перемещению. Его удаление удалит только этот черновик; исходное перемещение останется в журнале. Чтобы вернуть остатки, проверьте строки и проведите обратное сторно.</p>}
        {active.status === "draft" && <div className={selectedProduct ? "transfer-add-line has-product" : "transfer-add-line"}>
          <label>Товар<ThemedSelect searchable searchPlaceholder="Название, код или не полное имя" value={productId} onChange={event => { setProductId(event.target.value); setQuantity(""); }}><option value="">Выберите товар</option>{catalog.map(product => <option key={product.id} value={product.id}>{product.canonicalName} · {product.catalogNumber}</option>)}</ThemedSelect></label>
          {selectedProduct ? <><label>Количество<small className="transfer-quantity-step">Шаг {quantityStep}{selectedUnit}</small><div className="transfer-quantity-stepper"><button type="button" aria-label="Уменьшить количество" onClick={() => adjustQuantity(-quantityStep)} disabled={busy || !quantity}><Minus size={15}/></button><input inputMode="decimal" value={quantity} onChange={event => setQuantity(quantityInput(event.target.value))} onBlur={() => setQuantity(current => snapTransferQuantity(current, quantityStep))} placeholder="0" aria-label={`Количество, шаг ${quantityStep} ${selectedUnit}`} /><button type="button" aria-label="Увеличить количество" onClick={() => adjustQuantity(quantityStep)} disabled={busy}><Plus size={15}/></button></div></label><button type="button" className="subtle-button" onClick={addLine} disabled={!hasPlannedQuantity || busy}><Plus size={15}/>Добавить</button></> : <p className="transfer-add-line-placeholder">Выберите товар, чтобы указать количество и увидеть прогноз остатков.</p>}
        </div>}
          {selectedProduct && active.status === "draft" && <aside className="transfer-stock-snapshot" aria-label="Доступный остаток выбранного товара"><div><span>ДОСТУПНО У ОТПРАВИТЕЛЯ</span><strong>{projectedSourceQuantity === null ? "Нет подтвержденного остатка" : `${quantityText(projectedSourceQuantity)}${selectedUnit}`}</strong></div><p>Позиция не добавляется автоматически: сначала укажите количество, затем нажмите «Добавить». До проведения черновик не списывает и не зачисляет товар.</p></aside>}
          {selectedProduct && active.status === "draft" && hasPlannedQuantity && <aside className="transfer-stock-projection" aria-label="Прогноз остатков после проведения"><div><span>ОТПРАВИТЕЛЬ · БЫЛО → СТАНЕТ</span><strong>{projectedSourceQuantity === null ? "Нет подтвержденного остатка" : `${quantityText(projectedSourceQuantity)}${selectedUnit} → ${quantityText(projectedSourceQuantity - plannedQuantity)}${selectedUnit}`}</strong></div><div><span>ПОЛУЧАТЕЛЬ · БЫЛО → СТАНЕТ</span><strong>{projectedDestinationQuantity === null ? "Нет подтвержденного остатка" : `${quantityText(projectedDestinationQuantity)}${selectedUnit} → ${quantityText(projectedDestinationQuantity + plannedQuantity)}${selectedUnit}`}</strong></div><p>Прогноз применится только после проведения и повторно сверяется сервером с подтвержденным остатком.</p></aside>}
          {selectedProduct && active.status === "draft" && <aside className="transfer-recommendation"><strong>Рекомендация по перемещению</strong>{recommendation.isLoading ? <span>Считаем покрытие по продажам за 7 дней…</span> : recommendation.data ? <span>{recommendation.data.state === "recommended" ? `На точке хватит на ${quantityText(recommendation.data.destinationCoverDays)} дн.; рекомендовано до ${quantityText(recommendation.data.recommendedQuantity)} ${selectedProduct.baseUnit === "fraction" ? "кг" : selectedProduct.baseUnit === "l" ? "л" : "шт"}.` : recommendation.data.state === "sufficient" ? `На точке запас примерно на ${quantityText(recommendation.data.destinationCoverDays)} дн.; перемещение сейчас не требуется.` : "Рекомендация появится после подтвержденного остатка и продаж за 7 дней."}</span> : <span>Рекомендация пока недоступна.</span>}</aside>}
        {!active.lines.length ? <div className="empty-state compact"><Boxes size={24}/><h2>Добавьте позиции</h2><p>Только строки черновика попадут в проводку. Остатки пока не менялись.</p></div> : <div className="data-table-wrap transfer-table-wrap"><table className="data-table transfer-table"><thead><tr><th>№</th><th>Товар</th><th>{active.status === "draft" ? "Отправитель · будет" : "Учетный остаток отправителя"}</th><th>{active.status === "draft" ? "Получатель · будет" : "Учетный остаток получателя"}</th><th>Переместить</th><th aria-label="Действие" /></tr></thead><tbody>{active.lines.map((line, index) => <tr key={line.id}><td data-label="№">{index + 1}</td><td data-label="Товар"><strong>{line.canonicalName}</strong><small>{line.internalCode}{line.category ? ` · ${line.category}` : ""}</small></td><td data-label="Отправитель">{projectedLineBalance(line.sourceQuantity, -line.quantity, line.unit)}</td><td data-label="Получатель">{projectedLineBalance(line.destinationQuantity, line.quantity, line.unit)}</td><td data-label="Переместить"><strong>{quantityText(line.quantity)}{unitLabel[line.unit]}</strong></td><td data-label="Действие">{active.status === "draft" && <button type="button" className="subtle-button icon-only" aria-label={`Убрать ${line.canonicalName}`} onClick={() => removeLine.mutate({ transferId: active.id, productId: line.productId })} disabled={busy}><Trash2 size={15}/></button>}</td></tr>)}</tbody><tfoot><tr className="table-total"><th colSpan={4} scope="row">Итого · {active.lines.length} {active.lines.length === 1 ? "позиция" : active.lines.length < 5 ? "позиции" : "позиций"}</th><td colSpan={2}>{active.status === "draft" ? "В строках показано: было → станет после проведения" : "Пара движений создана для каждой позиции"}</td></tr></tfoot></table></div>}
        {active.status === "draft" && <>{hasUnconfirmedSource && <p className="transfer-post-blocked" role="status">Проведение недоступно: у одной или нескольких позиций нет подтверждённого остатка у отправителя.</p>}<div className="transfer-actions">{isAdmin && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button" disabled={busy}><Trash2 size={15}/>Удалить черновик</button>} title={isReversalDraft ? "Удалить обратный черновик?" : "Удалить черновик перемещения?"} description={isReversalDraft ? "Удалится только непроведенное обратное сторно. Исходное проведенное перемещение и его журнал не изменятся." : "Строки исчезнут, остатки не менялись."} confirmLabel="Удалить" onConfirm={() => removeDraft.mutate({ transferId: active.id })} disabled={busy}/>}<button type="button" className="subtle-button transfer-cancel-draft" onClick={closeTransferDraft} disabled={busy}><ArrowLeft size={15}/>Отмена</button><ConfirmDangerDialog trigger={<button type="button" className="subtle-button transfer-post" disabled={!active.lines.length || busy || hasUnconfirmedSource}><SendHorizontal size={15}/>{isReversalDraft ? "Провести сторно" : "Провести перемещение"}</button>} title={isReversalDraft ? "Провести обратное сторно?" : "Провести перемещение?"} description={`Будут созданы парные неизменяемые движения: ${active.sourceStoreName} → ${active.destinationStoreName}. Это изменит учетные остатки по ${active.lines.length} позициям.`} confirmLabel="Провести" onConfirm={() => post.mutate({ transferId: active.id })} disabled={!active.lines.length || busy || hasUnconfirmedSource}/></div></>}
        {active.status === "posted" && <div className="transfer-actions"><button type="button" className="subtle-button transfer-cancel-draft" onClick={closeTransferDraft} disabled={busy}><ArrowLeft size={15}/>Отмена</button><ConfirmDangerDialog trigger={<button type="button" className="subtle-button transfer-reversal" disabled={busy}><RotateCcw size={15}/>Подготовить обратное сторно</button>} title={`Подготовить обратное сторно к перемещению № ${active.transferNumber}?`} description="Будет создан отдельный обратный черновик с теми же строками. Исходное проведенное перемещение не отменится и останется в журнале; остатки вернутся только после отдельного проведения обратного сторно." confirmLabel="Подготовить черновик" onConfirm={() => createReversal.mutate({ transferId: active.id })} disabled={busy}/></div>}
      </>}
    </section>
    <section className="packet-card transfer-history-card"><div className="card-title"><div><span>ИСТОРИЯ</span><h3>Перемещения за период</h3></div><button type="button" className="subtle-button" onClick={() => { setTransferId(null); setProductId(""); setQuantity(""); }}><Save size={15}/>Новый черновик</button></div><div className="transfer-history-period"><span>ПЕРИОД ИСТОРИИ</span><DateRangeControl value={historyRange} onChange={setHistoryRange} title="ПЕРИОД ИСТОРИИ ПЕРЕМЕЩЕНИЙ" ariaLabel="Выбрать период истории перемещений"/></div>{history.isLoading ? <p className="packet-note">Загружаем перемещения…</p> : !(history.data as TransferHistory[] | undefined)?.length ? <div className="empty-state compact"><ArrowRightLeft size={24}/><h2>В выбранном периоде перемещений нет</h2><p>Измените период или создайте черновик и проведите его после сверки позиций.</p></div> : <div className="transfer-history-list">{(history.data as TransferHistory[]).map(item => { const itemIsReversalDraft = item.status === "draft" && item.reversalOfTransferId !== null; return <article className={item.id === transferId ? "transfer-history-entry is-selected" : "transfer-history-entry"} key={item.id}><button type="button" className="transfer-history-item" aria-current={item.id === transferId ? "true" : undefined} onClick={() => openTransfer(item)}><span>№ {item.transferNumber}</span><strong>{item.sourceStoreName} → {item.destinationStoreName}</strong><small>{transferHistoryMoment(item)} · {item.lineCount} {item.lineCount === 1 ? "позиция" : item.lineCount < 5 ? "позиции" : "позиций"}</small><b>{transferStatusLabel(item.status, itemIsReversalDraft)}</b></button>{isAdmin && item.status === "draft" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger transfer-history-delete" disabled={removeDraft.isPending}><Trash2 size={14}/><span>Удалить</span></button>} title={itemIsReversalDraft ? "Удалить обратный черновик?" : "Удалить черновик перемещения?"} description={itemIsReversalDraft ? "Удалится только непроведенное обратное сторно. Исходное проведенное перемещение не изменится." : "Строки исчезнут, остатки не менялись."} confirmLabel="Удалить" disabled={removeDraft.isPending} onConfirm={() => removeDraft.mutate({ transferId: item.id })}/>}</article>; })}</div>}</section>
  </AuditShell>;
}
