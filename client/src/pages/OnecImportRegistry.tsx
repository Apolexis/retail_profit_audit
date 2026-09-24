import { Boxes, CircleDollarSign, Eye, EyeOff, FileSpreadsheet, KeyRound, Link2, PackageCheck, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import { formatBusinessDate, formatMoscowDateTime } from "@/lib/utils";
import "@/onec-import.css";

type OnecEntity = "inventory_snapshots" | "store_shipments" | "purchase_costs";
type MappingProduct = { id: number; catalogNumber: number; canonicalName: string };
type MappingStore = { id: number; name: string };
type QuarantineRow = { id: number; kind: "snapshot" | "shipment" | "purchase_cost"; productName: string | null; batchImportId: number; sourceSystem: string };
type SnapshotRow = { id: number; warehouseCode: string; productName: string | null; quantityOnHand: string | number; quantityAvailable: string | number | null; expirationDate: string | null; businessDate: string; asOf: string; mappingState: "mapped" | "quarantined" };
type ShipmentRow = { id: number; businessDate: string; originWarehouseCode: string; destinationStoreName: string | null; documentNumber: string | null; sourceStatus: "posted" | "cancelled" | "corrected"; mappingState: "unmapped" | "mapped" | "quarantined" };
type ShipmentLineRow = { id: number; productName: string | null; quantity: string | number; unit: "kg" | "l" | "piece"; expirationDate: string | null; mappingState: "mapped" | "quarantined" };
type PurchaseCostRow = { id: number; productId: number | null; productName: string | null; unit: "kg" | "l" | "piece"; purchasePrice: string | number; effectiveDate: string; warehouseCode: "BM" | "SRS" | null; basis: string | null; mappingState: "mapped" | "quarantined"; appliedToCatalogAt: Date | string | null; batchImportId: number };
type BatchRow = { id: number; entity: OnecEntity; generatedAt: string; status: "applied" | "quarantined" | "mixed"; totalRecords: number; acceptedRecords: number; quarantinedRecords: number; createdAt: Date | string };
type PrintGroup = { id: number; name: string; isActive: boolean };
type OnecWarehouseMapping = { warehouseCode: "BM" | "SRS"; printGroupId: number | null; printGroupName: string | null };

const dateTime = (value: Date | string) => formatMoscowDateTime(value);
const dateText = (value: string) => formatBusinessDate(value);
const qtyText = (value: string | number | null) => value === null ? "—" : `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}`;
const costText = (value: string | number) => `${Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const expirationText = (value: string | null) => value ? dateText(value) : "Не передан 1С";
const entityLabel: Record<OnecEntity, string> = { inventory_snapshots: "Остатки БМ/СРС", store_shipments: "Расходные накладные", purchase_costs: "Закупочные цены" };
const statusLabel = (status: "applied" | "quarantined" | "mixed") => status === "applied" ? "Сопоставлен" : status === "mixed" ? "Частично в карантине" : "Карантин";
const warehouseLabel = (code: string) => code === "BM" ? "Основной склад БМ" : code === "SRS" ? "Основной склад СРС" : "Основной склад";

export default function OnecImportRegistry() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const batches = trpc.inventoryRegistry.onecImportBatches.useQuery(undefined, { enabled: isAdmin, retry: false });
  const snapshots = trpc.inventoryRegistry.onecWarehouseSnapshots.useQuery({ limit: 120 }, { enabled: isAdmin, retry: false });
  const purchaseCosts = trpc.inventoryRegistry.onecPurchaseCosts.useQuery({ limit: 160 }, { enabled: isAdmin, retry: false });
  const shipments = trpc.inventoryRegistry.onecStoreShipments.useQuery({ limit: 120 }, { enabled: isAdmin, retry: false });
  const quarantine = trpc.inventoryRegistry.onecQuarantine.useQuery({ limit: 120 }, { enabled: isAdmin, retry: false });
  const mappingOptions = trpc.inventoryRegistry.onecMappingOptions.useQuery(undefined, { enabled: isAdmin, retry: false });
  const inboundStatus = trpc.inventoryRegistry.onecInboundCredentialStatus.useQuery(undefined, { enabled: isAdmin, retry: false });
  const printGroups = trpc.inventoryRegistry.printGroups.useQuery(undefined, { enabled: isAdmin, retry: false });
  const onecWarehouseMappings = trpc.inventoryRegistry.onecWarehouseGroupMappings.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [selectedStores, setSelectedStores] = useState<Record<number, string>>({});
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [inboundKey, setInboundKey] = useState("");
  const [revealedInboundKey, setRevealedInboundKey] = useState<string | null>(null);
  const shipmentLineInput = useMemo(() => ({ shipmentId: selectedShipmentId ?? 0 }), [selectedShipmentId]);
  const shipmentLines = trpc.inventoryRegistry.onecShipmentLines.useQuery(shipmentLineInput, { enabled: isAdmin && selectedShipmentId !== null, retry: false });

  const refresh = async () => {
    await Promise.all([
      utils.inventoryRegistry.onecImportBatches.invalidate(),
      utils.inventoryRegistry.onecWarehouseSnapshots.invalidate(),
      utils.inventoryRegistry.onecPurchaseCosts.invalidate(),
      utils.inventoryRegistry.onecStoreShipments.invalidate(),
      utils.inventoryRegistry.onecQuarantine.invalidate(),
      utils.inventoryRegistry.onecWarehouseGroupMappings.invalidate(),
      utils.audit.changes.invalidate(),
    ]);
  };
  const resolveProduct = trpc.inventoryRegistry.resolveOnecQuarantineProduct.useMutation({
    onSuccess: async () => { toast.success("Товар сопоставлен для следующих строк этого источника"); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const resolveDestination = trpc.inventoryRegistry.resolveOnecShipmentDestination.useMutation({
    onSuccess: async () => { toast.success("Получатель накладной сопоставлен"); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const replaceInboundKey = trpc.inventoryRegistry.replaceOnecInboundCredential.useMutation({
    onSuccess: async () => {
      setInboundKey("");
      setRevealedInboundKey(null);
      toast.success("Ключ входящего обмена 1С заменён");
      await inboundStatus.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const revealInboundKey = trpc.inventoryRegistry.revealOnecInboundCredential.useMutation({
    onSuccess: result => setRevealedInboundKey(result.token),
    onError: error => toast.error(error.message),
  });
  const setOnecWarehouseGroup = trpc.inventoryRegistry.setOnecWarehouseGroupMapping.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.inventoryRegistry.onecWarehouseGroupMappings.invalidate(), utils.audit.changes.invalidate()]);
      toast.success("Источник 1С связан с группой магазинов для рекомендаций");
    },
    onError: error => toast.error("Связь источника 1С не сохранена", { description: error.message }),
  });
  const applyPurchaseCost = trpc.inventoryRegistry.applyOnecPurchaseCost.useMutation({
    onSuccess: async result => {
      toast.success("Закупочная цена применена", { description: result.outbound.delivery === "queued_and_dispatched" ? "Изменение поставлено в очередь Эвотор по разрешённому флагу товара." : "Во внешнюю систему цена не передавалась." });
      await refresh();
    },
    onError: error => toast.error(error.message),
  });

  const batchesRows = (batches.data ?? []) as BatchRow[];
  const snapshotRows = (snapshots.data ?? []) as SnapshotRow[];
  const purchaseCostRows = (purchaseCosts.data ?? []) as PurchaseCostRow[];
  const shipmentRows = (shipments.data ?? []) as ShipmentRow[];
  const shipmentLineRows = (shipmentLines.data ?? []) as ShipmentLineRow[];
  const quarantineRows = (quarantine.data ?? []) as QuarantineRow[];
  const products = (mappingOptions.data?.products ?? []) as MappingProduct[];
  const stores = (mappingOptions.data?.stores ?? []) as MappingStore[];
  const activePrintGroups = ((printGroups.data ?? []) as PrintGroup[]).filter(group => group.isActive);
  const onecMappings = (onecWarehouseMappings.data ?? []) as OnecWarehouseMapping[];
  const warehouseSummary = useMemo(() => (["BM", "SRS"] as const).map(warehouse => {
    const rows = snapshotRows.filter(row => row.warehouseCode === warehouse && row.mappingState === "mapped");
    return { warehouse, positions: rows.length, quantity: rows.reduce((sum, row) => sum + Number(row.quantityOnHand), 0), lastDate: rows[0]?.businessDate ?? null };
  }), [snapshotRows]);

  if (!me.isLoading && !isAdmin) return <AuditShell kicker="33 / ИМПОРТ 1С" title="Импорт 1С"><section className="empty-state"><ShieldAlert size={28}/><h2>Нет доступа к импорту 1С</h2><p>Пакеты 1С, сопоставления и карантин доступны только администратору. Они не заменяют финансовый Excel-импорт.</p></section></AuditShell>;

  return <AuditShell kicker="33 / ИМПОРТ 1С" title="Импорт 1С: склады и накладные">
    <section className="page-lede onec-lede"><div><span>ОТДЕЛЬНЫЙ ОПЕРАЦИОННЫЙ РЕЕСТР</span><h2>БМ, СРС, накладные и закупочные цены</h2><p>Пакеты принимает только защищенный автоматический канал 1С. Реестр не меняет P&amp;L, Excel-факты, остатки магазинов, 1С или Эвотор автоматически; несопоставленные товары и получатели остаются в карантине.</p></div></section>
    <section className="packet-card onec-inbound-card"><div className="card-title"><div><span><KeyRound size={15}/> ВХОДЯЩИЙ ОБМЕН 1С</span><h3>Защищённый односторонний JSON-приём</h3></div><small>{inboundStatus.data?.configured ? "Ключ задан" : "Ключ не задан"}</small></div><p className="packet-note">1С отправляет JSON только в этот изолированный приёмник. Повторно применяются текущие проверки, карантин и идемпотентность; остатки магазинов, P&L и внешние системы не изменяются.</p><div className="onec-inbound-endpoint"><span>Адрес приёмника</span><output aria-label="Адрес приёмника 1С">{`${window.location.origin}/api/integrations/1c/import`}</output></div><div className="onec-inbound-actions"><label><span>Новый ключ 1С</span><input type="password" autoComplete="new-password" value={inboundKey} onChange={event => setInboundKey(event.target.value)} placeholder="Не менее 24 символов" aria-label="Новый ключ входящего обмена 1С" /></label><button type="button" className="subtle-button" disabled={inboundKey.trim().length < 24 || replaceInboundKey.isPending} onClick={() => replaceInboundKey.mutate({ token: inboundKey })}><KeyRound size={15}/>{replaceInboundKey.isPending ? "Сохраняем…" : inboundStatus.data?.configured ? "Заменить ключ" : "Задать ключ"}</button>{revealedInboundKey === null ? <button type="button" className="subtle-button onec-reveal-current" disabled={!inboundStatus.data?.configured || revealInboundKey.isPending} onClick={() => revealInboundKey.mutate()}><Eye size={15}/>{revealInboundKey.isPending ? "Открываем…" : "Показать текущий"}</button> : <button type="button" className="subtle-button onec-reveal-current" onClick={() => setRevealedInboundKey(null)}><EyeOff size={15}/>Скрыть текущий</button>}</div>{revealedInboundKey !== null && <label className="onec-inbound-revealed"><span>Текущий ключ — показан только по явной команде</span><input readOnly value={revealedInboundKey} aria-label="Текущий ключ входящего обмена 1С" /></label>}<small className="onec-inbound-status">{inboundStatus.data?.lastAcceptedAt ? `Последний принятый пакет: ${dateTime(inboundStatus.data.lastAcceptedAt)}` : inboundStatus.data?.configured ? "Пакетов по ключу ещё не принято." : "До задания ключа внешний приёмник отклоняет все запросы."}</small></section>
    <section className="packet-card onec-developer-task"><div className="card-title"><div><span>ЗАДАНИЕ РАЗРАБОТЧИКУ 1С</span><h3>Формат автоматической выгрузки</h3></div></div><p className="packet-note">Внутреннее ТЗ не публикуется в исходном коде. Передавайте разработчику 1С его защищенную копию вместе с адресом приёмника и отдельным ключом доступа.</p></section>
    <section className="onec-summary-grid" aria-label="Сводка импортированных складов 1С">
      {warehouseSummary.map(item => <article className="packet-card onec-summary-card" key={item.warehouse}><span>{warehouseLabel(item.warehouse)}</span><strong>{item.positions}</strong><small>сопоставленных позиций{item.lastDate ? ` · срез ${dateText(item.lastDate)}` : " · срез еще не загружен"}</small><b>{item.positions ? `${qtyText(item.quantity)} ед. учета` : ""}</b></article>)}
      <article className="packet-card onec-summary-card"><span>НАКЛАДНЫЕ</span><strong>{shipmentRows.length}</strong><small>последних импортированных документов</small><b>{shipmentRows.filter(row => row.mappingState === "mapped").length} сопоставлено</b></article>
      <article className="packet-card onec-summary-card"><span>ЗАКУПОЧНЫЕ ЦЕНЫ</span><strong>{purchaseCostRows.length}</strong><small>строк 1С в отдельном реестре</small><b>{purchaseCostRows.filter(row => row.appliedToCatalogAt).length} применено явно</b></article>
      <article className="packet-card onec-summary-card onec-risk"><span>КАРАНТИН</span><strong>{quarantineRows.length}</strong><small>строк без подтвержденного соответствия</small><b>не влияет на остатки</b></article>
    </section>
    <section className="packet-card onec-warehouse-mapping" aria-labelledby="onec-warehouse-mapping-title"><div className="card-title"><div><span>НАСТРОЙКА РЕКОМЕНДАЦИЙ</span><h3 id="onec-warehouse-mapping-title">Источники БМ и СРС</h3></div><small>Только для рекомендации заявки</small></div><p className="packet-note">Назначьте, какой группе магазинов показывать остаток каждого источника 1С в рекомендациях. Это не настройка печати, не создаёт движение и не меняет фактический остаток.</p>{onecWarehouseMappings.isLoading || printGroups.isLoading ? <p className="packet-note">Загружаем связи источников 1С…</p> : onecWarehouseMappings.isError || printGroups.isError ? <p className="packet-note">Связи источников 1С сейчас недоступны.</p> : <div className="onec-warehouse-mapping-grid">{onecMappings.map(mapping => <label key={mapping.warehouseCode}><span>{mapping.warehouseCode === "BM" ? "БМ" : "СРС"}</span><ThemedSelect value={mapping.printGroupId ? String(mapping.printGroupId) : ""} disabled={setOnecWarehouseGroup.isPending} onChange={event => setOnecWarehouseGroup.mutate({ warehouseCode: mapping.warehouseCode, printGroupId: event.target.value ? Number(event.target.value) : null })}><option value="">Не связан</option>{activePrintGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</ThemedSelect><small>{mapping.printGroupName ? `Получатели рекомендаций: ${mapping.printGroupName}` : "Рекомендации по этому источнику пока не выводятся."}</small></label>)}</div>}</section>
      <section className="packet-card onec-registry-card"><div className="card-title"><div><span><Boxes size={15}/> ОСТАТКИ ОСНОВНЫХ СКЛАДОВ</span><h3>Последние импортированные строки основных складов</h3></div><small>Только read-only срезы 1С</small></div>{snapshots.isLoading ? <p className="packet-note">Загружаем срезы…</p> : !snapshotRows.length ? <p className="packet-note">Срезов основных складов пока нет.</p> : <div className="data-table-wrap onec-table-wrap"><table className="data-table onec-table"><thead><tr><th>Склад</th><th>Товар</th><th>Факт</th><th>Доступно</th><th>Срок</th><th>Дата среза</th><th>Статус</th></tr></thead><tbody>{snapshotRows.map(row => <tr key={row.id}><td data-label="Склад"><strong>{warehouseLabel(row.warehouseCode)}</strong></td><td data-label="Товар">{row.productName ?? "Товар ожидает сопоставления"}</td><td data-label="Факт">{qtyText(row.quantityOnHand)}</td><td data-label="Доступно">{qtyText(row.quantityAvailable)}</td><td data-label="Срок">{expirationText(row.expirationDate)}</td><td data-label="Дата среза">{dateText(row.businessDate)}</td><td data-label="Статус"><span className={`onec-state ${row.mappingState}`}>{row.mappingState === "mapped" ? "Сопоставлен" : "Карантин"}</span></td></tr>)}</tbody></table></div>}</section>
    <section className="packet-card onec-registry-card"><div className="card-title"><div><span><CircleDollarSign size={15}/> ЗАКУПОЧНЫЕ ЦЕНЫ 1С</span><h3>Отдельный реестр до явного применения</h3></div><small>БМ и СРС не смешиваются</small></div><p className="packet-note">Строка 1С не меняет себестоимость сама. Администратор выбирает конкретную сопоставленную цену; только после этого она становится внутренней себестоимостью товара. В Эвотор цена уйдёт лишь если флаг передачи закупочной цены включён в карточке товара.</p>{purchaseCosts.isLoading ? <p className="packet-note">Загружаем закупочные цены…</p> : !purchaseCostRows.length ? <p className="packet-note">Закупочные цены из 1С пока не получены.</p> : <div className="data-table-wrap onec-table-wrap"><table className="data-table onec-table"><thead><tr><th>Дата</th><th>Источник</th><th>Товар</th><th>Цена</th><th>Ед.</th><th>Основание</th><th>Статус</th><th/></tr></thead><tbody>{purchaseCostRows.map(row => <tr key={row.id}><td data-label="Дата">{dateText(row.effectiveDate)}</td><td data-label="Источник">{row.warehouseCode ? warehouseLabel(row.warehouseCode) : "Общая цена 1С"}</td><td data-label="Товар">{row.productName ?? "Товар ожидает сопоставления"}</td><td data-label="Цена"><strong>{costText(row.purchasePrice)}</strong></td><td data-label="Ед.">{row.unit === "piece" ? "шт" : row.unit}</td><td data-label="Основание">{row.basis ?? "—"}</td><td data-label="Статус">{row.mappingState === "quarantined" ? <span className="onec-state quarantined">Карантин</span> : row.appliedToCatalogAt ? <span className="onec-state mapped">Применена</span> : <span className="onec-state mixed">Ожидает решения</span>}</td><td data-label="Действие">{row.mappingState === "mapped" && !row.appliedToCatalogAt && <button type="button" className="subtle-button" disabled={applyPurchaseCost.isPending} onClick={() => applyPurchaseCost.mutate({ costId: row.id })}><CircleDollarSign size={14}/>{applyPurchaseCost.isPending ? "Применяем…" : "Применить"}</button>}</td></tr>)}</tbody></table></div>}</section>
    <section className="packet-card onec-registry-card">
      <div className="card-title"><div><span><FileSpreadsheet size={15}/> РАСХОДНЫЕ НАКЛАДНЫЕ</span><h3>От основных складов к магазинам</h3></div><small>Документы не проводят остатки автоматически</small></div>
      {shipments.isLoading ? <p className="packet-note">Загружаем накладные…</p> : !shipmentRows.length ? <p className="packet-note">Расходных накладных из 1С пока нет.</p> : <div className="data-table-wrap onec-table-wrap"><table className="data-table onec-table"><thead><tr><th>Дата</th><th>Откуда</th><th>Номер</th><th>Получатель</th><th>Статус 1С</th><th>Сопоставление</th><th/></tr></thead><tbody>{shipmentRows.map(row => <tr key={row.id}><td data-label="Дата">{dateText(row.businessDate)}</td><td data-label="Откуда"><strong>{warehouseLabel(row.originWarehouseCode)}</strong></td><td data-label="Номер">{row.documentNumber ?? "Без номера"}</td><td data-label="Получатель">{row.destinationStoreName ?? "Ожидает назначения"}</td><td data-label="Статус 1С">{row.sourceStatus}</td><td data-label="Сопоставление"><span className={`onec-state ${row.mappingState}`}>{row.mappingState === "mapped" ? "Готово" : row.mappingState === "unmapped" ? "Получатель не назначен" : "Требуется товар"}</span></td><td data-label="Действие">{row.mappingState === "mapped" ? <button type="button" className="subtle-button" onClick={() => setSelectedShipmentId(row.id)}><PackageCheck size={14}/>Партии и сроки</button> : row.mappingState === "unmapped" && <div className="onec-inline-map"><ThemedSelect searchable searchPlaceholder="Найти магазин" value={selectedStores[row.id] ?? ""} onChange={event => setSelectedStores(current => ({ ...current, [row.id]: event.target.value }))}><option value="">Назначить магазин</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</ThemedSelect><button type="button" className="subtle-button" disabled={!selectedStores[row.id] || resolveDestination.isPending} onClick={() => resolveDestination.mutate({ shipmentId: row.id, storeId: Number(selectedStores[row.id]) })}><Link2 size={14}/>Связать</button></div>}</td></tr>)}</tbody></table></div>}
      {selectedShipmentId !== null && <div className="onec-shipment-detail"><div className="card-title"><div><span>ПАРТИИ НАКЛАДНОЙ</span><h3>Товары и срок годности</h3></div><button type="button" className="subtle-button" onClick={() => setSelectedShipmentId(null)}><X size={14}/>Закрыть</button></div>{shipmentLines.isLoading ? <p className="packet-note">Загружаем состав накладной…</p> : !shipmentLineRows.length ? <p className="packet-note">В этой накладной нет доступных строк.</p> : <div className="data-table-wrap onec-table-wrap"><table className="data-table onec-table"><thead><tr><th>Товар</th><th>Количество</th><th>Ед.</th><th>Срок</th><th>Статус</th></tr></thead><tbody>{shipmentLineRows.map(line => <tr key={line.id}><td data-label="Товар">{line.productName ?? "Товар ожидает сопоставления"}</td><td data-label="Количество">{qtyText(line.quantity)}</td><td data-label="Ед.">{line.unit === "piece" ? "шт" : line.unit}</td><td data-label="Срок">{expirationText(line.expirationDate)}</td><td data-label="Статус"><span className={`onec-state ${line.mappingState}`}>{line.mappingState === "mapped" ? "Сопоставлен" : "Карантин"}</span></td></tr>)}</tbody></table></div>}</div>}
    </section>
    <section className="packet-card onec-quarantine-card"><div className="card-title"><div><span><PackageCheck size={15}/> КАРАНТИН СОПОСТАВЛЕНИЯ</span><h3>Подтвердите товар один раз</h3></div><small>Без сопоставления строка не используется</small></div>{quarantine.isLoading ? <p className="packet-note">Проверяем карантин…</p> : !quarantineRows.length ? <p className="packet-note">Нет строк, ожидающих сопоставления.</p> : <div className="onec-quarantine-list">{quarantineRows.map(row => <article key={`${row.kind}-${row.id}`}><div><span>{row.kind === "snapshot" ? "Остаток БМ/СРС" : row.kind === "purchase_cost" ? "Закупочная цена" : "Строка накладной"}</span><strong>{row.productName ?? "Наименование не передано 1С"}</strong><small>Выберите товар общего справочника; технический идентификатор 1С не показывается.</small></div><div className="onec-inline-map"><ThemedSelect searchable searchPlaceholder="Найти товар или №" value={selectedProducts[`${row.kind}-${row.id}`] ?? ""} onChange={event => setSelectedProducts(current => ({ ...current, [`${row.kind}-${row.id}`]: event.target.value }))}><option value="">Выберите товар</option>{products.map(product => <option key={product.id} value={product.id}>№ {product.catalogNumber} · {product.canonicalName}</option>)}</ThemedSelect><button type="button" className="subtle-button" disabled={!selectedProducts[`${row.kind}-${row.id}`] || resolveProduct.isPending} onClick={() => resolveProduct.mutate({ kind: row.kind, id: row.id, productId: Number(selectedProducts[`${row.kind}-${row.id}`]) })}><Link2 size={14}/>Сопоставить</button></div></article>)}</div>}</section>
    <section className="packet-card onec-history-card"><div className="card-title"><div><span>ИСТОРИЯ ПАКЕТОВ</span><h3>Идемпотентные приемы 1С</h3></div></div>{batches.isLoading ? <p className="packet-note">Загружаем историю…</p> : !batchesRows.length ? <p className="packet-note">Подтвержденных пакетов 1С пока нет.</p> : <div className="data-table-wrap onec-table-wrap"><table className="data-table onec-table"><thead><tr><th>Контур</th><th>Создан</th><th>Всего</th><th>Сопоставлено</th><th>Карантин</th><th>Статус</th></tr></thead><tbody>{batchesRows.map(row => <tr key={row.id}><td data-label="Контур"><strong>{entityLabel[row.entity]}</strong></td><td data-label="Создан">{dateTime(row.createdAt)}</td><td data-label="Всего">{row.totalRecords}</td><td data-label="Сопоставлено">{row.acceptedRecords}</td><td data-label="Карантин">{row.quarantinedRecords}</td><td data-label="Статус"><span className={`onec-state ${row.status}`}>{statusLabel(row.status)}</span></td></tr>)}</tbody></table></div>}</section>
  </AuditShell>;
}
