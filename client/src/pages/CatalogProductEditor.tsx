import { ArrowLeft, Eye, EyeOff, Maximize2, Minimize2, Save, Send, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import "@/catalog-control.css";

type CatalogUnit = "fraction" | "l" | "piece";
type MarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";
type CatalogProduct = { id: number; internalCode: string; canonicalName: string; evotorCategoryName?: string | null; catalogCategoryId?: number | null; catalogCategoryName?: string | null; barcodes?: unknown; baseUnit: CatalogUnit; vatRate: "VAT_10" | "VAT_22"; internalCostPrice?: string | null; isEvotorCostExportEnabled: boolean; markingCategory: MarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: string | null; alcoholVolumeLiters?: string | null; manualBarcodes: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean; isActive?: boolean };
type CatalogCategory = { id: number; name: string; isActive: boolean };
type PriceType = { id: number; name: string; isDefault: boolean; isActive: boolean };
type SalePrice = { productId: number; priceTypeId: number; salePrice: string };

const markingOptions: Array<{ value: MarkingCategory; label: string }> = [
  { value: "none", label: "Нет" }, { value: "supplement", label: "БАД" }, { value: "seafood_caviar", label: "Морепродукты · икра" }, { value: "seafood_canned", label: "Морепродукты · консервы" }, { value: "alcohol", label: "Алкоголь" }, { value: "beer_marked", label: "Маркированное пиво" }, { value: "beer_non_alcoholic", label: "Безалкогольное пиво" }, { value: "soft_drinks", label: "Соковая продукция и безалкогольные напитки" }, { value: "water", label: "Бутилированная питьевая вода" }, { value: "dairy", label: "Молоко и молочная продукция" },
];
/** Exact Cloud V2 type codes from the official «Схемы товаров» reference. */
const evotorProductTypeByMarking: Record<MarkingCategory, string> = {
  none: "NORMAL",
  supplement: "DIETARY_SUPPLEMENTS_MARKED",
  seafood_caviar: "CAVIAR_MARKED",
  seafood_canned: "GROCERIES_MARKED",
  alcohol: "ALCOHOL_MARKED",
  beer_marked: "BEER_MARKED",
  beer_non_alcoholic: "NOT_ALCOHOL_BEER_MARKED",
  soft_drinks: "JUICE_MARKED",
  water: "WATER_MARKED",
  dairy: "DAIRY_MARKED",
};
const alcoholTypeOptions = ["500", "510"] as const;

export default function CatalogProductEditor({ productId }: { productId?: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const products = trpc.inventoryRegistry.products.useQuery(undefined, { enabled: isAdmin, retry: false });
  const categories = trpc.inventoryRegistry.catalogCategories.useQuery(undefined, { enabled: isAdmin, retry: false });
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<CatalogUnit>("fraction");
  const [vatRate, setVatRate] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [marking, setMarking] = useState<MarkingCategory>("none");
  const [catalogCategoryId, setCatalogCategoryId] = useState("__none__");
  const [barcodes, setBarcodes] = useState("");
  const [barcodesExpanded, setBarcodesExpanded] = useState(false);
  const [alcoholCode, setAlcoholCode] = useState("");
  const [alcoholCodeExpanded, setAlcoholCodeExpanded] = useState(false);
  const [alcoholTypeCode, setAlcoholTypeCode] = useState("");
  const [alcoholStrengthPercent, setAlcoholStrengthPercent] = useState("");
  const [alcoholVolumeLiters, setAlcoholVolumeLiters] = useState("");
  const [visibleInRequests, setVisibleInRequests] = useState(true);
  const [evotorExportEnabled, setEvotorExportEnabled] = useState(true);
  const [internalCostPrice, setInternalCostPrice] = useState("");
  const [evotorCostExportEnabled, setEvotorCostExportEnabled] = useState(false);
  const [priceTypeId, setPriceTypeId] = useState("");
  const salePrices = trpc.inventoryRegistry.salePrices.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [salePrice, setSalePrice] = useState("");
  const product = useMemo(() => ((products.data ?? []) as CatalogProduct[]).find(item => item.id === productId), [products.data, productId]);
  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(item => item.isActive);
  const selectedPriceType = activePriceTypes.find(item => item.id === Number(priceTypeId));
  const evotorBarcodes = useMemo(() => Array.isArray(product?.barcodes) ? product.barcodes.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join("; ") : "", [product]);
  const categoryOptions = useMemo(() => ((categories.data ?? []) as CatalogCategory[]).filter(item => item.isActive), [categories.data]);

  useEffect(() => {
    if (!product) return;
    const isAlcoholProduct = product.markingCategory === "alcohol" || product.markingCategory === "beer_marked";
    const sourceProductKind = product.alcoholTypeCode ?? "";
    const productKind = alcoholTypeOptions.includes(sourceProductKind as typeof alcoholTypeOptions[number]) ? sourceProductKind : "500";
    setName(product.canonicalName); setUnit(product.baseUnit); setVatRate(product.vatRate); setMarking(product.markingCategory); setCatalogCategoryId(product.catalogCategoryId ? String(product.catalogCategoryId) : "__none__"); setBarcodes(product.manualBarcodes ?? evotorBarcodes); setAlcoholCode(product.alcoholCode ?? ""); setAlcoholTypeCode(isAlcoholProduct ? productKind : "500"); setAlcoholStrengthPercent(product.alcoholStrengthPercent ?? ""); setAlcoholVolumeLiters(product.alcoholVolumeLiters ?? ""); setVisibleInRequests(product.isVisibleInRequests); setEvotorExportEnabled(product.isEvotorExportEnabled); setInternalCostPrice(product.internalCostPrice ?? ""); setEvotorCostExportEnabled(product.isEvotorCostExportEnabled);
  }, [product, evotorBarcodes]);
  useEffect(() => {
    if (marking === "alcohol" || marking === "beer_marked") {
      setAlcoholTypeCode(current => alcoholTypeOptions.includes(current as typeof alcoholTypeOptions[number]) ? current : "500");
    }
  }, [marking]);
  useEffect(() => {
    if (!priceTypeId && activePriceTypes.length) setPriceTypeId(String(activePriceTypes.find(item => item.isDefault)?.id ?? activePriceTypes[0].id));
  }, [activePriceTypes, priceTypeId]);
  useEffect(() => {
    if (!productId || !selectedPriceType) return;
    const row = ((salePrices.data ?? []) as SalePrice[]).find(item => item.productId === productId && item.priceTypeId === selectedPriceType.id);
    setSalePrice(row?.salePrice ?? "");
  }, [productId, salePrices.data, selectedPriceType]);

  const refresh = () => Promise.all([utils.inventoryRegistry.products.invalidate(), utils.inventoryRegistry.salePrices.invalidate(), utils.audit.changes.invalidate()]);
  const create = trpc.inventoryRegistry.createCatalogProduct.useMutation({
    onError: error => toast.error("Товар не добавлен", { description: error.message }),
  });
  const update = trpc.inventoryRegistry.updateCatalogProduct.useMutation({
    onError: error => toast.error("Карточка не сохранена", { description: error.message }),
  });
  const archive = trpc.inventoryRegistry.archiveCatalogProduct.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Товар удален из активной номенклатуры", { description: "Исторические документы и аудит сохранены. При необходимости товар можно вернуть из списка скрытых." });
      setLocation("/catalog-control");
    },
    onError: error => toast.error("Товар не удален", { description: error.message }),
  });
  const permanentDelete = trpc.inventoryRegistry.permanentlyDeleteCatalogProduct.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Товар безвозвратно удален", { description: "Удалена только архивная позиция без документов, движений, импорта и обмена Эвотор." });
      setLocation("/catalog-control");
    },
    onError: error => toast.error("Товар нельзя удалить безвозвратно", { description: error.message }),
  });
  const setProductSalePrice = trpc.inventoryRegistry.setProductSalePrice.useMutation({ onSuccess: refresh, onError: error => toast.error("Цена не сохранена", { description: error.message }) });
  const isCardSaving = create.isPending || update.isPending || archive.isPending || permanentDelete.isPending || setProductSalePrice.isPending;

  const saveCard = async (event: React.FormEvent) => {
    event.preventDefault();
    const categoryId = catalogCategoryId === "__none__" ? null : Number(catalogCategoryId);
    const alcohol = marking === "alcohol" || marking === "beer_marked" ? { alcoholCode, alcoholTypeCode, alcoholStrengthPercent: alcoholStrengthPercent.trim() ? Number(alcoholStrengthPercent) : null, alcoholVolumeLiters: alcoholVolumeLiters.trim() ? Number(alcoholVolumeLiters) : null } : { alcoholCode: null, alcoholTypeCode: null, alcoholStrengthPercent: null, alcoholVolumeLiters: null };
    const cost = internalCostPrice.trim() ? Number(internalCostPrice) : null;
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return toast.error("Введите неотрицательную внутреннюю себестоимость.");
    const payload = { canonicalName: name, baseUnit: unit, vatRate, catalogCategoryId: categoryId, internalCostPrice: cost, isEvotorCostExportEnabled: evotorCostExportEnabled, markingCategory: marking, ...alcohol, manualBarcodes: barcodes, isVisibleInRequests: visibleInRequests, isEvotorExportEnabled: evotorExportEnabled };
    try {
      if (productId) {
        const result = await update.mutateAsync({ id: productId, ...payload });
        await refresh();
        toast.success("Карточка товара сохранена", { description: evotorExportEnabled ? `Сохранено: ${result.after.canonicalName}. Выгрузка поставлена в минутную очередь Эвотор.` : `Сохранено: ${result.after.canonicalName}.` });
        return;
      }
      const created = await create.mutateAsync(payload);
      const value = salePrice.trim() ? Number(salePrice) : null;
      if (selectedPriceType && value !== null && Number.isFinite(value) && value >= 0) await setProductSalePrice.mutateAsync({ productId: created.id, priceTypeId: selectedPriceType.id, salePrice: value });
      await refresh();
      toast.success("Товар добавлен в общий справочник", { description: evotorExportEnabled ? `Сохранено: ${created.canonicalName}. Выгрузка поставлена в минутную очередь Эвотор.` : `Сохранено: ${created.canonicalName}.` });
      setLocation(`/catalog-control/${created.id}/edit`);
    } catch { /* Every failed mutation already emits a Russian error toast. */ }
  };
  const savePrice = () => {
    if (!productId || !selectedPriceType) return;
    const value = salePrice.trim() ? Number(salePrice) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0)) return toast.error("Введите неотрицательную продажную цену.");
    setProductSalePrice.mutate({ productId, priceTypeId: selectedPriceType.id, salePrice: value });
  };

  if (!me.isLoading && !isAdmin) return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура"><section className="empty-state"><Tag size={28}/><h2>Карточки номенклатуры доступны администратору</h2></section></AuditShell>;
  if (productId && !products.isLoading && !product) return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title="Номенклатура"><section className="empty-state"><Tag size={28}/><h2>Товар не найден</h2><Link href="/catalog-control" className="subtle-button"><ArrowLeft size={15}/>К списку товаров</Link></section></AuditShell>;

  return <AuditShell kicker="26 / НОМЕНКЛАТУРА" title={productId ? "Карточка товара" : "Новый товар"}>
    <section className="page-lede catalog-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>{productId ? "Редактирование товара" : "Добавление товара"}</h2><p>Карточка товара отделена от списка. Общая номенклатура не зависит от магазина; продажная цена задается по выбранному виду цены.</p></div><Link href="/catalog-control" className="subtle-button"><ArrowLeft size={15}/>К списку</Link></section>
    <form className="packet-card catalog-editor-card" onSubmit={saveCard}>
	      <div className="card-title"><div><span>ОСНОВНЫЕ ДАННЫЕ</span><h3>{productId ? product?.canonicalName : "Новая позиция"}</h3>{productId && <small className="catalog-business-id" aria-label={`№ / ID / артикул: ${product?.internalCode}`} title={`№ / ID / артикул: ${product?.internalCode}`}>№ {product?.internalCode}</small>}</div><div className="catalog-editor-title-actions"><div className="catalog-editor-action-group"><button type="button" className={visibleInRequests ? "subtle-button catalog-visibility-button is-on" : "subtle-button catalog-visibility-button"} aria-pressed={visibleInRequests} onClick={() => setVisibleInRequests(value => !value)}>{visibleInRequests ? <Eye size={15}/> : <EyeOff size={15}/>}В заявках</button><button type="button" className={evotorExportEnabled ? "subtle-button catalog-visibility-button is-on" : "subtle-button catalog-visibility-button"} aria-pressed={evotorExportEnabled} onClick={() => setEvotorExportEnabled(value => !value)} title="Новая номенклатура по умолчанию включена в автоматическую выгрузку в Эвотор; переключатель можно выключить до сохранения.">{evotorExportEnabled ? <Send size={15}/> : <EyeOff size={15}/>} {evotorExportEnabled ? "Выгружать в Эвотор" : "Не выгружать в Эвотор"}</button>{productId && product?.isActive !== false && me.data?.role === "admin" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={isCardSaving}><Trash2 size={15}/>Удалить</button>} title={`Удалить «${product?.canonicalName}» из номенклатуры?`} description="Товар будет скрыт из активной номенклатуры и заявок. Исторические пересчеты, документы и общий аудит сохранятся; при необходимости товар можно вернуть из списка скрытых." confirmLabel="Удалить из активной номенклатуры" disabled={isCardSaving} onConfirm={() => archive.mutate({ id: productId })}/>} {productId && product?.isActive === false && me.data?.role === "admin" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger" disabled={isCardSaving}><Trash2 size={15}/>Удалить навсегда</button>} title={`Удалить «${product?.canonicalName}» безвозвратно?`} description="Доступно только если у архивного товара нет пересчётов, движений, заявок, импорта 1С и обмена Эвотор. При наличии истории товар сохранится в архиве." confirmLabel="Удалить безвозвратно" disabled={isCardSaving} onConfirm={() => permanentDelete.mutate({ id: productId })}/>}<button className="packet-link catalog-editor-save" disabled={isCardSaving}><Save size={16}/>{isCardSaving ? "Сохраняем…" : "Сохранить"}</button></div></div></div>
      <div className="catalog-editor-grid"><label>Название товара<input value={name} onChange={event => setName(event.target.value)} required maxLength={512}/></label><label>Категория<ThemedSelect value={catalogCategoryId} onChange={event => setCatalogCategoryId(event.target.value)}><option value="__none__">Без категории</option>{categoryOptions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</ThemedSelect></label><label>Единица<ThemedSelect value={unit} onChange={event => setUnit(event.target.value as CatalogUnit)}><option value="fraction">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={vatRate} onChange={event => setVatRate(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><label>Маркировка<ThemedSelect value={marking} onChange={event => setMarking(event.target.value as MarkingCategory)}>{markingOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</ThemedSelect></label><label className="catalog-marking-code">Тип товара Эвотор<input value={evotorProductTypeByMarking[marking]} readOnly aria-readonly="true" aria-label="Тип товара Эвотор"/></label><label className={`catalog-editor-barcodes catalog-grow-field${barcodesExpanded ? " is-expanded" : ""}`}>Штрихкоды<span className="catalog-grow-control"><textarea id="catalog-barcodes" rows={barcodesExpanded ? 5 : 2} value={barcodes} onChange={event => setBarcodes(event.target.value)} placeholder="1234567890123; 9876543210987"/><button type="button" className="catalog-grow-expand" aria-pressed={barcodesExpanded} aria-label={barcodesExpanded ? "Свернуть поле штрихкодов" : "Развернуть поле штрихкодов"} title={barcodesExpanded ? "Свернуть поле" : "Развернуть поле"} aria-controls="catalog-barcodes" onClick={() => setBarcodesExpanded(value => !value)}>{barcodesExpanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></span><small>Сохранённый набор заменяет штрихкоды из Эвотор; пустое поле после сохранения означает удаление всех штрихкодов.</small></label><label className="catalog-purchase-cost">Цена закупки<span className="catalog-cost-control"><input data-decimal-input value={internalCostPrice} onChange={event => setInternalCostPrice(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Не задана"/><b>₽</b><button type="button" className="catalog-cost-export-toggle" aria-pressed={evotorCostExportEnabled} aria-label={evotorCostExportEnabled ? "Не выгружать цену закупки в Эвотор" : "Выгружать цену закупки в Эвотор"} title={evotorCostExportEnabled ? "Цена закупки выгружается в Эвотор" : "Цена закупки не выгружается в Эвотор"} onClick={() => setEvotorCostExportEnabled(value => !value)}>{evotorCostExportEnabled ? <Eye size={15}/> : <EyeOff size={15}/>}</button></span><small>{evotorCostExportEnabled ? "Цена закупки передается в Эвотор" : "Цена закупки не передается в Эвотор"}</small></label>{(marking === "alcohol" || marking === "beer_marked") && <><label className={`catalog-alcohol-code catalog-grow-field${alcoholCodeExpanded ? " is-expanded" : ""}`}>Алкокод<span className="catalog-grow-control"><textarea id="catalog-alcohol-code" rows={alcoholCodeExpanded ? 5 : 2} value={alcoholCode} onChange={event => setAlcoholCode(event.target.value)} maxLength={255} placeholder="Код алкогольной продукции"/><button type="button" className="catalog-grow-expand" aria-pressed={alcoholCodeExpanded} aria-label={alcoholCodeExpanded ? "Свернуть поле алкокода" : "Развернуть поле алкокода"} title={alcoholCodeExpanded ? "Свернуть поле" : "Развернуть поле"} aria-controls="catalog-alcohol-code" onClick={() => setAlcoholCodeExpanded(value => !value)}>{alcoholCodeExpanded ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></span></label><label className="catalog-alcohol-kind">Код вида АП (ФСРАР)<ThemedSelect value={alcoholTypeCode} onChange={event => setAlcoholTypeCode(event.target.value)}>{alcoholTypeOptions.map(code => <option value={code} key={code}>{code}</option>)}</ThemedSelect></label><label className="catalog-alcohol-strength">Крепость, %<input data-decimal-input value={alcoholStrengthPercent} onChange={event => setAlcoholStrengthPercent(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Например: 4.3"/></label><label className="catalog-alcohol-volume">Объем тары, л<input data-decimal-input value={alcoholVolumeLiters} onChange={event => setAlcoholVolumeLiters(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Например: 0.5"/></label></>}</div>
    </form>
    <section className="packet-card catalog-editor-card">
      <div className="card-title"><div><span>ПРОДАЖНАЯ ЦЕНА</span><h3>Цена выбранного вида</h3></div></div>
      <div className="catalog-editor-price-grid"><label>Вид цены<ThemedSelect value={priceTypeId} onChange={event => { setPriceTypeId(event.target.value); const next = ((salePrices.data ?? []) as SalePrice[]).find(item => item.productId === productId && item.priceTypeId === Number(event.target.value)); setSalePrice(next?.salePrice ?? ""); }}>{activePriceTypes.map(item => <option value={item.id} key={item.id}>{item.name}{item.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></label><label>Продажная цена<input data-decimal-input value={salePrice} onChange={event => setSalePrice(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label>{productId && <button type="button" className="subtle-button" onClick={savePrice} disabled={!selectedPriceType || setProductSalePrice.isPending}><Save size={14}/>Сохранить</button>} {!productId && <p className="packet-note">Цена закупки и продажная цена сохранятся вместе с новым товаром.</p>}</div>
    </section>
  </AuditShell>;
}
