import { ChevronDown, Eye, EyeOff, FilePlus2, PencilLine, Plus, Save, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import "@/catalog-control.css";

type CatalogUnit = "kg" | "l" | "piece";
type MarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";
type CatalogProduct = { id: number; internalCode: string; canonicalName: string; evotorCategoryName?: string | null; barcodes?: unknown; baseUnit: CatalogUnit; vatRate: "VAT_10" | "VAT_22"; markingCategory: MarkingCategory; manualBarcodes: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean; isActive?: boolean };
type PriceType = { id: number; name: string; isDefault: boolean; isActive: boolean };
type SalePrice = { productId: number; priceTypeId: number; salePrice: string | number };

const unitLabel: Record<CatalogUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const markingLabel: Record<MarkingCategory, string> = { none: "Нет", supplement: "БАД", seafood_caviar: "Морепродукты · икра", seafood_canned: "Морепродукты · консервы", alcohol: "Алкоголь", beer_marked: "Маркированное пиво", beer_non_alcoholic: "Безалкогольное пиво", soft_drinks: "Соковая продукция и безалкогольные напитки", water: "Бутилированная питьевая вода", dairy: "Молоко и молочная продукция" };
const sourceBarcodes = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join("; ") : "";
const moneyText = (value: string | number | undefined) => value === undefined ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(value))} ₽`;

export default function CatalogControl() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const products = trpc.inventoryRegistry.products.useQuery(undefined, { enabled: isAdmin, retry: false });
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [visibleCatalog, setVisibleCatalog] = useState(50);
  const [priceTypeId, setPriceTypeId] = useState("");
  const [priceTypeDraft, setPriceTypeDraft] = useState("");
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [newPriceTypeName, setNewPriceTypeName] = useState("");
  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(item => item.isActive);
  const selectedPriceType = activePriceTypes.find(item => item.id === Number(priceTypeId));
  const salePriceInput = useMemo(() => selectedPriceType ? { priceTypeId: selectedPriceType.id } : undefined, [selectedPriceType]);
  const salePrices = trpc.inventoryRegistry.salePrices.useQuery(salePriceInput, { enabled: Boolean(isAdmin && selectedPriceType), retry: false });
  const salePriceByProduct = useMemo(() => new Map(((salePrices.data ?? []) as SalePrice[]).map(item => [item.productId, item.salePrice])), [salePrices.data]);

  useEffect(() => { if (!priceTypeId && activePriceTypes.length) setPriceTypeId(String(activePriceTypes.find(item => item.isDefault)?.id ?? activePriceTypes[0].id)); }, [activePriceTypes, priceTypeId]);
  useEffect(() => { setPriceTypeDraft(selectedPriceType?.name ?? ""); }, [selectedPriceType]);
  useEffect(() => { setVisibleCatalog(50); }, [catalogSearch]);

  const catalogRows = useMemo(() => {
    const query = catalogSearch.trim().toLocaleLowerCase("ru-RU");
    const list = (products.data ?? []) as CatalogProduct[];
    return query ? list.filter(item => `${item.canonicalName} ${item.internalCode} ${item.evotorCategoryName ?? ""} ${item.manualBarcodes ?? ""} ${markingLabel[item.markingCategory]}`.toLocaleLowerCase("ru-RU").includes(query)) : list;
  }, [catalogSearch, products.data]);
  const refresh = async () => { await Promise.all([utils.inventoryRegistry.products.invalidate(), utils.inventoryRegistry.priceTypes.invalidate(), utils.audit.changes.invalidate()]); };
  const createPriceType = trpc.inventoryRegistry.createPriceType.useMutation({ onSuccess: async row => { await refresh(); setNewPriceTypeName(""); setPriceTypeId(String(row.id)); toast.success("Вид цены создан"); }, onError: error => toast.error("Вид цены не создан", { description: error.message }) });
  const updatePriceType = trpc.inventoryRegistry.updatePriceType.useMutation({ onSuccess: async () => { await refresh(); toast.success("Вид цены сохранен"); }, onError: error => toast.error("Вид цены не сохранен", { description: error.message }) });
  const deletePriceType = trpc.inventoryRegistry.deletePriceType.useMutation({ onSuccess: async () => { setPriceTypeId(""); await refresh(); toast.success("Вид цены удален"); }, onError: error => toast.error("Вид цены не удален", { description: error.message }) });
  const restore = trpc.inventoryRegistry.restoreCatalogProduct.useMutation({ onSuccess: async () => { await refresh(); toast.success("Товар возвращен в общий справочник"); }, onError: error => toast.error("Товар не возвращен", { description: error.message }) });

  if (!me.isLoading && !isAdmin) return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура"><section className="empty-state"><Tag size={28}/><h2>Управление номенклатурой доступно администратору</h2><p>Продавцы и руководители используют подтвержденный общий справочник только в операционных действиях.</p></section></AuditShell>;

  return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура">
    <section className="page-lede catalog-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Общая номенклатура сети</h2><p>Один товар доступен всем магазинам-складам. В списке нет редактирования: карточка и создание товара открываются на отдельных страницах.</p></div><button type="button" className="packet-link" onClick={() => setLocation("/catalog-control/new")}><FilePlus2 size={16}/>Добавить товар</button></section>

    <details className="packet-card catalog-price-types" open={showPriceSettings} onToggle={event => setShowPriceSettings((event.currentTarget as HTMLDetailsElement).open)}>
      <summary><div><span>ВИДЫ ЦЕН</span><h3>{selectedPriceType?.name ?? "Выберите вид цены"}</h3><small>{selectedPriceType?.isDefault ? "Основной вид цены" : "Продажная цена выбирается в карточке товара"}</small></div><ChevronDown size={17}/></summary>
      <div className="catalog-price-primary"><label>Текущий вид цены<ThemedSelect value={priceTypeId} onChange={event => setPriceTypeId(event.target.value)}>{activePriceTypes.map(item => <option value={item.id} key={item.id}>{item.name}{item.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></label><label>Название<input value={priceTypeDraft} onChange={event => setPriceTypeDraft(event.target.value)} maxLength={128}/></label><button type="button" className="subtle-button" disabled={!selectedPriceType || updatePriceType.isPending || !priceTypeDraft.trim()} onClick={() => selectedPriceType && updatePriceType.mutate({ id: selectedPriceType.id, name: priceTypeDraft, isDefault: selectedPriceType.isDefault, isActive: true })}><Save size={14}/>Сохранить</button><button type="button" className="subtle-button" disabled={!selectedPriceType || selectedPriceType.isDefault || updatePriceType.isPending} onClick={() => selectedPriceType && updatePriceType.mutate({ id: selectedPriceType.id, name: selectedPriceType.name, isDefault: true, isActive: true })}><Eye size={14}/>Сделать основным</button></div>
      <div className="catalog-price-secondary"><form onSubmit={event => { event.preventDefault(); createPriceType.mutate({ name: newPriceTypeName }); }}><label>Новый вид цены<input value={newPriceTypeName} onChange={event => setNewPriceTypeName(event.target.value)} placeholder="Например: Оптово-розничная" maxLength={128}/></label><button className="subtle-button" disabled={!newPriceTypeName.trim() || createPriceType.isPending}><Plus size={14}/>Добавить</button></form>{selectedPriceType && !selectedPriceType.isDefault && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={deletePriceType.isPending}><Trash2 size={14}/>Удалить выбранный</button>} title="Удалить вид цены?" description="Удаление допустимо только если вид не назначен складу и для него нет цен товаров." confirmLabel="Удалить вид цены" disabled={deletePriceType.isPending} onConfirm={() => deletePriceType.mutate({ id: selectedPriceType.id })}/>}</div>
    </details>

    <section className="packet-card catalog-working-card"><div className="card-title"><div><span>ОБЩИЙ СПРАВОЧНИК</span><h3>{catalogRows.length} {catalogRows.length === 1 ? "товар" : catalogRows.length < 5 ? "товара" : "товаров"}</h3></div></div><label className="catalog-search-label">Поиск товара<div className="catalog-search"><input value={catalogSearch} onChange={event => setCatalogSearch(event.target.value)} placeholder="Название, код, категория, маркировка или штрихкод"/><PencilLine size={15}/></div></label>
      {products.isLoading ? <p className="packet-note">Загружаем общий справочник…</p> : !catalogRows.length ? <div className="empty-state compact"><Tag size={24}/><h2>Товаров не найдено</h2><p>Измените запрос или добавьте товар через отдельную карточку.</p></div> : <div className="data-table-wrap catalog-table-wrap"><table className="data-table catalog-table"><thead><tr><th>№</th><th>Товар</th><th>Категория</th><th>Ед.</th><th>НДС</th><th>Маркировка</th><th>Штрихкоды</th><th>Продажная цена<br/>{selectedPriceType?.name ?? "—"}</th><th>Заявки</th><th>Эвотор</th><th aria-label="Действие"/></tr></thead><tbody>{catalogRows.slice(0, visibleCatalog).map((product, index) => <tr className={product.isActive === false ? "is-archived" : ""} key={product.id}><td>{index + 1}</td><td><strong>{product.canonicalName}</strong><small>ID {product.id} · артикул Эвотор {product.internalCode}</small></td><td>{product.evotorCategoryName ?? "—"}</td><td>{unitLabel[product.baseUnit]}</td><td>{product.vatRate === "VAT_22" ? "22%" : "10%"}</td><td>{markingLabel[product.markingCategory]}</td><td>{product.manualBarcodes || sourceBarcodes(product.barcodes) || "—"}</td><td className="catalog-table-money">{moneyText(salePriceByProduct.get(product.id))}</td><td>{product.isVisibleInRequests ? <span className="catalog-table-flag is-on"><Eye size={14}/>Да</span> : <span className="catalog-table-flag"><EyeOff size={14}/>Нет</span>}</td><td><span className="catalog-table-flag"><EyeOff size={14}/>Выключена</span></td><td>{product.isActive === false ? <button type="button" className="subtle-button" onClick={() => restore.mutate({ id: product.id })} disabled={restore.isPending}><Eye size={14}/>Вернуть</button> : <button type="button" className="subtle-button" onClick={() => setLocation(`/catalog-control/${product.id}/edit`)}><PencilLine size={14}/>Изменить</button>}</td></tr>)}</tbody></table></div>}
      {visibleCatalog < catalogRows.length && <button type="button" className="subtle-button catalog-more" onClick={() => setVisibleCatalog(value => value + 50)}>Показать еще</button>}
    </section>
  </AuditShell>;
}
