import { Building2, ChevronUp, Eye, EyeOff, Link2, Pencil, Search, Tags, Warehouse } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import "@/warehouse-control.css";

type PriceType = { id: number; name: string; isDefault: boolean; isActive: boolean };
type EvotorStoreChoice = { id: string; name: string };
type WarehouseRow = { storeId: number; storeName: string; isHidden: boolean; priceTypeId: number | null; priceTypeName: string | null; hasEvotorMapping: boolean; evotorStoreName?: string | null; evotorTerminalUuid?: string | null; evotorLinkedProductCount: number };

/** Cloud preview can append a street address; operation UI never reveals it. */
const safeEvotorStoreLabel = (name: string, position: number) => {
  const concise = name.split(/,\s*(?:ул\.?|пр-?т|проспект|шоссе|пер(?:е)?ул(?:ок)?|д\.?|дом\b)/i)[0]?.trim();
  return concise && concise.length >= 2 ? concise : `Точка Эвотор ${position + 1}`;
};

export default function WarehouseControl() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const warehouses = trpc.inventoryRegistry.warehouses.useQuery(undefined, { enabled: isAdmin, retry: false });
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const evotorChoices = trpc.inventoryRegistry.evotorStoreChoices.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [evotorDrafts, setEvotorDrafts] = useState<Record<number, string>>({});
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<"all" | "mapped" | "not_mapped">("all");
  const [showHidden, setShowHidden] = useState(false);
  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(type => type.isActive);
  const rows = (warehouses.data ?? []) as WarehouseRow[];
  const choices = (evotorChoices.data ?? []) as EvotorStoreChoice[];
  const evotorUidRows = useMemo(() => {
    const mappedByUid = new Map(rows.filter(row => row.evotorTerminalUuid?.trim()).map(row => [row.evotorTerminalUuid!.trim(), row.storeName]));
    const fromSource = choices.map((choice, index) => ({ id: choice.id, name: safeEvotorStoreLabel(choice.name, index), mappedStoreName: mappedByUid.get(choice.id) ?? null }));
    const returnedIds = new Set(fromSource.map(row => row.id));
    const retainedMappings = rows
      .filter(row => row.evotorTerminalUuid?.trim() && !returnedIds.has(row.evotorTerminalUuid.trim()))
      .map(row => ({ id: row.evotorTerminalUuid!.trim(), name: row.evotorStoreName ?? row.storeName, mappedStoreName: row.storeName }));
    return [...fromSource, ...retainedMappings];
  }, [choices, rows]);
  const visibleRows = useMemo(() => {
    const query = warehouseSearch.trim().toLocaleLowerCase("ru-RU");
    return rows.filter(row => showHidden || !row.isHidden).filter(row => warehouseFilter === "all" || (warehouseFilter === "mapped" ? row.hasEvotorMapping : !row.hasEvotorMapping)).filter(row => !query || row.storeName.toLocaleLowerCase("ru-RU").includes(query));
  }, [rows, showHidden, warehouseFilter, warehouseSearch]);
  useEffect(() => {
    setPriceDrafts(current => { const next = { ...current }; for (const row of rows) if (next[row.storeId] === undefined) next[row.storeId] = row.priceTypeId ? String(row.priceTypeId) : ""; return next; });
    setEvotorDrafts(current => { const next = { ...current }; for (const row of rows) if (next[row.storeId] === undefined) next[row.storeId] = choices.find(choice => choice.name === row.evotorStoreName)?.id ?? ""; return next; });
  }, [rows, choices]);
  const invalidateWarehouse = () => Promise.all([utils.inventoryRegistry.warehouses.invalidate(), utils.inventoryRegistry.stock.invalidate(), utils.audit.changes.invalidate()]);
  const assignPriceType = trpc.inventoryRegistry.setStorePriceType.useMutation({ onSuccess: async () => { await invalidateWarehouse(); toast.success("Вид цены сохранен"); }, onError: error => toast.error("Вид цены не сохранен", { description: error.message }) });
  const assignEvotorMapping = trpc.inventoryRegistry.setWarehouseEvotorMapping.useMutation({ onSuccess: async () => { await invalidateWarehouse(); toast.success("Магазин Эвотор закреплен за складом"); }, onError: error => toast.error("Связь с Эвотор не сохранена", { description: error.message }) });
  const setVisibility = trpc.inventoryRegistry.setWarehouseVisibility.useMutation({ onSuccess: async result => { await invalidateWarehouse(); toast.success(result.after.isHidden ? "Склад скрыт из рабочих списков" : "Склад возвращен в рабочие списки"); }, onError: error => toast.error("Видимость склада не изменена", { description: error.message }) });
  if (!me.isLoading && !isAdmin) return <AuditShell kicker="27 / СКЛАДЫ" title="Склады"><section className="empty-state"><Warehouse size={28}/><h2>Склады доступны администратору</h2><p>Продавцы и руководители работают только с назначенными операционными действиями и не видят настройку цен.</p></section></AuditShell>;
  return <AuditShell kicker="27 / СКЛАДЫ" title="Склады">
    <section className="page-lede warehouse-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Склады и виды цен</h2><p>Каждый видимый магазин — склад общего справочника. Номенклатура едина; меняется только назначенный вид продажной цены и закрепленная точка Эвотор.</p></div></section>
    <section className="packet-card warehouse-rule"><div><Link2 size={18}/><div><span>СВЯЗЬ С ЭВОТОР</span><strong>Связь склада задается явно и остается закрепленной</strong><p>Администратор выбирает точку Эвотор только из обнаруженного read-only списка и сохраняет привязку к конкретному складу. Идентификаторы Cloud, адреса и ключи не выводятся. Включённые позиции и подтверждённые движения остатка передаются в Эвотор через audit-ируемую очередь с последующей сверкой.</p></div></div></section>
    <section className="packet-card warehouse-table-card">
      <div className="card-title">
        <div><span>СКЛАДЫ СЕТИ</span><h3>{visibleRows.length} {visibleRows.length === 1 ? "склад" : visibleRows.length < 5 ? "склада" : "складов"}</h3></div>
        <small>Изменение открывает параметры только выбранного склада</small>
      </div>
      <div className="warehouse-filters">
        <label className="warehouse-search"><Search size={15}/><input value={warehouseSearch} onChange={event => setWarehouseSearch(event.target.value)} placeholder="Поиск склада / магазина" aria-label="Поиск склада или магазина"/></label>
        <label>Показывать<ThemedSelect value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value as "all" | "mapped" | "not_mapped")}><option value="all">Все рабочие склады</option><option value="mapped">Только закрепленные Эвотор</option><option value="not_mapped">Без закрепления Эвотор</option></ThemedSelect></label>
        <button type="button" className={showHidden ? "subtle-button warehouse-hidden-toggle is-active" : "subtle-button warehouse-hidden-toggle"} aria-pressed={showHidden} onClick={() => setShowHidden(current => !current)}>{showHidden ? <EyeOff size={15}/> : <Eye size={15}/>}{showHidden ? "Скрытые показаны" : "Показать скрытые"}</button>
      </div>
      {warehouses.isLoading || priceTypes.isLoading || evotorChoices.isLoading ? <p className="packet-note">Загружаем настройки складов…</p> : warehouses.isError ? <p className="packet-note">Склады недоступны: {warehouses.error.message}</p> : <div className="data-table-wrap warehouse-table-wrap" data-drag-scroll="false">
        <table className="data-table warehouse-table"><thead><tr><th>Склад / магазин</th><th>Вид цены</th><th>Эвотор</th><th aria-label="Настройка"/></tr></thead><tbody>{visibleRows.map(row => <Fragment key={row.storeId}>
          <tr className={row.isHidden ? "warehouse-row is-hidden" : undefined}>
            <td data-label="Склад / магазин"><strong>{row.storeName}</strong>{row.isHidden && <small className="warehouse-hidden-note">Скрыт из рабочих списков</small>}</td>
            <td data-label="Вид цены">{row.priceTypeName ?? "Не назначен"}</td>
            <td data-label="Эвотор"><span className={row.hasEvotorMapping ? "warehouse-status is-linked" : "warehouse-status"}>{row.hasEvotorMapping ? <><Link2 size={14}/>Закреплен</> : "Не задан"}</span></td>
            <td data-label="Действие"><div className="warehouse-row-actions">
              <button type="button" className="subtle-button warehouse-edit" onClick={() => setEditingStoreId(current => current === row.storeId ? null : row.storeId)}>{editingStoreId === row.storeId ? <ChevronUp size={14}/> : <Pencil size={14}/>} {editingStoreId === row.storeId ? "Свернуть" : "Изменить"}</button>
              <button type="button" className="subtle-button warehouse-visibility" disabled={setVisibility.isPending} onClick={() => setVisibility.mutate({ storeId: row.storeId, isHidden: !row.isHidden })}>{row.isHidden ? <Eye size={14}/> : <EyeOff size={14}/>}{row.isHidden ? "Вернуть" : "Скрыть"}</button>
            </div></td>
          </tr>
          {editingStoreId === row.storeId && <tr className="warehouse-settings-row"><td colSpan={4}><div className="warehouse-settings-grid">
            <label>Вид продажной цены<ThemedSelect value={priceDrafts[row.storeId] ?? ""} onChange={event => { const value = event.target.value; setPriceDrafts(current => ({ ...current, [row.storeId]: value })); if (value && Number(value) !== row.priceTypeId) assignPriceType.mutate({ storeId: row.storeId, priceTypeId: Number(value) }); }}><option value="" disabled>Выберите вид цены</option>{activePriceTypes.map(type => <option value={type.id} key={type.id}>{type.name}{type.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></label>
            <label>Магазин Эвотор<ThemedSelect searchable searchPlaceholder="Найти точку Эвотор" value={evotorDrafts[row.storeId] ?? ""} onChange={event => { const value = event.target.value; setEvotorDrafts(current => ({ ...current, [row.storeId]: value })); if (value) assignEvotorMapping.mutate({ storeId: row.storeId, evotorStoreId: value }); }}><option value="" disabled>Выберите точку из Эвотор</option>{choices.map((choice, index) => <option value={choice.id} key={choice.id}>{safeEvotorStoreLabel(choice.name, index)}</option>)}</ThemedSelect></label>
	            <p className="warehouse-settings-note">Настройки сохраняются при выборе. Эвотор читает каталог и чеки автоматически; включённая в номенклатуре позиция передаётся обратно после изменения товара или подтверждённого движения остатка.</p>
          </div></td></tr>}
        </Fragment>)}</tbody></table>
      </div>}
    </section>
    <section className="packet-card warehouse-evotor-uids" aria-labelledby="warehouse-evotor-uids-title">
      <div className="card-title"><div><span>ЭВОТОР · READ‑ONLY</span><h3 id="warehouse-evotor-uids-title">Статус связей с Эвотор</h3></div><small>{evotorUidRows.length} точек · {evotorUidRows.filter(row => row.mappedStoreName).length} закреплено</small></div>
      {evotorChoices.isLoading ? <p className="packet-note">Загружаем статус связей Эвотор…</p> : evotorChoices.isError ? <p className="packet-note">Статус связей Эвотор сейчас не прочитан: {evotorChoices.error.message}</p> : evotorUidRows.length ? <div className="warehouse-evotor-link-summary"><article><strong>{evotorUidRows.length}</strong><span>обнаружено точек Эвотор</span></article><article><strong>{evotorUidRows.filter(row => row.mappedStoreName).length}</strong><span>закреплено за складами</span></article><article><strong>{evotorUidRows.filter(row => !row.mappedStoreName).length}</strong><span>требуют явного сопоставления</span></article></div> : <p className="packet-note">Эвотор не вернул доступных точек.</p>}
      <p className="warehouse-evotor-uid-note">Показывается только безопасный итог read-only сверки. Идентификаторы Cloud, адреса и ключи в интерфейс не выводятся.</p>
    </section>
    <section className="warehouse-guidance"><article><Building2 size={18}/><div><span>ОБЩИЙ СПРАВОЧНИК</span><strong>Товар не дублируется по магазинам</strong><p>Наименование, категория, НДС, маркировка, штрихкоды и внутренняя себестоимость задаются один раз в «Номенклатуре».</p></div></article><article><Tags size={18}/><div><span>ПЕЧАТЬ ЗАЯВОК</span><strong>Настраивается отдельно</strong><p>Группы магазинов и категории печати собраны в отдельной странице «Настройки печати».</p></div></article></section>
  </AuditShell>;
}
