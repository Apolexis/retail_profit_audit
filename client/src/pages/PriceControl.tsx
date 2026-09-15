import { useMemo, useRef, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  FileSpreadsheet,
  FolderPlus,
  GitCompareArrows,
  History,
  Link2,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Search,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { trpc } from "@/lib/trpc";

type Preview = {
  fileName: string;
  sourceType: "xls" | "xlsx" | "pdf" | "docx";
  detectedSupplierName: string | null;
  detectedSourceDate: string | null;
  rows: Array<{
    normalizedSignature: string;
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
  categoryId: string;
  baseUnit: "kg" | "l" | "piece" | "unknown";
  isActive: boolean;
};
type CategoryDraft = { id: number | null; name: string; isActive: boolean };
type DirectoryTab = "products" | "categories" | "suppliers";
type VisibilityFilter = "active" | "all" | "hidden";
type SupplierDraft = {
  id: number | null;
  name: string;
  contactNote: string;
  isActive: boolean;
};

function PriceSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  className?: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={`price-select-trigger ${className}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="price-select-content" align="start">
        {options.map(option => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
type PriceChangeView = { previousPrice: number; previousDate: string | null; delta: number; percent: number; direction: "up" | "down" | "same" } | null;
function PriceChangeBadge({ change, unit }: { change: PriceChangeView; unit: string }) {
  if (!change) return <small className="price-change none">Новая цена</small>;
  const direction = change.direction === "up" ? "up" : change.direction === "down" ? "down" : "same";
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  const label = direction === "up" ? "Подорожало" : direction === "down" ? "Подешевело" : "Без изменения";
  return <small className={`price-change ${direction}`}><Icon size={13} />{label} {direction === "same" ? "" : `${Math.abs(change.percent)}%`} · было {formatMoney(change.previousPrice)} ₽/{unitLabel(unit)}</small>;
}
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
    kicker: "21 / ИМПОРТ ПРАЙСОВ",
  },
  directory: {
    href: "/price-control/directory",
    label: "Справочник",
    title: "Справочник прайс‑контроля",
    kicker: "22 / СПРАВОЧНИК ПРАЙСОВ",
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
  const bulkAssignCategory = trpc.priceControl.bulkAssignCategory.useMutation({
    onSuccess: result => {
      invalidate();
      setSelectedDirectoryProductIds([]);
      setBulkCategoryId("");
      toast.success("Категория назначена", {
        description: `Обновлено товаров: ${result.updated}.`,
      });
    },
    onError: error => toast.error(error.message),
  });
  const createCategory = trpc.priceControl.createCategory.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Категория создана");
    },
    onError: error => toast.error(error.message),
  });
  const updateCategory = trpc.priceControl.updateCategory.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Категория обновлена");
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
  const createSupplier = trpc.priceControl.createSupplier.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Поставщик создан");
    },
    onError: error => toast.error(error.message),
  });
  const deleteSupplier = trpc.priceControl.deleteSupplier.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Поставщик удален");
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

  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("active");
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
  const [newCategoryTargets, setNewCategoryTargets] = useState<
    Record<number, string>
  >({});
  const [previewCategoryTargets, setPreviewCategoryTargets] = useState<
    Record<number, string>
  >({});
  const [selectedPreviewRowIndexes, setSelectedPreviewRowIndexes] = useState<
    number[]
  >([]);
  const [previewBulkCategoryId, setPreviewBulkCategoryId] = useState("");
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(
    null
  );
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>("products");
  const [directoryProductSearch, setDirectoryProductSearch] = useState("");
  const [directoryCategorySearch, setDirectoryCategorySearch] = useState("");
  const [selectedDirectoryProductIds, setSelectedDirectoryProductIds] = useState<
    number[]
  >([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft | null>(
    null
  );
  const [previewSupplierChoice, setPreviewSupplierChoice] = useState("__manual");
  const [supplierDeleteTarget, setSupplierDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [offerDrafts, setOfferDrafts] = useState<
    Record<number, { priceAmount: string; priceBasis: PriceBasis }>
  >({});
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});

  const categories = overview.data?.categories ?? [];
  const selectableCategories = categories.filter(category => category.isActive);
  const selectableSuppliers = (overview.data?.suppliers ?? []).filter(
    supplier => supplier.isActive
  );
  const matchesVisibility = (item: {
    isActive: boolean;
    categoryIsActive?: boolean | null;
  }) => {
    const visible = item.isActive && item.categoryIsActive !== false;
    return visibilityFilter === "all" ||
      (visibilityFilter === "active" ? visible : !visible);
  };
  const catalogProducts = overview.data?.products ?? [];
  const hiddenProductsCount = catalogProducts.filter(
    product => !product.isActive || product.categoryIsActive === false
  ).length;
  const hiddenCategoriesCount = categories.filter(
    category => !category.isActive
  ).length;
  const directoryProducts = useMemo(() => {
    const query = directoryProductSearch.trim().toLocaleLowerCase("ru");
    return catalogProducts.filter(product => {
      const matchesSearch =
        !query ||
        `${product.canonicalName} ${product.internalCode} ${product.category ?? ""}`
          .toLocaleLowerCase("ru")
          .includes(query);
      return matchesSearch && matchesVisibility(product);
    });
  }, [catalogProducts, directoryProductSearch, visibilityFilter]);
  const categoryMembers = useMemo(() => {
    const members = new Map<number, typeof catalogProducts>();
    catalogProducts.forEach(product => {
      if (!product.categoryId) return;
      members.set(product.categoryId, [
        ...(members.get(product.categoryId) ?? []),
        product,
      ]);
    });
    return members;
  }, [catalogProducts]);
  const directoryCategories = useMemo(() => {
    const query = directoryCategorySearch.trim().toLocaleLowerCase("ru");
    return categories.filter(category => {
      const matchesSearch =
        !query || category.name.toLocaleLowerCase("ru").includes(query);
      const matchesMode =
        visibilityFilter === "all" ||
        (visibilityFilter === "active" ? category.isActive : !category.isActive);
      return matchesSearch && matchesMode;
    });
  }, [categories, directoryCategorySearch, visibilityFilter]);
  const filteredComparisons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru");
    return (overview.data?.comparisons ?? [])
      .filter(item => {
        const matchQuery =
          !query ||
          `${item.product.canonicalName} ${item.product.internalCode} ${item.product.variant ?? ""} ${item.product.sizeText ?? ""}`
            .toLocaleLowerCase("ru")
            .includes(query);
        return (
          matchQuery &&
          matchesVisibility(item.product) &&
          (!categoryFilter || String(item.product.categoryId ?? "") === categoryFilter)
        );
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
  }, [overview.data?.comparisons, search, categoryFilter, supplierFilter, visibilityFilter]);
  const selected =
    filteredComparisons.find(item => item.product.id === selectedProductId) ??
    filteredComparisons[0] ??
    null;
  const chartData = (selected?.offers ?? []).map(offer => ({
    name: offer.supplierName,
    price: offer.normalizedPrice,
    winner: selected?.recommendation?.supplierId === offer.supplierId,
    priceChange: offer.priceChange,
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
  const previewNewRows = useMemo(
    () =>
      (preview?.rows ?? [])
        .map((row, index) => ({ row, index }))
        .filter(
          ({ row }) =>
            !catalogProducts.some(
              product => product.normalizedSignature === row.normalizedSignature
            )
        ),
    [preview?.rows, catalogProducts]
  );
  const previewNewRowIndexes = useMemo(
    () => new Set(previewNewRows.map(item => item.index)),
    [previewNewRows]
  );

  const inspectFile = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const result = await postPriceFile("/api/price-import/preview", file, {
        fileName: file.name,
      });
      setPreview(result);
      setSupplierName(result.detectedSupplierName ?? "");
      const knownSupplier = selectableSuppliers.find(
        supplier =>
          supplier.name.toLocaleLowerCase("ru") ===
          (result.detectedSupplierName ?? "").toLocaleLowerCase("ru")
      );
      setPreviewSupplierChoice(knownSupplier ? String(knownSupplier.id) : "__manual");
      setSourceDate(result.detectedSourceDate ?? "");
      setPreviewCategoryTargets({});
      setSelectedPreviewRowIndexes([]);
      setPreviewBulkCategoryId("");
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
  const selectPriceFile = (selected: File | null | undefined) => {
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xls", "xlsx", "pdf", "docx"].includes(extension)) {
      toast.error("Выберите прайс‑лист Excel, PDF или Word.");
      return;
    }
    setFile(selected);
    setPreview(null);
    setSupplierName("");
    setPreviewSupplierChoice("__manual");
    setSourceDate("");
    setPreviewCategoryTargets({});
    setSelectedPreviewRowIndexes([]);
    setPreviewBulkCategoryId("");
  };
  const commitFile = async () => {
    if (!file || !preview || !supplierName.trim()) return;
    setCommitting(true);
    try {
      const result = await postPriceFile("/api/price-import/commit", file, {
        fileName: file.name,
        supplierName: supplierName.trim(),
        ...(sourceDate ? { sourceDate } : {}),
        ...(Object.keys(previewCategoryTargets).length
          ? {
              categorySelections: Object.entries(previewCategoryTargets)
                .filter(([, categoryId]) => Number(categoryId) > 0)
                .map(([rowIndex, categoryId]) => `${rowIndex}:${categoryId}`)
                .join(","),
            }
          : {}),
      });
      await invalidate();
      toast.success("Прайс‑лист сохранен", {
        description: `Автосвязано: ${result.linked}; новых товаров создано: ${result.createdProducts ?? 0}; на проверке: ${result.suggested}; без связи: ${result.unmapped}.`,
      });
      setFile(null);
      setPreview(null);
      setSupplierName("");
      setPreviewSupplierChoice("__manual");
      setSourceDate("");
      setPreviewCategoryTargets({});
      setSelectedPreviewRowIndexes([]);
      setPreviewBulkCategoryId("");
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
    _rawCategory: string | null
  ) => {
    const canonicalName = (newNames[rowId] || rawName).trim();
    const categoryId = Number(newCategoryTargets[rowId]);
    if (!canonicalName || !categoryId) {
      toast.error("Для нового товара выберите существующую категорию.");
      return;
    }
    try {
      const product = await createProduct.mutateAsync({
        canonicalName,
        categoryId,
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
    if (!Number(productDraft.categoryId)) {
      toast.error("Выберите существующую категорию товара.");
      return;
    }
    if (productDraft.id) {
      await updateProduct.mutateAsync({
        id: productDraft.id,
        canonicalName: productDraft.canonicalName.trim(),
        internalCode: productDraft.internalCode.trim(),
        categoryId: Number(productDraft.categoryId) || null,
        baseUnit: productDraft.baseUnit,
        isActive: productDraft.isActive,
      });
    } else {
      await createProduct.mutateAsync({
        canonicalName: productDraft.canonicalName.trim(),
        ...(productDraft.internalCode.trim()
          ? { internalCode: productDraft.internalCode.trim() }
          : {}),
        ...(Number(productDraft.categoryId)
          ? { categoryId: Number(productDraft.categoryId) }
          : {}),
        baseUnit: productDraft.baseUnit,
      });
    }
    setProductDraft(null);
  };
  const openProductEditor = (product: (typeof catalogProducts)[number]) => {
    setDirectoryTab("products");
    setProductDraft({
      id: product.id,
      canonicalName: product.canonicalName,
      internalCode: product.internalCode,
      categoryId: String(product.categoryId ?? ""),
      baseUnit: product.baseUnit,
      isActive: product.isActive,
    });
  };
  const toggleDirectoryProduct = (productId: number) => {
    setSelectedDirectoryProductIds(current =>
      current.includes(productId)
        ? current.filter(id => id !== productId)
        : [...current, productId]
    );
  };
  const togglePreviewRow = (rowIndex: number) => {
    setSelectedPreviewRowIndexes(current =>
      current.includes(rowIndex)
        ? current.filter(index => index !== rowIndex)
        : [...current, rowIndex]
    );
  };
  const setPreviewCategory = (rowIndex: number, categoryId: string) => {
    setPreviewCategoryTargets(current => {
      const next = { ...current };
      if (categoryId === "__no_category") delete next[rowIndex];
      else next[rowIndex] = categoryId;
      return next;
    });
  };
  const assignPreviewCategoryToSelected = () => {
    if (!previewBulkCategoryId || !selectedPreviewRowIndexes.length) return;
    setPreviewCategoryTargets(current => ({
      ...current,
      ...Object.fromEntries(
        selectedPreviewRowIndexes.map(rowIndex => [rowIndex, previewBulkCategoryId])
      ),
    }));
  };
  const selectPreviewSupplier = (value: string) => {
    setPreviewSupplierChoice(value);
    if (value === "__manual") {
      setSupplierName("");
      return;
    }
    const supplier = selectableSuppliers.find(item => String(item.id) === value);
    setSupplierName(supplier?.name ?? "");
  };
  const createPreviewSupplier = async () => {
    const name = supplierName.trim();
    if (name.length < 2) {
      toast.error("Укажите название нового поставщика.");
      return;
    }
    try {
      const supplier = await createSupplier.mutateAsync({ name });
      setSupplierName(supplier.name);
      setPreviewSupplierChoice(String(supplier.id));
    } catch {
      /* уведомление показывает mutation */
    }
  };
  const saveSupplier = async () => {
    if (!supplierDraft?.name.trim()) {
      toast.error("Укажите название поставщика.");
      return;
    }
    try {
      if (supplierDraft.id) {
        await updateSupplier.mutateAsync({
          id: supplierDraft.id,
          name: supplierDraft.name.trim(),
          contactNote: supplierDraft.contactNote,
          isActive: supplierDraft.isActive,
        });
      } else {
        await createSupplier.mutateAsync({
          name: supplierDraft.name.trim(),
          contactNote: supplierDraft.contactNote,
        });
      }
      setSupplierDraft(null);
    } catch {
      /* уведомление показывает mutation */
    }
  };
  const saveCategory = async () => {
    if (!categoryDraft?.name.trim()) return;
    if (categoryDraft.id) {
      await updateCategory.mutateAsync({
        id: categoryDraft.id,
        name: categoryDraft.name.trim(),
        isActive: categoryDraft.isActive,
      });
    } else {
      await createCategory.mutateAsync({ name: categoryDraft.name.trim() });
    }
    setCategoryDraft(null);
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
                <PriceSelect
                  value={categoryFilter}
                  onValueChange={value => {
                    setCategoryFilter(value === "__all_categories" ? "" : value);
                    setSelectedProductId(null);
                  }}
                  placeholder="Все категории"
                  options={[
                    { value: "__all_categories", label: "Все категории" },
                    ...categories.map(category => ({
                      value: String(category.id),
                      label: category.name,
                    })),
                  ]}
                />
              </label>
              <label>
                Поставщик
                <PriceSelect
                  value={supplierFilter}
                  onValueChange={value => {
                    setSupplierFilter(value === "__all_suppliers" ? "" : value);
                    setSelectedProductId(null);
                  }}
                  placeholder="Все поставщики"
                  options={[
                    { value: "__all_suppliers", label: "Все поставщики" },
                    ...(overview.data?.suppliers
                      .filter(supplier => supplier.isActive)
                      .map(supplier => ({
                        value: String(supplier.id),
                        label: supplier.name,
                      })) ?? []),
                  ]}
                />
              </label>
              <label>
                Позиции
                <PriceSelect
                  value={visibilityFilter}
                  onValueChange={value => {
                    setVisibilityFilter(value as VisibilityFilter);
                    setSelectedProductId(null);
                  }}
                  placeholder="Без скрытых"
                  options={[
                    {
                      value: "active",
                      label: `Без скрытых · ${hiddenProductsCount + hiddenCategoriesCount}`,
                    },
                    { value: "all", label: "Все" },
                    {
                      value: "hidden",
                      label: `Только скрытые · ${hiddenProductsCount + hiddenCategoriesCount}`,
                    },
                  ]}
                />
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
                                fill={item.priceChange?.direction === "up" ? "var(--price-change-up)" : item.priceChange?.direction === "down" ? "var(--price-change-down)" : item.winner ? "var(--price-accent)" : "var(--price-bar)"}
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
                        <span>Нормализация и изменение</span>
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
                                <PriceSelect
                                  value={
                                    offerDrafts[offer.priceId]?.priceBasis ??
                                    offer.priceBasis
                                  }
                                  onValueChange={value =>
                                    setOfferDrafts(current => ({
                                      ...current,
                                      [offer.priceId]: {
                                        priceAmount:
                                          current[offer.priceId]?.priceAmount ??
                                          String(offer.priceAmount),
                                        priceBasis: value as PriceBasis,
                                      },
                                    }))
                                  }
                                  placeholder="База цены"
                                  className="price-select-compact"
                                  options={(
                                    Object.keys(basisLabel) as PriceBasis[]
                                  ).map(basis => ({
                                    value: basis,
                                    label: basisLabel[basis],
                                  }))}
                                />
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
                            <PriceChangeBadge change={offer.priceChange} unit={offer.normalizedUnit ?? "kg"} />
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
          </section>
          {canUpload && (
            <section className="price-import-workbench">
              <div className="packet-card price-upload">
              <div className="card-title">
                <div>
                  <span>НОВЫЙ ПРАЙС‑ЛИСТ</span>
                  <h3>Предпросмотр до сохранения</h3>
                </div>
                <FileSearch size={21} />
              </div>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept=".xls,.xlsx,.pdf,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={event => selectPriceFile(event.target.files?.[0])}
              />
              <button
                type="button"
                className={fileDragging ? "price-file-drop dragging" : "price-file-drop"}
                onClick={() => fileInput.current?.click()}
                onDragOver={event => {
                  event.preventDefault();
                  setFileDragging(true);
                }}
                onDragLeave={() => setFileDragging(false)}
                onDrop={event => {
                  event.preventDefault();
                  setFileDragging(false);
                  selectPriceFile(event.dataTransfer.files?.[0]);
                }}
              >
                <UploadCloud size={30} />
                <strong>Перетащите прайс‑лист сюда</strong>
                <span>или выберите файл с компьютера</span>
                <small>Excel, PDF или Word: .xls · .xlsx · .pdf · .docx</small>
              </button>
              {file && (
                <div className="price-selected-file">
                  <FileSpreadsheet size={20} />
                  <div>
                    <strong>{file.name}</strong>
                    <small>{Math.max(1, Math.ceil(file.size / 1024))} КБ · готов к проверке</small>
                  </div>
                  <button
                    type="button"
                    aria-label="Убрать выбранный файл"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setPreviewSupplierChoice("__manual");
                      setPreviewCategoryTargets({});
                      setSelectedPreviewRowIndexes([]);
                      setPreviewBulkCategoryId("");
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="price-import-steps" aria-label="Этапы импорта">
                <span className={file ? "complete" : "active"}><b>1</b> Файл <small>{file ? "выбран" : "ожидание"}</small></span>
                <span className={preview ? "complete" : file ? "active" : ""}><b>2</b> Проверка <small>{preview ? "готово" : "после выбора"}</small></span>
                <span className={committing ? "active" : ""}><b>3</b> Сохранение <small>после подтверждения</small></span>
              </div>
              <button
                type="button"
                className="packet-link price-inspect-action"
                onClick={inspectFile}
                disabled={!file || previewing}
              >
                {previewing ? <Loader2 className="animate-spin" /> : <FileSearch size={16} />}
                Проверить прайс
              </button>
              {preview && (
                <div className="price-preview">
                  <div>
                    <span>Распознано строк</span>
                    <strong>{preview.rows.length}</strong>
                  </div>
                  <label className="price-preview-supplier">
                    Поставщик для сохранения
                    <PriceSelect
                      value={previewSupplierChoice}
                      onValueChange={selectPreviewSupplier}
                      placeholder="Выберите поставщика"
                      options={[
                        { value: "__manual", label: "Указать или создать нового" },
                        ...selectableSuppliers.map(supplier => ({
                          value: String(supplier.id),
                          label: supplier.name,
                        })),
                      ]}
                    />
                    <input
                      value={supplierName}
                      onChange={event => {
                        setPreviewSupplierChoice("__manual");
                        setSupplierName(event.target.value);
                      }}
                      placeholder="Укажите нового поставщика"
                      maxLength={160}
                    />
                    {canEdit && previewSupplierChoice === "__manual" && supplierName.trim() && (
                      <button type="button" className="packet-link compact subtle" onClick={createPreviewSupplier} disabled={createSupplier.isPending}>
                        <Plus size={14} />
                        {createSupplier.isPending ? "Создаем…" : "Добавить в справочник"}
                      </button>
                    )}
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
                  {canEdit && previewNewRows.length > 0 && (
                    <div className="price-preview-categorization">
                      <div>
                        <span>НОВЫЕ ПОЗИЦИИ</span>
                        <strong>{previewNewRows.length}</strong>
                        <small>
                          Отметьте отдельные строки и назначьте существующую
                          категорию. Будут созданы только товары, которых еще
                          нет в справочнике.
                        </small>
                      </div>
                      {selectedPreviewRowIndexes.length > 0 && (
                        <div className="price-preview-bulk-actions">
                          <span>Отмечено: {selectedPreviewRowIndexes.length}</span>
                          <PriceSelect
                            value={previewBulkCategoryId}
                            onValueChange={setPreviewBulkCategoryId}
                            placeholder="Категория для отмеченных"
                            options={selectableCategories.map(category => ({
                              value: String(category.id),
                              label: category.name,
                            }))}
                          />
                          <button
                            type="button"
                            className="packet-link compact"
                            disabled={!previewBulkCategoryId}
                            onClick={assignPreviewCategoryToSelected}
                          >
                            <Tags size={14} />
                            Назначить отмеченным
                          </button>
                          <button
                            type="button"
                            className="packet-link compact subtle"
                            onClick={() => setSelectedPreviewRowIndexes([])}
                          >
                            Снять выбор
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="price-preview-table">
                    {preview.rows.map((row, index) => (
                      <div
                        key={`${row.rawName}-${index}`}
                        className={
                          canEdit && previewNewRowIndexes.has(index)
                            ? "price-preview-new-row"
                            : ""
                        }
                      >
                        {canEdit && previewNewRowIndexes.has(index) && (
                          <label className="price-preview-check">
                            <input
                              type="checkbox"
                              checked={selectedPreviewRowIndexes.includes(index)}
                              onChange={() => togglePreviewRow(index)}
                              aria-label={`Выбрать новую позицию «${row.rawName}»`}
                            />
                          </label>
                        )}
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
                        {canEdit && previewNewRowIndexes.has(index) && (
                          <PriceSelect
                            value={previewCategoryTargets[index] ?? "__no_category"}
                            onValueChange={value => setPreviewCategory(index, value)}
                            placeholder="Оставить без категории"
                            className="price-preview-category-select"
                            options={[
                              { value: "__no_category", label: "Оставить без категории" },
                              ...selectableCategories.map(category => ({
                                value: String(category.id),
                                label: category.name,
                              })),
                            ]}
                          />
                        )}
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
              </div>
              <aside className="packet-card price-import-guide">
                <span>ТРЕБОВАНИЯ К ПРАЙСУ</span>
                <h3>Как система читает файл</h3>
                <ol>
                  <li><b>1</b><span>Определяет поставщика и дату из шапки, если они указаны; иначе их можно выбрать или указать перед сохранением.</span></li>
                  <li><b>2</b><span>Находит товарные строки, цену, фасовку и единицу измерения.</span></li>
                  <li><b>3</b><span>Приводит фасовку к сопоставимой цене за кг или за литр.</span></li>
                  <li><b>4</b><span>Сначала применяет подтвержденные связи «поставщик → наш товар».</span></li>
                  <li><b>5</b><span>Показывает предпросмотр: до подтверждения ничего не сохраняется.</span></li>
                </ol>
                <p>После сохранения доступны история цен, скачивание исходника и подтверждаемое удаление.</p>
              </aside>
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
          </section>
          <nav className="price-directory-tabs" aria-label="Разделы справочника">
            <button
              type="button"
              className={directoryTab === "products" ? "active" : ""}
              onClick={() => setDirectoryTab("products")}
            >
              Товары
            </button>
            <button
              type="button"
              className={directoryTab === "categories" ? "active" : ""}
              onClick={() => setDirectoryTab("categories")}
            >
              Категории
            </button>
            <button
              type="button"
              className={directoryTab === "suppliers" ? "active" : ""}
              onClick={() => setDirectoryTab("suppliers")}
            >
              Поставщики
            </button>
          </nav>
          {directoryTab === "products" && (
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
                    categoryId: "",
                    baseUnit: "unknown",
                    isActive: true,
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
                  <PriceSelect
                    value={productDraft.categoryId}
                    onValueChange={value =>
                      setProductDraft({
                        ...productDraft,
                        categoryId: value,
                      })
                    }
                    placeholder="Выберите существующую категорию"
                    options={selectableCategories.map(category => ({
                      value: String(category.id),
                      label: category.name,
                    }))}
                  />
                </label>
                <label>
                  Базовая единица
                  <PriceSelect
                    value={productDraft.baseUnit}
                    onValueChange={value =>
                      setProductDraft({
                        ...productDraft,
                        baseUnit: value as ProductDraft["baseUnit"],
                      })
                    }
                    placeholder="Не задана"
                    options={[
                      { value: "unknown", label: "Не задана" },
                      { value: "kg", label: "Килограмм" },
                      { value: "l", label: "Литр" },
                      { value: "piece", label: "Штука" },
                    ]}
                  />
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
            <div className="price-directory-toolbar" role="search">
              <label className="price-directory-search">
                <Search size={15} aria-hidden="true" />
                <input
                  value={directoryProductSearch}
                  onChange={event => setDirectoryProductSearch(event.target.value)}
                  placeholder="Поиск по товару, коду или категории"
                  aria-label="Поиск товаров справочника"
                />
              </label>
              <small>
                Товаров: {directoryProducts.length} · скрыто: {hiddenProductsCount}
              </small>
            </div>
            {canEdit && selectedDirectoryProductIds.length > 0 && (
              <div className="price-bulk-actions">
                <span>Выбрано товаров: {selectedDirectoryProductIds.length}</span>
                <PriceSelect
                  value={bulkCategoryId}
                  onValueChange={setBulkCategoryId}
                  placeholder="Выберите категорию"
                  options={selectableCategories.map(category => ({
                    value: String(category.id),
                    label: category.name,
                  }))}
                />
                <button
                  type="button"
                  className="packet-link compact"
                  disabled={!bulkCategoryId || bulkAssignCategory.isPending}
                  onClick={() =>
                    bulkAssignCategory.mutate({
                      productIds: selectedDirectoryProductIds,
                      categoryId: Number(bulkCategoryId),
                    })
                  }
                >
                  <Tags size={14} />
                  Назначить категорию
                </button>
                <button
                  type="button"
                  className="packet-link compact subtle"
                  onClick={() => setSelectedDirectoryProductIds([])}
                >
                  Снять выбор
                </button>
              </div>
            )}
            <div className="price-directory-list">
              {directoryProducts.map(product => (
                <article key={product.id}>
                  {canEdit && (
                    <label className="price-directory-check">
                      <input
                        type="checkbox"
                        checked={selectedDirectoryProductIds.includes(product.id)}
                        onChange={() => toggleDirectoryProduct(product.id)}
                        aria-label={`Выбрать товар «${product.canonicalName}»`}
                      />
                    </label>
                  )}
                  <div>
                    <span>
                      {product.internalCode} · {product.category || "Без категории"}
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
                    <div className="price-directory-actions">
                      <button
                        type="button"
                        className="packet-link compact"
                        onClick={() => openProductEditor(product)}
                      >
                        <Pencil size={14} />
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="packet-link compact subtle"
                        onClick={() =>
                          updateProduct.mutate({
                            id: product.id,
                            canonicalName: product.canonicalName,
                            internalCode: product.internalCode,
                            categoryId: product.categoryId,
                            baseUnit: product.baseUnit,
                            isActive: !product.isActive,
                          })
                        }
                      >
                        {product.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                        {product.isActive ? "Скрыть" : "Показать"}
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {!directoryProducts.length && (
                <div className="empty-state compact">
                  <Search size={22} />
                  <p>Товары по текущему поиску и фильтру не найдены.</p>
                </div>
              )}
            </div>
          </section>
          )}
          {directoryTab === "categories" && (
            <section className="packet-card price-directory">
              <div className="card-title">
                <div>
                  <span>КАТЕГОРИИ ТОВАРОВ</span>
                  <h3>Единый список для выбора в товарах</h3>
                </div>
                <FolderPlus size={21} />
              </div>
              <p className="packet-note">
                Категория создается один раз, затем выбирается в карточке товара.
                Скрытие не удаляет связанные товары и историю цен.
              </p>
              {canEdit && (
                <button
                  type="button"
                  className="packet-link compact"
                  onClick={() =>
                    setCategoryDraft({ id: null, name: "", isActive: true })
                  }
                >
                  <Plus size={14} />
                  Новая категория
                </button>
              )}
              {categoryDraft && (
                <div className="price-directory-editor category">
                  <label>
                    Название категории
                    <input
                      value={categoryDraft.name}
                      onChange={event =>
                        setCategoryDraft({
                          ...categoryDraft,
                          name: event.target.value,
                        })
                      }
                      placeholder="Например, Лососевые"
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      className="packet-link compact"
                      onClick={saveCategory}
                      disabled={
                        createCategory.isPending || updateCategory.isPending
                      }
                    >
                      <Save size={14} />
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="packet-link compact subtle"
                      onClick={() => setCategoryDraft(null)}
                    >
                      Отменить
                    </button>
                  </div>
                </div>
              )}
              <div className="price-directory-toolbar" role="search">
                <label className="price-directory-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={directoryCategorySearch}
                    onChange={event => setDirectoryCategorySearch(event.target.value)}
                    placeholder="Поиск категории"
                    aria-label="Поиск категорий справочника"
                  />
                </label>
                <small>
                  Категорий: {directoryCategories.length} · скрыто: {hiddenCategoriesCount}
                </small>
              </div>
              <div className="price-directory-list">
                {directoryCategories.length ? (
                  directoryCategories.map(category => (
                      <article key={category.id}>
                        <div>
                          <span>
                            {category.isActive
                              ? "В выборе товаров"
                              : "Скрыта из новых выборов"}
                          </span>
                          <strong>{category.name}</strong>
                          <small>
                            Входит товаров: {(categoryMembers.get(category.id) ?? []).length}
                          </small>
                          {(categoryMembers.get(category.id) ?? []).length > 0 && (
                            <div className="price-category-members">
                              {(categoryMembers.get(category.id) ?? []).map(product => (
                                <button
                                  type="button"
                                  key={product.id}
                                  onClick={() => openProductEditor(product)}
                                  title={`Открыть товар «${product.canonicalName}»`}
                                >
                                  {product.canonicalName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="price-directory-actions">
                            <button
                              type="button"
                              className="packet-link compact"
                              onClick={() =>
                                setCategoryDraft({
                                  id: category.id,
                                  name: category.name,
                                  isActive: category.isActive,
                                })
                              }
                            >
                              <Pencil size={14} />
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="packet-link compact subtle"
                              onClick={() =>
                                updateCategory.mutate({
                                  id: category.id,
                                  name: category.name,
                                  isActive: !category.isActive,
                                })
                              }
                            >
                              {category.isActive ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                              {category.isActive ? "Скрыть" : "Показать"}
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                ) : (
                  <div className="empty-state compact">
                    <FolderPlus size={22} />
                    <p>Категории в выбранном режиме пока отсутствуют.</p>
                  </div>
                )}
              </div>
            </section>
          )}
          {directoryTab === "suppliers" && (
          <section className="packet-card price-directory">
            <div className="card-title">
              <div>
                <span>ПОСТАВЩИКИ</span>
                <h3>Названия и служебные пометки</h3>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  className="price-directory-new-action"
                  onClick={() =>
                    setSupplierDraft({
                      id: null,
                      name: "",
                      contactNote: "",
                      isActive: true,
                    })
                  }
                >
                  <Plus size={14} />
                  Новый поставщик
                </button>
              ) : (
                <PackageSearch size={21} />
              )}
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
                  <span>
                    <strong>Активен в фильтрах</strong>
                    <small>Доступен при выборе поставщика</small>
                  </span>
                </label>
                <div className="price-directory-editor-actions">
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={saveSupplier}
                    disabled={updateSupplier.isPending || createSupplier.isPending}
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
                  {canEdit && (
                    <button
                      type="button"
                      className="packet-link compact subtle-danger"
                      onClick={() =>
                        setSupplierDeleteTarget({
                          id: supplier.id,
                          name: supplier.name,
                        })
                      }
                    >
                      <Trash2 size={14} />
                      Удалить
                    </button>
                  )}
                </article>
              ))}
            </div>
            <p className="packet-note">Поставщика без прайс‑листов и товарных связей можно удалить. Если история уже есть, используйте «Изменить» и выключите активность — записи останутся доступны.</p>
            <AlertDialog
              open={Boolean(supplierDeleteTarget)}
              onOpenChange={open => {
                if (!open) setSupplierDeleteTarget(null);
              }}
            >
              <AlertDialogContent className="danger-confirm-dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить поставщика?</AlertDialogTitle>
                  <AlertDialogDescription>Будет удален только пустой поставщик «{supplierDeleteTarget?.name}». Если у него есть сохраненные прайс‑листы или товарные связи, удаление будет заблокировано, чтобы не потерять историю.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отменить</AlertDialogCancel>
                  <AlertDialogAction
                    className="danger-confirm-action"
                    disabled={deleteSupplier.isPending}
                    onClick={() => {
                      if (supplierDeleteTarget)
                        deleteSupplier.mutate({ id: supplierDeleteTarget.id });
                      setSupplierDeleteTarget(null);
                    }}
                  >
                    {deleteSupplier.isPending ? "Удаляем…" : "Удалить поставщика"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
          )}
          {directoryTab === "products" && canEdit && (
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
                        <PriceSelect
                          value={
                            linkTargets[row.rowId] ??
                            row.suggestedProduct?.id ??
                            ""
                          }
                          onValueChange={value =>
                            setLinkTargets(current => ({
                              ...current,
                              [row.rowId]: value,
                            }))
                          }
                          placeholder="Выберите наш товар"
                          options={(overview.data?.products ?? []).map(product => ({
                            value: String(product.id),
                            label: `${product.internalCode} · ${product.canonicalName}`,
                          }))}
                        />
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
                            <PriceSelect
                              value={newCategoryTargets[row.rowId] ?? ""}
                              onValueChange={value =>
                                setNewCategoryTargets(current => ({
                                  ...current,
                                  [row.rowId]: value,
                                }))
                              }
                              placeholder="Выберите категорию"
                              options={selectableCategories.map(category => ({
                                value: String(category.id),
                                label: category.name,
                              }))}
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
                                createProduct.isPending ||
                                linkRow.isPending ||
                                !Number(newCategoryTargets[row.rowId])
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
                      <PriceSelect
                        value={aliasTargets[alias.aliasId] ?? alias.productId}
                        onValueChange={value =>
                          setAliasTargets(current => ({
                            ...current,
                            [alias.aliasId]: value,
                          }))
                        }
                        placeholder="Выберите наш товар"
                        options={(overview.data?.products ?? []).map(product => ({
                          value: String(product.id),
                          label: `${product.internalCode} · ${product.canonicalName}`,
                        }))}
                      />
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
