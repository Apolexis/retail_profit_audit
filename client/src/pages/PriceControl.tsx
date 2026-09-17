import { type CSSProperties, type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";
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
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  MapPin,
  Maximize2,
  Minimize2,
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
import { ExactDateControl } from "@/components/DateRangeControl";
import { FreeScrollSelect } from "@/components/FreeScrollSelect";
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
    manufacturer: string | null;
    placeContents: string | null;
    manufacturedOn: string | null;
    shelfLifeMonths: number | null;
    expiresOn: string | null;
    category: string | null;
    priceOptions: Array<{
      priceAmount: number | null;
      priceBasis: PriceBasis;
      priceMode: PriceMode;
      market: PriceMarket;
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
type PriceMode = "standard" | "cash" | "cashless_no_vat" | "cashless_vat" | "spb" | "moscow" | "special" | "threshold";
type PricePaymentMode = "cash" | "cashless_no_vat" | "cashless_vat";
type PriceMarket = "unknown" | "spb" | "moscow";
type PreviewPriceDraft = {
  priceAmount: string;
  priceBasis: PriceBasis;
  priceMode: PricePaymentMode;
  market: PriceMarket;
};
type PreviewAddedPriceDraft = PreviewPriceDraft & { id: string };
type ManualOfferDraft = {
  enabled: boolean;
  supplierId: string;
  sourceDate: string;
  priceAmount: string;
  priceBasis: PriceBasis;
  priceMode: PricePaymentMode;
  market: PriceMarket;
  manufacturer: string;
  placeContents: string;
  manufacturedOn: string;
  shelfLifeMonths: number | null;
  expiresOn: string;
};
type ProductDraft = {
  id: number | null;
  canonicalName: string;
  internalCode: string;
  categoryId: string;
  variantCharacteristicId: string;
  sizeCharacteristicId: string;
  placeContentsCharacteristicId: string;
  baseUnit: "kg" | "l" | "piece" | "unknown";
  isActive: boolean;
  manualOffer: ManualOfferDraft;
};
type CharacteristicDraft = { id: number | null; kind: "variant" | "size" | "place_contents" | "manufacturer"; value: string; isActive: boolean };
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
    <FreeScrollSelect
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      options={options}
      className={`price-select-trigger ${className}`}
      contentClassName="price-select-content"
    />
  );
}

const formatMoney = (value: number) => {
  const fixed = Number(value).toFixed(2);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
};
const formatPackaging = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|gr|g|л|литр(?:а|ов|ы)?|l|мл|ml|шт|pcs?|штук|уп\.?)(?![a-zа-я])/gi, (_match, amount: string, rawUnit: string) => {
      const unit = /^(?:кг|kg)$/i.test(rawUnit) ? "кг" : /^(?:г|гр|gr|g)$/i.test(rawUnit) ? "гр" : /^(?:л|литр(?:а|ов|ы)?|l)$/i.test(rawUnit) ? "л" : /^(?:мл|ml)$/i.test(rawUnit) ? "мл" : "шт";
      return `${amount}${unit}`;
    })
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[.,;:]+$/g, "")
    .trim();
const formatPlaceContents = (value: string | null | undefined) => {
  const source = formatPackaging(value)
    .replace(/\((?:\s*(?:короб(?:ка)?|ящик|упак(?:овка)?|место|куб)\s*)+\)/gi, " ")
    .replace(/\b(?:короб(?:ка)?|ящик|упак(?:овка)?|место|куб)\b/gi, " ")
    .replace(/,/g, ".")
    .replace(/\s*([/×x])\s*/gi, "/")
    .trim();
  if (!source) return "";
  const prefix = /^(\d+)\//.exec(source);
  const count = prefix?.[1] ?? "1";
  const contents = prefix ? source.slice(prefix[0].length) : source;
  const parts = Array.from(contents.matchAll(/(\d+(?:\.\d+)?)\s*(кг|kg|г|гр|gr|g|л|l|мл|ml|шт|pcs?|штук)?/gi));
  if (!parts.length) return source;
  const unit = (rawUnit: string | undefined) => !rawUnit ? "кг" : /^(?:кг|kg)$/i.test(rawUnit) ? "кг" : /^(?:г|гр|gr|g)$/i.test(rawUnit) ? "гр" : /^(?:л|l)$/i.test(rawUnit) ? "л" : /^(?:мл|ml)$/i.test(rawUnit) ? "мл" : "шт";
  return `${count}/${parts.map(match => `${match[1]}${unit(match[2])}`).join("/")}`;
};
const synchronizePlaceContentsBasis = (value: string | null | undefined, priceBasis: PriceBasis) => {
  const normalized = formatPlaceContents(value);
  if (!normalized || !["kg", "l", "piece"].includes(priceBasis)) return normalized;
  const unit = priceBasis === "kg" ? "кг" : priceBasis === "l" ? "л" : "шт";
  const simplePlace = /^(\d+)\/(\d+(?:\.\d+)?)(?:кг|гр|л|мл|шт)$/i.exec(normalized);
  return simplePlace ? `${simplePlace[1]}/${simplePlace[2]}${unit}` : normalized;
};
const shelfLifeOptions = [
  { value: 1, label: "1 месяц" },
  { value: 2, label: "2 месяца" },
  { value: 3, label: "3 месяца" },
  { value: 6, label: "Полгода" },
  { value: 12, label: "1 год" },
  { value: 18, label: "1.5 года" },
  { value: 24, label: "2 года" },
] as const;
type ShelfLifeMonths = (typeof shelfLifeOptions)[number]["value"];
const moscowTodayIso = () => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const createManualOfferDraft = (
  baseUnit: ProductDraft["baseUnit"] = "unknown",
  placeContents = ""
): ManualOfferDraft => ({
  enabled: false,
  supplierId: "",
  sourceDate: moscowTodayIso(),
  priceAmount: "",
  priceBasis: baseUnit === "kg" || baseUnit === "l" || baseUnit === "piece" ? baseUnit : "unknown",
  priceMode: "cashless_vat",
  market: "unknown",
  manufacturer: "",
  placeContents,
  manufacturedOn: "",
  shelfLifeMonths: null,
  expiresOn: "",
});
const calculateExpiryDate = (manufacturedOn: string, shelfLifeMonths: number | null) => {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(manufacturedOn) || !shelfLifeMonths) return "";
  const [year, month, day] = manufacturedOn.split("-").map(Number);
  const totalMonths = month - 1 + shelfLifeMonths;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = totalMonths % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};
const dateLabel = (value: string | null) => {
  if (!value) return "дата не указана";
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const date = new Date(source);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(date)
    : "дата не указана";
};
const modeLabel: Record<PriceMode, string> = {
  standard: "б/нал с НДС",
  cash: "наличные",
  cashless_no_vat: "б/нал без НДС",
  cashless_vat: "б/нал с НДС",
  spb: "СПБ",
  moscow: "Москва",
  special: "б/нал с НДС",
  threshold: "б/нал с НДС",
};
const canonicalPriceMode = (mode: PriceMode | null | undefined): PricePaymentMode =>
  mode === "cash" || mode === "cashless_no_vat" || mode === "cashless_vat"
    ? mode
    : "cashless_vat";
const marketFromPriceMode = (market: PriceMarket | null | undefined, mode: PriceMode | null | undefined): PriceMarket =>
  market === "spb" || market === "moscow"
    ? market
    : mode === "spb" || mode === "moscow"
      ? mode
      : "unknown";
const marketLabel: Record<PriceMarket, string> = {
  unknown: "Город не указан",
  spb: "СПБ",
  moscow: "Москва",
};
const editablePriceModes: Array<{ value: PricePaymentMode; label: string }> = [
  { value: "cash", label: modeLabel.cash },
  { value: "cashless_no_vat", label: modeLabel.cashless_no_vat },
  { value: "cashless_vat", label: modeLabel.cashless_vat },
];
const priceMarketOptions: Array<{ value: PriceMarket; label: string }> = [
  { value: "unknown", label: marketLabel.unknown },
  { value: "spb", label: marketLabel.spb },
  { value: "moscow", label: marketLabel.moscow },
];
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
  package: "за шт",
  unknown: "не указана",
};
const priceBasisOptions = (packaging: string | null | undefined) => {
  const isMeasuredPackage = /\d+(?:[.,]\d+)?\s*(?:кг|kg|г|гр|gr|g|л|литр|l|мл|ml)(?![a-zа-я])/i.test(String(packaging ?? ""));
  return [
    { value: "kg", label: basisLabel.kg },
    { value: "l", label: basisLabel.l },
    ...(isMeasuredPackage
      ? [{ value: "package", label: basisLabel.package }]
      : [{ value: "piece", label: basisLabel.piece }]),
    { value: "unknown", label: basisLabel.unknown },
  ] as Array<{ value: PriceBasis; label: string }>;
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
  query: Record<string, string>,
  commitOptions?: {
    categorySelections: Array<{ rowIndex: number; categoryId: number }>;
    priceEdits: Array<{ rowIndex: number; optionIndex: number; priceAmount: number; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket }>;
    priceAdditions: Array<{ rowIndex: number; priceAmount: number; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket }>;
    priceRemovals: Array<{ rowIndex: number; optionIndex: number }>;
    rowEdits: Array<{ rowIndex: number; rawName: string }>;
    metadataEdits: Array<{ rowIndex: number; manufacturer: string | null; placeContents: string | null; manufacturedOn: string | null; shelfLifeMonths: number | null; expiresOn: string | null }>;
    productLinks: Array<{ rowIndex: number; productId: number }>;
    excludedRowIndexes: number[];
  }
) {
  const requestBody = commitOptions
    ? await packPriceImportCommitBody(file, commitOptions)
    : file;
  const response = await fetch(
    `${path}?${new URLSearchParams(query).toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: requestBody,
    }
  );
  const body = await response
    .json()
    .catch(() => ({ error: "Не удалось получить ответ сервера." }));
  if (!response.ok)
    throw new Error(body.error ?? "Не удалось обработать прайс‑лист.");
  return body;
}

const priceImportOptionsMagic = "PRICE-IMPORT-OPTIONS-V1\n";
async function packPriceImportCommitBody(
  file: File,
  options: {
    categorySelections: Array<{ rowIndex: number; categoryId: number }>;
    priceEdits: Array<{ rowIndex: number; optionIndex: number; priceAmount: number; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket }>;
    priceAdditions: Array<{ rowIndex: number; priceAmount: number; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket }>;
    priceRemovals: Array<{ rowIndex: number; optionIndex: number }>;
    rowEdits: Array<{ rowIndex: number; rawName: string }>;
    metadataEdits: Array<{ rowIndex: number; manufacturer: string | null; placeContents: string | null; manufacturedOn: string | null; shelfLifeMonths: number | null; expiresOn: string | null }>;
    productLinks: Array<{ rowIndex: number; productId: number }>;
    excludedRowIndexes: number[];
  }
) {
  const encoder = new TextEncoder();
  const magic = encoder.encode(priceImportOptionsMagic);
  const metadata = encoder.encode(JSON.stringify(options));
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const output = new Uint8Array(magic.length + 4 + metadata.length + fileBytes.length);
  output.set(magic, 0);
  new DataView(output.buffer).setUint32(magic.length, metadata.length);
  output.set(metadata, magic.length + 4);
  output.set(fileBytes, magic.length + 4 + metadata.length);
  return output;
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
  const createCharacteristic = trpc.priceControl.createCharacteristic.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Характеристика товара добавлена");
    },
    onError: error => toast.error(error.message),
  });
  const updateCharacteristic = trpc.priceControl.updateCharacteristic.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Характеристика товара обновлена");
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
  const setSupplierActive = trpc.priceControl.setSupplierActive.useMutation({
    onSuccess: () => invalidate(),
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
  const createManualOffer = trpc.priceControl.createManualOffer.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Ручное предложение сохранено");
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
  const deleteImportRow = trpc.priceControl.deleteImportRow.useMutation({
    onSuccess: result => {
      invalidate();
      setDeleteSavedRowCandidate(null);
      toast.success("Позиция удалена из сохраненного прайса", {
        description: `В прайс‑листе осталось строк: ${result.rowCount}. Исходный файл сохранен.`,
      });
    },
    onError: error => toast.error(error.message),
  });
  const downloadImport = trpc.priceControl.downloadImport.useMutation({
    onError: error => toast.error(error.message),
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const productEditorRef = useRef<HTMLDivElement>(null);
  const previewRequestToken = useRef(0);
  const previewSwipeStart = useRef<{ x: number; y: number } | null>(null);
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
  const [offerMarketFilter, setOfferMarketFilter] = useState<"" | "moscow" | "spb">("");
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
  const [previewBulkMarket, setPreviewBulkMarket] = useState<"" | PriceMarket>("");
  const [previewNewCategoryName, setPreviewNewCategoryName] = useState("");
  const [previewPriceEdits, setPreviewPriceEdits] = useState<
    Record<string, PreviewPriceDraft>
  >({});
  const [previewAddedPriceOptions, setPreviewAddedPriceOptions] = useState<Record<number, PreviewAddedPriceDraft[]>>({});
  const [previewRemovedPriceOptions, setPreviewRemovedPriceOptions] = useState<Record<string, true>>({});
  const [previewNameEdits, setPreviewNameEdits] = useState<Record<number, string>>({});
  const [expandedPreviewNameRows, setExpandedPreviewNameRows] = useState<Record<number, boolean>>({});
  const [previewMetadataEdits, setPreviewMetadataEdits] = useState<
    Record<number, { manufacturer: string; placeContents: string; manufacturedOn: string; shelfLifeMonths: number | null; expiresOn: string }>
  >({});
  const [previewProductLinks, setPreviewProductLinks] = useState<Record<number, string>>({});
  const [excludedPreviewRowIndexes, setExcludedPreviewRowIndexes] = useState<number[]>([]);
  const [mobilePreviewPosition, setMobilePreviewPosition] = useState(0);
  const [mobilePreviewSwipeOffset, setMobilePreviewSwipeOffset] = useState(0);
  const [mobilePreviewTransition, setMobilePreviewTransition] = useState<{
    from: number;
    to: number;
    direction: -1 | 1;
  } | null>(null);
  const [mobilePreviewHintVisible, setMobilePreviewHintVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.sessionStorage.getItem("price-preview-swipe-hint") !== "seen";
  });
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [characteristicDraft, setCharacteristicDraft] = useState<CharacteristicDraft | null>(null);
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
    Record<number, { priceAmount: string; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket; manufacturer: string; placeContents: string; manufacturedOn: string; shelfLifeMonths: number | null; expiresOn: string }>
  >({});
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});
  const [deleteSavedRowCandidate, setDeleteSavedRowCandidate] = useState<{
    rowId: number;
    name: string;
  } | null>(null);
  const categoryEditorRef = useRef<HTMLDivElement>(null);
  const supplierEditorRef = useRef<HTMLDivElement>(null);

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
  const characteristics = overview.data?.characteristics ?? [];
  const selectableCharacteristics = (kind: CharacteristicDraft["kind"]) =>
    characteristics.filter(item => item.kind === kind && item.isActive);
  const offerCharacteristicOptions = (kind: "manufacturer" | "place_contents", currentValue: string | null | undefined) => {
    const values = selectableCharacteristics(kind).map(item => ({ value: item.value, label: item.value }));
    const current = String(currentValue ?? "").trim();
    return current && !values.some(item => item.value === current) ? [{ value: current, label: current }, ...values] : values;
  };
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
          .filter(offer => !offerMarketFilter || offer.market === offerMarketFilter)
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
            offer.normalizedUnit === best?.normalizedUnit &&
            offer.priceMode === best?.priceMode
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
  }, [overview.data?.comparisons, search, categoryFilter, supplierFilter, offerMarketFilter, visibilityFilter]);
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
        .filter(({ index }) => !excludedPreviewRowIndexes.includes(index))
        .filter(
          ({ row, index }) =>
            !previewProductLinks[index] &&
            !catalogProducts.some(
              product => product.normalizedSignature === row.normalizedSignature
            )
        ),
    [preview?.rows, catalogProducts, excludedPreviewRowIndexes, previewProductLinks]
  );
  const previewNewRowIndexes = useMemo(
    () => new Set(previewNewRows.map(item => item.index)),
    [previewNewRows]
  );
  const previewActiveRows = useMemo(
    () =>
      (preview?.rows ?? [])
        .map((row, index) => ({ row, index }))
        .filter(({ index }) => !excludedPreviewRowIndexes.includes(index)),
    [preview?.rows, excludedPreviewRowIndexes]
  );
  const currentMobilePreviewPosition = Math.min(
    mobilePreviewPosition,
    Math.max(0, previewActiveRows.length - 1)
  );
  const currentMobilePreviewRowIndex = previewActiveRows[currentMobilePreviewPosition]?.index ?? null;
  const moveMobilePreview = (direction: -1 | 1) => {
    const total = previewActiveRows.length;
    if (total < 2) return;
    const from = currentMobilePreviewPosition;
    const to = (from + direction + total) % total;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMobilePreviewSwipeOffset(0);
      setMobilePreviewPosition(to);
      return;
    }
    setMobilePreviewSwipeOffset(0);
    setMobilePreviewPosition(to);
    setMobilePreviewTransition({ from, to, direction });
  };
  const startPreviewSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || (event.target as HTMLElement).closest("input, textarea, button, [data-slot='select-trigger']")) return;
    previewSwipeStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updatePreviewSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = previewSwipeStart.current;
    if (!start || event.pointerType !== "touch") return;
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;
    setMobilePreviewSwipeOffset(Math.max(-112, Math.min(112, horizontalDistance)));
  };
  const cancelPreviewSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    previewSwipeStart.current = null;
    setMobilePreviewSwipeOffset(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const finishPreviewSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = previewSwipeStart.current;
    previewSwipeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!start || event.pointerType !== "touch") {
      setMobilePreviewSwipeOffset(0);
      return;
    }
    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < 44 || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
      setMobilePreviewSwipeOffset(0);
      return;
    }
    const direction = horizontalDistance < 0 ? 1 : -1;
    moveMobilePreview(direction);
    if (mobilePreviewHintVisible) {
      setMobilePreviewHintVisible(false);
      window.sessionStorage.setItem("price-preview-swipe-hint", "seen");
    }
  };
  const unresolvedPreviewPriceCount = useMemo(
    () =>
      previewActiveRows.reduce(
        (count, { row, index }) =>
          count +
          row.priceOptions.filter((option, optionIndex) => {
            if (previewRemovedPriceOptions[previewPriceKey(index, optionIndex)]) return false;
            if (option.priceAmount !== null) return false;
            const manualAmount = previewPriceEdits[
              `${index}:${optionIndex}`
            ]?.priceAmount.trim();
            return !manualAmount || !Number.isFinite(Number(manualAmount.replace(",", ".")));
          }).length,
        0
      ),
    [previewActiveRows, previewPriceEdits, previewRemovedPriceOptions]
  );
  const previewStaticWarnings = (preview?.warnings ?? []).filter(
    warning => !/цен[аы].*(?:не указ|уточн|заполн)/i.test(warning)
  );

  const resetPreviewState = () => {
    setPreview(null);
    setSupplierName("");
    setPreviewSupplierChoice("__manual");
    setSourceDate("");
    setPreviewCategoryTargets({});
    setSelectedPreviewRowIndexes([]);
    setPreviewBulkCategoryId("");
    setPreviewBulkMarket("");
    setPreviewNewCategoryName("");
    setPreviewPriceEdits({});
    setPreviewAddedPriceOptions({});
    setPreviewRemovedPriceOptions({});
    setPreviewNameEdits({});
    setExpandedPreviewNameRows({});
    setPreviewMetadataEdits({});
    setPreviewProductLinks({});
    setExcludedPreviewRowIndexes([]);
    setMobilePreviewPosition(0);
    setMobilePreviewSwipeOffset(0);
    setMobilePreviewTransition(null);
  };
  const inspectFile = async (selectedFile: File) => {
    const requestToken = ++previewRequestToken.current;
    setPreviewing(true);
    try {
      const result = await postPriceFile("/api/price-import/preview", selectedFile, {
        fileName: selectedFile.name,
      });
      if (requestToken !== previewRequestToken.current) return;
      setPreview(result);
      setSupplierName(result.detectedSupplierName ?? "");
      const knownSupplier = selectableSuppliers.find(
        supplier =>
          supplier.name.toLocaleLowerCase("ru") ===
          (result.detectedSupplierName ?? "").toLocaleLowerCase("ru")
      );
      setPreviewSupplierChoice(knownSupplier ? String(knownSupplier.id) : "__manual");
      setSourceDate(result.detectedSourceDate ?? "");
      toast.success("Прайс‑лист разобран", {
        description: `Распознано позиций: ${result.rows.length}.`,
      });
    } catch (error) {
      if (requestToken !== previewRequestToken.current) return;
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось разобрать прайс‑лист."
      );
      setPreview(null);
    } finally {
      if (requestToken === previewRequestToken.current) setPreviewing(false);
    }
  };
  const selectPriceFile = (selected: File | null | undefined) => {
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xls", "xlsx", "pdf", "docx"].includes(extension)) {
      toast.error("Выберите прайс‑лист Excel, PDF или Word.");
      return;
    }
    previewRequestToken.current += 1;
    setFile(selected);
    resetPreviewState();
    void inspectFile(selected);
  };
  const commitFile = async () => {
    if (!file || !preview || !supplierName.trim()) return;
    const missingManualPrice = preview.rows.some((row, rowIndex) =>
      !excludedPreviewRowIndexes.includes(rowIndex) && row.priceOptions.some((option, optionIndex) =>
        option.priceAmount === null && !previewRemovedPriceOptions[previewPriceKey(rowIndex, optionIndex)] && !previewPriceEdits[previewPriceKey(rowIndex, optionIndex)]?.priceAmount.trim()
      )
    );
    if (missingManualPrice) {
      toast.error("Заполните вручную цены, отмеченные «цена не указана поставщиком».");
      return;
    }
    const priceEdits = Object.entries(previewPriceEdits).map(([key, draft]) => {
      const [rowIndexText, optionIndexText] = key.split(":");
      const priceAmount = Number(draft.priceAmount.replace(/\s/g, "").replace(",", "."));
      return { rowIndex: Number(rowIndexText), optionIndex: Number(optionIndexText), priceAmount, priceBasis: draft.priceBasis, priceMode: draft.priceMode, market: draft.market };
    });
    if (priceEdits.some(edit => !Number.isFinite(edit.priceAmount) || edit.priceAmount <= 0 || edit.priceAmount >= 10_000_000)) {
      toast.error("Проверьте измененные цены: допустимо значение от 0 до 10 000 000 ₽.");
      return;
    }
    const priceAdditions = Object.entries(previewAddedPriceOptions).flatMap(([rowIndex, additions]) => additions.map(addition => ({
      rowIndex: Number(rowIndex),
      priceAmount: Number(addition.priceAmount.replace(/\s/g, "").replace(",", ".")),
      priceBasis: addition.priceBasis,
      priceMode: addition.priceMode,
      market: addition.market,
    })));
    if (priceAdditions.some(addition => !Number.isFinite(addition.priceAmount) || addition.priceAmount <= 0 || addition.priceAmount >= 10_000_000)) {
      toast.error("Заполните каждую добавленную цену значением от 0 до 10 000 000 ₽.");
      return;
    }
    const rowEdits = Object.entries(previewNameEdits)
      .map(([rowIndex, rawName]) => ({ rowIndex: Number(rowIndex), rawName: rawName.trim() }))
      .filter(edit => edit.rawName && edit.rawName !== preview.rows[edit.rowIndex]?.rawName);
    const metadataEdits = Object.entries(previewMetadataEdits)
      .map(([rowIndex, metadata]) => ({ rowIndex: Number(rowIndex), manufacturer: metadata.manufacturer.trim() || null, placeContents: metadata.placeContents.trim() || null, manufacturedOn: metadata.manufacturedOn || null, shelfLifeMonths: metadata.shelfLifeMonths, expiresOn: metadata.expiresOn || null }))
      .filter(edit => edit.manufacturer !== preview.rows[edit.rowIndex]?.manufacturer || edit.placeContents !== preview.rows[edit.rowIndex]?.placeContents || edit.manufacturedOn !== preview.rows[edit.rowIndex]?.manufacturedOn || edit.shelfLifeMonths !== preview.rows[edit.rowIndex]?.shelfLifeMonths || edit.expiresOn !== preview.rows[edit.rowIndex]?.expiresOn);
    if (rowEdits.some(edit => edit.rawName.length < 2 || edit.rawName.length > 255)) {
      toast.error("Проверьте измененные названия: от 2 до 255 символов.");
      return;
    }
    setCommitting(true);
    try {
      const result = await postPriceFile("/api/price-import/commit", file, {
        fileName: file.name,
        supplierName: supplierName.trim(),
        ...(sourceDate ? { sourceDate } : {}),
      }, {
        categorySelections: Object.entries(previewCategoryTargets)
          .filter(([rowIndex, categoryId]) => !excludedPreviewRowIndexes.includes(Number(rowIndex)) && Number(categoryId) > 0)
          .map(([rowIndex, categoryId]) => ({ rowIndex: Number(rowIndex), categoryId: Number(categoryId) })),
        priceEdits,
        priceAdditions,
        priceRemovals: Object.keys(previewRemovedPriceOptions).map(key => {
          const [rowIndex, optionIndex] = key.split(":");
          return { rowIndex: Number(rowIndex), optionIndex: Number(optionIndex) };
        }),
        rowEdits,
        metadataEdits,
        productLinks: Object.entries(previewProductLinks)
          .filter(([rowIndex, productId]) => !excludedPreviewRowIndexes.includes(Number(rowIndex)) && Number(productId) > 0)
          .map(([rowIndex, productId]) => ({ rowIndex: Number(rowIndex), productId: Number(productId) })),
        excludedRowIndexes: excludedPreviewRowIndexes,
      });
      await invalidate();
      toast.success("Прайс‑лист сохранен", {
        description: `Автосвязано: ${result.linked}; новых товаров создано: ${result.createdProducts ?? 0}; на проверке: ${result.suggested}; без связи: ${result.unmapped}.`,
      });
      setFile(null);
      resetPreviewState();
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
    const manualOffer = productDraft.manualOffer;
    const manualPrice = Number(
      manualOffer.priceAmount.replace(/\s/g, "").replace(",", ".")
    );
    if (
      manualOffer.enabled &&
      (!Number(manualOffer.supplierId) ||
        !manualOffer.sourceDate ||
        !Number.isFinite(manualPrice) ||
        manualPrice <= 0)
    ) {
      toast.error("Для ручного предложения укажите поставщика, дату и цену.");
      return;
    }
    let savedProductId: number;
    if (productDraft.id) {
      const product = await updateProduct.mutateAsync({
        id: productDraft.id,
        canonicalName: productDraft.canonicalName.trim(),
        internalCode: productDraft.internalCode.trim(),
        categoryId: Number(productDraft.categoryId) || null,
        variantCharacteristicId: productDraft.variantCharacteristicId ? Number(productDraft.variantCharacteristicId) : null,
        sizeCharacteristicId: productDraft.sizeCharacteristicId ? Number(productDraft.sizeCharacteristicId) : null,
        placeContentsCharacteristicId: productDraft.placeContentsCharacteristicId ? Number(productDraft.placeContentsCharacteristicId) : null,
        baseUnit: productDraft.baseUnit,
        isActive: productDraft.isActive,
      });
      savedProductId = product.id;
    } else {
      const product = await createProduct.mutateAsync({
        canonicalName: productDraft.canonicalName.trim(),
        ...(productDraft.internalCode.trim()
          ? { internalCode: productDraft.internalCode.trim() }
          : {}),
        ...(Number(productDraft.categoryId)
          ? { categoryId: Number(productDraft.categoryId) }
          : {}),
        ...(productDraft.variantCharacteristicId
          ? { variantCharacteristicId: Number(productDraft.variantCharacteristicId) }
          : { variantCharacteristicId: null }),
        ...(productDraft.sizeCharacteristicId
          ? { sizeCharacteristicId: Number(productDraft.sizeCharacteristicId) }
          : { sizeCharacteristicId: null }),
        ...(productDraft.placeContentsCharacteristicId
          ? { placeContentsCharacteristicId: Number(productDraft.placeContentsCharacteristicId) }
          : { placeContentsCharacteristicId: null }),
        baseUnit: productDraft.baseUnit,
        isActive: productDraft.isActive,
      });
      savedProductId = product.id;
    }
    if (manualOffer.enabled) {
      await createManualOffer.mutateAsync({
        productId: savedProductId,
        supplierId: Number(manualOffer.supplierId),
        sourceDate: manualOffer.sourceDate,
        priceAmount: manualPrice,
        priceBasis: manualOffer.priceBasis,
        priceMode: manualOffer.priceMode,
        market: manualOffer.market,
        manufacturer: manualOffer.manufacturer.trim() || null,
        placeContents: manualOffer.placeContents.trim() || null,
        manufacturedOn: manualOffer.manufacturedOn || null,
        shelfLifeMonths: manualOffer.shelfLifeMonths as ShelfLifeMonths | null,
        expiresOn: manualOffer.expiresOn || null,
      });
    }
    setProductDraft(null);
  };
  const patchProductManualOffer = (
    patch: Partial<ManualOfferDraft>
  ) => {
    setProductDraft(current => {
      if (!current) return current;
      const manualOffer = { ...current.manualOffer, ...patch };
      if (patch.manufacturedOn !== undefined || patch.shelfLifeMonths !== undefined) {
        manualOffer.expiresOn = calculateExpiryDate(
          manualOffer.manufacturedOn,
          manualOffer.shelfLifeMonths
        );
      }
      return { ...current, manualOffer };
    });
  };
  const openProductEditor = (product: (typeof catalogProducts)[number]) => {
    setDirectoryTab("products");
    setProductDraft({
      id: product.id,
      canonicalName: product.canonicalName,
      internalCode: product.internalCode,
      categoryId: String(product.categoryId ?? ""),
      variantCharacteristicId: product.variantCharacteristicId ? String(product.variantCharacteristicId) : "",
      sizeCharacteristicId: product.sizeCharacteristicId ? String(product.sizeCharacteristicId) : "",
      placeContentsCharacteristicId: product.placeContentsCharacteristicId ? String(product.placeContentsCharacteristicId) : "",
      baseUnit: product.baseUnit,
      isActive: product.isActive,
      manualOffer: createManualOfferDraft(product.baseUnit, product.placeContents ?? ""),
    });
    window.requestAnimationFrame(() => {
      productEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      productEditorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
  };
  const openCategoryEditor = (category: (typeof categories)[number]) => {
    setCategoryDraft({
      id: category.id,
      name: category.name,
      isActive: category.isActive,
    });
    window.requestAnimationFrame(() => {
      categoryEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      categoryEditorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
  };
  const openSupplierEditor = (supplier: (typeof selectableSuppliers)[number]) => {
    setSupplierDraft({
      id: supplier.id,
      name: supplier.name,
      contactNote: supplier.contactNote || "",
      isActive: supplier.isActive,
    });
    window.requestAnimationFrame(() => {
      supplierEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      supplierEditorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
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
  const removePreviewRows = (rowIndexes: number[]) => {
    const removing = new Set(rowIndexes);
    if (!removing.size) return;
    setExcludedPreviewRowIndexes(current => Array.from(new Set([...current, ...Array.from(removing)])).sort((left, right) => left - right));
    setSelectedPreviewRowIndexes(current => current.filter(index => !removing.has(index)));
    setPreviewCategoryTargets(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    setPreviewPriceEdits(current => Object.fromEntries(Object.entries(current).filter(([key]) => !removing.has(Number(key.split(":" )[0])))));
    setPreviewAddedPriceOptions(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    setPreviewRemovedPriceOptions(current => Object.fromEntries(Object.entries(current).filter(([key]) => !removing.has(Number(key.split(":" )[0])))));
    setPreviewNameEdits(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    setExpandedPreviewNameRows(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    setPreviewMetadataEdits(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    setPreviewProductLinks(current => Object.fromEntries(Object.entries(current).filter(([rowIndex]) => !removing.has(Number(rowIndex)))));
    toast.success(removing.size === 1 ? "Позиция исключена из этого импорта" : `Исключено из этого импорта: ${removing.size} позиций`, {
      description: "Исходный файл не меняется; исключенные строки не будут сохранены.",
    });
  };
  const restorePreviewRow = (rowIndex: number) => {
    setExcludedPreviewRowIndexes(current => current.filter(index => index !== rowIndex));
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
  const assignPreviewMarketToSelected = () => {
    if (!preview || !previewBulkMarket || !selectedPreviewRowIndexes.length) return;
    const selectedRows = new Set(selectedPreviewRowIndexes);
    setPreviewPriceEdits(current => {
      const next = { ...current };
      selectedRows.forEach(rowIndex => {
        preview.rows[rowIndex]?.priceOptions.forEach((option, optionIndex) => {
          const key = previewPriceKey(rowIndex, optionIndex);
          if (previewRemovedPriceOptions[key]) return;
          next[key] = {
            priceAmount: current[key]?.priceAmount ?? (option.priceAmount === null ? "" : String(option.priceAmount)),
            priceBasis: current[key]?.priceBasis ?? option.priceBasis,
            priceMode: current[key]?.priceMode ?? canonicalPriceMode(option.priceMode),
            market: previewBulkMarket,
          };
        });
      });
      return next;
    });
    setPreviewAddedPriceOptions(current => Object.fromEntries(
      Object.entries(current).map(([rowIndex, additions]) => [
        rowIndex,
        selectedRows.has(Number(rowIndex))
          ? additions.map(addition => ({ ...addition, market: previewBulkMarket }))
          : additions,
      ])
    ));
  };
  const createPreviewCategory = async () => {
    const name = previewNewCategoryName.trim();
    if (name.length < 2) {
      toast.error("Укажите название новой категории.");
      return;
    }
    if (!selectedPreviewRowIndexes.length) {
      toast.error("Сначала отметьте новые позиции, которым нужно назначить категорию.");
      return;
    }
    try {
      const category = await createCategory.mutateAsync({ name });
      setPreviewBulkCategoryId(String(category.id));
      setPreviewCategoryTargets(current => ({
        ...current,
        ...Object.fromEntries(selectedPreviewRowIndexes.map(rowIndex => [rowIndex, String(category.id)])),
      }));
      setPreviewNewCategoryName("");
      toast.success("Категория создана и назначена отмеченным строкам");
    } catch {
      /* уведомление показывает mutation */
    }
  };
  const previewPriceKey = (rowIndex: number, optionIndex: number) => `${rowIndex}:${optionIndex}`;
  const previewAddedPriceKey = (rowIndex: number, id: string) => `${rowIndex}:${id}`;
  const addPreviewPriceOption = (rowIndex: number, row: Preview["rows"][number]) => {
    const fallback = row.priceOptions.find(option => option.priceAmount !== null) ?? row.priceOptions[0];
    if (!fallback) return;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setPreviewAddedPriceOptions(current => ({
      ...current,
      [rowIndex]: [
        ...(current[rowIndex] ?? []),
        {
          id,
          priceAmount: "",
          priceBasis: fallback.priceBasis,
          priceMode: canonicalPriceMode(fallback.priceMode),
          market: marketFromPriceMode(fallback.market, fallback.priceMode),
        },
      ],
    }));
  };
  const updatePreviewAddedPriceOption = (rowIndex: number, id: string, patch: Partial<PreviewPriceDraft>) => {
    setPreviewAddedPriceOptions(current => ({
      ...current,
      [rowIndex]: (current[rowIndex] ?? []).map(option => option.id === id ? { ...option, ...patch } : option),
    }));
  };
  const removePreviewAddedPriceOption = (rowIndex: number, id: string) => {
    setPreviewAddedPriceOptions(current => ({
      ...current,
      [rowIndex]: (current[rowIndex] ?? []).filter(option => option.id !== id),
    }));
  };
  const removePreviewPriceOption = (rowIndex: number, optionIndex: number, row: Preview["rows"][number]) => {
    const key = previewPriceKey(rowIndex, optionIndex);
    const remainingOriginal = row.priceOptions.filter((_option, index) => !previewRemovedPriceOptions[previewPriceKey(rowIndex, index)]).length;
    const remaining = remainingOriginal + (previewAddedPriceOptions[rowIndex]?.length ?? 0);
    if (remaining <= 1) {
      toast.error("В позиции должна остаться хотя бы одна цена. Чтобы убрать ее целиком, исключите позицию.");
      return;
    }
    setPreviewRemovedPriceOptions(current => ({ ...current, [key]: true }));
    setPreviewPriceEdits(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const updatePreviewPriceDraft = (rowIndex: number, optionIndex: number, fallback: Preview["rows"][number]["priceOptions"][number], patch: Partial<{ priceAmount: string; priceBasis: PriceBasis; priceMode: PricePaymentMode; market: PriceMarket }>) => {
    const key = previewPriceKey(rowIndex, optionIndex);
    const nextBasis = patch.priceBasis ?? previewPriceEdits[key]?.priceBasis ?? fallback.priceBasis;
    setPreviewPriceEdits(current => ({
      ...current,
      [key]: {
        priceAmount: patch.priceAmount ?? current[key]?.priceAmount ?? (fallback.priceAmount === null ? "" : String(fallback.priceAmount)),
        priceBasis: patch.priceBasis ?? current[key]?.priceBasis ?? fallback.priceBasis,
        priceMode: patch.priceMode ?? current[key]?.priceMode ?? canonicalPriceMode(fallback.priceMode),
        market: patch.market ?? current[key]?.market ?? marketFromPriceMode(fallback.market, fallback.priceMode),
      },
    }));
    if (patch.priceBasis) {
      const previewRow = preview?.rows[rowIndex];
      if (previewRow) {
        setPreviewMetadataEdits(current => {
          const existing = current[rowIndex];
          const manufacturedOn = existing?.manufacturedOn ?? previewRow.manufacturedOn ?? "";
          const shelfLifeMonths = existing?.shelfLifeMonths ?? previewRow.shelfLifeMonths ?? null;
          return {
            ...current,
            [rowIndex]: {
              manufacturer: existing?.manufacturer ?? previewRow.manufacturer ?? "",
              placeContents: synchronizePlaceContentsBasis(existing?.placeContents ?? previewRow.placeContents, nextBasis),
              manufacturedOn,
              shelfLifeMonths,
              expiresOn: calculateExpiryDate(manufacturedOn, shelfLifeMonths),
            },
          };
        });
      }
    }
  };
  const updatePreviewNameDraft = (rowIndex: number, rawName: string) => {
    setPreviewNameEdits(current => ({ ...current, [rowIndex]: rawName }));
  };
  const updatePreviewMetadataDraft = (rowIndex: number, patch: Partial<{ manufacturer: string; placeContents: string; manufacturedOn: string; shelfLifeMonths: ShelfLifeMonths | null }>, fallback: Preview["rows"][number]) => {
    setPreviewMetadataEdits(current => {
      const next = {
        manufacturer: patch.manufacturer ?? current[rowIndex]?.manufacturer ?? fallback.manufacturer ?? "",
        placeContents: patch.placeContents ?? current[rowIndex]?.placeContents ?? fallback.placeContents ?? "",
        manufacturedOn: patch.manufacturedOn ?? current[rowIndex]?.manufacturedOn ?? fallback.manufacturedOn ?? "",
        shelfLifeMonths: patch.shelfLifeMonths ?? current[rowIndex]?.shelfLifeMonths ?? fallback.shelfLifeMonths ?? null,
        expiresOn: "",
      };
      return { ...current, [rowIndex]: { ...next, expiresOn: calculateExpiryDate(next.manufacturedOn, next.shelfLifeMonths) } };
    });
  };
  const setPreviewProductLink = (rowIndex: number, productId: string) => {
    setPreviewProductLinks(current => {
      const next = { ...current };
      if (productId === "__unlinked") delete next[rowIndex];
      else next[rowIndex] = productId;
      return next;
    });
    if (productId !== "__unlinked") {
      setPreviewCategoryTargets(current => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
      setSelectedPreviewRowIndexes(current => current.filter(index => index !== rowIndex));
    }
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
  const toggleSupplierDraftActive = async () => {
    if (!supplierDraft) return;
    const isActive = !supplierDraft.isActive;
    const previous = supplierDraft;
    setSupplierDraft({ ...supplierDraft, isActive });
    if (!supplierDraft.id) return;
    try {
      await setSupplierActive.mutateAsync({ id: supplierDraft.id, isActive });
    } catch {
      setSupplierDraft(previous);
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
  const saveCharacteristic = async () => {
    if (!characteristicDraft?.value.trim()) {
      toast.error("Укажите значение характеристики товара.");
      return;
    }
    if (characteristicDraft.id) {
      await updateCharacteristic.mutateAsync({
        id: characteristicDraft.id,
        value: characteristicDraft.value.trim(),
        isActive: characteristicDraft.isActive,
      });
    } else {
      await createCharacteristic.mutateAsync({
        kind: characteristicDraft.kind,
        value: characteristicDraft.value.trim(),
      });
    }
    setCharacteristicDraft(null);
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
                Город предложения
                <PriceSelect
                  value={offerMarketFilter}
                  onValueChange={value => {
                    setOfferMarketFilter(value === "__all_markets" ? "" : value as "moscow" | "spb");
                    setSelectedProductId(null);
                  }}
                  placeholder="Все города"
                  options={[
                    { value: "__all_markets", label: "Все города" },
                    { value: "moscow", label: "Москва" },
                    { value: "spb", label: "СПБ" },
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
                рекомендации. Фасовка пересчитывается в цену за кг или литр;
                предложения Москвы и СПБ не сравниваются между собой.
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
                      {selected.offers.map(offer => {
                        const draft = offerDrafts[offer.priceId];
                        const currentDraft = {
                          priceAmount: draft?.priceAmount ?? String(offer.priceAmount),
                          priceBasis: draft?.priceBasis ?? offer.priceBasis,
                          priceMode: draft?.priceMode ?? canonicalPriceMode(offer.priceMode),
                          market: draft?.market ?? marketFromPriceMode(offer.market, offer.priceMode),
                          manufacturer: draft?.manufacturer ?? offer.manufacturer ?? "",
                          placeContents: draft?.placeContents ?? offer.placeContents ?? "",
                          manufacturedOn: draft?.manufacturedOn ?? offer.manufacturedOn ?? "",
                          shelfLifeMonths: (draft?.shelfLifeMonths ?? offer.shelfLifeMonths ?? null) as ShelfLifeMonths | null,
                          expiresOn: draft?.expiresOn ?? offer.expiresOn ?? "",
                        };
                        const patchDraft = (patch: Partial<typeof currentDraft>) => {
                          const next = {
                            ...currentDraft,
                            ...patch,
                            ...(patch.priceBasis ? { placeContents: synchronizePlaceContentsBasis(currentDraft.placeContents, patch.priceBasis) } : {}),
                          };
                          const expiresOn = calculateExpiryDate(next.manufacturedOn, next.shelfLifeMonths);
                          setOfferDrafts(current => ({ ...current, [offer.priceId]: { ...next, expiresOn } }));
                        };
                        return (
                          <div
                            className={selected.recommendation?.supplierId === offer.supplierId ? "price-offer winner" : "price-offer"}
                            key={`${offer.rowId}-${offer.priceId}`}
                          >
                            <span>
                              <strong>{offer.supplierName}</strong>
                              <small>
                                {offer.rawName} · {modeLabel[currentDraft.priceMode]}
                                {currentDraft.market !== "unknown" ? ` · ${marketLabel[currentDraft.market]}` : ""}
                              </small>
                            </span>
                            <span>
                              {formatPackaging(offer.packaging) || "Не указана"}
                              {(offer.manufacturer || offer.placeContents) && (
                                <small className="price-offer-metadata">
                                  {offer.manufacturer ? `Производитель: ${offer.manufacturer}` : ""}
                                  {offer.manufacturer && offer.placeContents ? " · " : ""}
                                  {offer.placeContents ? `Место: ${formatPlaceContents(offer.placeContents)}` : ""}
                                </small>
                              )}
                            </span>
                            <span>
                              {canEdit ? (
                                <div className="price-inline-edit">
                                  <input inputMode="decimal" value={currentDraft.priceAmount} onChange={event => patchDraft({ priceAmount: event.target.value })} />
                                  <PriceSelect value={currentDraft.priceBasis} onValueChange={value => patchDraft({ priceBasis: value as PriceBasis })} placeholder="База цены" className="price-select-compact" options={priceBasisOptions(offer.packaging ?? offer.rawName)} />
                                  <PriceSelect value={currentDraft.priceMode} onValueChange={value => patchDraft({ priceMode: value as PricePaymentMode })} placeholder="Условие цены" className="price-select-compact" options={editablePriceModes} />
                                  <PriceSelect value={currentDraft.market} onValueChange={value => patchDraft({ market: value as PriceMarket })} placeholder="Город" className="price-select-compact" options={priceMarketOptions} />
                                  <div className="price-offer-meta-edit">
                                    <PriceSelect value={currentDraft.manufacturer} onValueChange={manufacturer => patchDraft({ manufacturer })} placeholder="Производитель" options={offerCharacteristicOptions("manufacturer", currentDraft.manufacturer)} />
                                    <PriceSelect value={currentDraft.placeContents} onValueChange={placeContents => patchDraft({ placeContents })} placeholder="Состав места" options={offerCharacteristicOptions("place_contents", currentDraft.placeContents)} />
                                    <ExactDateControl value={currentDraft.manufacturedOn} onChange={manufacturedOn => patchDraft({ manufacturedOn })} title="ДАТА ИЗГОТОВЛЕНИЯ" ariaLabel="Указать дату изготовления" emptyLabel="Дата изготовления" />
                                    <div className="price-shelf-life-picker" aria-label="Срок годности">
                                      {shelfLifeOptions.map(option => <button type="button" key={option.value} className={currentDraft.shelfLifeMonths === option.value ? "active" : ""} onClick={() => patchDraft({ shelfLifeMonths: option.value })}>{option.label}</button>)}
                                    </div>
                                    <small className="price-expiry-date">{currentDraft.expiresOn ? `Годен до: ${dateLabel(currentDraft.expiresOn)}` : "Срок годности не указан"}</small>
                                  </div>
                                  <button
                                    type="button"
                                    className="packet-link compact"
                                    onClick={() => {
                                      const value = Number(currentDraft.priceAmount.replace(/\s/g, "").replace(",", "."));
                                      if (value > 0) updateOffer.mutate({
                                        priceId: offer.priceId,
                                        priceAmount: value,
                                        priceBasis: currentDraft.priceBasis,
                                        priceMode: currentDraft.priceMode,
                                        market: currentDraft.market,
                                        manufacturer: currentDraft.manufacturer.trim() || null,
                                        placeContents: currentDraft.placeContents.trim() || null,
                                        manufacturedOn: currentDraft.manufacturedOn || null,
                                        shelfLifeMonths: currentDraft.shelfLifeMonths,
                                        expiresOn: currentDraft.expiresOn || null,
                                      });
                                    }}
                                    disabled={updateOffer.isPending}
                                  >
                                    <Save size={13} />
                                    Сохранить
                                  </button>
                                </div>
                              ) : `${formatMoney(offer.priceAmount)} ₽/${offer.priceBasis === "kg" ? "кг" : offer.priceBasis === "l" ? "л" : "шт"}`}
                            </span>
                            <span>
                              <strong>{priceLabel({ normalizedPrice: offer.normalizedPrice, normalizedUnit: offer.normalizedUnit ?? "kg" })}</strong>
                              <PriceChangeBadge change={offer.priceChange} unit={offer.normalizedUnit ?? "kg"} />
                              {offer.minimumQuantityKg && <small>от {formatMoney(offer.minimumQuantityKg)} кг</small>}
                            </span>
                          </div>
                        );
                      })}
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
              <h2>Выберите файл — проверим автоматически</h2>
              <p>
                Это отдельный импорт коммерческих предложений. Он не использует
                и не изменяет старую страницу импорта финансовых фактов. Сохранение
                произойдет только после вашего подтверждения.
              </p>
            </div>
          </section>
          {canUpload && (
            <>
            <section className={preview ? "price-import-workbench is-preview-ready" : "price-import-workbench"}>
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
                    <small>{Math.max(1, Math.ceil(file.size / 1024))} КБ · {previewing ? "идет автоматическая проверка" : preview ? "проверка готова" : "готов к автоматической проверке"}</small>
                  </div>
                  <button
                    type="button"
                    aria-label="Убрать выбранный файл"
                    onClick={() => {
                      previewRequestToken.current += 1;
                      setFile(null);
                      resetPreviewState();
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="price-import-steps" aria-label="Этапы импорта">
                <span className={file ? "complete" : "active"}><b>1</b> Файл <small>{file ? "выбран" : "ожидание"}</small></span>
                <span className={preview ? "complete" : file ? "active" : ""}><b>2</b> Проверка <small>{preview ? "готово" : "сразу после выбора"}</small></span>
                <span className={committing ? "active" : ""}><b>3</b> Сохранение <small>после подтверждения</small></span>
              </div>
              {previewing && (
                <div className="price-inspect-status" role="status" aria-live="polite">
                  <Loader2 className="animate-spin" />
                  Проверяем прайс‑лист…
                </div>
              )}
              {preview && (
                <div className="price-preview">
                  <div>
                    <span>Распознано строк</span>
                    <strong>{previewActiveRows.length}</strong>
                    {excludedPreviewRowIndexes.length > 0 && <small>исключено: {excludedPreviewRowIndexes.length}</small>}
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
                    {previewSupplierChoice === "__manual" && (
                      <input
                        value={supplierName}
                        onChange={event => setSupplierName(event.target.value)}
                        placeholder="Укажите нового поставщика"
                        maxLength={160}
                      />
                    )}
                    {canEdit && previewSupplierChoice === "__manual" && supplierName.trim() && (
                      <button type="button" className="packet-link compact subtle" onClick={createPreviewSupplier} disabled={createSupplier.isPending}>
                        <Plus size={14} />
                        {createSupplier.isPending ? "Создаем…" : "Добавить в справочник"}
                      </button>
                    )}
                  </label>
                  <div className="price-preview-date">
                    <span>Дата прайса</span>
                    <ExactDateControl
                      value={sourceDate}
                      onChange={setSourceDate}
                      title="ДАТА ПРАЙСА"
                      ariaLabel="Изменить дату прайс-листа"
                    />
                  </div>
                  <div className="price-preview-actions">
                    <small>
                      {unresolvedPreviewPriceCount
                        ? `Требуют проверки: ${unresolvedPreviewPriceCount}`
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
                          Отметьте новые строки и назначьте существующую или
                          явно создайте новую категорию. Товары появятся только
                          после сохранения прайс‑листа.
                        </small>
                      </div>
                      {selectedPreviewRowIndexes.length > 0 && (
                        <div className="price-preview-bulk-actions">
                          <span>Выбрано для действия: {selectedPreviewRowIndexes.length}</span>
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
                          <PriceSelect
                            value={previewBulkMarket}
                            onValueChange={value => setPreviewBulkMarket(value as PriceMarket)}
                            placeholder="Город для отмеченных"
                            options={priceMarketOptions}
                          />
                          <button
                            type="button"
                            className="packet-link compact"
                            disabled={!previewBulkMarket}
                            onClick={assignPreviewMarketToSelected}
                          >
                            <MapPin size={14} />
                            Назначить город
                          </button>
                          <div className="price-preview-create-category">
                            <input
                              value={previewNewCategoryName}
                              onChange={event => setPreviewNewCategoryName(event.target.value)}
                              placeholder="Новая категория"
                              maxLength={160}
                            />
                            <button
                              type="button"
                              className="packet-link compact subtle"
                              onClick={createPreviewCategory}
                              disabled={createCategory.isPending || previewNewCategoryName.trim().length < 2}
                            >
                              <FolderPlus size={14} />
                              {createCategory.isPending ? "Создаем…" : "Создать и назначить"}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="packet-link compact subtle-danger"
                            onClick={() => removePreviewRows(selectedPreviewRowIndexes)}
                          >
                            <Trash2 size={14} />
                            Исключить выбранные
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
                      {selectedPreviewRowIndexes.length === 0 && (
                        <div className="price-preview-bulk-actions">
                          <span>Выберите новые строки, чтобы назначить им категорию или исключить их.</span>
                          <button
                            type="button"
                            className="packet-link compact subtle"
                            onClick={() => setSelectedPreviewRowIndexes(previewNewRows.map(item => item.index))}
                          >
                            <CheckCircle2 size={14} />
                            Выбрать все новые
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {previewActiveRows.length > 1 && (
                    <div className="price-preview-mobile-pager" aria-label="Навигация по позициям предпросмотра">
                      <button
                        type="button"
                        aria-label="Предыдущая позиция"
                        onClick={() => moveMobilePreview(-1)}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <span>Позиция {currentMobilePreviewPosition + 1} из {previewActiveRows.length}</span>
                      <button
                        type="button"
                        aria-label="Следующая позиция"
                        onClick={() => moveMobilePreview(1)}
                      >
                        <ChevronRight size={17} />
                      </button>
                      {mobilePreviewHintVisible && (
                        <small className="price-preview-swipe-hint" aria-live="polite">
                          <ChevronLeft className="price-preview-swipe-hint-left" size={13} />
                          Свайпните влево или вправо
                          <ChevronRight className="price-preview-swipe-hint-right" size={13} />
                        </small>
                      )}
                    </div>
                  )}
                  <div className="price-preview-table" onPointerDown={startPreviewSwipe} onPointerMove={updatePreviewSwipe} onPointerUp={finishPreviewSwipe} onPointerCancel={cancelPreviewSwipe}>
                    {previewActiveRows.map(({ row, index }, position) => {
                      const isMobileCurrent = currentMobilePreviewRowIndex === index;
                      const isMobileOutgoing = mobilePreviewTransition?.from === position;
                      const isMobileIncoming = mobilePreviewTransition?.to === position;
                      const transitionClass = isMobileOutgoing
                        ? mobilePreviewTransition?.direction === 1
                          ? " is-mobile-carousel-outgoing is-mobile-swipe-exit-to-left"
                          : " is-mobile-carousel-outgoing is-mobile-swipe-exit-to-right"
                        : isMobileIncoming
                          ? mobilePreviewTransition?.direction === 1
                            ? " is-mobile-carousel-incoming is-mobile-swipe-enter-from-right"
                            : " is-mobile-carousel-incoming is-mobile-swipe-enter-from-left"
                          : "";
                      const isMobileVisible = isMobileCurrent || isMobileOutgoing || isMobileIncoming;
                      return (
                        <div
                          key={`${row.rawName}-${index}`}
                          className={
                            `${canEdit && previewNewRowIndexes.has(index) ? "price-preview-new-row" : "price-preview-row"}${selectedPreviewRowIndexes.includes(index) ? " is-selected" : ""}${isMobileCurrent ? " is-mobile-current" : ""}${isMobileVisible ? " is-mobile-carousel-visible" : ""}${isMobileCurrent && !mobilePreviewTransition && mobilePreviewSwipeOffset !== 0 ? " is-mobile-swipe-dragging" : ""}${transitionClass}`
                          }
                          style={isMobileCurrent ? ({ "--price-preview-swipe-offset": `${mobilePreviewSwipeOffset}px` } as CSSProperties) : undefined}
                          onAnimationEnd={event => {
                            if (event.currentTarget !== event.target || !isMobileIncoming || !mobilePreviewTransition) return;
                            setMobilePreviewSwipeOffset(0);
                            setMobilePreviewTransition(current => current?.to === position ? null : current);
                          }}
                        >
                        {canEdit && previewNewRowIndexes.has(index) && (
                          <div className="price-preview-selection-marker">
                            <label className="price-preview-check">
                              <input
                                type="checkbox"
                                checked={selectedPreviewRowIndexes.includes(index)}
                                onChange={() => togglePreviewRow(index)}
                                aria-label={`Выбрать новую позицию «${row.rawName}»`}
                              />
                              <span aria-hidden="true"><Check size={12} /></span>
                            </label>
                            <span className="price-preview-row-number" aria-label={`Позиция ${position + 1}`}>№ {position + 1}</span>
                          </div>
                        )}
                        <div className="price-preview-product">
                          {canUpload ? (
                            <div className={`price-preview-name-edit${expandedPreviewNameRows[index] ? " is-expanded" : ""}`}>
                              <label htmlFor={`price-preview-name-${index}`}>
                                <span>Название в этом прайсе</span>
                              </label>
                              <div className="price-preview-name-field">
                                <textarea
                                  id={`price-preview-name-${index}`}
                                  rows={expandedPreviewNameRows[index] ? 4 : 2}
                                  value={previewNameEdits[index] ?? row.rawName}
                                  onChange={event => updatePreviewNameDraft(index, event.target.value)}
                                  maxLength={255}
                                  aria-label={`Название позиции ${row.rawName}`}
                                />
                                <button
                                  type="button"
                                  className="price-preview-name-expand"
                                  aria-label={expandedPreviewNameRows[index] ? "Свернуть поле названия" : "Развернуть поле названия"}
                                  title={expandedPreviewNameRows[index] ? "Свернуть поле названия" : "Развернуть поле названия"}
                                  aria-expanded={Boolean(expandedPreviewNameRows[index])}
                                  aria-controls={`price-preview-name-${index}`}
                                  onClick={() => setExpandedPreviewNameRows(current => ({ ...current, [index]: !current[index] }))}
                                >
                                  {expandedPreviewNameRows[index] ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
                                </button>
                              </div>
                            </div>
                          ) : <strong>{row.rawName}</strong>}
                          <span>
                            {row.category || "Без категории"} ·{" "}
                            {formatPackaging(row.packaging) || "фасовка не указана"}
                          </span>
                          <div className="price-preview-offer-metadata">
                            {canUpload ? (
                              <>
                                <label>
                                  Производитель
                                  <PriceSelect
                                    value={previewMetadataEdits[index]?.manufacturer ?? row.manufacturer ?? ""}
                                    onValueChange={manufacturer => updatePreviewMetadataDraft(index, { manufacturer }, row)}
                                    placeholder="Не указан"
                                    options={offerCharacteristicOptions("manufacturer", previewMetadataEdits[index]?.manufacturer ?? row.manufacturer)}
                                  />
                                </label>
                                <label>
                                  Состав места
                                  <PriceSelect
                                    value={previewMetadataEdits[index]?.placeContents ?? row.placeContents ?? ""}
                                    onValueChange={placeContents => updatePreviewMetadataDraft(index, { placeContents }, row)}
                                    placeholder="Не указан"
                                    options={offerCharacteristicOptions("place_contents", previewMetadataEdits[index]?.placeContents ?? row.placeContents)}
                                  />
                                </label>
                                <label className="price-preview-manufactured-date">
                                  Дата изготовления
                                  <ExactDateControl
                                    value={previewMetadataEdits[index]?.manufacturedOn ?? row.manufacturedOn ?? ""}
                                    onChange={manufacturedOn => updatePreviewMetadataDraft(index, { manufacturedOn }, row)}
                                    title="ДАТА ИЗГОТОВЛЕНИЯ"
                                    ariaLabel={`Указать дату изготовления «${row.rawName}»`}
                                    emptyLabel="Не указана"
                                  />
                                </label>
                                <div className="price-shelf-life-picker" aria-label={`Срок годности «${row.rawName}»`}>
                                  {shelfLifeOptions.map(option => (
                                    <button type="button" key={option.value} className={(previewMetadataEdits[index]?.shelfLifeMonths ?? row.shelfLifeMonths) === option.value ? "active" : ""} onClick={() => updatePreviewMetadataDraft(index, { shelfLifeMonths: option.value }, row)}>{option.label}</button>
                                  ))}
                                </div>
                                <small className="price-expiry-date">
                                  {(previewMetadataEdits[index]?.expiresOn ?? row.expiresOn) ? `Годен до: ${dateLabel(previewMetadataEdits[index]?.expiresOn ?? row.expiresOn)}` : "Срок годности не указан"}
                                </small>
                              </>
                            ) : (
                              <small>
                                {row.manufacturer ? `Производитель: ${row.manufacturer}` : "Производитель не указан"}
                                {row.placeContents ? ` · Место: ${formatPlaceContents(row.placeContents)}` : ""}
                              </small>
                            )}
                          </div>
                        </div>
                        <div className="price-preview-prices" aria-label={`Цены позиции ${row.rawName}`}>
                          {row.priceOptions.map((option, optionIndex) => {
                            const priceKey = previewPriceKey(index, optionIndex);
                            if (previewRemovedPriceOptions[priceKey]) return null;
                            const draft = previewPriceEdits[previewPriceKey(index, optionIndex)];
                            return (
                              <div key={priceKey}>
                                <small>{option.priceAmount === null ? "цена не указана поставщиком" : modeLabel[canonicalPriceMode(option.priceMode)]}</small>
                                {canUpload ? (
                                  <div className="price-preview-price-edit">
                                    <input
                                      inputMode="decimal"
                                      value={draft?.priceAmount ?? (option.priceAmount === null ? "" : String(option.priceAmount))}
                                      onChange={event => updatePreviewPriceDraft(index, optionIndex, option, { priceAmount: event.target.value })}
                                      aria-label={`Цена «${row.rawName}», ${modeLabel[option.priceMode] ?? "б/нал с НДС"}`}
                                    />
                                    <PriceSelect
                                      value={draft?.priceBasis ?? option.priceBasis}
                                      onValueChange={value => updatePreviewPriceDraft(index, optionIndex, option, { priceBasis: value as PriceBasis })}
                                      placeholder="База цены"
                                      className="price-preview-basis-select"
                                      options={priceBasisOptions(row.packaging || row.rawName)}
                                    />
                                    <PriceSelect
                                      value={draft?.priceMode ?? canonicalPriceMode(option.priceMode)}
                                      onValueChange={value => updatePreviewPriceDraft(index, optionIndex, option, { priceMode: value as PricePaymentMode })}
                                      placeholder="Условие цены"
                                      className="price-preview-mode-select"
                                      options={editablePriceModes}
                                    />
                                    <PriceSelect
                                      value={draft?.market ?? marketFromPriceMode(option.market, option.priceMode)}
                                      onValueChange={value => updatePreviewPriceDraft(index, optionIndex, option, { market: value as PriceMarket })}
                                      placeholder="Город"
                                      className="price-preview-market-select"
                                      options={priceMarketOptions}
                                    />
                                    <button
                                      type="button"
                                      className="price-preview-price-remove"
                                      onClick={() => removePreviewPriceOption(index, optionIndex, row)}
                                      aria-label={`Удалить вариант цены «${row.rawName}»`}
                                      title="Удалить вариант цены"
                                    >
                                      <X size={15} />
                                    </button>
                                  </div>
                                ) : (
                                  option.priceAmount === null
                                    ? <b>Цена уточняется</b>
                                    : <b>{formatMoney(option.priceAmount)} ₽/{basisLabel[option.priceBasis].replace("за ", "")}</b>
                                )}
                              </div>
                            );
                          })}
                          {(previewAddedPriceOptions[index] ?? []).map(option => (
                            <div key={previewAddedPriceKey(index, option.id)} className="price-preview-added-price">
                              <small>цена добавлена вручную</small>
                              <div className="price-preview-price-edit">
                                <input
                                  inputMode="decimal"
                                  value={option.priceAmount}
                                  onChange={event => updatePreviewAddedPriceOption(index, option.id, { priceAmount: event.target.value })}
                                  aria-label={`Добавленная цена «${row.rawName}»`}
                                />
                                <PriceSelect
                                  value={option.priceBasis}
                                  onValueChange={value => updatePreviewAddedPriceOption(index, option.id, { priceBasis: value as PriceBasis })}
                                  placeholder="База цены"
                                  className="price-preview-basis-select"
                                  options={priceBasisOptions(row.packaging || row.rawName)}
                                />
                                <PriceSelect
                                  value={option.priceMode}
                                  onValueChange={value => updatePreviewAddedPriceOption(index, option.id, { priceMode: value as PricePaymentMode })}
                                  placeholder="Условие цены"
                                  className="price-preview-mode-select"
                                  options={editablePriceModes}
                                />
                                <PriceSelect
                                  value={option.market}
                                  onValueChange={value => updatePreviewAddedPriceOption(index, option.id, { market: value as PriceMarket })}
                                  placeholder="Город"
                                  className="price-preview-market-select"
                                  options={priceMarketOptions}
                                />
                                <button
                                  type="button"
                                  className="price-preview-price-remove"
                                  onClick={() => removePreviewAddedPriceOption(index, option.id)}
                                  aria-label={`Удалить добавленную цену «${row.rawName}»`}
                                  title="Удалить вариант цены"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {canUpload && (
                            <button
                              type="button"
                              className="packet-link compact subtle price-preview-price-add"
                              onClick={() => addPreviewPriceOption(index, row)}
                            >
                              <Plus size={14} />
                              Добавить цену
                            </button>
                          )}
                        </div>
                        {canEdit && (
                          <PriceSelect
                            value={previewProductLinks[index] ?? "__unlinked"}
                            onValueChange={value => setPreviewProductLink(index, value)}
                            placeholder="Связать с внутренним товаром"
                            className="price-preview-product-link"
                            options={[
                              { value: "__unlinked", label: "Не связывать сейчас" },
                              ...catalogProducts.filter(product => product.isActive).map(product => ({
                                value: String(product.id),
                                label: `${product.internalCode} · ${product.canonicalName}`,
                              })),
                            ]}
                          />
                        )}
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
                        {canUpload && (
                          <button
                            type="button"
                            className="price-preview-remove"
                            onClick={() => removePreviewRows([index])}
                            aria-label={`Исключить «${row.rawName}» из импорта`}
                            title="Исключить из этого импорта"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        </div>
                      );
                    })}
                  </div>
                  {excludedPreviewRowIndexes.length > 0 && (
                    <details className="price-preview-excluded">
                      <summary>Исключено из этого импорта: {excludedPreviewRowIndexes.length}</summary>
                      <div>
                        {excludedPreviewRowIndexes.map(index => (
                          <button type="button" key={index} onClick={() => restorePreviewRow(index)}>
                            <span>{preview?.rows[index]?.rawName ?? `Строка ${index + 1}`}</span>
                            Вернуть
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  {unresolvedPreviewPriceCount > 0 && (
                    <p className="inline-error">
                      У {unresolvedPreviewPriceCount} поз. цена не указана поставщиком: заполните ее вручную перед сохранением
                    </p>
                  )}
                  {previewStaticWarnings.map(warning => (
                    <p key={warning} className="inline-error">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
              </div>
              {!preview && <aside className="packet-card price-import-guide">
                <span>ТРЕБОВАНИЯ К ПРАЙСУ</span>
                <h3>Как система читает файл</h3>
                <ol>
                  <li><b>1</b><span>Определяет поставщика и дату из шапки, если они указаны; иначе их можно выбрать или указать перед сохранением.</span></li>
                  <li><b>2</b><span>Находит товарные строки, цену, фасовку и единицу измерения.</span></li>
                  <li><b>3</b><span>Приводит фасовку к сопоставимой цене за кг или за литр.</span></li>
                  <li><b>4</b><span>Сначала применяет подтвержденные связи «поставщик → наш товар».</span></li>
                  <li><b>5</b><span>Показывает предпросмотр: до подтверждения ничего не сохраняется.</span></li>
                </ol>
                <p>Проверка запускается сразу после выбора файла. До явного сохранения можно исправить цену, исключить позицию и назначить категорию; исходный файл при этом не меняется.</p>
              </aside>}
            </section>
            </>
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
                        {importItem.sourceType === "manual" ? "ВВЕДЕНО ВРУЧНУЮ" : importItem.sourceType.toUpperCase()}
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
                      {importItem.sourceType !== "manual" && (
                        <button
                          type="button"
                          className="packet-link compact"
                          onClick={() => downloadExisting(importItem.id)}
                          disabled={downloadImport.isPending}
                        >
                          <Download size={14} />
                          Скачать
                        </button>
                      )}
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
                    {canEdit && (
                      <button
                        type="button"
                        className="price-preview-remove"
                        onClick={() => setDeleteSavedRowCandidate({ rowId: row.rowId, name: row.rawName })}
                        aria-label={`Удалить сохраненную позицию «${row.rawName}»`}
                        title="Удалить позицию из сохраненного прайса"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
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
                    variantCharacteristicId: "",
                    sizeCharacteristicId: "",
                    placeContentsCharacteristicId: "",
                    baseUnit: "unknown",
                    isActive: true,
                    manualOffer: createManualOfferDraft(),
                  })
                }
              >
                <Plus size={14} />
                Новый товар
              </button>
            )}
            <section className="price-characteristics-panel" aria-label="Характеристики товаров">
              <div>
                <span>ХАРАКТЕРИСТИКИ ТОВАРОВ</span>
                <p>Вариант, фасовка, состав места и производитель выбираются из повторно используемых значений, а не вводятся заново в каждой позиции.</p>
              </div>
              {canEdit && (
                <div className="price-characteristics-actions">
                  <button type="button" className="packet-link compact" onClick={() => setCharacteristicDraft({ id: null, kind: "variant", value: "", isActive: true })}>
                    <Plus size={13} /> Вариант
                  </button>
                  <button type="button" className="packet-link compact" onClick={() => setCharacteristicDraft({ id: null, kind: "size", value: "", isActive: true })}>
                    <Plus size={13} /> Фасовка
                  </button>
                  <button type="button" className="packet-link compact" onClick={() => setCharacteristicDraft({ id: null, kind: "place_contents", value: "", isActive: true })}>
                    <Plus size={13} /> Состав места
                  </button>
                  <button type="button" className="packet-link compact" onClick={() => setCharacteristicDraft({ id: null, kind: "manufacturer", value: "", isActive: true })}>
                    <Plus size={13} /> Производитель
                  </button>
                </div>
              )}
              {characteristicDraft && (
                <div className="price-characteristics-editor">
                  <label>
                    Тип
                    {characteristicDraft.id ? (
                      <strong>{characteristicDraft.kind === "variant" ? "Вариант товара" : characteristicDraft.kind === "size" ? "Фасовка / вес" : characteristicDraft.kind === "place_contents" ? "Состав места" : "Производитель"}</strong>
                    ) : (
                      <PriceSelect
                        value={characteristicDraft.kind}
                        onValueChange={value => setCharacteristicDraft({ ...characteristicDraft, kind: value as CharacteristicDraft["kind"] })}
                        placeholder="Тип характеристики"
                        options={[{ value: "variant", label: "Вариант товара" }, { value: "size", label: "Фасовка / вес" }, { value: "place_contents", label: "Состав места" }, { value: "manufacturer", label: "Производитель" }]}
                      />
                    )}
                  </label>
                  <label>
                    Значение
                    <input value={characteristicDraft.value} onChange={event => setCharacteristicDraft({ ...characteristicDraft, value: event.target.value })} placeholder={characteristicDraft.kind === "variant" ? "Например, IQF" : characteristicDraft.kind === "size" ? "Например, 500гр" : characteristicDraft.kind === "place_contents" ? "Например, 1/12.5кг" : "Например, Экспрод"} maxLength={160} />
                  </label>
                  {characteristicDraft.id && (
                    <button type="button" className={`price-active-toggle${characteristicDraft.isActive ? " is-active" : ""}`} onClick={() => setCharacteristicDraft({ ...characteristicDraft, isActive: !characteristicDraft.isActive })}>
                      {characteristicDraft.isActive ? <CheckCircle2 size={15} /> : <EyeOff size={15} />}
                      <span><strong>{characteristicDraft.isActive ? "Доступна в списках" : "Скрыта из списков"}</strong></span>
                    </button>
                  )}
                  <div>
                    <button type="button" className="packet-link compact" onClick={() => void saveCharacteristic()} disabled={createCharacteristic.isPending || updateCharacteristic.isPending}><Save size={14} /> Сохранить</button>
                    <button type="button" className="packet-link compact" onClick={() => setCharacteristicDraft(null)}>Отмена</button>
                  </div>
                </div>
              )}
              {!!characteristics.length && (
                <div className="price-characteristics-list">
                  {characteristics.map(item => (
                    <button type="button" key={item.id} className={item.isActive ? "" : "is-hidden"} onClick={() => canEdit && setCharacteristicDraft({ id: item.id, kind: item.kind, value: item.value, isActive: item.isActive })} disabled={!canEdit}>
                      <small>{item.kind === "variant" ? "ВАРИАНТ" : item.kind === "size" ? "ФАСОВКА" : item.kind === "place_contents" ? "СОСТАВ МЕСТА" : "ПРОИЗВОДИТЕЛЬ"}</small>
                      <strong>{item.value}</strong>
                      {!item.isActive && <em>Скрыта</em>}
                    </button>
                  ))}
                </div>
              )}
            </section>
            {productDraft && (
              <div ref={productEditorRef} className="price-directory-editor">
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
                <label>
                  Характеристика товара
                  <PriceSelect
                    value={productDraft.variantCharacteristicId}
                    onValueChange={value => setProductDraft({ ...productDraft, variantCharacteristicId: value })}
                    placeholder="Выберите значение"
                    options={selectableCharacteristics("variant").map(item => ({ value: String(item.id), label: item.value }))}
                  />
                </label>
                <label>
                  Фасовка / вес
                  <PriceSelect
                    value={productDraft.sizeCharacteristicId}
                    onValueChange={value => setProductDraft({ ...productDraft, sizeCharacteristicId: value })}
                    placeholder="Выберите значение"
                    options={selectableCharacteristics("size").map(item => ({ value: String(item.id), label: item.value }))}
                  />
                </label>
                <label>
                  Состав места
                  <PriceSelect
                    value={productDraft.placeContentsCharacteristicId}
                    onValueChange={value => setProductDraft({ ...productDraft, placeContentsCharacteristicId: value })}
                    placeholder="Выберите значение"
                    options={selectableCharacteristics("place_contents").map(item => ({ value: String(item.id), label: item.value }))}
                  />
                </label>
                <section className="price-manual-offer-editor" aria-label="Ручное предложение поставщика">
                  <div className="price-manual-offer-heading">
                    <span>РУЧНОЕ ПРЕДЛОЖЕНИЕ</span>
                    <p>Добавьте цену без загрузки прайс‑листа. Она сразу попадет в историю и сравнение.</p>
                  </div>
                  <button
                    type="button"
                    className={`price-active-toggle${productDraft.manualOffer.enabled ? " is-active" : ""}`}
                    aria-pressed={productDraft.manualOffer.enabled}
                    onClick={() => patchProductManualOffer({ enabled: !productDraft.manualOffer.enabled })}
                  >
                    {productDraft.manualOffer.enabled ? <CheckCircle2 size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    <span>
                      <strong>{productDraft.manualOffer.enabled ? "Цена будет добавлена" : "Добавить цену поставщика"}</strong>
                      <small>Поставщик, дата и цена обязательны</small>
                    </span>
                    <em>{productDraft.manualOffer.enabled ? "Включено" : "Не добавлять"}</em>
                  </button>
                  {productDraft.manualOffer.enabled && (
                    <div className="price-manual-offer-fields">
                      <label>
                        Поставщик
                        <PriceSelect
                          value={productDraft.manualOffer.supplierId}
                          onValueChange={supplierId => patchProductManualOffer({ supplierId })}
                          placeholder="Выберите поставщика"
                          options={selectableSuppliers.map(supplier => ({ value: String(supplier.id), label: supplier.name }))}
                        />
                      </label>
                      <ExactDateControl
                        value={productDraft.manualOffer.sourceDate}
                        onChange={sourceDate => patchProductManualOffer({ sourceDate })}
                        title="ДАТА ПРЕДЛОЖЕНИЯ"
                        ariaLabel="Указать дату ручного предложения"
                        emptyLabel="Дата не указана"
                      />
                      <label>
                        Цена, ₽
                        <input
                          inputMode="decimal"
                          value={productDraft.manualOffer.priceAmount}
                          onChange={event => patchProductManualOffer({ priceAmount: event.target.value })}
                          placeholder="Например, 925"
                        />
                      </label>
                      <label>
                        База цены
                        <PriceSelect
                          value={productDraft.manualOffer.priceBasis}
                          onValueChange={priceBasis => patchProductManualOffer({ priceBasis: priceBasis as PriceBasis })}
                          placeholder="База цены"
                          options={priceBasisOptions(null)}
                        />
                      </label>
                      <label>
                        Условие оплаты
                        <PriceSelect
                          value={productDraft.manualOffer.priceMode}
                          onValueChange={priceMode => patchProductManualOffer({ priceMode: priceMode as PricePaymentMode })}
                          placeholder="Условие оплаты"
                          options={editablePriceModes}
                        />
                      </label>
                      <label>
                        Город
                        <PriceSelect
                          value={productDraft.manualOffer.market}
                          onValueChange={market => patchProductManualOffer({ market: market as PriceMarket })}
                          placeholder="Город"
                          options={priceMarketOptions}
                        />
                      </label>
                      <label>
                        Производитель
                        <PriceSelect
                          value={productDraft.manualOffer.manufacturer}
                          onValueChange={manufacturer => patchProductManualOffer({ manufacturer })}
                          placeholder="Не указан"
                          options={offerCharacteristicOptions("manufacturer", productDraft.manualOffer.manufacturer)}
                        />
                      </label>
                      <label>
                        Состав места
                        <PriceSelect
                          value={productDraft.manualOffer.placeContents}
                          onValueChange={placeContents => patchProductManualOffer({ placeContents })}
                          placeholder="Не указан"
                          options={offerCharacteristicOptions("place_contents", productDraft.manualOffer.placeContents)}
                        />
                      </label>
                      <ExactDateControl
                        value={productDraft.manualOffer.manufacturedOn}
                        onChange={manufacturedOn => patchProductManualOffer({ manufacturedOn })}
                        title="ДАТА ИЗГОТОВЛЕНИЯ"
                        ariaLabel="Указать дату изготовления ручного предложения"
                        emptyLabel="Не указана"
                      />
                      <div className="price-shelf-life-picker" aria-label="Срок годности ручного предложения">
                        {shelfLifeOptions.map(option => (
                          <button
                            type="button"
                            key={option.value}
                            className={productDraft.manualOffer.shelfLifeMonths === option.value ? "active" : ""}
                            onClick={() => patchProductManualOffer({ shelfLifeMonths: option.value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <small className="price-expiry-date">
                        {productDraft.manualOffer.expiresOn
                          ? `Годен до: ${dateLabel(productDraft.manualOffer.expiresOn)}`
                          : "Срок годности не указан"}
                      </small>
                    </div>
                  )}
                </section>
                <button
                  type="button"
                  className={`price-active-toggle${productDraft.isActive ? " is-active" : ""}`}
                  aria-pressed={productDraft.isActive}
                  onClick={() => setProductDraft({ ...productDraft, isActive: !productDraft.isActive })}
                >
                  {productDraft.isActive ? <CheckCircle2 size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                  <span>
                    <strong>{productDraft.isActive ? "Активен в фильтрах" : "Скрыт из фильтров"}</strong>
                    <small>История цен и связи сохраняются в обоих состояниях</small>
                  </span>
                  <em>{productDraft.isActive ? "Включен" : "Скрыт"}</em>
                </button>
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
                      {product.sizeText || product.variant || product.placeContents
                        ? [product.sizeText, product.variant, product.placeContents ? `Место: ${formatPlaceContents(product.placeContents)}` : null]
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
                <div ref={categoryEditorRef} className="price-directory-editor category">
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
                              onClick={() => openCategoryEditor(category)}
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
              <div ref={supplierEditorRef} className="price-directory-editor supplier">
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
                <button
                  type="button"
                  className={`price-active-toggle${supplierDraft.isActive ? " is-active" : ""}`}
                  aria-pressed={supplierDraft.isActive}
                  onClick={toggleSupplierDraftActive}
                  disabled={setSupplierActive.isPending}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>
                    <strong>Активен в фильтрах</strong>
                    <small>Доступен при выборе поставщика</small>
                  </span>
                  <em>{supplierDraft.isActive ? "Включен" : "Скрыт"}</em>
                </button>
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
                      onClick={() => openSupplierEditor(supplier)}
                    >
                      <Pencil size={14} />
                      Изменить
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="packet-link compact subtle"
                      onClick={() =>
                        setSupplierActive.mutate({
                          id: supplier.id,
                          isActive: !supplier.isActive,
                        })
                      }
                      disabled={setSupplierActive.isPending}
                    >
                      {supplier.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      {supplier.isActive ? "Скрыть" : "Показать"}
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
      <AlertDialog
        open={Boolean(deleteSavedRowCandidate)}
        onOpenChange={open => {
          if (!open) setDeleteSavedRowCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить позицию из сохраненного прайса?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены распознанная позиция «{deleteSavedRowCandidate?.name}» и ее цены. Исходный файл прайс‑листа, история других позиций и товарные связи сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отменить</AlertDialogCancel>
            <AlertDialogAction
              className="danger-confirm-action"
              disabled={deleteImportRow.isPending}
              onClick={() => {
                if (deleteSavedRowCandidate) deleteImportRow.mutate({ rowId: deleteSavedRowCandidate.rowId });
              }}
            >
              {deleteImportRow.isPending ? "Удаляем…" : "Удалить позицию"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuditShell>
  );
}
