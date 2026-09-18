import { ArrowDown, Boxes, ClipboardCheck, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import "@/stock-control.css";

type StockUnit = "kg" | "l" | "piece";
type StockItem = {
  productId: number;
  storeId: number;
  storeName: string;
  internalCode: string;
  canonicalName: string;
  category: string | null;
  baseUnit: StockUnit | "unknown";
  vatRate: "VAT_10" | "VAT_22";
  accountingQuantity: number | null;
  salePrice: number | null;
  stockValue: number | null;
  lastCountedAt: Date | string | null;
};

type StockResult = { items: StockItem[]; total: number };

const unitLabel: Record<StockUnit | "unknown", string> = { kg: "кг", l: "л", piece: "шт", unknown: "—" };
const quantityText = (value: number) => String(Math.round(value * 1_000) / 1_000);
const moneyText = (value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
const displayMoscowDate = (value: Date | string | null) => value ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "";

export default function StockControl() {
  const [, setLocation] = useLocation();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [storeId, setStoreId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const selectedStoreId = Number(storeId);
  const stock = trpc.inventoryRegistry.stock.useQuery({ storeId: selectedStoreId || undefined, query: query.trim() || undefined, category: category || undefined, offset, limit: selectedStoreId ? 2_000 : 50 }, { enabled: Boolean(me.data && (isSeller || isManager || isAdmin)), retry: false });
  const result = stock.data as StockResult | undefined;
  const products = trpc.inventoryRegistry.products.useQuery({ storeId: selectedStoreId || undefined }, { enabled: Boolean(me.data && (isSeller || isManager || isAdmin)), retry: false });

  useEffect(() => {
    if (storeId || !stores.data?.length) return;
    if (isSeller && stores.data.length === 1) setStoreId(String(stores.data[0].id));
  }, [isSeller, storeId, stores.data]);

  const visibleStores = useMemo(() => (stores.data ?? []).filter(store => !store.isHidden), [stores.data]);
  const categories = useMemo(() => Array.from(new Set(((products.data ?? []) as Array<{ category?: string | null }>).map(product => product.category).filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right, "ru")), [products.data]);
  const canShowMore = Boolean(result && offset + result.items.length < result.total);
  const startRevision = (item?: StockItem) => {
    const params = new URLSearchParams();
    if (item?.storeId ?? selectedStoreId) params.set("store", String(item?.storeId ?? selectedStoreId));
    if (item?.productId) params.set("product", String(item.productId));
    setLocation(`/inventory-control${params.size ? `?${params}` : ""}`);
  };
  const revisionHref = (item: StockItem) => {
    const params = new URLSearchParams({ store: String(item.storeId), product: String(item.productId) });
    return `/inventory-control?${params}`;
  };

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) {
    return <AuditShell kicker="24 / ОСТАТКИ" title="Остатки"><section className="empty-state"><Boxes size={28}/><h2>Нет операционного доступа</h2><p>Остатки доступны только назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;
  }

  return <AuditShell kicker="24 / ОСТАТКИ" title="Остатки">
    <section className="page-lede stock-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Остатки магазинов</h2><p>Это отдельный рабочий список по точкам. Учетный остаток берется из последнего read-only снимка Эвотор и затем корректируется закрытой инвентаризацией или подтвержденным движением. Отображается продажная цена назначенного виду цен и сумма по ней; внутренняя себестоимость не раскрывается.</p></div></section>
    <details className="packet-card stock-rule-disclosure"><summary><span>КАК ЧИТАТЬ ОСТАТКИ</span><strong>«Не посчитан» — это не ноль</strong></summary><div><p>После «Обновить каталог» на закрепленной точке отображается read-only остаток Эвотор. Если такой снимок и закрытая ревизия отсутствуют, позиция остается со статусом «Не посчитан», а не подменяется нулем.</p><p>«Изменить в пересчете» сразу открывает черновик инвентаризации выбранного магазина и товара. Там вводится только фактический остаток; после закрытия пересчета система создает неизменяемую корректировку и общий audit.</p></div></details>

    <section className="packet-card stock-table-card">
      <div className="card-title"><div><span>УЧЕТНЫЙ ОСТАТОК</span><h3>Номенклатура по магазинам</h3></div><button type="button" className="subtle-button" onClick={() => startRevision()}><ClipboardCheck size={15}/>Новая ревизия</button></div>
      <div className="stock-controls">
        <label>Магазин<ThemedSelect value={storeId} onChange={event => { setStoreId(event.target.value); setOffset(0); }}><option value="">Все доступные магазины</option>{visibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect></label>
        <label>Категория<ThemedSelect value={category} onChange={event => { setCategory(event.target.value); setOffset(0); }}><option value="">Все категории</option>{categories.map(item => <option value={item} key={item}>{item}</option>)}</ThemedSelect></label>
        <label>Поиск товара<div className="stock-search"><input value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} placeholder="Название или код"/><Search size={15}/></div></label>
      </div>
	      {stock.isLoading ? <p className="packet-note">Собираем учетные остатки…</p> : stock.isError ? <p className="packet-note">Остатки недоступны: {stock.error.message}</p> : !result?.items.length ? <div className="empty-state compact"><Boxes size={25}/><h2>{query || category ? "Ничего не найдено" : "Номенклатура пока не загружена"}</h2><p>{query || category ? "Измените запрос, категорию или магазин." : "Сначала подтвердите каталог Эвотор для нужной точки."}</p></div> : <><div className="stock-summary"><strong>{result.total} {result.total === 1 ? "позиция" : result.total < 5 ? "позиции" : "позиций"}</strong><span>{selectedStoreId ? "Выбранная точка · показаны все позиции" : "Все доступные точки"}</span></div><div className="data-table-wrap stock-table-wrap"><table className="data-table stock-table"><thead><tr><th>№</th><th>Магазин</th><th>Категория</th><th>Товар</th><th>НДС</th><th>Продажная цена</th><th>Учетный остаток</th><th>Сумма по цене</th><th aria-label="Действие"></th></tr></thead><tbody>{result.items.map((item, index) => <tr key={`${item.storeId}:${item.productId}`}><td data-label="№">{offset + index + 1}</td><td data-label="Магазин"><strong>{item.storeName}</strong></td><td data-label="Категория">{item.category ?? "—"}</td><td data-label="Товар"><strong>{item.canonicalName}</strong><small>{item.internalCode}</small></td><td data-label="НДС">{item.vatRate === "VAT_22" ? "22%" : "10%"}</td><td data-label="Продажная цена" className="stock-money">{moneyText(item.salePrice)}</td><td data-label="Учетный остаток" className={item.accountingQuantity === null ? "stock-not-counted" : "stock-quantity"}>{item.accountingQuantity === null ? "Не посчитан" : `${quantityText(item.accountingQuantity)} ${unitLabel[item.baseUnit]}`}</td><td data-label="Сумма по цене" className="stock-money">{moneyText(item.stockValue)}</td><td data-label="Действие"><div className="stock-row-actions"><Link href={revisionHref(item)} className="subtle-button stock-revision-action"><ClipboardCheck size={14}/>Изменить в пересчете</Link></div></td></tr>)}</tbody></table></div>{canShowMore && <button type="button" className="subtle-button stock-more" onClick={() => setOffset(current => current + (selectedStoreId ? 2_000 : 50))}><ArrowDown size={14}/>Показать еще</button>}</>}
    </section>
  </AuditShell>;
}
