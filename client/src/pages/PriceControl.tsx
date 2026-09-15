import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  Eye,
  FileSearch,
  GitCompareArrows,
  History,
  Link2,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Tags,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { trpc } from "@/lib/trpc";

type Preview = {
  fileName: string;
  sourceType: "xls" | "xlsx" | "pdf" | "docx";
  detectedSupplierName: string | null;
  detectedSourceDate: string | null;
  rows: Array<{
    rawName: string;
    packaging: string | null;
    category: string | null;
    priceOptions: Array<{
      priceAmount: number;
      normalizedPrice: number | null;
      normalizedUnit: string;
    }>;
  }>;
  warningCount: number;
  warnings: string[];
};
type PriceLevel = "none" | "view" | "upload" | "edit";
export type PriceControlSection = "compare" | "import" | "directory";
type PriceBasis = "kg" | "l" | "piece" | "package" | "unknown";
type ProductDraft = {
  id: number | null;
  canonicalName: string;
  internalCode: string;
  category: string;
  baseUnit: "kg" | "l" | "piece" | "unknown";
};
type SupplierDraft = {
  id: number;
  name: string;
  contactNote: string;
  isActive: boolean;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
        new Date(`${value}T12:00:00`)
      )
    : "дата не указана";
const modeLabel: Record<string, string> = {
  standard: "основная",
  cash: "наличные",
  cashless_no_vat: "б/нал без НДС",
  cashless_vat: "б/нал с НДС",
  spb: "СПБ",
  moscow: "Москва",
  special: "спецпредложение",
  threshold: "цена от объема",
};
const unitLabel = (unit: string) =>
  unit === "kg" ? "кг" : unit === "l" ? "л" : unit === "piece" ? "шт" : "ед.";
const priceLabel = (price: {
  normalizedPrice: number;
  normalizedUnit: string;
}) =>
  `${formatMoney(price.normalizedPrice)} ₽/${unitLabel(price.normalizedUnit)}`;
const basisLabel: Record<PriceBasis, string> = {
  kg: "за кг",
  l: "за л",
  piece: "за шт",
  package: "за уп.",
  unknown: "не указана",
};
const sectionMeta: Record<
  PriceControlSection,
  { href: string; label: string; title: string; kicker: string }
> = {
  compare: {
    href: "/price-control",
    label: "Сравнение",
    title: "Предложения поставщиков",
    kicker: "20 / ПРАЙС‑КОНТРОЛЬ",
  },
  import: {
    href: "/price-control/import",
    label: "Импорт прайсов",
    title: "Импорт прайс‑листов",
    kicker: "20 / ИМПОРТ ПРАЙСОВ",
  },
  directory: {
    href: "/price-control/directory",
    label: "Справочник",
    title: "Справочник прайс‑контроля",
    kicker: "20 / СПРАВОЧНИК ПРАЙСОВ",
  },
};

async function postPriceFile(
  path: string,
  file: File,
  query: Record<string, string>
) {
  const response = await fetch(
    `${path}?${new URLSearchParams(query).toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    }
  );
  const body = await response
    .json()
    .catch(() => ({ error: "Не удалось получить ответ сервера." }));
  if (!response.ok)
    throw new Error(body.error ?? "Не удалось обработать прайс‑лист.");
  return body;
}

function PriceSectionNav({ active }: { active: PriceControlSection }) {
  return (
    <nav className="price-section-nav" aria-label="Разделы прайс-контроля">
      {(
        Object.entries(sectionMeta) as Array<
          [PriceControlSection, typeof sectionMeta.compare]
        >
      ).map(([key, item]) => (
        <Link
          key={key}
          href={item.href}
          className={active === key ? "active" : ""}
        >
          {key === "compare" ? (
            <GitCompareArrows size={15} />
          ) : key === "import" ? (
            <Upload size={15} />
          ) : (
            <BookOpenCheck size={15} />
          )}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function PriceControl({
  section = "compare",
}: {
  section?: PriceControlSection;
}) {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const level: PriceLevel =
    me.data?.role === "admin" ? "edit" : (me.data?.priceAccessLevel ?? "none");
  const canView = level !== "none";
  const canUpload = level === "upload" || level === "edit";
  const canEdit = level === "edit";
  const overview = trpc.priceControl.overview.useQuery(undefined, {
    enabled: canView,
    retry: false,
  });
  const invalidate = () => utils.priceControl.overview.invalidate();
  const createProduct = trpc.priceControl.createProduct.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Внутренний товар создан");
    },
    onError: error => toast.error(error.message),
  });
  const updateProduct = trpc.priceControl.updateProduct.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Товар справочника обновлен");
    },
    onError: error => toast.error(error.message),
  });
  const updateSupplier = trpc.priceControl.updateSupplier.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Поставщик обновлен");
    },
    onError: error => toast.error(error.message),
  });
  const updateOffer = trpc.priceControl.updateOffer.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Цена прайс‑листа обновлена");
    },
    onError: error => toast.error(error.message),
  });
  const updateImportDate = trpc.priceControl.updateImportDate.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Дата прайс‑листа обновлена");
    },
    onError: error => toast.error(error.message),
  });
  const linkRow = trpc.priceControl.linkRow.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Связь поставщика сохранена", {
        description:
          "Следующие прайсы этого поставщика будут сопоставляться автоматически.",
      });
    },
    onError: error => toast.error(error.message),
  });
  const reassignAlias = trpc.priceControl.reassignAlias.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Автосвязь поставщика переназначена");
    },
    onError: error => toast.error(error.message),
  });
  const unlinkAlias = trpc.priceControl.unlinkAlias.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Автосвязь поставщика отменена");
    },
    onError: error => toast.error(error.message),
  });
  const deleteImport = trpc.priceControl.deleteImport.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Прайс‑лист удален");
    },
    onError: error => toast.error(error.message),
  });
  const downloadImport = trpc.priceControl.downloadImport.useMutation({
    onError: error => toast.error(error.message),
  });

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(
    null
  );
  const [linkTargets, setLinkTargets] = useState<Record<number, string>>({});
  const [aliasTargets, setAliasTargets] = useState<Record<number, string>>({});
  const [newNames, setNewNames] = useState<Record<number, string>>({});
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft | null>(
    null
  );
  const [offerDrafts, setOfferDrafts] = useState<
    Record<number, { priceAmount: string; priceBasis: PriceBasis }>
  >({});
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          (overview.data?.products ?? []).map(
            product => product.category || "Без категории"
          )
        )
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [overview.data?.products]
  );
  const filteredComparisons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return (overview.data?.comparisons ?? [])
      .filter(item => {
        const category = item.product.category || "Без категории";
        const matchQuery =
          !query ||
          `${item.product.canonicalName} ${item.product.internalCode} ${item.product.variant ?? ""} ${item.product.sizeText ?? ""}`
            .toLocaleLowerCase("ru")
            .includes(query);
        return matchQuery && (!categoryFilter || category === categoryFilter);
      })
      .map(item => {
        const offers = (
          supplierFilter
            ? item.offers.filter(
                offer => String(offer.supplierId) === supplierFilter
              )
            : item.offers
        )
          .filter(
            offer =>
              offer.importId !== null &&
              offer.rowId !== null &&
              offer.priceId !== null &&
              offer.supplierId !== null &&
              offer.normalizedPrice !== null &&
              offer.normalizedUnit !== null &&
              offer.priceAmount !== null &&
              offer.priceBasis !== null
          )
          .map(offer => ({
            ...offer,
            importId: Number(offer.importId),
            rowId: Number(offer.rowId),
            priceId: Number(offer.priceId),
            supplierId: Number(offer.supplierId),
            supplierName: offer.supplierName ?? "Неизвестный поставщик",
            rawName: offer.rawName ?? "Без названия",
            priceAmount: Number(offer.priceAmount),
            priceBasis: offer.priceBasis as PriceBasis,
            normalizedPrice: Number(offer.normalizedPrice),
            normalizedUnit: offer.normalizedUnit,
            priceMode: offer.priceMode ?? "standard",
          }))
          .sort((a, b) => a.normalizedPrice - b.normalizedPrice);
        const best = offers[0];
        const next = offers.find(
          offer =>
            offer.supplierId !== best?.supplierId &&
            offer.normalizedUnit === best?.normalizedUnit
        );
        const savings =
          best && next
            ? Number((next.normalizedPrice - best.normalizedPrice).toFixed(2))
            : null;
        return {
          ...item,
          offers,
          recommendation:
            best && next && savings !== null
              ? {
                  supplierId: best.supplierId,
                  supplierName: best.supplierName,
                  normalizedPrice: best.normalizedPrice,
                  normalizedUnit: best.normalizedUnit,
                  savings,
                  savingsPercent: Number(
                    ((savings / next.normalizedPrice) * 100).toFixed(1)
                  ),
                }
              : null,
        };
      })
      .filter(item => item.offers.length);
  }, [overview.data?.comparisons, search, categoryFilter, supplierFilter]);
  const selected =
    filteredComparisons.find(item => item.product.id === selectedProductId) ??
    filteredComparisons[0] ??
    null;
  const chartData = (selected?.offers ?? []).map(offer => ({
    name: offer.supplierName,
    price: offer.normalizedPrice,
    winner: selected?.recommendation?.supplierId === offer.supplierId,
  }));
  const historyRows = useMemo(
    () =>
      (overview.data?.history ?? [])
        .filter(
          item =>
            item.productId === selected?.product.id &&
            (!supplierFilter || String(item.supplierId) === supplierFilter) &&
            item.normalizedPrice !== null &&
            item.supplierName !== null
        )
        .map(item => ({
          ...item,
          normalizedPrice: Number(item.normalizedPrice),
          supplierName: item.supplierName ?? "Неизвестный поставщик",
        })),
    [overview.data?.history, selected?.product.id, supplierFilter]
  );
  const historySuppliers = useMemo(
    () => Array.from(new Set(historyRows.map(item => item.supplierName))),
    [historyRows]
  );
  const historyData = useMemo(() => {
    const dates = new Map<string, Record<string, string | number>>();
    historyRows.forEach(item => {
      const point = dates.get(item.date) ?? { date: item.date };
      const current = point[item.supplierName];
      if (typeof current !== "number" || item.normalizedPrice < current)
        point[item.supplierName] = item.normalizedPrice;
      dates.set(item.date, point);
    });
    return Array.from(dates.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [historyRows]);
  const selectedImport =
    (overview.data?.imports ?? []).find(item => item.id === selectedImportId) ??
    null;
  const selectedImportPreview =
    (overview.data?.importPreviews ?? []).find(
      item => item.importId === selectedImport?.id
    ) ?? null;

  const inspectFile = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const result = await postPriceFile("/api/price-import/preview", file, {
        fileName: file.name,
      });
      setPreview(result);
      setSupplierName(result.detectedSupplierName ?? "");
      setSourceDate(result.detectedSourceDate ?? "");
      toast.success("Прайс‑лист разобран", {
        description: `Распознано строк с ценой: ${result.rows.length}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось разобрать прайс‑лист."
      );
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };
  const commitFile = async () => {
    if (!file || !preview || !supplierName.trim()) return;
    setCommitting(true);
    try {
      const result = await postPriceFile("/api/price-import/commit", file, {
        fileName: file.name,
        supplierName: supplierName.trim(),
        ...(sourceDate ? { sourceDate } : {}),
      });
      await invalidate();
      toast.success("Прайс‑лист сохранен", {
        description: `Автосвязано: ${result.linked}; на проверке: ${result.suggested}; без связи: ${result.unmapped}.`,
      });
      setFile(null);
      setPreview(null);
      setSupplierName("");
      setSourceDate("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить прайс‑лист."
      );
    } finally {
      setCommitting(false);
    }
  };
  const downloadExisting = async (importId: number) => {
    const target = window.open("about:blank", "_blank");
    try {
      const result = await downloadImport.mutateAsync({ importId });
      if (target) target.location.href = result.url;
      else window.location.assign(result.url);
    } catch {
      target?.close();
    }
  };
  const linkExisting = (rowId: number) => {
    const productId = Number(linkTargets[rowId]);
    if (productId) linkRow.mutate({ rowId, productId, saveAlias: true });
  };
  const reassignExistingAlias = (aliasId: number, currentProductId: number) => {
    const productId = Number(aliasTargets[aliasId] ?? currentProductId);
    if (productId && productId !== currentProductId)
      reassignAlias.mutate({ aliasId, productId });
  };
  const createAndLink = async (
    rowId: number,
    rawName: string,
    rawCategory: string | null
  ) => {
    const canonicalName = (newNames[rowId] || rawName).trim();
    if (!canonicalName) return;
    try {
      const product = await createProduct.mutateAsync({
        canonicalName,
        ...(rawCategory ? { category: rawCategory } : {}),
      });
      await linkRow.mutateAsync({
        rowId,
        productId: product.id,
        saveAlias: true,
      });
    } catch {
      /* notification emitted in mutations */
    }
  };
  const saveProduct = async () => {
    if (!productDraft?.canonicalName.trim()) return;
    if (productDraft.id) {
      await updateProduct.mutateAsync({
        id: productDraft.id,
        canonicalName: productDraft.canonicalName.trim(),
        internalCode: productDraft.internalCode.trim(),
        category: productDraft.category.trim() || null,
        baseUnit: productDraft.baseUnit,
      });
    } else {
      await createProduct.mutateAsync({
        canonicalName: productDraft.canonicalName.trim(),
        ...(productDraft.internalCode.trim()
          ? { internalCode: productDraft.internalCode.trim() }
          : {}),
        ...(productDraft.category.trim()
          ? { category: productDraft.category.trim() }
          : {}),
        baseUnit: productDraft.baseUnit,
      });
    }
    setProductDraft(null);
  };
  const meta = sectionMeta[section];

  if (me.isLoading)
    return (
      <AuditShell kicker={meta.kicker} title={meta.title}>
        <section className="empty-state">
          <Loader2 className="animate-spin" />
          <p>Проверяем доступ к прайс‑контролю…</p>
        </section>
      </AuditShell>
    );
  if (!canView)
    return (
      <AuditShell kicker={meta.kicker} title={meta.title}>
        <section className="empty-state price-empty">
          <PackageSearch size={30} />
          <h2>Нет доступа к прайс‑контролю</h2>
          <p>
            Администратор может назначить просмотр, загрузку или изменение на
            странице «Доступ». Права на финансовый импорт не меняются.
          </p>
        </section>
      </AuditShell>
    );

  return (
    <AuditShell kicker={meta.kicker} title={meta.title}>
      <PriceSectionNav active={section} />
      {section === "compare" && (
        <>
          <section className="page-lede price-lede">
            <div>
              <span>СРАВНЕНИЕ ЗАКУПКИ</span>
              <h2>Одна позиция — все актуальные предложения</h2>
              <p>
                Сравнение показывает только сохраненные прайс‑листы. Фасовка
                приводится к цене за кг/л, а подтвержденные связи поставщиков
                имеют приоритет.
              </p>
            </div>
            <div className="price-scope">
              <span>Контур доступа</span>
              <strong>
                {level === "edit"
                  ? "Изменение"
                  : level === "upload"
                    ? "Загрузка"
                    : "Просмотр"}
              </strong>
            </div>
          </section>
          <section
            className="price-summary-grid"
            aria-label="Сводка прайс-контроля"
          >
            <article>
              <span>Поставщики</span>
              <strong>{overview.data?.suppliers.length ?? 0}</strong>
              <small>в сохраненной базе</small>
            </article>
            <article>
              <span>Прайс‑листы</span>
              <strong>{overview.data?.imports.length ?? 0}</strong>
              <small>с историей строк</small>
            </article>
            <article>
              <span>Сопоставленные товары</span>
              <strong>{overview.data?.comparisons.length ?? 0}</strong>
              <small>готовы к сравнению</small>
            </article>
            <article>
              <span>Нужны связи</span>
              <strong>{overview.data?.unmappedRows.length ?? 0}</strong>
              <small>строк на проверке</small>
            </article>
          </section>
          <section className="packet-card price-comparison">
            <div className="card-title">
              <div>
                <span>ГДЕ ВЫГОДНЕЕ КУПИТЬ</span>
                <h3>Сравнение текущих предложений</h3>
              </div>
              <GitCompareArrows size={21} />
            </div>
            <div className="price-toolbar">
              <label>
                Найти товар
                <input
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setSelectedProductId(null);
                  }}
                  placeholder="Название или внутренний код"
                />
              </label>
              <label>
                Категория
                <select
                  value={categoryFilter}
                  onChange={event => {
                    setCategoryFilter(event.target.value);
                    setSelectedProductId(null);
                  }}
                >
                  <option value="">Все категории</option>
                  {categories.map(category => (
                    <option value={category} key={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Поставщик
                <select
                  value={supplierFilter}
                  onChange={event => {
                    setSupplierFilter(event.target.value);
                    setSelectedProductId(null);
                  }}
                >
                  <option value="">Все поставщики</option>
                  {overview.data?.suppliers
                    .filter(supplier => supplier.isActive)
                    .map(supplier => (
                      <option value={supplier.id} key={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                </select>
              </label>
              <small>
                Фильтры применяются одновременно к списку, таблице, графику и
                рекомендации. Данные не меняются.
              </small>
            </div>
            {overview.isLoading ? (
              <div className="empty-state">
                <Loader2 className="animate-spin" />
                <p>Собираем предложения поставщиков…</p>
              </div>
            ) : !filteredComparisons.length ? (
              <div className="empty-state price-empty">
                <GitCompareArrows size={30} />
                <h2>Нет сохраненных предложений по текущему фильтру</h2>
                <p>Измените фильтр или импортируйте и свяжите прайс‑листы.</p>
              </div>
            ) : (
              <div className="price-comparison-body">
                <div
                  className="price-product-list"
                  role="list"
                  aria-label="Сопоставленные товары"
                >
                  {filteredComparisons.map(item => (
                    <button
                      type="button"
                      key={item.product.id}
                      className={
                        selected?.product.id === item.product.id
                          ? "price-product-choice active"
                          : "price-product-choice"
                      }
                      onClick={() => setSelectedProductId(item.product.id)}
                    >
                      <span>
                        {item.product.internalCode} ·{" "}
                        {item.product.category || "Без категории"}
                      </span>
                      <strong>{item.product.canonicalName}</strong>
                      <small>
                        {item.offers.length}{" "}
                        {item.offers.length === 1
                          ? "предложение"
                          : "предложения"}
                        {item.recommendation
                          ? ` · выгода до ${formatMoney(item.recommendation.savings)} ₽/${unitLabel(item.recommendation.normalizedUnit ?? "кг")}`
                          : " · нужна сверка"}
                      </small>
                    </button>
                  ))}
                </div>
                {selected && (
                  <div className="price-detail">
                    <div className="price-detail-heading">
                      <div>
                        <span>
                          {selected.product.internalCode} ·{" "}
                          {selected.product.category || "Без категории"}
                        </span>
                        <h4>{selected.product.canonicalName}</h4>
                        {(selected.product.sizeText ||
                          selected.product.variant) && (
                          <small>
                            {[
                              selected.product.sizeText,
                              selected.product.variant,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                      </div>
                      {selected.recommendation ? (
                        <aside className="price-winner">
                          <span>ВЫГОДНЕЕ КУПИТЬ</span>
                          <strong>
                            {selected.recommendation.supplierName}
                          </strong>
                          <small>
                            {priceLabel({ ...selected.recommendation, normalizedUnit: selected.recommendation.normalizedUnit ?? "kg" })} · экономия{" "}
                            {formatMoney(selected.recommendation.savings)} ₽/
                            {unitLabel(selected.recommendation.normalizedUnit ?? "kg")}{" "}
                            ({selected.recommendation.savingsPercent}%)
                          </small>
                        </aside>
                      ) : (
                        <aside className="price-winner neutral">
                          <span>НУЖНА СВЕРКА</span>
                          <strong>Недостаточно сопоставимых цен</strong>
                          <small>
                            Проверьте вариант, фасовку или цену за единицу.
                          </small>
                        </aside>
                      )}
                    </div>
                    <div className="price-chart">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                          data={chartData}
                          margin={{ top: 8, right: 10, left: -14, bottom: 0 }}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 5"
                          />
                          <XAxis
                            dataKey="name"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={value => `${formatMoney(value)} ₽`}
                          />
                          <Tooltip
                            formatter={(value: number) => [
                              priceLabel({
                                normalizedPrice: Number(value),
                                normalizedUnit:
                                  selected.offers[0]?.normalizedUnit ?? "kg",
                              }),
                              "Цена",
                            ]}
                          />
                          <Bar dataKey="price" radius={[7, 7, 2, 2]}>
                            {chartData.map(item => (
                              <Cell
                                key={item.name}
                                fill={
                                  item.winner
                                    ? "var(--price-accent)"
                                    : "var(--price-bar)"
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <section className="price-history-chart">
                      <div>
                        <span>ИСТОРИЯ ЦЕН</span>
                        <h5>Нормализованная цена по датам</h5>
                      </div>
                      {historyData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={230}>
                          <LineChart
                            data={historyData}
                            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 5"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              tickFormatter={value =>
                                dateLabel(String(value)).replace(/\s+\d{4}/, "")
                              }
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={value => `${formatMoney(value)} ₽`}
                            />
                            <Tooltip
                              formatter={(value: number) => [
                                `${formatMoney(Number(value))} ₽`,
                                "Нормализованная цена",
                              ]}
                            />
                            <Legend />
                            {historySuppliers.map((supplier, index) => (
                              <Line
                                key={supplier}
                                type="monotone"
                                dataKey={supplier}
                                stroke={
                                  index === 0
                                    ? "var(--price-accent)"
                                    : index === 1
                                      ? "var(--price-bar)"
                                      : "var(--price-muted)"
                                }
                                strokeWidth={2.4}
                                dot={{ r: 3 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p>
                          История появится после сохранения минимум двух
                          прайс‑листов с датой для этого товара.
                        </p>
                      )}
                    </section>
                    <div className="price-offer-table">
                      <div className="price-offer-head">
                        <span>Поставщик и исходная строка</span>
                        <span>Фасовка</span>
                        <span>Цена</span>
                        <span>Нормализация</span>
                      </div>
                      {selected.offers.map(offer => (
                        <div
                          className={
                            selected.recommendation?.supplierId ===
                            offer.supplierId
                              ? "price-offer winner"
                              : "price-offer"
                          }
                          key={`${offer.rowId}-${offer.priceMode}`}
                        >
                          <span>
                            <strong>{offer.supplierName}</strong>
                            <small>
                              {offer.rawName} ·{" "}
                              {modeLabel[offer.priceMode ?? "standard"]}
                            </small>
                          </span>
                          <span>{offer.packaging || "Не указана"}</span>
                          <span>
                            {canEdit ? (
                              <div className="price-inline-edit">
                                <input
                                  inputMode="decimal"
                                  value={
                                    offerDrafts[offer.priceId]?.priceAmount ??
                                    String(offer.priceAmount)
                                  }
                                  onChange={event =>
                                    setOfferDrafts(current => ({
                                      ...current,
                                      [offer.priceId]: {
                                        priceAmount: event.target.value,
                                        priceBasis:
                                          current[offer.priceId]?.priceBasis ??
                                          offer.priceBasis,
                                      },
                                    }))
                                  }
                                />
                                <select
                                  value={
                                    offerDrafts[offer.priceId]?.priceBasis ??
                                    offer.priceBasis
                                  }
                                  onChange={event =>
                                    setOfferDrafts(current => ({
                                      ...current,
                                      [offer.priceId]: {
                                        priceAmount:
                                          current[offer.priceId]?.priceAmount ??
                                          String(offer.priceAmount),
                                        priceBasis: event.target
                                          .value as PriceBasis,
                                      },
                                    }))
                                  }
                                >
                                  {(
                                    Object.keys(basisLabel) as PriceBasis[]
                                  ).map(basis => (
                                    <option key={basis} value={basis}>
                                      {basisLabel[basis]}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="packet-link compact"
                                  onClick={() => {
                                    const draft = offerDrafts[offer.priceId];
                                    const value = Number(
                                      (
                                        draft?.priceAmount ?? offer.priceAmount
                                      ).replace(",", ".")
                                    );
                                    if (value > 0)
                                      updateOffer.mutate({
                                        priceId: offer.priceId,
                                        priceAmount: value,
                                        priceBasis:
                                          draft?.priceBasis ?? offer.priceBasis,
                                      });
                                  }}
                                  disabled={updateOffer.isPending}
                                >
                                  <Save size={13} />
                                  Сохранить
                                </button>
                              </div>
                            ) : (
                              `${formatMoney(offer.priceAmount)} ₽/${offer.priceBasis === "kg" ? "кг" : offer.priceBasis === "l" ? "л" : offer.priceBasis === "piece" ? "шт" : "уп."}`
                            )}
                          </span>
                          <span>
                            <strong>
                              {priceLabel({
                                normalizedPrice: offer.normalizedPrice,
                                normalizedUnit: offer.normalizedUnit ?? "kg",
                              })}
                            </strong>
                            {offer.minimumQuantityKg && (
                              <small>
                                от {formatMoney(offer.minimumQuantityKg)} кг
                              </small>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {section === "import" && (
        <>
          <section className="page-lede price-lede">
            <div>
              <span>ИМПОРТ ПРАЙСОВ</span>
              <h2>Сначала проверить, затем сохранить</h2>
              <p>
                Это отдельный импорт коммерческих предложений. Он не использует
                и не изменяет старую страницу импорта финансовых фактов.
              </p>
            </div>
            <div className="price-scope">
              <span>Контур доступа</span>
              <strong>{canUpload ? "Загрузка" : "Просмотр"}</strong>
            </div>
          </section>
          {canUpload && (
            <section className="packet-card price-upload">
              <div className="card-title">
                <div>
                  <span>НОВЫЙ ПРАЙС‑ЛИСТ</span>
                  <h3>Предпросмотр до сохранения</h3>
                </div>
                <FileSearch size={21} />
              </div>
              <p className="packet-note">
                Поддерживаются `.xls`, `.xlsx`, `.pdf`, `.docx`. После
                подтверждения сохраняются исходный файл, дата, товарные строки и
                цены.
              </p>
              <div className="price-upload-form">
                <label className="price-file-input">
                  <span>Файл поставщика</span>
                  <input
                    type="file"
                    accept=".xls,.xlsx,.pdf,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={event => {
                      setFile(event.target.files?.[0] ?? null);
                      setPreview(null);
                    }}
                  />
                  <strong>{file ? file.name : "Выберите прайс‑лист"}</strong>
                </label>
                <button
                  type="button"
                  className="packet-link"
                  onClick={inspectFile}
                  disabled={!file || previewing}
                >
                  {previewing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <FileSearch size={16} />
                  )}
                  Проверить файл
                </button>
              </div>
              {preview && (
                <div className="price-preview">
                  <div>
                    <span>Распознано строк</span>
                    <strong>{preview.rows.length}</strong>
                  </div>
                  <label>
                    Поставщик
                    <input
                      value={supplierName}
                      onChange={event => setSupplierName(event.target.value)}
                      placeholder="Укажите поставщика"
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Дата прайса
                    <input
                      type="date"
                      value={sourceDate}
                      onChange={event => setSourceDate(event.target.value)}
                    />
                  </label>
                  <div className="price-preview-actions">
                    <small>
                      {preview.warningCount
                        ? `Требуют проверки: ${preview.warningCount}`
                        : "Поля цены и фасовки распознаны"}
                    </small>
                    <button
                      type="button"
                      className="packet-link"
                      onClick={commitFile}
                      disabled={committing || !supplierName.trim()}
                    >
                      {committing ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      Сохранить прайс‑лист
                    </button>
                  </div>
                  <div className="price-preview-table">
                    {preview.rows.slice(0, 10).map((row, index) => (
                      <div key={`${row.rawName}-${index}`}>
                        <strong>{row.rawName}</strong>
                        <span>
                          {row.category || "Без категории"} ·{" "}
                          {row.packaging || "фасовка не указана"}
                        </span>
                        <b>
                          {row.priceOptions[0]
                            ? `${formatMoney(row.priceOptions[0].priceAmount)} ₽`
                            : "цена не найдена"}
                        </b>
                      </div>
                    ))}
                  </div>
                  {preview.warnings.map(warning => (
                    <p key={warning} className="inline-error">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}
          <section className="packet-card price-history">
            <div className="card-title">
              <div>
                <span>СОХРАНЕННЫЕ ПРАЙСЫ</span>
                <h3>Предпросмотр, скачивание и удаление</h3>
              </div>
              <History size={21} />
            </div>
            {!overview.data?.imports.length ? (
              <div className="empty-state compact">
                <FileSearch size={22} />
                <p>Пока нет сохраненных прайс‑листов.</p>
              </div>
            ) : (
              <div className="price-import-list">
                {overview.data?.imports.map(importItem => (
                  <article
                    className={
                      selectedImport?.id === importItem.id ? "active" : ""
                    }
                    key={importItem.id}
                  >
                    <button
                      type="button"
                      className="price-import-open"
                      onClick={() => setSelectedImportId(importItem.id)}
                    >
                      <strong>{importItem.supplierName}</strong>
                      <span>{importItem.fileName}</span>
                      <small>
                        {dateLabel(importItem.sourceDate)} ·{" "}
                        {importItem.rowCount} строк ·{" "}
                        {importItem.sourceType.toUpperCase()}
                      </small>
                    </button>
                    <div className="price-import-actions">
                      <button
                        type="button"
                        className="packet-link compact"
                        onClick={() => setSelectedImportId(importItem.id)}
                      >
                        <Eye size={14} />
                        Просмотр
                      </button>
                      <button
                        type="button"
                        className="packet-link compact"
                        onClick={() => downloadExisting(importItem.id)}
                        disabled={downloadImport.isPending}
                      >
                        <Download size={14} />
                        Скачать
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          className="packet-link compact subtle-danger"
                          onClick={() => setDeleteCandidateId(importItem.id)}
                        >
                          <Trash2 size={14} />
                          Удалить
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          {selectedImport && (
            <section className="packet-card price-import-preview">
              <div className="card-title">
                <div>
                  <span>ПРЕДПРОСМОТР СОХРАНЕННОГО ПРАЙСА</span>
                  <h3>{selectedImport.fileName}</h3>
                </div>
                <Eye size={21} />
              </div>
              <div className="price-import-meta">
                <strong>{selectedImport.supplierName}</strong>
                <label>
                  Дата прайса
                  <input
                    type="date"
                    value={
                      dateDrafts[selectedImport.id] ??
                      selectedImport.sourceDate ??
                      ""
                    }
                    onChange={event =>
                      setDateDrafts(current => ({
                        ...current,
                        [selectedImport.id]: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                  />
                </label>
                {canEdit && (
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={() =>
                      updateImportDate.mutate({
                        importId: selectedImport.id,
                        sourceDate:
                          dateDrafts[selectedImport.id] ??
                          selectedImport.sourceDate ??
                          null,
                      })
                    }
                    disabled={updateImportDate.isPending}
                  >
                    <Save size={14} />
                    Сохранить дату
                  </button>
                )}
              </div>
              <div className="price-preview-table">
                {selectedImportPreview?.rows.map(row => (
                  <div key={row.rowId}>
                    <strong>{row.rawName}</strong>
                    <span>
                      {row.rawCategory || "Без категории"} ·{" "}
                      {row.rawPackaging || "фасовка не указана"}
                    </span>
                    <b>
                      {row.priceAmount === null
                        ? "цена не указана"
                        : `${formatMoney(row.priceAmount)} ₽`}
                    </b>
                    <small>{row.productName || "ожидает связи"}</small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {section === "directory" && (
        <>
          <section className="page-lede price-lede">
            <div>
              <span>СПРАВОЧНИК ПРАЙС‑КОНТРОЛЯ</span>
              <h2>Товары, категории и поставщики</h2>
              <p>
                Здесь редактируются только данные коммерческих прайс‑листов.
                Финансовая «База» и ее показатели остаются отдельными и не
                изменяются.
              </p>
            </div>
            <div className="price-scope">
              <span>Контур доступа</span>
              <strong>{canEdit ? "Изменение" : "Просмотр"}</strong>
            </div>
          </section>
          <section className="packet-card price-directory">
            <div className="card-title">
              <div>
                <span>ВНУТРЕННИЕ ТОВАРЫ</span>
                <h3>Коды, категории и эталонные названия</h3>
              </div>
              <Tags size={21} />
            </div>
            {canEdit && (
              <button
                type="button"
                className="packet-link compact"
                onClick={() =>
                  setProductDraft({
                    id: null,
                    canonicalName: "",
                    internalCode: "",
                    category: "",
                    baseUnit: "unknown",
                  })
                }
              >
                <Plus size={14} />
                Новый товар
              </button>
            )}
            {productDraft && (
              <div className="price-directory-editor">
                <label>
                  Эталонное название
                  <input
                    value={productDraft.canonicalName}
                    onChange={event =>
                      setProductDraft({
                        ...productDraft,
                        canonicalName: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Внутренний код
                  <input
                    value={productDraft.internalCode}
                    onChange={event =>
                      setProductDraft({
                        ...productDraft,
                        internalCode: event.target.value,
                      })
                    }
                    placeholder="Будет создан автоматически"
                  />
                </label>
                <label>
                  Категория
                  <input
                    value={productDraft.category}
                    onChange={event =>
                      setProductDraft({
                        ...productDraft,
                        category: event.target.value,
                      })
                    }
                    placeholder="Например, Лососевые"
                  />
                </label>
                <label>
                  Базовая единица
                  <select
                    value={productDraft.baseUnit}
                    onChange={event =>
                      setProductDraft({
                        ...productDraft,
                        baseUnit: event.target
                          .value as ProductDraft["baseUnit"],
                      })
                    }
                  >
                    <option value="unknown">Не задана</option>
                    <option value="kg">Килограмм</option>
                    <option value="l">Литр</option>
                    <option value="piece">Штука</option>
                  </select>
                </label>
                <div>
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={saveProduct}
                    disabled={
                      createProduct.isPending || updateProduct.isPending
                    }
                  >
                    <Save size={14} />
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="packet-link compact subtle"
                    onClick={() => setProductDraft(null)}
                  >
                    Отменить
                  </button>
                </div>
              </div>
            )}
            <div className="price-directory-list">
              {overview.data?.products.map(product => (
                <article key={product.id}>
                  <div>
                    <span>
                      {product.internalCode} ·{" "}
                      {product.category || "Без категории"}
                    </span>
                    <strong>{product.canonicalName}</strong>
                    <small>
                      {product.sizeText || product.variant
                        ? [product.sizeText, product.variant]
                            .filter(Boolean)
                            .join(" · ")
                        : "Параметры не уточнены"}
                    </small>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="packet-link compact"
                      onClick={() =>
                        setProductDraft({
                          id: product.id,
                          canonicalName: product.canonicalName,
                          internalCode: product.internalCode,
                          category: product.category || "",
                          baseUnit: product.baseUnit,
                        })
                      }
                    >
                      <Pencil size={14} />
                      Изменить
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className="packet-card price-directory">
            <div className="card-title">
              <div>
                <span>ПОСТАВЩИКИ</span>
                <h3>Названия и служебные пометки</h3>
              </div>
              <PackageSearch size={21} />
            </div>
            {supplierDraft && (
              <div className="price-directory-editor supplier">
                <label>
                  Название поставщика
                  <input
                    value={supplierDraft.name}
                    onChange={event =>
                      setSupplierDraft({
                        ...supplierDraft,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Заметка
                  <textarea
                    value={supplierDraft.contactNote}
                    onChange={event =>
                      setSupplierDraft({
                        ...supplierDraft,
                        contactNote: event.target.value,
                      })
                    }
                    placeholder="Контакты, условия, комментарий"
                  />
                </label>
                <label className="price-active-toggle">
                  <input
                    type="checkbox"
                    checked={supplierDraft.isActive}
                    onChange={event =>
                      setSupplierDraft({
                        ...supplierDraft,
                        isActive: event.target.checked,
                      })
                    }
                  />
                  Активен в фильтрах
                </label>
                <div>
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={async () => {
                      await updateSupplier.mutateAsync(supplierDraft);
                      setSupplierDraft(null);
                    }}
                    disabled={updateSupplier.isPending}
                  >
                    <Save size={14} />
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="packet-link compact subtle"
                    onClick={() => setSupplierDraft(null)}
                  >
                    Отменить
                  </button>
                </div>
              </div>
            )}
            <div className="price-directory-list">
              {overview.data?.suppliers.map(supplier => (
                <article key={supplier.id}>
                  <div>
                    <span>
                      {supplier.isActive
                        ? "Активный поставщик"
                        : "Скрыт из новых фильтров"}
                    </span>
                    <strong>{supplier.name}</strong>
                    <small>
                      {supplier.contactNote || "Заметка не добавлена"}
                    </small>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="packet-link compact"
                      onClick={() =>
                        setSupplierDraft({
                          id: supplier.id,
                          name: supplier.name,
                          contactNote: supplier.contactNote || "",
                          isActive: supplier.isActive,
                        })
                      }
                    >
                      <Pencil size={14} />
                      Изменить
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          {canEdit && (
            <section className="packet-card price-mapping">
              <div className="card-title">
                <div>
                  <span>СВЯЗАТЬ НАЗВАНИЯ ПОСТАВЩИКА</span>
                  <h3>
                    Один раз подтвердить — затем сопоставляется автоматически
                  </h3>
                </div>
                <Link2 size={21} />
              </div>
              <p className="packet-note">
                Точная связь «поставщик → наш товар» имеет приоритет над
                автоматической нормализацией. Исходное название и фасовка
                сохраняются для контроля.
              </p>
              {!overview.data?.unmappedRows.length ? (
                <div className="empty-state compact">
                  <CheckCircle2 size={22} />
                  <p>
                    Все распознанные строки уже связаны с внутренними товарами.
                  </p>
                </div>
              ) : (
                <div className="price-mapping-list">
                  {overview.data?.unmappedRows.map(row => (
                    <article key={row.rowId}>
                      <div>
                        <span>{row.supplierName}</span>
                        <strong>{row.rawName}</strong>
                        <small>
                          {row.rawCategory || "Без категории"} ·{" "}
                          {row.rawPackaging || "Фасовка не указана"} ·{" "}
                          {row.mappingStatus === "suggested"
                            ? `кандидат: ${row.suggestedProduct?.name ?? "не определен"} (${row.matchConfidence ?? 0}%)`
                            : "новое название"}
                        </small>
                      </div>
                      <div className="price-map-actions">
                        <select
                          value={
                            linkTargets[row.rowId] ??
                            row.suggestedProduct?.id ??
                            ""
                          }
                          onChange={event =>
                            setLinkTargets(current => ({
                              ...current,
                              [row.rowId]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Выберите наш товар</option>
                          {overview.data?.products.map(product => (
                            <option value={product.id} key={product.id}>
                              {product.internalCode} · {product.canonicalName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="packet-link compact"
                          onClick={() => linkExisting(row.rowId)}
                          disabled={
                            linkRow.isPending ||
                            !Number(
                              linkTargets[row.rowId] ?? row.suggestedProduct?.id
                            )
                          }
                        >
                          Связать
                        </button>
                        <details>
                          <summary>Создать новый товар</summary>
                          <div>
                            <input
                              value={newNames[row.rowId] ?? row.rawName}
                              onChange={event =>
                                setNewNames(current => ({
                                  ...current,
                                  [row.rowId]: event.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="packet-link compact"
                              onClick={() =>
                                createAndLink(
                                  row.rowId,
                                  row.rawName,
                                  row.rawCategory
                                )
                              }
                              disabled={
                                createProduct.isPending || linkRow.isPending
                              }
                            >
                              <WandSparkles size={14} />
                              Создать и связать
                            </button>
                          </div>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {canEdit && (overview.data?.aliases.length ?? 0) > 0 && (
            <section className="packet-card price-aliases">
              <div className="card-title">
                <div>
                  <span>ПОДТВЕРЖДЕННЫЕ АВТОСВЯЗИ</span>
                  <h3>Названия поставщиков и наши товары</h3>
                </div>
                <Link2 size={21} />
              </div>
              <p className="packet-note">
                Эти связи применяются к новым прайс‑листам в первую очередь.
                Переназначение и отмена не меняют сохраненные строки прошлых
                импортов.
              </p>
              <div className="price-alias-list">
                {overview.data?.aliases.map(alias => (
                  <article key={alias.aliasId}>
                    <div>
                      <span>{alias.supplierName}</span>
                      <strong>{alias.normalizedName}</strong>
                      <small>
                        {alias.packagingSignature || "Фасовка не уточнена"} ·
                        сейчас: {alias.internalCode} · {alias.canonicalName}
                      </small>
                    </div>
                    <div className="price-alias-actions">
                      <select
                        value={aliasTargets[alias.aliasId] ?? alias.productId}
                        onChange={event =>
                          setAliasTargets(current => ({
                            ...current,
                            [alias.aliasId]: event.target.value,
                          }))
                        }
                      >
                        {overview.data?.products.map(product => (
                          <option value={product.id} key={product.id}>
                            {product.internalCode} · {product.canonicalName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="packet-link compact"
                        onClick={() =>
                          reassignExistingAlias(alias.aliasId, alias.productId)
                        }
                        disabled={
                          reassignAlias.isPending ||
                          Number(
                            aliasTargets[alias.aliasId] ?? alias.productId
                          ) === alias.productId
                        }
                      >
                        Переназначить
                      </button>
                      <button
                        type="button"
                        className="packet-link compact subtle"
                        onClick={() =>
                          unlinkAlias.mutate({ aliasId: alias.aliasId })
                        }
                        disabled={unlinkAlias.isPending}
                      >
                        Отменить автосвязь
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <AlertDialog
        open={Boolean(deleteCandidateId)}
        onOpenChange={open => {
          if (!open) setDeleteCandidateId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сохраненный прайс‑лист?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены файл, распознанные строки и цены этого импорта.
              Связи поставщиков с внутренними товарами сохранятся для следующих
              прайсов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отменить</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidateId)
                  deleteImport.mutate({ importId: deleteCandidateId });
                setDeleteCandidateId(null);
              }}
            >
              Удалить прайс‑лист
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuditShell>
  );
}
