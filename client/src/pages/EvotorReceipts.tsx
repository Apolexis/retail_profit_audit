import { ChevronRight, ReceiptText, Search, ShoppingBasket, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { DateRangeControl } from "@/components/DateRangeControl";
import { FactsLoader } from "@/components/OceanLoader";
import { ThemedSelect } from "@/components/ui/themed-select";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import { formatQuantityWithUnit, normalizeEvotorQuantityUnit } from "@/lib/displayFormat";
import { positionLabel } from "@/lib/russianPlural";
import { trpc } from "@/lib/trpc";
import { formatBusinessDate, formatMoscowDateTime } from "@/lib/utils";
import "@/evotor-receipts.css";

type ReceiptItem = {
  id: number;
  storeId: number;
  storeName: string;
  receiptNumber: string | null;
  type: "sale" | "return";
  typeLabel: string;
  occurredAt: string | null;
  total: number | null;
  discountAmount: number | null;
  paymentCaptureStatus: "complete" | "unavailable" | "unreconciled" | "malformed";
};

type ReceiptDetail = {
  id: number;
  storeName: string;
  receiptNumber: string | null;
  type: "sale" | "return";
  typeLabel: string;
  occurredAt: string | null;
  total: number | null;
  discountAmount: number | null;
  payments: {
    cashAmount: number | null;
    cashTenderedAmount: number | null;
    cashChangeAmount: number | null;
    cashlessAmount: number | null;
    otherPaymentAmount: number | null;
    unknownPaymentAmount: number | null;
    captureStatus: "complete" | "unavailable" | "unreconciled" | "malformed";
    reconciliationDelta: number | null;
  };
  positions: Array<{ id: number; productName: string; quantity: number | null; unit: string | null; resultSum: number | null }>;
};
type ReturnNotificationDetail = { id: number; storeName: string; receiptNumber: string | null; typeLabel: string; occurredAt: string | null; total: number | null; positions: Array<{ id: number; productName: string; quantity: number | null; unit: string | null }> };

const EVOTOR_ANALYTICS_START = "2025-01-01";
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
const defaultReceiptRange = (): DateRangeValue => {
  const today = todayIso();
  return { from: today < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : today, to: today };
};
const retainedRange = (value: DateRangeValue): DateRangeValue => {
  const from = value.from < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.from;
  const to = value.to < EVOTOR_ANALYTICS_START ? EVOTOR_ANALYTICS_START : value.to;
  return to < from ? { from: EVOTOR_ANALYTICS_START, to: EVOTOR_ANALYTICS_START } : { from, to };
};
const rangeText = (value: DateRangeValue) => `${formatBusinessDate(value.from)} — ${formatBusinessDate(value.to)}`;
const dateTimeText = (value: string | null) => formatMoscowDateTime(value, { fallback: "Время не передано" });
const compactMoscowDateTime = (value: string | null) => `${formatMoscowDateTime(value, { seconds: false, fallback: "Время не передано" })} МСК`;
const moneyText = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Не передано";
  const sign = value < 0 ? "−" : "";
  const [integer, fraction] = Math.abs(value).toFixed(2).split(".");
  return `${sign}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${fraction} ₽`;
};
const quantityText = (value: number | null, unit: string | null) => value === null || !Number.isFinite(value) ? "Не передано" : formatQuantityWithUnit(value, normalizeEvotorQuantityUnit(unit));
const receiptNumberText = (value: string | null) => value ? `Чек № ${value}` : "Номер не передан Эвотором";

export default function EvotorReceipts() {
  const { demoMode, selectedStores, setSelectedStores } = useAudit();
  const receiptFromAddress = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("receipt"));
  const returnReceiptId = Number.isInteger(receiptFromAddress) && receiptFromAddress > 0 ? receiptFromAddress : null;
  const isReturnNotificationView = returnReceiptId !== null;
  const utils = trpc.useUtils();
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [receiptRange, setReceiptRange] = useState<DateRangeValue>(defaultReceiptRange);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pageOffset, setPageOffset] = useState(0);
  const [loadedItems, setLoadedItems] = useState<ReceiptItem[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(() => Number.isInteger(receiptFromAddress) && receiptFromAddress > 0 ? receiptFromAddress : null);
  const [paymentRepairNotice, setPaymentRepairNotice] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const selectedStoreIds = useMemo(() => visibleStores.filter(store => selectedStores.includes(store.name)).map(store => store.id), [selectedStores, visibleStores]);
  const allStoresSelected = selectedStores.length === 0;
  const queryInput = useMemo(() => ({
    from: receiptRange.from,
    to: receiptRange.to,
    storeIds: allStoresSelected ? undefined : selectedStoreIds,
    search: appliedSearch.trim() || undefined,
    limit: 30,
    offset: pageOffset,
  }), [allStoresSelected, appliedSearch, pageOffset, receiptRange.from, receiptRange.to, selectedStoreIds]);
  const query = trpc.inventoryRegistry.evotorReceipts.useQuery(queryInput, {
    retry: false,
    enabled: !demoMode && !isReturnNotificationView,
    // Preserve a completed protected page briefly on navigation/focus. The data
    // still refreshes on the minute, while a user is not shown the loader again
    // for the same already-imported receipt slice.
    staleTime: 45_000,
    refetchInterval: 60_000,
  });
  const detail = trpc.inventoryRegistry.evotorReceiptDetail.useQuery({ receiptId: selectedReceiptId ?? 0 }, { retry: false, enabled: !demoMode && !isReturnNotificationView && selectedReceiptId !== null });
  const returnNotificationDetail = trpc.inventoryRegistry.evotorReturnNotificationDetail.useQuery({ receiptId: returnReceiptId ?? 0 }, { retry: false, enabled: !demoMode && returnReceiptId !== null });
  const syncStatus = trpc.inventoryRegistry.evotorSyncStatus.useQuery(undefined, { retry: false, enabled: !demoMode && !isReturnNotificationView });
  const reconcilePayments = trpc.inventoryRegistry.reconcileEvotorPayments.useMutation({
    onSuccess: async result => {
      setPaymentRepairNotice(result.candidateCount
        ? `Проверено: ${result.readCount} из ${result.candidateCount}; сверено: ${result.reconciledCount}; осталось несверенных: ${result.unresolvedCount}; ошибок чтения: ${result.failedCount}.`
        : "Несверенных оплат для точечной проверки нет.");
      await Promise.all([
        utils.inventoryRegistry.evotorReceipts.invalidate(),
        utils.inventoryRegistry.evotorReceiptDetail.invalidate(),
        utils.inventoryRegistry.evotorSyncStatus.invalidate(),
        utils.inventoryRegistry.evotorSalesAnalytics.invalidate(),
      ]);
    },
    onError: () => setPaymentRepairNotice("Точечная проверка оплат не завершилась. Несверенные суммы сохранены без подстановки."),
  });
  const items = loadedItems;
  const selectedDetail = detail.data as ReceiptDetail | undefined;
  const notifiedReturn = returnNotificationDetail.data as ReturnNotificationDetail | undefined;
  const scope = allStoresSelected ? "Все магазины" : selectedStores.length === 1 ? selectedStores[0] : `${selectedStores.length} магазина`;
  const resetRegister = () => {
    setPageOffset(0);
    setLoadedItems([]);
    setSelectedReceiptId(null);
  };
  const selectedReceipt = items.find(item => item.id === selectedReceiptId);
  const coverageText = query.data?.coverage?.from && query.data?.coverage?.to ? `${query.data.coverage.from} — ${query.data.coverage.to}` : null;
  const paymentStatusText: Record<ReceiptItem["paymentCaptureStatus"], string> = {
    complete: "Оплаты сверены с итогом",
    unavailable: "Оплаты не переданы",
    unreconciled: "Оплаты не сходятся",
    malformed: "Оплаты не распознаны",
  };
  const openReceipt = (receiptId: number) => setSelectedReceiptId(receiptId);
  const canLoadMore = Boolean(query.data?.page?.hasMore);
  const currentDaySync = syncStatus.data?.currentDay;
  const currentDayErrorCount = currentDaySync ? currentDaySync.uncoveredStores || currentDaySync.failedStores + (syncStatus.data?.documentJob.hasError ? 1 : 0) : 0;
  const latestStoredReceiptAt = useMemo(() => (query.data?.storeCoverage ?? [])
    .map(store => store.latestOccurredAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null, [query.data?.storeCoverage]);
  const syncHeadline = syncStatus.isLoading ? "Проверяем…" : currentDaySync ? `Сегодня: ${currentDaySync.completedStores}/${syncStatus.data?.mappedStores ?? 0} завершено${currentDayErrorCount ? ` · ошибок ${currentDayErrorCount}` : ""}` : "Статус недоступен";
  const syncDetailsHint = latestStoredReceiptAt ? `Последний: ${compactMoscowDateTime(latestStoredReceiptAt)}` : "Раскрыть покрытие";
  const currentDaySyncNarrative = currentDaySync
    ? `Текущий день: проверка новых документов запускается каждую минуту. ${currentDaySync.activeWorkers} параллельных потока распределяют точки. Последние ${currentDaySync.overlapMinutes} мин перепроверяются только как страховка от поздней доставки: это не задержка обновления, повторные документы не создаются. Архив 2025+ не перечитывается.`
    : null;
  useEffect(() => {
    const received = (query.data?.items ?? []) as ReceiptItem[];
    if (!query.data) return;
    setLoadedItems(current => {
      if (pageOffset === 0) return received;
      const byId = new Map(current.map(item => [item.id, item]));
      received.forEach(item => byId.set(item.id, item));
      return Array.from(byId.values());
    });
  }, [pageOffset, query.data]);
  useEffect(() => {
    if (selectedReceiptId === null) return;
    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      detailHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedReceiptId]);

  if (isReturnNotificationView) return <AuditShell kicker="34 / ЧЕКИ ЭВОТОР" title="Возврат Эвотор"><section className="page-lede"><div><span>УВЕДОМЛЕНИЕ О ВОЗВРАТЕ</span><h2>Точный документ возврата</h2><p>Открыт только возврат, адресованный этой учётной записи. Общий реестр чеков, оплаты и финансовые итоги не раскрываются.</p></div></section>{demoMode ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Чеки Эвотор отключены в демо‑режиме</h2><p>Нормализованные возвраты в демо‑режиме не используются.</p></section> : returnNotificationDetail.isLoading ? <FactsLoader /> : returnNotificationDetail.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Возврат недоступен</h2><p>{returnNotificationDetail.error.message}</p></section> : notifiedReturn && <section className="packet-card evotor-receipt-detail"><div className="card-title"><div><span>СОСТАВ ВОЗВРАТА</span><h3>{receiptNumberText(notifiedReturn.receiptNumber)}</h3><small>{notifiedReturn.storeName} · {dateTimeText(notifiedReturn.occurredAt)} · {notifiedReturn.typeLabel}</small></div></div><section className="evotor-receipt-detail-kpis"><article><span>Итого возврата</span><strong>{moneyText(notifiedReturn.total)}</strong></article><article><span>Позиции</span><strong>{notifiedReturn.positions.length}</strong></article></section><div className="data-table-wrap evotor-receipt-detail-table-wrap"><table className="data-table evotor-receipt-detail-table"><thead><tr><th>Товар</th><th>Количество</th></tr></thead><tbody>{notifiedReturn.positions.map(position => <tr key={position.id}><td data-label="Товар">{position.productName}</td><td data-label="Количество">{quantityText(position.quantity, position.unit)}</td></tr>)}</tbody></table></div><p className="packet-note">Показаны только сохранённые позиции и итог конкретного возврата. Оплаты, общий реестр, технические и фискальные данные не раскрываются.</p></section>}</AuditShell>;

  return <AuditShell kicker="34 / ЧЕКИ ЭВОТОР" title="Чеки Эвотор">
    <section className="analysis-filter evotor-receipt-period">
      <div className="analysis-filter-copy"><span>ПЕРИОД ЧЕКОВ ЭВОТОР</span><strong>{rangeText(receiptRange)}</strong><small>{coverageText ? `Витрина: ${coverageText}.` : "Документы — с 2025 года."} По умолчанию — сегодня. Только чтение: P&L не меняется.</small></div>
      <DateRangeControl value={receiptRange} onChange={value => { resetRegister(); setReceiptRange(retainedRange(value)); }} title="ПЕРИОД ЧЕКОВ ЭВОТОР" ariaLabel="Изменить период чеков Эвотор" />
      <label className="analysis-store-scope"><span>МАГАЗИНЫ</span><ThemedSelect value={allStoresSelected ? "" : selectedStores[0] ?? ""} aria-label="Выбрать магазин для реестра чеков" onChange={event => { resetRegister(); setSelectedStores(event.target.value ? [event.target.value] : []); }}><option value="">Все магазины</option>{visibleStores.map(store => <option key={store.id} value={store.name}>{store.name}</option>)}</ThemedSelect></label>
    </section>

    {demoMode ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Чеки Эвотор отключены в демо‑режиме</h2><p>Демо использует только синтетические финансовые периоды. Нормализованные чеки Эвотор в него не подмешиваются.</p></section> : query.isLoading ? <FactsLoader /> : query.isError ? <section className="empty-state live-empty"><ReceiptText size={30}/><h2>Реестр чеков недоступен</h2><p>{query.error.message}</p></section> : <>
      <section className="packet-kpis equal cadence-kpis evotor-receipt-kpis">
        <article className="packet-kpi cadence-primary-kpi"><span>Продажи · {scope}</span><strong>{query.data?.summary.sales ?? 0}</strong><small>{moneyText(query.data?.summary.saleAmount ?? 0)}</small></article>
        <article className="packet-kpi"><span>Возвраты</span><strong>{query.data?.summary.returns ?? 0}</strong><small>{moneyText(query.data?.summary.returnAmount ?? 0)}</small></article>
        <article className="packet-kpi"><span>Скидки Эвотор</span><strong>{query.data?.summary.discountAmount === null ? "Нет данных" : moneyText(query.data?.summary.discountAmount ?? 0)}</strong><small>только явно переданные агрегаты</small></article>
        <article className="packet-kpi"><span>Оплаты сверены</span><strong>{query.data?.summary.paymentCapture.complete ?? 0}</strong><small>состав оплат = итогу · из {(query.data?.summary.paymentCapture.complete ?? 0) + (query.data?.summary.paymentCapture.unavailable ?? 0) + (query.data?.summary.paymentCapture.unreconciled ?? 0) + (query.data?.summary.paymentCapture.malformed ?? 0)} чек.</small></article>
      </section>

      <details className="packet-card evotor-receipt-sync">
        <summary><span>СИНХРОНИЗАЦИЯ И ПОКРЫТИЕ ЧЕКОВ</span><b>{syncHeadline}</b><small>{syncDetailsHint}</small></summary>
        {syncStatus.isError ? <p className="packet-note">Состояние синхронизации сейчас не прочитано: {syncStatus.error.message}</p> : currentDaySync && <><p className="evotor-sync-trust">Здесь собран единственный технический статус чеков Эвотор. Он показывает сохранённые read-only документы и не является бизнес-сигналом или подтверждением мгновенной доставки Эвотор.</p><div className="evotor-sync-summary-grid"><article><span>Текущий проход</span><strong>{currentDaySync.completedStores}/{syncStatus.data?.mappedStores ?? 0}</strong><small>{currentDaySync.runningStores ? `в работе: ${currentDaySync.runningStores}` : "точек завершено"}</small></article><article className={currentDayErrorCount ? "is-risk" : undefined}><span>{currentDaySync.uncoveredStores ? "Без потока" : "Ошибки"}</span><strong>{currentDayErrorCount}</strong><small>{currentDaySync.uncoveredStores ? "нужно расширить покрытие" : currentDaySync.failureMessages?.length ? "причины раскрыты ниже" : "не считаются загруженными"}</small></article><article><span>Последний документ</span><strong>{latestStoredReceiptAt ? compactMoscowDateTime(latestStoredReceiptAt) : "Нет"}</strong><small>по выбранным точкам</small></article></div>{currentDaySync.failureMessages?.length ? <section className="evotor-sync-failure-details" aria-label="Причины ошибок синхронизации"><strong>Причины ошибок текущего прохода</strong><ul>{currentDaySync.failureMessages.map((message: string) => <li key={message}>{message}</li>)}</ul></section> : null}<p className="packet-note">{currentDaySync.uncoveredStores ? `Покрыто ${Math.min(syncStatus.data?.mappedStores ?? 0, currentDaySync.workerCapacity)} из ${syncStatus.data?.mappedStores ?? 0} точек: для остальных нужен отдельный поток.` : currentDaySyncNarrative}</p></>}
        <details className="evotor-sync-coverage"><summary>Покрытие среза по магазинам</summary><div className="evotor-store-coverage" aria-label="Покрытие чеков по магазинам">{(query.data?.storeCoverage ?? []).map(store => <article key={store.storeId}><strong>{store.storeName}</strong><span>{store.documentsInPeriod ? `${store.documentsInPeriod} чек.` : "Чеков нет"}</span><small>{store.latestOccurredAt ? `Последний: ${compactMoscowDateTime(store.latestOccurredAt)}` : "Нет загруженных документов"}</small></article>)}</div></details>
        <div className="evotor-payment-repair"><div><strong>Сверка неопределённых оплат</strong><small>Повторно читаются только уже сохранённые несверенные чеки по их ID. Архив не обходится, запись в Эвотор не выполняется.</small></div><button type="button" className="subtle-button" disabled={reconcilePayments.isPending} onClick={() => { setPaymentRepairNotice(null); reconcilePayments.mutate({ limit: 100 }); }}>{reconcilePayments.isPending ? "Проверяем…" : "Уточнить оплаты"}</button></div>
        {paymentRepairNotice && <p className="packet-note evotor-payment-repair-result" aria-live="polite">{paymentRepairNotice}</p>}
      </details>

      <section className="packet-card evotor-receipt-register">
        <div className="card-title"><div><span>РЕЕСТР ЧЕКОВ · {scope}</span><h3>Показано {items.length} чеков</h3></div><small>Номер · МСК-время · сумма</small></div>
        <form className="evotor-receipt-search" onSubmit={event => { event.preventDefault(); resetRegister(); setAppliedSearch(searchDraft); }}><Search size={16} aria-hidden="true"/><input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Номер, магазин, МСК-время или сумма" aria-label="Поиск чека по номеру, магазину, московскому времени или сумме" />{(searchDraft || appliedSearch) && <button type="button" className="receipt-search-clear" aria-label="Очистить поиск чеков" onClick={() => { resetRegister(); setSearchDraft(""); setAppliedSearch(""); }}><X size={16}/></button>}<button type="submit" className="subtle-button">Найти</button></form>
        {!items.length ? <div className="empty-state compact"><ReceiptText size={26}/><h3>В выбранном срезе чеков нет</h3><p>Измените дату, магазин или строку поиска. Нули не подставляются.</p></div> : <><div className="data-table-wrap evotor-receipt-table-wrap"><table className="data-table evotor-receipt-table"><thead><tr><th>Чек</th><th>Магазин</th><th>Время</th><th>Тип</th><th className="numeric-column">Сумма</th><th>Оплаты</th><th aria-label="Открыть" /></tr></thead><tbody>{items.map(item => <tr key={item.id} className={selectedReceiptId === item.id ? "is-selected" : undefined} onClick={() => openReceipt(item.id)}><td data-label="Чек"><strong>{receiptNumberText(item.receiptNumber)}</strong></td><td data-label="Магазин">{item.storeName}</td><td data-label="Время">{dateTimeText(item.occurredAt)}</td><td data-label="Тип"><span className={item.type === "return" ? "receipt-kind is-return" : "receipt-kind"}>{item.typeLabel}</span></td><td data-label="Сумма" className="numeric-column">{moneyText(item.total)}</td><td data-label="Оплаты"><small>{paymentStatusText[item.paymentCaptureStatus]}</small></td><td className="receipt-open-cell"><button type="button" aria-label={`Открыть ${receiptNumberText(item.receiptNumber)}`} onClick={event => { event.stopPropagation(); openReceipt(item.id); }}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>{canLoadMore && <div className="evotor-receipt-more"><button type="button" className="subtle-button" disabled={query.isFetching} onClick={() => setPageOffset(current => current + 30)}>{query.isFetching ? "Загружаем…" : "Показать еще"}</button><small>Следующие 30 чеков</small></div>}</>}
      </section>

      {selectedReceiptId && <section ref={detailRef} className="packet-card evotor-receipt-detail" aria-live="polite" tabIndex={-1}>
        {detail.isLoading ? <FactsLoader /> : detail.isError ? <div className="empty-state compact"><ReceiptText size={26}/><h3>Состав чека недоступен</h3><p>{detail.error.message}</p></div> : selectedDetail && <>
          <div className="card-title"><div><span>СОСТАВ ЧЕКА</span><h3 ref={detailHeadingRef} tabIndex={-1}>{receiptNumberText(selectedDetail.receiptNumber)}</h3><small>{selectedDetail.storeName} · {dateTimeText(selectedDetail.occurredAt)} · {selectedDetail.typeLabel}</small></div><button type="button" className="subtle-button receipt-detail-close" onClick={() => setSelectedReceiptId(null)}><X size={15}/>Закрыть состав</button></div>
          <section className="evotor-receipt-detail-kpis"><article><span>Итого</span><strong>{moneyText(selectedDetail.total)}</strong></article><article><span>Скидка</span><strong>{selectedDetail.discountAmount === null ? "Нет данных" : moneyText(selectedDetail.discountAmount)}</strong></article><article><span>Наличные</span><strong>{selectedDetail.payments.cashAmount === null ? "Нет данных" : moneyText(selectedDetail.payments.cashAmount)}</strong></article><article><span>Безналичные</span><strong>{selectedDetail.payments.cashlessAmount === null ? "Нет данных" : moneyText(selectedDetail.payments.cashlessAmount)}</strong></article></section>
          <p className="packet-note"><ShoppingBasket size={15}/> {selectedDetail.payments.captureStatus === "complete" ? "Оплаты переданы и сверены по сумме чека." : "Данные об оплате неполные или не сходятся: отсутствующие суммы не подставляются."} {selectedDetail.payments.cashChangeAmount && selectedDetail.payments.cashChangeAmount > 0 ? `Внесено наличными: ${moneyText(selectedDetail.payments.cashTenderedAmount)}; сдача: ${moneyText(selectedDetail.payments.cashChangeAmount)}; к оплате наличными: ${moneyText(selectedDetail.payments.cashAmount)}.` : ""} {selectedDetail.payments.otherPaymentAmount ? `Прочие оплаты: ${moneyText(selectedDetail.payments.otherPaymentAmount)}.` : ""} {selectedDetail.payments.unknownPaymentAmount ? `Неизвестный тип оплаты: ${moneyText(selectedDetail.payments.unknownPaymentAmount)}.` : ""}</p>
          <div className="data-table-wrap evotor-receipt-detail-table-wrap"><table className="data-table evotor-receipt-detail-table"><thead><tr><th>Товар</th><th>Количество</th><th>Сумма строки</th></tr></thead><tbody>{selectedDetail.positions.map(position => <tr key={position.id}><td data-label="Товар">{position.productName}</td><td data-label="Количество">{quantityText(position.quantity, position.unit)}</td><td data-label="Сумма строки">{moneyText(position.resultSum)}</td></tr>)}</tbody><tfoot><tr className="table-total"><th scope="row">Итого по чеку</th><td>{positionLabel(selectedDetail.positions.length)}</td><td>{selectedDetail.positions.some(position => position.resultSum === null) ? "Неполная сумма" : moneyText(selectedDetail.positions.reduce((sum, position) => sum + Number(position.resultSum), 0))}</td></tr></tfoot></table></div>
          <p className="packet-note">Состав показан только по уже нормализованным товарным строкам. Внутренние цены, себестоимость, UUID, фискальные и терминальные данные не выводятся.</p>
        </>}
      </section>}
    </>}
  </AuditShell>;
}
