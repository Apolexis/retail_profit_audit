import { ArrowLeft, Eye, EyeOff, Save, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import "@/catalog-control.css";

type CatalogUnit = "kg" | "l" | "piece";
type MarkingCategory = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";
type CatalogProduct = { id: number; internalCode: string; canonicalName: string; evotorCategoryName?: string | null; barcodes?: unknown; baseUnit: CatalogUnit; vatRate: "VAT_10" | "VAT_22"; internalCostPrice?: string | null; markingCategory: MarkingCategory; alcoholCode?: string | null; alcoholTypeCode?: string | null; alcoholStrengthPercent?: string | null; alcoholVolumeLiters?: string | null; manualBarcodes: string | null; isVisibleInRequests: boolean; isEvotorExportEnabled: boolean; isActive?: boolean };
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
  const priceTypes = trpc.inventoryRegistry.priceTypes.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<CatalogUnit>("kg");
  const [vatRate, setVatRate] = useState<"VAT_10" | "VAT_22">("VAT_10");
  const [marking, setMarking] = useState<MarkingCategory>("none");
  const [categoryName, setCategoryName] = useState("__none__");
  const [barcodes, setBarcodes] = useState("");
  const [alcoholCode, setAlcoholCode] = useState("");
  const [alcoholTypeCode, setAlcoholTypeCode] = useState("");
  const [alcoholStrengthPercent, setAlcoholStrengthPercent] = useState("");
  const [alcoholVolumeLiters, setAlcoholVolumeLiters] = useState("");
  const [visibleInRequests, setVisibleInRequests] = useState(true);
  const [evotorExportEnabled, setEvotorExportEnabled] = useState(false);
  const [internalCostPrice, setInternalCostPrice] = useState("");
  const [priceTypeId, setPriceTypeId] = useState("");
  const salePrices = trpc.inventoryRegistry.salePrices.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [salePrice, setSalePrice] = useState("");
  const product = useMemo(() => ((products.data ?? []) as CatalogProduct[]).find(item => item.id === productId), [products.data, productId]);
  const activePriceTypes = ((priceTypes.data ?? []) as PriceType[]).filter(item => item.isActive);
  const selectedPriceType = activePriceTypes.find(item => item.id === Number(priceTypeId));
  const evotorBarcodes = useMemo(() => Array.isArray(product?.barcodes) ? product.barcodes.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).join("; ") : "", [product]);
  const categoryOptions = useMemo(() => Array.from(new Set(((products.data ?? []) as CatalogProduct[]).map(item => item.evotorCategoryName?.trim()).filter((item): item is string => Boolean(item)))).sort((left, right) => left.localeCompare(right, "ru")), [products.data]);

  useEffect(() => {
    if (!product) return;
    setName(product.canonicalName); setUnit(product.baseUnit); setVatRate(product.vatRate); setMarking(product.markingCategory); setCategoryName(product.evotorCategoryName?.trim() || "__none__"); setBarcodes(product.manualBarcodes || evotorBarcodes); setAlcoholCode(product.alcoholCode ?? ""); setAlcoholTypeCode(product.alcoholTypeCode ?? ""); setAlcoholStrengthPercent(product.alcoholStrengthPercent ?? ""); setAlcoholVolumeLiters(product.alcoholVolumeLiters ?? ""); setVisibleInRequests(product.isVisibleInRequests); setEvotorExportEnabled(product.isEvotorExportEnabled); setInternalCostPrice(product.internalCostPrice ?? "");
  }, [product, evotorBarcodes]);
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
    onSuccess: async item => { await refresh(); toast.success("Товар добавлен в общий справочник"); setLocation(`/catalog-control/${item.id}/edit`); },
    onError: error => toast.error("Товар не добавлен", { description: error.message }),
  });
  const update = trpc.inventoryRegistry.updateCatalogProduct.useMutation({ onSuccess: async () => { await refresh(); toast.success("Карточка товара сохранена"); }, onError: error => toast.error("Карточка не сохранена", { description: error.message }) });
  const updateCost = trpc.inventoryRegistry.updateInternalCost.useMutation({ onSuccess: refresh, onError: error => toast.error("Себестоимость не сохранена", { description: error.message }) });
  const setProductSalePrice = trpc.inventoryRegistry.setProductSalePrice.useMutation({ onSuccess: refresh, onError: error => toast.error("Цена не сохранена", { description: error.message }) });

  const saveCard = async (event: React.FormEvent) => {
    event.preventDefault();
    const evotorCategoryName = categoryName === "__none__" ? null : categoryName;
    const alcohol = marking === "alcohol" || marking === "beer_marked" ? { alcoholCode, alcoholTypeCode, alcoholStrengthPercent: alcoholStrengthPercent.trim() ? Number(alcoholStrengthPercent) : null, alcoholVolumeLiters: alcoholVolumeLiters.trim() ? Number(alcoholVolumeLiters) : null } : { alcoholCode: null, alcoholTypeCode: null, alcoholStrengthPercent: null, alcoholVolumeLiters: null };
    if (productId) update.mutate({ id: productId, canonicalName: name, baseUnit: unit, vatRate, evotorCategoryName, markingCategory: marking, ...alcohol, manualBarcodes: barcodes, isVisibleInRequests: visibleInRequests, isEvotorExportEnabled: evotorExportEnabled });
    else {
      try {
        const created = await create.mutateAsync({ canonicalName: name, baseUnit: unit, vatRate, evotorCategoryName, markingCategory: marking, ...alcohol, manualBarcodes: barcodes, isVisibleInRequests: visibleInRequests, isEvotorExportEnabled: evotorExportEnabled });
        const value = salePrice.trim() ? Number(salePrice) : null;
        if (selectedPriceType && value !== null && Number.isFinite(value) && value >= 0) await setProductSalePrice.mutateAsync({ productId: created.id, priceTypeId: selectedPriceType.id, salePrice: value });
      } catch { /* mutation toast already communicates the failure */ }
    }
  };
  const saveCost = () => {
    if (!productId) return;
    const value = internalCostPrice.trim() ? Number(internalCostPrice) : null;
    if (value !== null && (!Number.isFinite(value) || value < 0)) return toast.error("Введите неотрицательную себестоимость.");
    updateCost.mutate({ id: productId, internalCostPrice: value });
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
      <div className="card-title"><div><span>ОСНОВНЫЕ ДАННЫЕ</span><h3>{productId ? product?.canonicalName : "Новая позиция"}</h3>{productId && <small className="catalog-business-id">№ / ID / артикул: {product?.internalCode}</small>}</div><div className="catalog-editor-title-actions"><button type="button" className={visibleInRequests ? "subtle-button catalog-visibility-button is-on" : "subtle-button catalog-visibility-button"} aria-pressed={visibleInRequests} onClick={() => setVisibleInRequests(value => !value)}>{visibleInRequests ? <Eye size={15}/> : <EyeOff size={15}/>}В заявках</button><button type="button" className="subtle-button catalog-visibility-button" disabled title="Обратная запись в Эвотор пока не подключена"><EyeOff size={15}/>Эвотор: не подключено</button><button className="packet-link" disabled={create.isPending || update.isPending}><Save size={16}/>{create.isPending || update.isPending ? "Сохраняем…" : "Сохранить"}</button></div></div>
      <div className="catalog-editor-grid"><label>Название товара<input value={name} onChange={event => setName(event.target.value)} required maxLength={512}/></label><label>Категория<ThemedSelect value={categoryName} onChange={event => setCategoryName(event.target.value)}><option value="__none__">Без категории</option>{categoryOptions.map(item => <option value={item} key={item}>{item}</option>)}</ThemedSelect></label><label>Единица<ThemedSelect value={unit} onChange={event => setUnit(event.target.value as CatalogUnit)}><option value="kg">кг</option><option value="l">л</option><option value="piece">шт</option></ThemedSelect></label><label>НДС<ThemedSelect value={vatRate} onChange={event => setVatRate(event.target.value as "VAT_10" | "VAT_22")}><option value="VAT_10">НДС 10%</option><option value="VAT_22">НДС 22%</option></ThemedSelect></label><label>Маркировка<ThemedSelect value={marking} onChange={event => setMarking(event.target.value as MarkingCategory)}>{markingOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</ThemedSelect></label><div className="catalog-editor-readonly catalog-marking-code"><span>Тип товара Эвотор</span><strong>{evotorProductTypeByMarking[marking]}</strong><small>Справочное соответствие V2 · без выгрузки</small></div><label className="catalog-editor-barcodes">Штрихкоды <small>Эвотор и ручные, строго через ;</small><input value={barcodes} onChange={event => setBarcodes(event.target.value)} placeholder="1234567890123; 9876543210987"/></label>{(marking === "alcohol" || marking === "beer_marked") && <><label className="catalog-alcohol-code">Алкокод<input value={alcoholCode} onChange={event => setAlcoholCode(event.target.value)} maxLength={255} placeholder="Код алкогольной продукции"/></label><label>Код вида АП (ФСРАР)<ThemedSelect value={alcoholTypeCode} onChange={event => setAlcoholTypeCode(event.target.value)}><option value="">Не задан</option>{alcoholTypeOptions.map(code => <option value={code} key={code}>{code}</option>)}</ThemedSelect></label><label>Крепость, %<input data-decimal-input value={alcoholStrengthPercent} onChange={event => setAlcoholStrengthPercent(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Например: 40"/></label><label>Объем тары, л<input data-decimal-input value={alcoholVolumeLiters} onChange={event => setAlcoholVolumeLiters(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Например: 0,5"/></label></>}</div>
    </form>
    <section className="packet-card catalog-editor-card">
      <div className="card-title"><div><span>ЦЕНЫ ТОВАРА</span><h3>Внутренняя и продажная</h3></div></div>
      <div className="catalog-editor-price-grid">{productId && <><label>Внутренняя себестоимость<input data-decimal-input value={internalCostPrice} onChange={event => setInternalCostPrice(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label><button type="button" className="subtle-button" onClick={saveCost} disabled={updateCost.isPending}><Save size={14}/>Сохранить</button></>}<label>Вид цены<ThemedSelect value={priceTypeId} onChange={event => { setPriceTypeId(event.target.value); const next = ((salePrices.data ?? []) as SalePrice[]).find(item => item.productId === productId && item.priceTypeId === Number(event.target.value)); setSalePrice(next?.salePrice ?? ""); }}>{activePriceTypes.map(item => <option value={item.id} key={item.id}>{item.name}{item.isDefault ? " · основной" : ""}</option>)}</ThemedSelect></label><label>Продажная цена<input data-decimal-input value={salePrice} onChange={event => setSalePrice(normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Не задана"/><span>₽</span></label>{productId && <button type="button" className="subtle-button" onClick={savePrice} disabled={!selectedPriceType || setProductSalePrice.isPending}><Save size={14}/>Сохранить</button>} {!productId && <p className="packet-note">Указанная цена сохранится вместе с новым товаром.</p>}</div>
    </section>
  </AuditShell>;
}
