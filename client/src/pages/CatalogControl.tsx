import { Eye, EyeOff, FilePlus2, PencilLine, Save, Search, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/catalog-control.css";

type CatalogUnit = "kg" | "l" | "piece";
type MarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";
type CatalogProduct = { id: number; internalCode: string; canonicalName: string; baseUnit: CatalogUnit; vatRate: "VAT_10" | "VAT_22"; internalCostPrice?: string | null; markingCategory: MarkingCategory; manualBarcodes: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean; isActive?: boolean };
type PriceType = { id: number; name: string; isDefault: boolean; isActive: boolean };
type SalePrice = { productId: number; priceTypeId: number; salePrice: string };

const unitLabel: Record<CatalogUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const vatLabel = (value: "VAT_10" | "VAT_22") => value === "VAT_22" ? "НДС 22%" : "НДС 10%";
const markingOptions: Array<{ value: MarkingCategory; label: string }> = [
  { value: "none", label: "Нет" },
  { value: "supplement", label: "БАД" },
  { value: "seafood_caviar", label: "Морепродукты · икра" },
  { value: "seafood_canned", label: "Морепродукты · консервы" },
  { value: "alcohol", label: "Алкоголь" },
  { value: "beer_marked", label: "Маркированное пиво" },
  { value: "beer_non_alcoholic", label: "Безалкогольное пиво" },
  { value: "soft_drinks", label: "Соковая продукция и безалкогольные напитки" },
  { value: "water", label: "Бутилированная питьевая вода" },
  { value: "dairy", label: "Молоко и молочная продукция" },
];
const markingLabel = (value: MarkingCategory) => markingOptions.find(option => option.value === value)?.label ?? "Нет";

export default function CatalogControl() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const products = trpc.inventoryRegistry.products.useQuery(undefined, { enabled: isAdmin, retry: false });
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [priceTypeId, setPriceTypeId] = useState("");
  const salePrices = trpc.inventoryRegistry.salePrices.useQuery({ priceTypeId: Number(priceTypeId) || undefined }, { enabled: isAdmin, retry: false });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [visibleCatalog, setVisibleCatalog] = useState(40);
  const [showManual, setShowManual] = useState(false);
  const [editId, setEditId] = useState<number>();
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<number, string>>({});
  const [manualName, setManualName] = useState("");
  const [manualUnit, setManualUnit] = useState<CatalogUnit>("kg");
  const [manualVat, setManualVat] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [manualMarking, setManualMarking] = useState<MarkingCategory>("none");
  const [manualBarcodes, setManualBarcodes] = useState("");
  const [manualVisible, setManualVisible] = useState(true);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState<CatalogUnit>("kg");
  const [editVat, setEditVat] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [editMarking, setEditMarking] = useState<MarkingCategory>("none");
  const [editBarcodes, setEditBarcodes] = useState("");
  const [editVisible, setEditVisible] = useState(true);
  const [newPriceTypeName, setNewPriceTypeName] = useState("");
  const [priceTypeDrafts, setPriceTypeDrafts] = useState<Record<number, string>>({});

  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(type => type.isActive);
  useEffect(() => {
    if (priceTypeId || !activePriceTypes.length) return;
    setPriceTypeId(String(activePriceTypes.find(type => type.isDefault)?.id ?? activePriceTypes[0].id));
  }, [activePriceTypes, priceTypeId]);
  useEffect(() => { setVisibleCatalog(40); setPriceDrafts({}); }, [catalogSearch, priceTypeId]);

  const catalogRows = useMemo(() => {
    const query = catalogSearch.trim().toLocaleLowerCase("ru-RU");
    const rows = (products.data ?? []) as CatalogProduct[];
    return query ? rows.filter(product => `${product.canonicalName} ${product.internalCode} ${product.manualBarcodes ?? ""} ${markingLabel(product.markingCategory)}`.toLocaleLowerCase("ru-RU").includes(query)) : rows;
  }, [catalogSearch, products.data]);
  const pricesByProduct = useMemo(() => new Map(((salePrices.data ?? []) as SalePrice[]).map(price => [price.productId, price.salePrice])), [salePrices.data]);
  const selectedPriceType = activePriceTypes.find(type => type.id === Number(priceTypeId));
  const refreshCatalog = async () => { await Promise.all([utils.inventoryRegistry.products.invalidate(), utils.inventoryRegistry.salePrices.invalidate(), utils.inventoryRegistry.priceTypes.invalidate(), utils.inventoryRegistry.stock.invalidate(), utils.audit.changes.invalidate()]); };

  const createProduct = trpc.inventoryRegistry.createCatalogProduct.useMutation({
    onSuccess: async () => { setManualName(""); setManualUnit("kg"); setManualVat("VAT_10"); setManualMarking("none"); setManualBarcodes(""); setManualVisible(true); setShowManual(false); await refreshCatalog(); toast.success("Товар добавлен в общий справочник"); },
    onError: error => toast.error("Товар не добавлен", { description: error.message }),
  });
  const updateProduct = trpc.inventoryRegistry.updateCatalogProduct.useMutation({
    onSuccess: async () => { setEditId(undefined); await refreshCatalog(); toast.success("Карточка товара изменена"); },
    onError: error => toast.error("Карточка товара не изменена", { description: error.message }),
  });
  const archiveProduct = trpc.inventoryRegistry.archiveCatalogProduct.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Товар скрыт из рабочего списка"); }, onError: error => toast.error("Товар не скрыт", { description: error.message }) });
  const updateCost = trpc.inventoryRegistry.updateInternalCost.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Внутренняя себестоимость сохранена"); }, onError: error => toast.error("Себестоимость не сохранена", { description: error.message }) });
  const setSalePrice = trpc.inventoryRegistry.setProductSalePrice.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Продажная цена сохранена"); }, onError: error => toast.error("Продажная цена не сохранена", { description: error.message }) });
  const createPriceType = trpc.inventoryRegistry.createPriceType.useMutation({ onSuccess: async result => { setNewPriceTypeName(""); await refreshCatalog(); setPriceTypeId(String(result.id)); toast.success("Вид цены создан"); }, onError: error => toast.error("Вид цены не создан", { description: error.message }) });
  const updatePriceType = trpc.inventoryRegistry.updatePriceType.useMutation({ onSuccess: async () => { await refreshCatalog(); toast.success("Вид цены изменен"); }, onError: error => toast.error("Вид цены не изменен", { description: error.message }) });
  const deletePriceType = trpc.inventoryRegistry.deletePriceType.useMutation({ onSuccess: async () => { setPriceTypeId(""); await refreshCatalog(); toast.success("Вид цены удален"); }, onError: error => toast.error("Вид цены не удален", { description: error.message }) });

  const openEditor = (product: CatalogProduct) => { setEditId(product.id); setEditName(product.canonicalName); setEditUnit(product.baseUnit); setEditVat(product.vatRate); setEditMarking(product.markingCategory); setEditBarcodes(product.manualBarcodes ?? ""); setEditVisible(product.isVisibleInRequests); };
  const commitCost = (product: CatalogProduct) => {
    const text = (costDrafts[product.id] ?? product.internalCostPrice ?? "").trim();
    const value = text ? Number(text) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0)) { toast.error("Введите неотрицательную себестоимость."); return; }
    updateCost.mutate({ id: product.id, internalCostPrice: value });
  };
  const commitSalePrice = (product: CatalogProduct) => {
    if (!selectedPriceType) { toast.error("Сначала выберите вид цены."); return; }
    const text = (priceDrafts[product.id] ?? pricesByProduct.get(product.id) ?? "").trim();
    const value = text ? Number(text) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0)) { toast.error("Введите неотрицательную продажную цену."); return; }
    setSalePrice.mutate({ productId: product.id, priceTypeId: selectedPriceType.id, salePrice: value });
  };

  if (!me.isLoading && !isAdmin) return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура"><section className="empty-state"><Tag size={28}/><h2>Управление номенклатурой доступно администратору</h2><p>Продавцы и руководители используют общий подтвержденный справочник только в операционных действиях и не видят цены или себестоимость.</p></section></AuditShell>;

  return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура">
    <section className="page-lede catalog-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Общая номенклатура сети</h2><p>Один товар доступен всем магазинам-складам. Различаются только продажные цены по назначенному виду цен. Каталог Эвотор остается отдельным read-only списком на странице «Склад».</p></div></section>

    <section className="packet-card catalog-price-types"><div className="card-title"><div><span>ВИДЫ ЦЕН</span><h3>Продажные цены магазинов</h3></div></div><p className="packet-note">Выберите активный вид для просмотра и ввода цен товара. Назначение вида конкретному магазину выполняется на странице «Склад».</p><div className="catalog-price-type-tools"><label>Вид цены<ThemedSelect value={priceTypeId} onChange={event => setPriceTypeId(event.target.value)}>{activePriceTypes.map(type => <option value={type.id} key={type.id}>{type.name}{type.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></label><form onSubmit={event => { event.preventDefault(); createPriceType.mutate({ name: newPriceTypeName }); }}><label>Новый вид цены<input value={newPriceTypeName} onChange={event => setNewPriceTypeName(event.target.value)} placeholder="Например: Розница СПб" maxLength={128}/></label><button className="subtle-button" disabled={!newPriceTypeName.trim() || createPriceType.isPending}><FilePlus2 size={14}/>{createPriceType.isPending ? "Создаем…" : "Добавить"}</button></form></div><div className="catalog-price-type-list">{((priceTypes.data ?? []) as PriceType[]).map(type => <article key={type.id} className={type.isActive ? "" : "is-archived"}><div><strong>{type.name}</strong><small>{type.isDefault ? "Основной вид" : type.isActive ? "Активен" : "Скрыт"}</small></div><input aria-label={`Название вида цены ${type.name}`} value={priceTypeDrafts[type.id] ?? type.name} onChange={event => setPriceTypeDrafts(current => ({ ...current, [type.id]: event.target.value }))}/><button type="button" className="subtle-button" disabled={updatePriceType.isPending} onClick={() => updatePriceType.mutate({ id: type.id, name: (priceTypeDrafts[type.id] ?? type.name), isDefault: type.isDefault, isActive: type.isActive })}><Save size={14}/>Сохранить</button>{!type.isDefault && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={deletePriceType.isPending}><Trash2 size={14}/>Удалить</button>} title="Удалить вид цены?" description="Удаление допустимо только если этот вид не назначен магазину и для него нет цен товаров. Иначе сначала переназначьте магазин или удалите цены." confirmLabel="Удалить вид цены" disabled={deletePriceType.isPending} onConfirm={() => deletePriceType.mutate({ id: type.id })}/>}</article>)}</div></section>

    <section className="packet-card catalog-working-card"><div className="card-title"><div><span>ОБЩИЙ СПРАВОЧНИК</span><h3>{catalogRows.length} {catalogRows.length === 1 ? "товар" : catalogRows.length < 5 ? "товара" : "товаров"}</h3></div><button type="button" className="subtle-button" onClick={() => setShowManual(value => !value)}><FilePlus2 size={15}/>{showManual ? "Скрыть форму" : "Добавить товар"}</button></div><p className="packet-note">НДС нового товара — 10% по умолчанию. Кассовая себестоимость скрыта и равна 0; внутренняя себестоимость остается только в приложении. Флаг выгрузки в Эвотор пока недоступен: интеграция строго read-only.</p>
      {showManual && <form className="catalog-manual-form" onSubmit={event => { event.preventDefault(); createProduct.mutate({ canonicalName: manualName, baseUnit: manualUnit, vatRate: manualVat, markingCategory: manualMarking, manualBarcodes, isVisibleInRequests: manualVisible, isEvotorExportEnabled: false }); }}><label>Название<input value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Новый товар" required/></label><label>Единица<ThemedSelect value={manualUnit} onChange={event => setManualUnit(event.target.value as CatalogUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={manualVat} onChange={event => setManualVat(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><label>Маркировка<ThemedSelect value={manualMarking} onChange={event => setManualMarking(event.target.value as MarkingCategory)}>{markingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</ThemedSelect></label><label>Ручные штрихкоды <small>через ;</small><input value={manualBarcodes} onChange={event => setManualBarcodes(event.target.value)} placeholder="1234567890123; 9876543210987"/></label><label className="catalog-visibility"><input type="checkbox" checked={manualVisible} onChange={event => setManualVisible(event.target.checked)}/><span>Показывать в заявках</span></label><button className="packet-link" disabled={createProduct.isPending}><FilePlus2 size={16}/>{createProduct.isPending ? "Добавляем…" : "Добавить товар"}</button></form>}
      <label className="catalog-search-label">Поиск товара<div className="catalog-search"><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Название, код, маркировка или штрихкод"/><Search size={15}/></div></label>
      {products.isLoading ? <p className="packet-note">Загружаем общий справочник…</p> : <div className="catalog-working-list">{catalogRows.slice(0, visibleCatalog).map(product => <article key={product.id} className={product.isActive === false ? "is-archived" : ""}>{editId === product.id ? <form className="catalog-edit-form" onSubmit={event => { event.preventDefault(); updateProduct.mutate({ id: product.id, canonicalName: editName, baseUnit: editUnit, vatRate: editVat, markingCategory: editMarking, manualBarcodes: editBarcodes, isVisibleInRequests: editVisible, isEvotorExportEnabled: product.isEvotorExportEnabled }); }}><label>Название<input value={editName} onChange={event => setEditName(event.target.value)} required/></label><label>Единица<ThemedSelect value={editUnit} onChange={event => setEditUnit(event.target.value as CatalogUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={editVat} onChange={event => setEditVat(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><label>Маркировка<ThemedSelect value={editMarking} onChange={event => setEditMarking(event.target.value as MarkingCategory)}>{markingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</ThemedSelect></label><label>Ручные штрихкоды <small>через ;</small><input value={editBarcodes} onChange={event => setEditBarcodes(event.target.value)} placeholder="1234567890123; 9876543210987"/></label><label className="catalog-visibility"><input type="checkbox" checked={editVisible} onChange={event => setEditVisible(event.target.checked)}/><span>Показывать в заявках</span></label><div className="catalog-edit-actions"><button className="packet-link" disabled={updateProduct.isPending}><Save size={15}/>{updateProduct.isPending ? "Сохраняем…" : "Сохранить"}</button><button type="button" className="subtle-button" onClick={() => setEditId(undefined)}><X size={14}/>Отмена</button></div></form> : <><div className="catalog-product-name"><strong>{product.canonicalName}</strong><small>{product.internalCode} · {unitLabel[product.baseUnit]} · {vatLabel(product.vatRate)} · {markingLabel(product.markingCategory)}</small><small>{product.manualBarcodes ? `Ручные штрихкоды: ${product.manualBarcodes}` : "Ручные штрихкоды не заданы"}</small></div><div className="catalog-product-values"><label>Внутренняя себестоимость<input data-decimal-input value={costDrafts[product.id] ?? product.internalCostPrice ?? ""} onChange={event => setCostDrafts(current => ({ ...current, [product.id]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label><button type="button" className="subtle-button" disabled={updateCost.isPending} onClick={() => commitCost(product)}><Save size={14}/>Себестоимость</button>{selectedPriceType && <><label>Цена · {selectedPriceType.name}<input data-decimal-input value={priceDrafts[product.id] ?? pricesByProduct.get(product.id) ?? ""} onChange={event => setPriceDrafts(current => ({ ...current, [product.id]: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") }))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label><button type="button" className="subtle-button" disabled={setSalePrice.isPending} onClick={() => commitSalePrice(product)}><Save size={14}/>Цена</button></>}</div><div className="catalog-product-actions"><button type="button" className="subtle-button" onClick={() => openEditor(product)}><PencilLine size={14}/>Изменить</button><span className={product.isVisibleInRequests ? "catalog-flag is-on" : "catalog-flag"}>{product.isVisibleInRequests ? <Eye size={14}/> : <EyeOff size={14}/>}{product.isVisibleInRequests ? "В заявках" : "Скрыт из заявок"}</span><span className="catalog-flag is-locked">Эвотор: read-only</span>{product.isActive !== false && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={archiveProduct.isPending}><Trash2 size={14}/>Скрыть</button>} title="Скрыть товар?" description="Товар перестанет отображаться в рабочем справочнике и новых ревизиях. История пересчетов и общий журнал останутся неизменными." confirmLabel="Скрыть товар" disabled={archiveProduct.isPending} onConfirm={() => archiveProduct.mutate({ id: product.id })}/>}</div></>}</article>)}</div>}
      {visibleCatalog < catalogRows.length && <button type="button" className="subtle-button catalog-more" onClick={() => setVisibleCatalog(limit => limit + 40)}>Показать еще</button>}
    </section>
  </AuditShell>;
}
