import { FilePlus2, PencilLine, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/catalog-control.css";

type CatalogUnit = "kg" | "l" | "piece";
type CatalogProduct = { id: number; internalCode: string; canonicalName: string; baseUnit: CatalogUnit; vatRate: "VAT_10" | "VAT_22"; evotorCostPrice?: string | null; internalCostPrice?: string | null; isActive?: boolean };
type EvotorCatalogPreviewItem = { id: string; code: string | null; name: string; barcodes: string[]; unit: string | null; vatRate: "VAT_10" | "VAT_22" };
type EvotorCatalogPreview = { mapping: { storeId: number; internalStoreName: string; evotorStoreName: string }; products: EvotorCatalogPreviewItem[] };
type EvotorStoreMapping = { storeId: number; internalStoreName: string };

const unitLabel: Record<CatalogUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const vatLabel = (value: "VAT_10" | "VAT_22") => value === "VAT_22" ? "НДС 22%" : "НДС 10%";

export default function CatalogControl() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const [storeId, setStoreId] = useState("");
  const [previewSearch, setPreviewSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [visiblePreview, setVisiblePreview] = useState(40);
  const [visibleCatalog, setVisibleCatalog] = useState(40);
  const [costDrafts, setCostDrafts] = useState<Record<number, string>>({});
  const [editId, setEditId] = useState<number>();
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState<CatalogUnit>("kg");
  const [editVat, setEditVat] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState<CatalogUnit>("kg");
  const [manualVat, setManualVat] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [showManual, setShowManual] = useState(false);
  const selectedStoreId = Number(storeId);
  const evotorPreview = trpc.evotorCatalog.previewForStore.useQuery({ storeId: selectedStoreId || 0 }, { enabled: isAdmin && Boolean(selectedStoreId), retry: false });
  const evotorMapping = trpc.evotorCatalog.mappingForStore.useQuery({ storeId: selectedStoreId || 0 }, { enabled: isAdmin && Boolean(selectedStoreId), retry: false });
  const products = trpc.inventoryRegistry.products.useQuery({ storeId: selectedStoreId || undefined }, { enabled: isAdmin && Boolean(selectedStoreId), retry: false });

  useEffect(() => {
    if (!storeId && stores.data?.length && isAdmin) setStoreId(String(stores.data[0].id));
  }, [isAdmin, storeId, stores.data]);
  useEffect(() => { setVisiblePreview(40); setVisibleCatalog(40); setCatalogSearch(""); setPreviewSearch(""); setEditId(undefined); }, [storeId]);

  const previewRows = useMemo(() => {
    const search = previewSearch.trim().toLocaleLowerCase("ru-RU");
    const rows = ((evotorPreview.data as EvotorCatalogPreview | undefined)?.products ?? []);
    return search ? rows.filter(product => `${product.name} ${product.code ?? ""} ${product.barcodes.join(" ")}`.toLocaleLowerCase("ru-RU").includes(search)) : rows;
  }, [evotorPreview.data, previewSearch]);
  const catalogRows = useMemo(() => {
    const search = catalogSearch.trim().toLocaleLowerCase("ru-RU");
    const rows = (products.data ?? []) as CatalogProduct[];
    return search ? rows.filter(product => `${product.canonicalName} ${product.internalCode}`.toLocaleLowerCase("ru-RU").includes(search)) : rows;
  }, [catalogSearch, products.data]);
  const visibleStores = (stores.data ?? []).filter(store => !store.isHidden);
  const refreshCatalog = async () => { await Promise.all([utils.inventoryRegistry.products.invalidate(), utils.inventoryRegistry.stock.invalidate(), utils.audit.changes.invalidate()]); };
  const confirmEvotor = trpc.inventoryRegistry.confirmEvotorCatalog.useMutation({ onSuccess: async result => { await refreshCatalog(); toast.success("Номенклатура обновлена", { description: `${result.imported} позиций закреплены только во внутреннем операционном справочнике.` }); }, onError: error => toast.error("Номенклатура не сохранена", { description: error.message }) });
  const updateCost = trpc.inventoryRegistry.updateInternalCost.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Внутренняя себестоимость сохранена"); }, onError: error => toast.error("Себестоимость не сохранена", { description: error.message }) });
  const createProduct = trpc.inventoryRegistry.createCatalogProduct.useMutation({ onSuccess: async () => { setManualName(""); setManualUnit("kg"); setManualVat("VAT_10"); setShowManual(false); await refreshCatalog(); toast.success("Товар добавлен в рабочую номенклатуру"); }, onError: error => toast.error("Товар не добавлен", { description: error.message }) });
  const updateProduct = trpc.inventoryRegistry.updateCatalogProduct.useMutation({ onSuccess: async () => { setEditId(undefined); await refreshCatalog(); toast.success("Номенклатура изменена"); }, onError: error => toast.error("Товар не изменен", { description: error.message }) });
  const archiveProduct = trpc.inventoryRegistry.archiveCatalogProduct.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Товар скрыт из рабочего списка"); }, onError: error => toast.error("Товар не скрыт", { description: error.message }) });
  const openEditor = (product: CatalogProduct) => { setEditId(product.id); setEditName(product.canonicalName); setEditUnit(product.baseUnit); setEditVat(product.vatRate); };

  if (!me.isLoading && !isAdmin) return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура"><section className="empty-state"><ShieldCheck size={28}/><h2>Управление номенклатурой доступно администратору</h2><p>Продавцы и руководители используют подтвержденный рабочий справочник только при ревизии и не видят себестоимость.</p></section></AuditShell>;
  return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура">
    <section className="page-lede catalog-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Номенклатура магазинов</h2><p>Отдельный справочник операционного контура. Каталог Эвотор только считывается и подтверждается здесь; созданные вручную позиции и внутренние значения не отправляются обратно в кассу.</p></div></section>
    <section className="packet-card catalog-store-card"><label>Магазин<ThemedSelect value={storeId} onChange={event => setStoreId(event.target.value)}><option value="">Выберите магазин</option>{visibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label>{selectedStoreId && <div className="catalog-mapping"><span>Соответствие Эвотор</span><strong>{evotorMapping.data ? `${(evotorMapping.data as EvotorStoreMapping).internalStoreName} ↔ назначенная касса` : evotorMapping.isError ? "Не задано" : "Проверяем…"}</strong></div>}</section>
    {selectedStoreId && <section className="packet-card catalog-preview-card"><div className="card-title"><div><span>ЭВОТОР · READ-ONLY</span><h3>Номенклатура кассы</h3></div></div><p className="packet-note">Для выбранной внутренней точки доступен только ее закрепленный магазин Эвотор. Данные из кассы не изменяются. НДС отображается, «Себестоимость Эвотор» равна 0 и не выводится.</p><label>Поиск в каталоге Эвотор<div className="catalog-search"><input value={previewSearch} onChange={event => { setPreviewSearch(event.target.value); setVisiblePreview(40); }} placeholder="Название, код или штрихкод"/><Search size={15}/></div></label>{evotorPreview.isLoading ? <p className="packet-note">Читаем каталог назначенной кассы…</p> : evotorPreview.isError ? <p className="packet-note">Каталог недоступен: {evotorPreview.error.message}</p> : evotorPreview.data ? <><div className="catalog-preview-summary"><strong>{previewRows.length} позиций</strong><span>только просмотр перед подтверждением</span></div><div className="catalog-preview-list">{previewRows.slice(0, visiblePreview).map((product, index) => <article key={product.id}><span>№ {index + 1}</span><div><strong>{product.name}</strong><small>{[product.code, product.unit === "дроб" ? "кг" : product.unit, vatLabel(product.vatRate)].filter(Boolean).join(" · ")}</small></div><small>{product.barcodes.length ? `${product.barcodes.length} штрихкодов` : "Без штрихкода"}</small></article>)}</div>{visiblePreview < previewRows.length && <button type="button" className="subtle-button" onClick={() => setVisiblePreview(limit => limit + 40)}>Показать еще</button>}<button type="button" className="packet-link compact" onClick={() => confirmEvotor.mutate({ storeId: selectedStoreId })} disabled={confirmEvotor.isPending}>{confirmEvotor.isPending ? "Сохраняем…" : `Подтвердить ${((evotorPreview.data as EvotorCatalogPreview).products ?? []).length} позиций`}</button></> : null}</section>}
    {selectedStoreId && <section className="packet-card catalog-working-card"><div className="card-title"><div><span>РАБОЧАЯ НОМЕНКЛАТУРА</span><h3>Товары выбранного магазина</h3></div><button type="button" className="subtle-button" onClick={() => setShowManual(value => !value)}><FilePlus2 size={15}/>{showManual ? "Скрыть форму" : "Добавить товар"}</button></div><p className="packet-note">Изменение имени, единицы, НДС или себестоимости влияет только на рабочий операционный справочник. Удаление заменено скрытием: прошлые ревизии и журнал остаются точными.</p>{showManual && <form className="catalog-manual-form" onSubmit={event => { event.preventDefault(); createProduct.mutate({ storeId: selectedStoreId, canonicalName: manualName, baseUnit: manualUnit, vatRate: manualVat }); }}><label>Название<input value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Новый товар" required/></label><label>Единица<ThemedSelect value={manualUnit} onChange={event => setManualUnit(event.target.value as CatalogUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={manualVat} onChange={event => setManualVat(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><button className="packet-link" disabled={createProduct.isPending}>{createProduct.isPending ? "Добавляем…" : "Добавить"}</button></form>}<label>Поиск товара<div className="catalog-search"><input value={catalogSearch} onChange={event => { setCatalogSearch(event.target.value); setVisibleCatalog(40); }} placeholder="Название или код"/><Search size={15}/></div></label>{products.isLoading ? <p className="packet-note">Загружаем рабочую номенклатуру…</p> : <><div className="catalog-preview-summary"><strong>{catalogRows.length} позиций</strong><span>скрытые позиции не попадают в ревизию</span></div><div className="catalog-working-list">{catalogRows.slice(0, visibleCatalog).map(product => <article key={product.id} className={product.isActive === false ? "is-archived" : ""}>{editId === product.id ? <form className="catalog-edit-form" onSubmit={event => { event.preventDefault(); updateProduct.mutate({ id: product.id, canonicalName: editName, baseUnit: editUnit, vatRate: editVat }); }}><label>Название<input value={editName} onChange={event => setEditName(event.target.value)} required/></label><label>Единица<ThemedSelect value={editUnit} onChange={event => setEditUnit(event.target.value as CatalogUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={editVat} onChange={event => setEditVat(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><button className="packet-link" disabled={updateProduct.isPending}>{updateProduct.isPending ? "Сохраняем…" : "Сохранить"}</button><button type="button" className="subtle-button" onClick={() => setEditId(undefined)}>Отмена</button></form> : <><div className="catalog-product-name"><strong>{product.canonicalName}</strong><small>{product.internalCode} · {unitLabel[product.baseUnit]} · {vatLabel(product.vatRate)}{product.isActive === false ? " · скрыт" : ""}</small></div><label className="catalog-cost">Внутренняя себестоимость<input data-decimal-input value={costDrafts[product.id] ?? product.internalCostPrice ?? ""} onChange={event => setCostDrafts(current => ({ ...current, [product.id]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label><div className="catalog-product-actions"><button type="button" className="subtle-button" onClick={() => openEditor(product)}><PencilLine size={14}/>Изменить</button><button type="button" className="subtle-button" disabled={updateCost.isPending} onClick={() => { const text = (costDrafts[product.id] ?? product.internalCostPrice ?? "").trim(); const value = text ? Number(text) : null; if (value !== null && (!Number.isFinite(value) || value < 0)) { toast.error("Введите неотрицательную себестоимость."); return; } updateCost.mutate({ id: product.id, internalCostPrice: value }); }}>Себестоимость</button>{product.isActive !== false && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={archiveProduct.isPending}><Trash2 size={14}/>Скрыть</button>} title="Скрыть товар?" description="Товар перестанет отображаться в рабочей номенклатуре и в новых ревизиях. История закрытых пересчетов и журнал останутся неизменными." confirmLabel="Скрыть товар" disabled={archiveProduct.isPending} onConfirm={() => archiveProduct.mutate({ id: product.id })}/>}</div></>}</article>)}</div>{visibleCatalog < catalogRows.length && <button type="button" className="subtle-button" onClick={() => setVisibleCatalog(limit => limit + 40)}>Показать еще</button>}</>}</section>}
  </AuditShell>;
}
