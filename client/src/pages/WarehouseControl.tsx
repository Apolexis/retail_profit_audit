import { Building2, Download, Link2, RefreshCw, Save, Search, Tags, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import "@/warehouse-control.css";

type PriceType = { id: number; name: string; isDefault: boolean; isActive: boolean };
type WarehouseRow = { storeId: number; storeName: string; isHidden: boolean; priceTypeId: number | null; priceTypeName: string | null; hasEvotorMapping: boolean; evotorLinkedProductCount: number };

export default function WarehouseControl() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const warehouses = trpc.inventoryRegistry.warehouses.useQuery(undefined, { enabled: isAdmin, retry: false });
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<"all" | "mapped" | "not_mapped">("all");

  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(type => type.isActive);
  const rows = (warehouses.data ?? []) as WarehouseRow[];
  const visibleRows = useMemo(() => {
    const query = warehouseSearch.trim().toLocaleLowerCase("ru-RU");
    return rows.filter(row => !row.isHidden).filter(row => warehouseFilter === "all" || (warehouseFilter === "mapped" ? row.hasEvotorMapping : !row.hasEvotorMapping)).filter(row => !query || row.storeName.toLocaleLowerCase("ru-RU").includes(query));
  }, [rows, warehouseFilter, warehouseSearch]);
  useEffect(() => {
    setDrafts(current => {
      const next = { ...current };
      for (const row of rows) {
        if (next[row.storeId] === undefined) next[row.storeId] = row.priceTypeId ? String(row.priceTypeId) : "";
      }
      return next;
    });
  }, [warehouses.data]);

  const assignPriceType = trpc.inventoryRegistry.setStorePriceType.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.inventoryRegistry.warehouses.invalidate(), utils.inventoryRegistry.stock.invalidate(), utils.audit.changes.invalidate()]);
      toast.success("Вид цены назначен складу");
    },
    onError: error => toast.error("Вид цены не назначен", { description: error.message }),
  });
  const syncDocuments = trpc.inventoryRegistry.syncEvotorDocumentPage.useMutation({
    onSuccess: result => toast.success(result.completed ? "Документы Эвотор загружены" : "Загружена следующая страница документов", { description: `${result.readDocuments} документов · ${result.readPositions} позиций` }),
    onError: error => toast.error("Документы Эвотор не загружены", { description: error.message }),
  });
  const refreshEvotorCatalog = trpc.inventoryRegistry.confirmEvotorCatalog.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.inventoryRegistry.products.invalidate(), utils.inventoryRegistry.stock.invalidate(), utils.inventoryRegistry.warehouses.invalidate(), utils.audit.changes.invalidate()]);
      toast.success("Каталог Эвотор обновлен", { description: `${result.imported} позиций; категории и штрихкоды обновлены из закрепленной точки.` });
    },
    onError: error => toast.error("Каталог Эвотор не обновлен", { description: error.message }),
  });

  if (!me.isLoading && !isAdmin) {
    return <AuditShell kicker="27 / СКЛАДЫ" title="Склады"><section className="empty-state"><Warehouse size={28}/><h2>Склады доступны администратору</h2><p>Продавцы и руководители работают только с назначенными операционными действиями и не видят настройку цен.</p></section></AuditShell>;
  }

  return <AuditShell kicker="27 / СКЛАДЫ" title="Склады">
    <section className="page-lede warehouse-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Склады и виды цен</h2><p>Каждый магазин — склад общего справочника. Номенклатура едина; различается только назначенный вид продажной цены. Адреса и технические идентификаторы Эвотор здесь не выводятся.</p></div></section>

    <section className="packet-card warehouse-rule"><div><Link2 size={18}/><div><span>READ‑ONLY ЭВОТОР</span><strong>Связь точки закреплена, а не выбирается вручную</strong><p>Список показывает только факт закрепленного соответствия и количество связанных кассовых позиций. Запись в Эвотор, изменение кассы и показ адреса исключены. Документы читаются порциями и сохраняются без фискальных номеров, реквизитов оплат, адресов и технических идентификаторов.</p></div></div></section>

    <section className="packet-card warehouse-table-card"><div className="card-title"><div><span>СКЛАДЫ СЕТИ</span><h3>{visibleRows.length} {visibleRows.length === 1 ? "склад" : visibleRows.length < 5 ? "склада" : "складов"}</h3></div><small>Виды цен управляются в «Номенклатуре»</small></div>
      <div className="warehouse-filters"><label className="warehouse-search"><Search size={15}/><input value={warehouseSearch} onChange={event => setWarehouseSearch(event.target.value)} placeholder="Поиск склада / магазина" aria-label="Поиск склада или магазина"/></label><label>Показывать<ThemedSelect value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value as "all" | "mapped" | "not_mapped")}><option value="all">Все рабочие склады</option><option value="mapped">Только закрепленные Эвотор</option><option value="not_mapped">Без закрепления Эвотор</option></ThemedSelect></label></div>
      {warehouses.isLoading || priceTypes.isLoading ? <p className="packet-note">Загружаем склады и виды цен…</p> : warehouses.isError ? <p className="packet-note">Склады недоступны: {warehouses.error.message}</p> : <><p className="warehouse-result-count">Показано: <strong>{visibleRows.length}</strong></p><div className="data-table-wrap warehouse-table-wrap"><table className="data-table warehouse-table"><thead><tr><th>Склад / магазин</th><th>Вид продажной цены</th><th>Эвотор</th><th aria-label="Действия"></th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.storeId}><td><strong>{row.storeName}</strong></td><td><ThemedSelect value={drafts[row.storeId] ?? ""} onChange={event => setDrafts(current => ({ ...current, [row.storeId]: event.target.value }))}><option value="" disabled>Выберите вид цены</option>{activePriceTypes.map(type => <option value={type.id} key={type.id}>{type.name}{type.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></td><td><span className={row.hasEvotorMapping ? "warehouse-status is-linked" : "warehouse-status"}>{row.hasEvotorMapping ? <><Link2 size={14}/>Закреплен{row.evotorLinkedProductCount ? ` · ${row.evotorLinkedProductCount} поз.` : ""}</> : "Не задан"}</span></td><td><div className="warehouse-actions"><button type="button" className="subtle-button warehouse-save" disabled={!drafts[row.storeId] || Number(drafts[row.storeId]) === row.priceTypeId || assignPriceType.isPending} onClick={() => assignPriceType.mutate({ storeId: row.storeId, priceTypeId: Number(drafts[row.storeId]) })}><Save size={14}/>Сохранить вид цены</button><button type="button" className="subtle-button warehouse-catalog" disabled={!row.hasEvotorMapping || refreshEvotorCatalog.isPending} onClick={() => refreshEvotorCatalog.mutate({ storeId: row.storeId })}><RefreshCw size={14}/>{refreshEvotorCatalog.isPending ? "Обновляем…" : "Обновить каталог"}</button><button type="button" className="subtle-button warehouse-documents" disabled={!row.hasEvotorMapping || syncDocuments.isPending} onClick={() => syncDocuments.mutate({ storeId: row.storeId })}><Download size={14}/>Документы</button></div></td></tr>)}</tbody></table></div></>}
    </section>

    <section className="warehouse-guidance"><article><Building2 size={18}/><div><span>ОБЩИЙ СПРАВОЧНИК</span><strong>Товар не дублируется по магазинам</strong><p>Наименование, НДС, маркировка, ручные штрихкоды и внутренняя себестоимость задаются один раз в «Номенклатуре».</p></div></article><article><Tags size={18}/><div><span>ПРОДАЖНАЯ ЦЕНА</span><strong>Цена хранится по виду, а не по складу</strong><p>Назначьте вид цены магазину здесь, затем заполните цены товаров для этого вида в общей номенклатуре.</p></div></article></section>
  </AuditShell>;
}
