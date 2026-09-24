import { Boxes, ChevronDown, ClipboardList, EyeOff, FilePlus2, LoaderCircle, Minus, Plus, Printer, Save, Settings2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { DateRangeControl, ExactDateControl } from "@/components/DateRangeControl";
import { ThemedSelect } from "@/components/ui/themed-select";
import { positionLabel } from "@/lib/russianPlural";
import { formatBusinessDate, normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import "@/store-requests.css";

type RequestUnit = "kg" | "l" | "piece";
type CatalogUnit = "fraction" | "l" | "piece";
type StockState = "unknown" | "low" | "sufficient" | "high";
type RequestProduct = {
  id: number;
  catalogNumber: number;
  canonicalName: string;
  categoryName: string | null;
  baseUnit: CatalogUnit;
  isVisibleInRequests: boolean;
  weeklySold: number;
  dailySold: number | null;
  storeQuantity: number | null;
  daysCover: number | null;
  storeStockState: StockState;
  supplyStockState: StockState;
  supplySourceLabel: string | null;
  maxStoreCoverDays: number;
  recommendedQuantity: number | null;
  recommendation: "order_soon" | "no_recent_sales" | "normal";
};
type RequestLine = {
  id: number;
  productId: number | null;
  catalogNumber: number;
  productName: string;
  manualProductName?: string | null;
  manualPrintCategoryGroupId?: number | null;
  categoryName: string | null;
  requestedQuantity: number;
  unit: RequestUnit;
  note: string | null;
};
type RequestDetail = {
  id: number;
  requestNumber: number;
  storeId: number;
  storeName: string;
  businessDate: string;
  status: "draft" | "closed";
  note: string | null;
  closedAt: Date | string | null;
  updatedAt?: Date | string;
  lines: RequestLine[];
  comments: Array<{ id: number; slot: number; printCategoryGroupId: number; printCategoryGroupName: string; text: string }>;
};
type RequestListItem = Omit<RequestDetail, "lines" | "comments" | "closedAt"> & { lineCount: number };
type PrintGroup = { id: number; name: string; isActive: boolean };
type PrintProjection = {
  from: string;
  to: string;
  zebraMode: "none" | "rows" | "columns";
  headingFontSize: number;
  bodyFontSize: number;
  totalFontSize: number;
  headingBold: boolean;
  bodyBold: boolean;
  totalBold: boolean;
  showStoreQuantity: boolean;
  showAverageDailySales: boolean;
  showSalesCover: boolean;
  showOverstockSignal: boolean;
  recommendationFontSize: number;
  recommendationTone: "muted" | "dark";
  totalRequests: number;
  totalLines: number;
  printableRequestCount: number;
  printableLineCount: number;
  sheets: Array<{
    id: string;
    businessDate: string;
    storeGroupName: string;
    categoryGroupName: string;
    printMode: "per_store" | "grouped_stores";
    stockIndicator: { supplyGroupName: string | null; maxStoreCoverDays: number | null };
    stores: Array<{
      storeId: number;
      storeName: string;
      lines: Array<{ id: number; catalogNumber: number; productName: string; categoryName: string | null; requestedQuantity: string | number; unit: RequestUnit; note: string | null; requestNumber: number; stock: { storeQuantity: number | null; weeklySold: number; dailySold: number | null; daysCover: number | null; maxStoreCoverDays: number; recommendedQuantity: number | null; baseUnit: CatalogUnit } | null }>;
      comments: Array<{ id: number; slot: number; text: string; requestNumber: number }>;
    }>;
  }>;
};
type PrintStore = PrintProjection["sheets"][number]["stores"][number];
type PrintLineStock = NonNullable<PrintProjection["sheets"][number]["stores"][number]["lines"][number]["stock"]>;
type PrintMatrixRow = { catalogNumber: number; productName: string; unit: RequestUnit; quantities: Map<number, number>; stocks: Map<number, PrintLineStock>; total: number };

const unitLabel: Record<RequestUnit, string> = { kg: "кг", l: "л", piece: "шт" };
const catalogUnitLabel: Record<CatalogUnit, string> = { fraction: "кг", l: "л", piece: "шт" };
const stockLabel: Record<StockState, string> = { unknown: "нет среза", low: "мало", sufficient: "достаточно", high: "много" };
const requestSearchTokens = (value: string) => value
  .toLocaleLowerCase("ru-RU")
  .replace(/ё/g, "е")
  .split(/[^0-9A-Za-zА-Яа-я]+/)
  .filter(Boolean);
const toMoscowDate = () => {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => values.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const displayDate = (value: string) => formatBusinessDate(value);
const quantityText = (value: string | number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return String(Math.round(numeric * 1_000) / 1_000);
};
const normalizeQuantity = (value: string) => {
  const normalized = normalizeDecimalInputText(value).replace(/[^0-9.]/g, "");
  const [whole, ...fractionParts] = normalized.split(".");
  if (!fractionParts.length) return whole;
  return `${whole}.${fractionParts.join("").slice(0, 1)}`;
};
const requestPrintMatrix = (stores: PrintStore[]): PrintMatrixRow[] => {
  const rows = new Map<string, PrintMatrixRow>();
  for (const store of stores) {
    for (const line of store.lines) {
      const key = `${line.catalogNumber}:${line.productName}:${line.unit}`;
      const current = rows.get(key) ?? { catalogNumber: line.catalogNumber, productName: line.productName, unit: line.unit, quantities: new Map<number, number>(), stocks: new Map<number, PrintLineStock>(), total: 0 };
      const quantity = Number(line.requestedQuantity);
      current.quantities.set(store.storeId, (current.quantities.get(store.storeId) ?? 0) + quantity);
      if (line.stock) current.stocks.set(store.storeId, line.stock);
      current.total += quantity;
      rows.set(key, current);
    }
  }
  return Array.from(rows.values()).sort((left, right) => left.catalogNumber - right.catalogNumber || left.productName.localeCompare(right.productName, "ru"));
};
const requestUnitTotals = (entries: Array<{ quantity: number; unit: RequestUnit }>) => {
  const totals = new Map<RequestUnit, number>();
  for (const entry of entries) totals.set(entry.unit, (totals.get(entry.unit) ?? 0) + entry.quantity);
  return Array.from(totals.entries())
    .filter(([, quantity]) => quantity > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([unit, quantity]) => `${quantityText(quantity)}${unitLabel[unit]}`)
    .join(" · ") || "—";
};
const requestLineTotals = (lines: PrintStore["lines"]) => requestUnitTotals(lines.map(line => ({ quantity: Number(line.requestedQuantity), unit: line.unit })));
function orderSignal(product: RequestProduct, draft: string) {
  const quantity = Number(normalizeQuantity(draft));
  if (!Number.isFinite(quantity) || quantity <= 0 || !product.dailySold || product.dailySold <= 0) return null;
  const plannedDays = Math.round((quantity / product.dailySold) * 10) / 10;
  if (product.storeStockState === "high" && plannedDays > product.maxStoreCoverDays) return `заказ избыточен при текущем запасе магазина`;
  if (plannedDays > 21) return `объем примерно на ${quantityText(plannedDays)} дн.`;
  if (product.storeStockState === "low" && plannedDays < 1) return `заказ меньше одного дня продаж`;
  return null;
}

function requestPrintFacts(stock: PrintLineStock | null, settings: Pick<PrintProjection, "showStoreQuantity" | "showAverageDailySales" | "showSalesCover" | "showOverstockSignal">, requestedQuantity: number) {
  const facts: string[] = [];
  if (!stock) return settings.showStoreQuantity || settings.showAverageDailySales || settings.showSalesCover || settings.showOverstockSignal
    ? ["Факты: нет связи"]
    : facts;
  if (settings.showStoreQuantity) facts.push(`Остаток: ${stock.storeQuantity === null ? "нет среза" : `${quantityText(stock.storeQuantity)}${catalogUnitLabel[stock.baseUnit]}`}`);
  if (settings.showAverageDailySales) facts.push(stock.dailySold === null ? "Продажи: нет" : `Ср. продажи: ${quantityText(stock.dailySold)}${catalogUnitLabel[stock.baseUnit]}/день`);
  if (settings.showSalesCover) facts.push(stock.daysCover === null ? "Покрытие: нет" : `Покрытие: ${quantityText(stock.daysCover)} дн.`);
  if (settings.showOverstockSignal) {
    const projectedCover = stock.storeQuantity === null || stock.dailySold === null || stock.dailySold <= 0
      ? null
      : Math.round(((stock.storeQuantity + requestedQuantity) / stock.dailySold) * 10) / 10;
    if (projectedCover !== null && projectedCover > stock.maxStoreCoverDays) facts.push(`Сигнал: ${quantityText(projectedCover)} дн. после заказа; норма ${stock.maxStoreCoverDays} дн.`);
    else if (stock.recommendedQuantity === 0) facts.push(`Сигнал: не заказывать; норма ${stock.maxStoreCoverDays} дн.`);
  }
  return facts;
}

function RequestPrintSheet({ sheet, settings }: { sheet: PrintProjection["sheets"][number]; settings: Pick<PrintProjection, "showStoreQuantity" | "showAverageDailySales" | "showSalesCover" | "showOverstockSignal" | "recommendationFontSize" | "recommendationTone"> }) {
  const matrixRows = sheet.printMode === "grouped_stores" ? requestPrintMatrix(sheet.stores) : [];
  const comments = sheet.stores.flatMap(store => store.comments.map(comment => ({ ...comment, storeName: store.storeName })));
  const factStyle = { "--request-print-fact-size": `${settings.recommendationFontSize}pt`, "--request-print-fact-color": settings.recommendationTone === "dark" ? "#000" : "#515151" } as CSSProperties;
  return <article style={factStyle} className={`store-request-print-sheet${sheet.printMode === "grouped_stores" ? " is-matrix" : ""}`}><header><strong>{sheet.categoryGroupName}</strong><small>{displayDate(sheet.businessDate)} · {sheet.storeGroupName}</small></header>{sheet.printMode === "grouped_stores" ? <section className="store-request-print-matrix"><table><thead><tr><th>Товар</th>{sheet.stores.map(store => <th key={store.storeId}>{store.storeName}</th>)}<th>Итого</th></tr></thead><tbody>{matrixRows.map(row => <tr key={`${row.catalogNumber}:${row.productName}:${row.unit}`}><td>{row.productName}</td>{sheet.stores.map(store => { const hasQuantity = row.quantities.has(store.storeId); const requestedQuantity = Number(row.quantities.get(store.storeId) ?? 0); const facts = hasQuantity ? requestPrintFacts(row.stocks.get(store.storeId) ?? null, settings, requestedQuantity) : []; return <td key={store.storeId}>{hasQuantity ? `${quantityText(requestedQuantity)}${unitLabel[row.unit]}` : "—"}{facts.length > 0 && <small className="store-request-print-stock">{facts.join(" · ")}</small>}</td>; })}<td><b>{quantityText(row.total)}{unitLabel[row.unit]}</b></td></tr>)}</tbody><tfoot className={matrixRows.length % 2 === 1 ? "is-striped-total" : undefined}><tr><th scope="row">Итого позиций</th>{sheet.stores.map(store => <td key={store.storeId}>{store.lines.length} поз.</td>)}<td>{matrixRows.length} поз.</td></tr></tfoot></table></section> : sheet.stores.map(store => <section key={store.storeId}><h1>{store.storeName}</h1><table><thead><tr><th>Товар</th><th>Кол-во</th></tr></thead><tbody>{store.lines.map(line => { const facts = requestPrintFacts(line.stock, settings, Number(line.requestedQuantity)); return <tr key={`${store.storeId}:${line.id}`}><td>{line.productName}{facts.length > 0 && <small className="store-request-print-stock">{facts.join(" · ")}</small>}</td><td className="store-request-print-quantity"><b>{quantityText(line.requestedQuantity)}</b><small>{unitLabel[line.unit]}</small></td></tr>; })}</tbody><tfoot className={store.lines.length % 2 === 1 ? "is-striped-total" : undefined}><tr><th scope="row">Итого позиций</th><td>{store.lines.length} поз.</td></tr></tfoot></table></section>)}{comments.length > 0 && <div className="store-request-print-comments">{comments.map(comment => <p key={comment.id}><b>{comment.storeName}:</b> {comment.text}</p>)}</div>}</article>;
}

export default function StoreRequests() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const stores = trpc.inventoryRegistry.requestStores.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const isSeller = me.data?.role === "seller";
  const isManager = me.data?.role === "manager";
  const isAdmin = me.data?.role === "admin";
  const canPrintRequests = Boolean(isManager || isAdmin);
  const [storeId, setStoreId] = useState("");
  const [businessDate, setBusinessDate] = useState(toMoscowDate);
  const [printRange, setPrintRange] = useState(() => {
    const today = toMoscowDate();
    return { from: today, to: today };
  });
  const [historyRange, setHistoryRange] = useState(() => {
    const today = toMoscowDate();
    return { from: `${today.slice(0, 4)}-01-01`, to: today };
  });
  const [activeRequestId, setActiveRequestId] = useState<number>();
  const [focusOpenedRequest, setFocusOpenedRequest] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, { text: string }>>({
    1: { text: "" },
    2: { text: "" },
  });
  const [printProjection, setPrintProjection] = useState<PrintProjection | null>(null);
  const requestDraftRef = useRef<HTMLElement | null>(null);

  const selectedStoreId = Number(storeId);
  const requestProducts = trpc.inventoryRegistry.requestProducts.useQuery({ storeId: selectedStoreId || 0 }, { enabled: Boolean(selectedStoreId), retry: false });
  const requestListInput = useMemo(() => ({ storeId: selectedStoreId || undefined, from: isSeller ? undefined : historyRange.from, to: isSeller ? undefined : historyRange.to, limit: isSeller ? 10 : 100 }), [historyRange.from, historyRange.to, isSeller, selectedStoreId]);
  const requestList = trpc.inventoryRegistry.requestList.useQuery(requestListInput, { enabled: Boolean(me.data), retry: false });
  const requestDetail = trpc.inventoryRegistry.requestDetail.useQuery({ requestId: activeRequestId ?? 0 }, { enabled: Boolean(activeRequestId), retry: false });
  const printCandidates = trpc.inventoryRegistry.requestPrintCandidates.useQuery({ businessDate: printRange.from, storeId: selectedStoreId || undefined }, { enabled: canPrintRequests && printRange.from === printRange.to, retry: false });
  const active = requestDetail.data as RequestDetail | undefined;
  const isRequestOpening = Boolean(activeRequestId && requestDetail.isLoading);
  const requestOpenFailed = Boolean(activeRequestId && requestDetail.isError);
  const accessibleStores = stores.data ?? [];
  const products = (requestProducts.data ?? []) as RequestProduct[];
  const isAllStoresScope = Boolean(!isSeller && !selectedStoreId);

  useEffect(() => {
    if (storeId || !accessibleStores.length) return;
    if (isSeller && accessibleStores.length === 1) setStoreId(String(accessibleStores[0].id));
  }, [accessibleStores, isSeller, storeId]);

  useEffect(() => {
    if (!active) return;
    setExpandedCategory(null);
    setQuantityDrafts(Object.fromEntries(active.lines.filter(line => line.productId !== null).map(line => [line.productId!, quantityText(line.requestedQuantity)])));
    setCommentDrafts({
      1: { text: active.comments.find(comment => comment.slot === 1)?.text ?? "" },
      2: { text: active.comments.find(comment => comment.slot === 2)?.text ?? "" },
    });
  }, [active?.id]);

  useEffect(() => {
    if (!focusOpenedRequest || !active) return;
    const frame = window.requestAnimationFrame(() => requestDraftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    setFocusOpenedRequest(false);
    return () => window.cancelAnimationFrame(frame);
  }, [active, focusOpenedRequest]);

  useEffect(() => {
    if (!printProjection) return;
    // The portal is committed outside the interactive application shell before
    // readiness is checked; screen geometry is irrelevant because it is hidden
    // until print media applies.
    const firstFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const sheet = document.getElementById("request-print-root");
      const printableRows = sheet?.querySelectorAll(".store-request-print-sheet tbody tr").length ?? 0;
      if (!sheet || !printableRows) {
        toast.error("Печать не сформирована", { description: "Не удалось подготовить непустую подборку. Проверьте строки заявки и настройки печати." });
        setPrintProjection(null);
        return;
      }
      document.body.dataset.printTarget = "requests";
      const clearPrintTarget = () => {
        delete document.body.dataset.printTarget;
        window.removeEventListener("afterprint", clearPrintTarget);
      };
      window.addEventListener("afterprint", clearPrintTarget);
      window.print();
    }));
    return () => window.cancelAnimationFrame(firstFrame);
  }, [printProjection]);

  const productLines = useMemo(() => new Map((active?.lines ?? []).filter(line => line.productId !== null).map(line => [line.productId!, line])), [active?.lines]);
  const legacyManualLines = useMemo(() => (active?.lines ?? []).filter(line => line.productId === null), [active?.lines]);
  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const draftProductLines = useMemo(() => Object.entries(quantityDrafts)
    .map(([productId, raw]) => ({ productId: Number(productId), requestedQuantity: Number(normalizeQuantity(raw)) }))
    .filter(line => Number.isInteger(line.productId) && Number.isFinite(line.requestedQuantity) && line.requestedQuantity > 0)
    .map(line => {
      const product = productsById.get(line.productId);
      const persisted = productLines.get(line.productId);
      return {
        productId: line.productId,
        catalogNumber: product?.catalogNumber ?? persisted?.catalogNumber ?? 0,
        productName: product?.canonicalName ?? persisted?.productName ?? "Товар из сохраненной заявки",
        unit: product ? (product.baseUnit === "fraction" ? "kg" : product.baseUnit) : persisted?.unit ?? "kg",
        requestedQuantity: line.requestedQuantity,
      };
    }), [productLines, productsById, quantityDrafts]);
  const hasUnsavedDraftChanges = useMemo(() => {
    if (!active || active.status !== "draft") return false;
    const savedByProduct = new Map(active.lines.filter(line => line.productId !== null).map(line => [line.productId!, Number(line.requestedQuantity)]));
    if (savedByProduct.size !== draftProductLines.length) return true;
    if (active.businessDate !== businessDate) return true;
    if (draftProductLines.some(line => savedByProduct.get(line.productId) !== line.requestedQuantity)) return true;
    return ([1, 2] as const).some(slot => (active.comments.find(comment => comment.slot === slot)?.text ?? "") !== commentDrafts[slot].text);
  }, [active, businessDate, commentDrafts, draftProductLines]);
  const normalizedQueryTokens = requestSearchTokens(query);
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, RequestProduct[]>();
    for (const product of products) {
      const haystack = `${product.catalogNumber} ${product.canonicalName} ${product.categoryName ?? ""}`.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
      if (normalizedQueryTokens.length && !normalizedQueryTokens.every(token => haystack.includes(token))) continue;
      const category = product.categoryName || "Без категории";
      groups.set(category, [...(groups.get(category) ?? []), product]);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right, "ru"));
  }, [normalizedQueryTokens, products]);

  const refresh = async () => {
    await Promise.all([
      utils.inventoryRegistry.requestList.invalidate(),
      utils.inventoryRegistry.requestDetail.invalidate(),
      utils.inventoryRegistry.requestPrintCandidates.invalidate(),
      utils.audit.changes.invalidate(),
    ]);
  };
  const createRequest = trpc.inventoryRegistry.createRequest.useMutation({
    onSuccess: async result => {
      setActiveRequestId(result.request?.id);
      setFocusOpenedRequest(true);
      await refresh();
      toast.success(result.created ? "Заявка открыта" : "Открыта сохранённая заявка");
    },
    onError: error => toast.error("Заявка не открыта", { description: error.message }),
  });
  const saveRequestDraft = trpc.inventoryRegistry.saveRequestDraft.useMutation({
    onSuccess: async (result, variables) => {
      setQuantityDrafts(Object.fromEntries(variables.lines.map(line => [line.productId, quantityText(line.requestedQuantity)])));
      setCommentDrafts({
        1: { text: variables.comments.find(comment => comment.slot === 1)?.text.trim().replace(/\s+/g, " ") ?? "" },
        2: { text: variables.comments.find(comment => comment.slot === 2)?.text.trim().replace(/\s+/g, " ") ?? "" },
      });
      await refresh();
      setActiveRequestId(undefined);
      if (result.after.lineCount !== variables.lines.length + result.after.retainedManualLines) {
        toast.error("Заявка сохранена не полностью", { description: `Ожидалось ${variables.lines.length + result.after.retainedManualLines} строк, записано ${result.after.lineCount}. Повторите сохранение перед печатью.` });
        return;
      }
        toast.success(`Заявка сохранена: ${positionLabel(result.after.lineCount)}.`);
    },
    onError: error => toast.error("Заявка не сохранена", { description: error.message }),
  });
  const closeRequestsForPrint = trpc.inventoryRegistry.closeRequestsForPrint.useMutation({
    onSuccess: async result => {
      await refresh();
      if (!result.requests.length) { toast.error("Нет непустых открытых заявок для закрытия"); return; }
      toast.success(`Закрыто заявок: ${result.requests.length}`);
      printRequests.mutate({ from: result.businessDate, to: result.businessDate });
    },
    onError: error => toast.error("Заявки не закрыты", { description: error.message }),
  });
  const deleteDraft = trpc.inventoryRegistry.deleteRequestDraft.useMutation({
    onSuccess: async () => { setActiveRequestId(undefined); await refresh(); toast.success("Открытая заявка удалена"); },
    onError: error => toast.error("Открытая заявка не удалена", { description: error.message }),
  });
  const deleteClosedRequest = trpc.inventoryRegistry.deleteRequest.useMutation({
    onSuccess: async () => { setActiveRequestId(undefined); await refresh(); toast.success("Закрытая заявка удалена"); },
    onError: error => toast.error("Заявка не удалена", { description: error.message }),
  });
  const hideClosedRequest = trpc.inventoryRegistry.setRequestHidden.useMutation({
    onSuccess: async () => { setActiveRequestId(undefined); await refresh(); toast.success("Закрытая заявка скрыта из истории и печати"); },
    onError: error => toast.error("Заявка не скрыта", { description: error.message }),
  });
  const printRequests = trpc.inventoryRegistry.printRequests.useMutation({
    onSuccess: result => {
      const projection = result as PrintProjection;
      if (!projection.sheets.length || !projection.printableLineCount) {
        toast.error("Нет строк для печати", { description: projection.totalRequests ? "Заявка найдена, но сохранённых строк в ней нет. Откройте заявку, сохраните позиции и повторите печать." : "В выбранном срезе нет сохранённых заявок выбранных магазинов." });
        return;
      }
      setPrintProjection(projection);
    },
    onError: error => toast.error("Подборка для печати недоступна", { description: error.message }),
  });

  const openRequest = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStoreId) { toast.error("Выберите магазин"); return; }
    createRequest.mutate({ storeId: selectedStoreId, businessDate });
  };
  const setProductQuantity = (product: RequestProduct, raw: string) => {
    setQuantityDrafts(current => ({ ...current, [product.id]: normalizeQuantity(raw) }));
  };
  const normalizeProductQuantityDraft = (product: RequestProduct, preferred?: number) => {
    if (!active || active.status !== "draft") return;
    const raw = preferred === undefined ? quantityDrafts[product.id] ?? "" : String(preferred);
    const quantity = Number(normalizeQuantity(raw));
    setQuantityDrafts(current => ({ ...current, [product.id]: Number.isFinite(quantity) && quantity > 0 ? quantityText(quantity) : "" }));
  };
  const changeProductQuantity = (product: RequestProduct, delta: number) => {
    const current = Number(normalizeQuantity(quantityDrafts[product.id] ?? quantityText(productLines.get(product.id)?.requestedQuantity ?? 0))) || 0;
    const step = product.baseUnit === "fraction" ? 0.5 : 1;
    normalizeProductQuantityDraft(product, Math.max(0, Math.round((current + delta * step) * 10) / 10));
  };
  const toggleCategory = (category: string) => setExpandedCategory(current => current === category ? null : category);
  const openFromHistory = (item: RequestListItem) => {
    setFocusOpenedRequest(true);
    setActiveRequestId(item.id);
    setStoreId(String(item.storeId));
    setBusinessDate(item.businessDate);
    setPrintRange({ from: item.businessDate, to: item.businessDate });
  };
  const returnToRequestHistory = () => {
    setActiveRequestId(undefined);
    if (!isSeller) setStoreId("");
  };
  const saveDraft = () => {
    if (!active || active.status !== "draft") return;
    saveRequestDraft.mutate({
      requestId: active.id,
      businessDate,
      lines: draftProductLines.map(line => ({ productId: line.productId, requestedQuantity: line.requestedQuantity })),
      comments: ([1, 2] as const).map(slot => ({ slot, text: commentDrafts[slot].text })),
    });
  };
  const requestPrintSheet = printProjection ? createPortal(
    <section id="request-print-root" className="store-request-print" data-zebra-mode={printProjection.zebraMode} style={{ "--request-print-heading-size": `${printProjection.headingFontSize}pt`, "--request-print-body-size": `${printProjection.bodyFontSize}pt`, "--request-print-total-size": `${printProjection.totalFontSize}pt`, "--request-print-heading-weight": printProjection.headingBold ? 700 : 400, "--request-print-body-weight": printProjection.bodyBold ? 700 : 400, "--request-print-total-weight": printProjection.totalBold ? 700 : 400 } as CSSProperties} aria-hidden="true" aria-label="Печатная разметка заявок">{printProjection.sheets.map(sheet => <RequestPrintSheet key={sheet.id} sheet={sheet} settings={printProjection}/>)}</section>, document.body
  ) : null;

  if (!me.isLoading && !isSeller && !isManager && !isAdmin) return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов"><section className="empty-state"><ClipboardList size={28}/><h2>Нет операционного доступа</h2><p>Заявки доступны назначенному продавцу, руководителю или администратору.</p></section></AuditShell>;

  return <AuditShell kicker="30 / ЗАЯВКИ" title="Заявки магазинов">
    <section className="page-lede request-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Заявка магазина</h2><p>Соберите потребность по категориям. В заявку попадают только название и количество; цены и себестоимость не раскрываются.</p></div></section>

    {isRequestOpening && <section className="packet-card request-open-loader" role="status" aria-live="polite"><LoaderCircle size={22}/><div><span>ОТКРЫВАЕМ ЗАЯВКУ</span><strong>Загружаем открытую заявку…</strong><small>Переходим к форме сразу после загрузки.</small></div></section>}
    {requestOpenFailed && <section className="packet-card request-open-loader request-open-error" role="alert"><div><span>ЗАЯВКА НЕ ОТКРЫТА</span><strong>Не удалось загрузить выбранную заявку.</strong><small>Вернитесь к списку и повторите попытку.</small></div><button type="button" className="subtle-button" onClick={() => setActiveRequestId(undefined)}>К списку заявок</button></section>}
    {!active && !isRequestOpening && !requestOpenFailed && <section className="packet-card request-create-card">
      <div className="card-title"><div><span>НОВАЯ ЗАЯВКА</span><h3>Выберите точку и дату</h3></div><ClipboardList size={20}/></div>
      <form className="request-open-form" data-scope={isAllStoresScope ? "all" : "store"} onSubmit={openRequest}>
        <label>Магазин
          {isSeller && accessibleStores.length === 1 ? <strong className="request-store-fixed">{accessibleStores[0].name}</strong> : isSeller ? <strong className="request-store-fixed">Выберите магазин</strong> : <ThemedSelect searchable searchPlaceholder="Найти магазин" value={storeId} onChange={event => setStoreId(event.target.value)} aria-label="Выбрать магазин для заявок"><option value="">Все магазины</option>{accessibleStores.map(store => <option value={store.id} key={store.id}>{store.name}</option>)}</ThemedSelect>}
        </label>
        <label>Дата заявки
          {isSeller ? <strong className="request-today">{displayDate(businessDate)}</strong> : <ExactDateControl value={businessDate} onChange={setBusinessDate} title="ДАТА ЗАЯВКИ" ariaLabel="Выбрать дату заявки"/>}
        </label>
        {!isAllStoresScope && <button className="subtle-button request-open-action" disabled={!selectedStoreId || createRequest.isPending}><FilePlus2 size={16}/>{createRequest.isPending ? "Открываем…" : "Открыть заявку"}</button>}
      </form>
      {!isSeller && <p className="request-open-hint">Для новой заявки выберите одну точку. «Все магазины» оставляет только сводную историю и не открывает заявку.</p>}
    </section>}

    {active && <section className="packet-card request-draft-card" ref={requestDraftRef} tabIndex={-1}>
      <div className="card-title request-draft-title"><div><span>{active.status === "draft" ? "ОТКРЫТАЯ ЗАЯВКА" : "ЗАКРЫТАЯ ЗАЯВКА"}</span><h3>{active.storeName} · {displayDate(active.businessDate)}</h3></div>{active.status === "draft" && !isSeller && <label className="request-edit-date">Дата заявки<ExactDateControl value={businessDate} onChange={setBusinessDate} title="ИЗМЕНИТЬ ДАТУ ЗАЯВКИ" ariaLabel="Изменить дату открытой заявки"/></label>}</div>
      {active.status === "draft" && <div className="request-actions"><ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger request-delete-draft" disabled={deleteDraft.isPending || saveRequestDraft.isPending}><Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить заявку"}</button>} title="Удалить открытую заявку?" description="Открытая заявка и её строки будут удалены. Несохранённые локальные изменения также не попадут в заявку. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить открытую заявку" disabled={deleteDraft.isPending || saveRequestDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: active.id })}/><button type="button" className="subtle-button request-save-draft" disabled={saveRequestDraft.isPending || !hasUnsavedDraftChanges} onClick={saveDraft}><Save size={14}/>{saveRequestDraft.isPending ? "Сохраняем…" : "Сохранить заявку"}</button><button type="button" className="subtle-button request-cancel-draft" disabled={saveRequestDraft.isPending} onClick={returnToRequestHistory}>К списку заявок</button></div>}
      {active.status === "draft" ? <>
          <div className="request-search-row"><label>Поиск товара<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, код или не полное имя" autoComplete="off"/></label></div>
        {requestProducts.isLoading ? <p className="packet-note">Загружаем доступную номенклатуру…</p> : <div className="request-catalog" aria-label="Категории товаров для заявки">{groupedProducts.map(([category, categoryProducts]) => {
            const isOpen = expandedCategory === category;
          return <section className="request-category" key={category}>
            <button type="button" className="request-category-trigger" onClick={() => toggleCategory(category)} aria-expanded={isOpen}><span><i>КАТЕГОРИЯ</i>{category}</span><small>{positionLabel(categoryProducts.length)}</small><ChevronDown size={17}/></button>
            {isOpen && <div className="request-category-products">{categoryProducts.map(product => {
              const line = productLines.get(product.id);
              const draft = quantityDrafts[product.id] ?? (line ? quantityText(line.requestedQuantity) : "");
              return <article className="request-product-row" key={product.id}>
                <div className="request-product-name"><span>№ {product.catalogNumber}</span><strong>{product.canonicalName}</strong>{!product.isVisibleInRequests && <small className="request-admin-only">видно только администратору</small>}<div className="request-product-signals">{product.storeQuantity !== null ? <small>Фактический остаток магазина: {quantityText(product.storeQuantity)}{catalogUnitLabel[product.baseUnit]}</small> : <small>Фактический остаток магазина: нет среза</small>}{product.supplySourceLabel && <i className={`request-stock ${product.supplyStockState}`}>{product.supplySourceLabel}: {stockLabel[product.supplyStockState]}</i>}{product.dailySold !== null && <small>Продажи за 7 дн.: {quantityText(product.weeklySold)} {catalogUnitLabel[product.baseUnit]} · в среднем {quantityText(product.dailySold)} {catalogUnitLabel[product.baseUnit]}/день</small>}{product.daysCover !== null && <small>В магазине запас примерно на {quantityText(product.daysCover)} дн.; норма категории — до {product.maxStoreCoverDays} дн.</small>}{product.recommendedQuantity !== null && <b>{product.recommendedQuantity > 0 ? `Рекомендуем заказать ${quantityText(product.recommendedQuantity)} ${catalogUnitLabel[product.baseUnit]}: средняя продажа за день + запас` : `Не рекомендуется заказывать: запаса в магазине достаточно (норма — до ${product.maxStoreCoverDays} дн.)`}</b>}{product.recommendation === "order_soon" && product.recommendedQuantity === null && <b>Рекомендуем проверить наличие и заказать</b>}{orderSignal(product, draft) && <b className="request-order-signal">{orderSignal(product, draft)}</b>}</div></div>
                <div className="request-quantity-stepper"><button type="button" className="subtle-button" aria-label={`Уменьшить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, -1)} disabled={saveRequestDraft.isPending}><Minus size={15}/></button><label><input aria-label={`Количество: ${product.canonicalName}`} data-decimal-input type="text" inputMode="decimal" value={draft} onChange={event => setProductQuantity(product, event.target.value)} onBlur={() => normalizeProductQuantityDraft(product)} placeholder="0"/><small>{catalogUnitLabel[product.baseUnit]}</small></label><button type="button" className="subtle-button" aria-label={`Увеличить количество: ${product.canonicalName}`} onClick={() => changeProductQuantity(product, 1)} disabled={saveRequestDraft.isPending}><Plus size={15}/></button></div>
              </article>;
            })}</div>}
          </section>;
        })}</div>}
        {!groupedProducts.length && <div className="request-empty-lines"><Boxes size={24}/><div><strong>Ничего не найдено</strong><p>Измените запрос: в заявке доступны только товары общего справочника.</p></div></div>}
        <section className="request-comments" aria-label="Комментарии к печати"><div><span>КОММЕНТАРИИ</span><small>Создайте или измените текст; «Удалить комментарий» очистит поле и удалит его при сохранении заявки.</small></div>{([1, 2] as const).map(slot => <div className="request-comment-editor" key={slot}><label>{slot === 1 ? "Комментарий к Мороженной продукции" : "Комментарий к Копченой продукции"}<textarea value={commentDrafts[slot].text} onChange={event => setCommentDrafts(current => ({ ...current, [slot]: { ...current[slot], text: event.target.value } }))} maxLength={2_000} placeholder={slot === 1 ? "Пожелания к мороженной продукции" : "Пожелания к копченой продукции"}/></label>{commentDrafts[slot].text.trim().length > 0 && <button type="button" className="subtle-button subtle-danger" disabled={saveRequestDraft.isPending} onClick={() => setCommentDrafts(current => ({ ...current, [slot]: { text: "" } }))}><Trash2 size={14}/>Удалить комментарий</button>}</div>)}</section>
        <div className="request-chosen-lines"><div><span>В ЗАЯВКЕ{hasUnsavedDraftChanges ? " · НЕ СОХРАНЕНО" : ""}</span><strong>{positionLabel(draftProductLines.length + legacyManualLines.length)}</strong></div>{draftProductLines.length || legacyManualLines.length ? <div>{draftProductLines.map(line => <article key={line.productId}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "без номера"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b><button type="button" className="subtle-button subtle-danger" aria-label={`Убрать ${line.productName}`} disabled={saveRequestDraft.isPending} onClick={() => setQuantityDrafts(current => ({ ...current, [line.productId]: "" }))}><Trash2 size={14}/></button></article>)}{legacyManualLines.map(line => <article key={`manual-${line.id}`}><span>вручную</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b></article>)}</div> : <p>Добавьте товары из раскрытой категории.</p>}</div>
        <div className="request-draft-footer"><span>{hasUnsavedDraftChanges ? "Изменения пока локальные: сохраните заявку перед печатью или выходом к списку." : "Открытая заявка сохранена и доступна для печати. Закрытие — отдельное действие уполномоченного руководителя или администратора."}</span></div>
      </> : <div className="request-closed-lines">{active.lines.map(line => <article key={line.id}><span>{line.catalogNumber ? `№ ${line.catalogNumber}` : "вручную"}</span><strong>{line.productName}</strong><b>{quantityText(line.requestedQuantity)} {unitLabel[line.unit]}</b></article>)}</div>}
    </section>}

    <section className="packet-card request-history"><div className="card-title"><div><span>{isSeller ? "МОИ ЗАЯВКИ" : "ИСТОРИЯ ЗАЯВОК"}</span><h3>{isSeller ? "Последние заявки точки" : selectedStoreId ? "Заявки выбранного магазина" : "Заявки всех доступных магазинов"}</h3></div>{!isSeller && <DateRangeControl value={historyRange} onChange={setHistoryRange} title="ПЕРИОД СПИСКА ЗАЯВОК" ariaLabel="Выбрать период списка заявок"/>}</div>{requestList.isLoading ? <p className="packet-note">Загружаем заявки…</p> : (requestList.data as RequestListItem[] | undefined)?.length ? <div className="request-history-list">{(requestList.data as RequestListItem[]).map(item => <article key={item.id} className={item.id === activeRequestId ? "selected" : ""}><button type="button" className="request-history-select" aria-current={item.id === activeRequestId ? "true" : undefined} onClick={() => openFromHistory(item)}><span>{displayDate(item.businessDate)}</span><strong>{item.storeName}</strong><small>{item.status === "closed" ? "Сохраненная подборка доступна только для просмотра" : "Открытая заявка доступна для изменения и печати"}</small><b className={item.status === "closed" ? "closed" : "draft"}>{item.status === "closed" ? "Закрыта" : "Открыта"}</b></button>{item.status === "draft" && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger request-history-delete" disabled={deleteDraft.isPending}><Trash2 size={14}/><span>Удалить</span></button>} title="Удалить открытую заявку?" description="Открытая заявка и её строки будут удалены. Закрытые заявки и печатные подборки не изменятся; событие останется в общем журнале." confirmLabel="Удалить открытую заявку" disabled={deleteDraft.isPending} onConfirm={() => deleteDraft.mutate({ requestId: item.id })}/>} {item.status === "closed" && canPrintRequests && <><ConfirmDangerDialog trigger={<button type="button" className="subtle-button request-history-hide" disabled={hideClosedRequest.isPending}><EyeOff size={14}/><span>Скрыть</span></button>} title="Скрыть закрытую заявку?" description="Заявка останется в журнале и не будет удалена, но исчезнет из обычной истории и печатных подборок." confirmLabel="Скрыть заявку" disabled={hideClosedRequest.isPending} onConfirm={() => hideClosedRequest.mutate({ requestId: item.id, hidden: true })}/><ConfirmDangerDialog trigger={<button type="button" className="subtle-button subtle-danger request-history-delete" disabled={deleteClosedRequest.isPending}><Trash2 size={14}/><span>Удалить</span></button>} title="Удалить закрытую заявку?" description="Будут удалены закрытая заявка, ее строки и комментарии. Печатный лист и событие удаления останутся в журнале." confirmLabel="Удалить заявку" disabled={deleteClosedRequest.isPending} onConfirm={() => deleteClosedRequest.mutate({ requestId: item.id })}/></>}</article>)}</div> : <div className="empty-state compact"><ClipboardList size={25}/><h2>Заявок пока нет</h2><p>После открытия первой заявки здесь появится история выбранного магазина.</p></div>}{canPrintRequests && <section className="request-history-print" aria-label="Печать заявок из истории"><div className="request-history-print-title"><span>ПЕЧАТЬ ЗАЯВОК</span><strong>{isAllStoresScope ? "Все доступные магазины" : "Выбранный магазин"}</strong></div><div className="request-history-print-controls"><DateRangeControl value={printRange} onChange={setPrintRange} title="ПЕРИОД ПЕЧАТИ ЗАЯВОК" ariaLabel="Выбрать период заявок для печати"/><div className="request-print-actions"><button type="button" className="subtle-button" disabled={printRequests.isPending} onClick={() => printRequests.mutate({ from: printRange.from, to: printRange.to, storeId: selectedStoreId || undefined })}><Printer size={16}/>{printRequests.isPending ? "Готовим…" : isAllStoresScope ? "Распечатать заявки" : "Распечатать"}</button>{isAllStoresScope && printRange.from === printRange.to && (printCandidates.data?.count ?? 0) > 0 && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button" disabled={closeRequestsForPrint.isPending || printRequests.isPending}><Printer size={16}/>{closeRequestsForPrint.isPending || printRequests.isPending ? "Готовим…" : "Распечатать и закрыть"}</button>} title="Распечатать и закрыть все заявки?" description={`Будут закрыты все непустые открытые заявки на выбранную дату (${printCandidates.data?.count ?? 0}); затем сформируется печать всех активных групп.`} confirmLabel="Распечатать и закрыть" disabled={closeRequestsForPrint.isPending || printRequests.isPending} onConfirm={() => closeRequestsForPrint.mutate({ businessDate: printRange.from })}/>} {isAdmin && <Link href="/print-settings" className="subtle-button request-print-settings-link"><Settings2 size={16}/>Настройки печати</Link>}</div></div><small className="request-history-print-note">{printRange.from === printRange.to ? "Печатаются открытые и закрытые заявки по активным группам и категориям." : "Для диапазона доступна read-only печать; закрытие выполняется только за один день."}</small></section>}</section>
    {requestPrintSheet}
  </AuditShell>;
}
