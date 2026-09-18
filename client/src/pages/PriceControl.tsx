import { type CSSProperties, type PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
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
import { normalizeDecimalInputText } from "@/lib/utils";

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
type DirectoryTab = "products" | "categories" | "suppliers" | "links";
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
      searchable
      searchPlaceholder="Найти в списке"
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
type PriceOfferTooltipDatum = {
  supplierName: string;
  rawName: string;
  packaging: string | null;
  manufacturer: string | null;
  placeContents: string | null;
  priceMode: PricePaymentMode;
  market: PriceMarket;
  priceAmount: number;
  priceBasis: PriceBasis;
  normalizedPrice: number;
  normalizedUnit: string;
  sourceDate: string | null;
  sourcePriceText: string | null;
  priceChange: PriceChangeView;
};
type PriceHistoryPoint = {
  date: string;
  offerDetails: Record<string, PriceOfferTooltipDatum>;
  [key: string]: string | number | Record<string, PriceOfferTooltipDatum>;
};
function PriceOfferTooltipDetails({ offer }: { offer: PriceOfferTooltipDatum }) {
  return <>
    <div className="price-offer-tooltip-main">
      <strong>{offer.supplierName}</strong>
      <b>{priceLabel(offer)}</b>
    </div>
    <dl className="price-offer-tooltip-details">
      <div><dt>Город</dt><dd>{marketLabel[offer.market]}</dd></div>
      <div><dt>Условие</dt><dd>{modeLabel[offer.priceMode]}</dd></div>
      <div><dt>Исходная строка</dt><dd>{offer.rawName}</dd></div>
      <div><dt>Фасовка</dt><dd>{formatPackaging(offer.packaging) || "Не указана"}</dd></div>
      <div><dt>Производитель</dt><dd>{offer.manufacturer || "Не указан"}</dd></div>
      <div><dt>Состав места</dt><dd>{formatPlaceContents(offer.placeContents) || "Не указан"}</dd></div>
      <div><dt>В прайсе</dt><dd>{offer.sourcePriceText || `${formatMoney(offer.priceAmount)} ₽`} · {basisLabel[offer.priceBasis]}</dd></div>
      <div><dt>Дата</dt><dd>{dateLabel(offer.sourceDate)}</dd></div>
    </dl>
    <PriceChangeBadge change={offer.priceChange} unit={offer.normalizedUnit} />
  </>;
}
function PriceHistoryTooltip({ active, label, payload }: { active?: boolean; label?: string | number; payload?: Array<{ payload?: PriceHistoryPoint; dataKey?: string | number; name?: string | number }> }) {
  if (!active || !payload?.length) return null;
  const offers = payload.map(entry => {
    const supplier = String(entry.dataKey ?? entry.name ?? "");
    return entry.payload?.offerDetails[supplier];
  }).filter((offer): offer is PriceOfferTooltipDatum => Boolean(offer));
  if (!offers.length) return null;
  return <div className="price-offer-tooltip price-history-tooltip" role="status">
    <span className="price-history-tooltip-date">{dateLabel(String(label ?? offers[0].sourceDate ?? ""))}</span>
    {offers.map(offer => <section key={`${offer.supplierName}-${offer.sourceDate}-${offer.priceAmount}`}><PriceOfferTooltipDetails offer={offer} /></section>)}
  </div>;
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
    linkNames: Array<{ rowIndex: number; canonicalName: string }>;
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
    linkNames: Array<{ rowIndex: number; canonicalName: string }>;
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
      toast.success("Товар добавлен в справочник");
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
  const updateLinkGroup = trpc.priceControl.updateLinkGroup.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Имя связи обновлено");
    },
    onError: error => toast.error(error.message),
  });
  const assignProductLinkGroup = trpc.priceControl.assignProductLinkGroup.useMutation({
    onSuccess: () => { invalidate(); toast.success("Товар добавлен в связь"); },
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
  const repairRecognizedVariants = trpc.priceControl.repairRecognizedVariants.useMutation({
    onSuccess: result => {
      invalidate();
      toast.success("Варианты из названий добавлены", {
        description: `Обновлено товаров: ${result.updated}.`,
      });
    },
    onError: error => toast.error(error.message),
  });
  const refreshPlaceContents = trpc.priceControl.refreshPlaceContents.useMutation({
    onSuccess: result => {
      invalidate();
      toast.success("Составы мест добавлены в справочник", {
        description: result.created.length
          ? `Добавлено значений: ${result.created.length}.`
          : "Все составы мест из сохраненных прайсов уже доступны.",
      });
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
  const bulkSetProductActive = trpc.priceControl.bulkSetProductActive.useMutation({
    onSuccess: result => {
      invalidate();
      setSelectedDirectoryProductIds([]);
      toast.success(result.isActive ? "Товары показаны" : "Товары скрыты", {
        description: `Обновлено товаров: ${result.updated}.`,
      });
    },
    onError: error => toast.error(error.message),
  });
  const bulkSetOfferMarket = trpc.priceControl.bulkSetOfferMarket.useMutation({
    onSuccess: result => {
      invalidate();
      toast.success("Город назначен предложениям", {
        description: `Обновлено ценовых предложений: ${result.updatedOffers}.`,
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
      setComparisonManualOffer(null);
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
  const updateImportRowCategory = trpc.priceControl.updateImportRowCategory.useMutation({
    onSuccess: () => { invalidate(); toast.success("Категория позиции обновлена"); },
    onError: error => toast.error(error.message),
  });
  const linkRow = trpc.priceControl.linkRow.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Название поставщика добавлено в связь", {
        description:
          "Следующие прайсы этого поставщика будут сопоставляться с этим именем связи.",
      });
    },
    onError: error => toast.error(error.message),
  });
  const reassignAlias = trpc.priceControl.reassignAlias.useMutation({
    onSuccess: () => {
      invalidate();
      setEditingAliasId(null);
      toast.success("Название поставщика переназначено");
    },
    onError: error => toast.error(error.message),
  });
  const unlinkAlias = trpc.priceControl.unlinkAlias.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Название поставщика убрано из связи");
    },
    onError: error => toast.error(error.message),
  });
  const createAlias = trpc.priceControl.createAlias.useMutation({
    onSuccess: (_, variables) => {
      invalidate();
      setNewAliasDrafts(current => ({ ...current, [variables.productId]: { supplierId: "", name: "", packaging: "" } }));
      toast.success("Название поставщика добавлено в связь");
    },
    onError: error => toast.error(error.message),
  });
  const repairLinkCodes = trpc.priceControl.repairLinkCodes.useMutation({
    onSuccess: result => {
      invalidate();
      toast.success(result.updated ? `Назначены коды связей: ${result.updated}` : "Все коды связей уже назначены");
    },
    onError: error => toast.error(error.message),
  });
  const backfillLinkNames = trpc.priceControl.backfillLinkNames.useMutation({
    onSuccess: result => {
      invalidate();
      toast.success(
        result.linkedRows
          ? `Созданы имена связей: ${result.sharedNames}`
          : "У всех сохраненных строк уже есть имя связи"
      );
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
  const [characteristicFilter, setCharacteristicFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [offerMarketFilter, setOfferMarketFilter] = useState<"" | "moscow" | "spb">("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("active");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [savedImportsSupplierFilter, setSavedImportsSupplierFilter] = useState("");
  const [savedImportsLimit, setSavedImportsLimit] = useState(8);
  const [deleteCandidateId, setDeleteCandidateId] = useState<number | null>(
    null
  );
  const [linkTargets, setLinkTargets] = useState<Record<number, string>>({});
  const [linkSearches, setLinkSearches] = useState<Record<number, string>>({});
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
  const [previewProductLinkSearches, setPreviewProductLinkSearches] = useState<Record<number, string>>({});
  const [previewLinkNameDrafts, setPreviewLinkNameDrafts] = useState<Record<number, string>>({});
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
  const [directoryCategoryPresence, setDirectoryCategoryPresence] = useState<"all" | "assigned" | "unassigned">("all");
  const [directoryProductLimit, setDirectoryProductLimit] = useState(60);
  const [directoryCategorySearch, setDirectoryCategorySearch] = useState("");
  const [directoryLinkSearch, setDirectoryLinkSearch] = useState("");
  const [directoryLinkLimit, setDirectoryLinkLimit] = useState(40);
  const [selectedDirectoryProductIds, setSelectedDirectoryProductIds] = useState<
    number[]
  >([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkOfferMarket, setBulkOfferMarket] = useState<"" | PriceMarket>("");
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
  const [editingOfferId, setEditingOfferId] = useState<number | null>(null);
  const [comparisonManualOffer, setComparisonManualOffer] = useState<{
    productId: number;
    draft: ManualOfferDraft;
  } | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});
  const [deleteSavedRowCandidate, setDeleteSavedRowCandidate] = useState<{
    rowId: number;
    name: string;
  } | null>(null);
  const [editingSavedImportRowId, setEditingSavedImportRowId] = useState<number | null>(null);
  const [savedImportLinkTargets, setSavedImportLinkTargets] = useState<Record<number, string>>({});
  const [savedImportLinkSearches, setSavedImportLinkSearches] = useState<Record<number, string>>({});
  const [savedImportCategoryDrafts, setSavedImportCategoryDrafts] = useState<Record<number, string>>({});
  const [editingLinkNameProductId, setEditingLinkNameProductId] = useState<number | null>(null);
  const [linkNameDrafts, setLinkNameDrafts] = useState<Record<number, string>>({});
  const [newGroupProductDrafts, setNewGroupProductDrafts] = useState<Record<number, { productIds: string[] }>>({});
  const [editingAliasId, setEditingAliasId] = useState<number | null>(null);
  const [aliasSearches, setAliasSearches] = useState<Record<number, string>>({});
  const [newAliasDrafts, setNewAliasDrafts] = useState<Record<number, { supplierId: string; name: string; packaging: string }>>({});
  const categoryEditorRef = useRef<HTMLDivElement>(null);
  const supplierEditorRef = useRef<HTMLDivElement>(null);
  const savedImportPreviewRef = useRef<HTMLElement>(null);
  const previewPriceKey = (rowIndex: number, optionIndex: number) => `${rowIndex}:${optionIndex}`;
  const previewAddedPriceKey = (rowIndex: number, id: string) => `${rowIndex}:${id}`;

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
  const productLinkOptions = (query: string, selectedValue = "") => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    const active = catalogProducts.filter(product => product.isActive);
    const matches = active.filter(product =>
      !normalizedQuery ||
      `${product.canonicalName} ${product.internalCode} ${product.category ?? ""}`
        .toLocaleLowerCase("ru")
        .includes(normalizedQuery)
    );
    const selected = active.find(product => String(product.id) === selectedValue);
    const compact = normalizedQuery ? matches : matches.slice(0, 40);
    const options = selected && !compact.some(product => product.id === selected.id)
      ? [selected, ...compact]
      : compact;
    return options.map(product => ({
      value: String(product.id),
      label: `${product.canonicalName} · ${product.linkCode ?? product.internalCode}`,
    }));
  };
  const savedImportSuppliers = useMemo(
    () => Array.from(new Set((overview.data?.imports ?? []).map(item => item.supplierName)))
      .sort((left, right) => left.localeCompare(right, "ru")),
    [overview.data?.imports]
  );
  const savedImports = useMemo(
    () => (overview.data?.imports ?? []).filter(item =>
      !savedImportsSupplierFilter || item.supplierName === savedImportsSupplierFilter
    ),
    [overview.data?.imports, savedImportsSupplierFilter]
  );
  const visibleSavedImports = selectedImportId
    ? savedImports.filter(item => item.id === selectedImportId)
    : savedImports.slice(0, savedImportsLimit);
  const characteristics = overview.data?.characteristics ?? [];
  const selectableCharacteristics = (kind: CharacteristicDraft["kind"]) =>
    characteristics.filter(item => item.kind === kind && item.isActive);
  const characteristicGroups = useMemo(() => ([
    { kind: "variant" as const, label: "Вариант", items: characteristics.filter(item => item.kind === "variant") },
    { kind: "size" as const, label: "Фасовка / вес", items: characteristics.filter(item => item.kind === "size") },
    { kind: "place_contents" as const, label: "Состав места", items: characteristics.filter(item => item.kind === "place_contents") },
    { kind: "manufacturer" as const, label: "Производитель", items: characteristics.filter(item => item.kind === "manufacturer") },
  ]), [characteristics]);
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
      const matchesCategoryPresence = directoryCategoryPresence === "all" ||
        (directoryCategoryPresence === "assigned" ? Boolean(product.category) : !product.category);
      return matchesSearch && matchesCategoryPresence && matchesVisibility(product);
    });
  }, [catalogProducts, directoryProductSearch, directoryCategoryPresence, visibilityFilter]);
  const visibleDirectoryProducts = directoryProducts.slice(0, directoryProductLimit);
  const selectedDirectoryProducts = catalogProducts.filter(product => selectedDirectoryProductIds.includes(product.id));
  const selectedDirectoryProductsHaveActive = selectedDirectoryProducts.some(product => product.isActive);
  const selectedDirectoryProductsHaveHidden = selectedDirectoryProducts.some(product => !product.isActive);
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
  const linkGroups = overview.data?.linkGroups ?? [];
  const aliasesByProduct = useMemo(() => {
    const items = new Map<number, NonNullable<typeof overview.data>["aliases"]>();
    (overview.data?.aliases ?? []).forEach(alias => items.set(alias.productId, [...(items.get(alias.productId) ?? []), alias]));
    return items;
  }, [overview.data?.aliases]);
  const filteredLinkGroups = useMemo(() => {
    const query = directoryLinkSearch.trim().toLocaleLowerCase("ru");
    return linkGroups.filter(group =>
      !query ||
      [
        group.canonicalName,
        group.linkCode ?? "",
        ...group.products.flatMap(product => [product.canonicalName, product.internalCode, product.category ?? ""]),
        ...group.products.flatMap(product => (aliasesByProduct.get(product.id) ?? []).flatMap(alias => [alias.supplierName, alias.normalizedName, alias.packagingSignature ?? ""])),
      ]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(query)
    );
  }, [linkGroups, aliasesByProduct, directoryLinkSearch]);
  const visibleLinkGroups = filteredLinkGroups.slice(0, directoryLinkLimit);
  const filteredUnmappedRows = useMemo(() => {
    const query = directoryLinkSearch.trim().toLocaleLowerCase("ru");
    const rows = overview.data?.unmappedRows ?? [];
    if (!query) return rows;
    return rows.filter(row =>
      [
        row.supplierName,
        row.rawName,
        row.rawCategory ?? "",
        row.rawPackaging ?? "",
        row.suggestedProduct?.name ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(query)
    );
  }, [overview.data?.unmappedRows, directoryLinkSearch]);
  const visibleUnmappedRows = filteredUnmappedRows.slice(0, directoryLinkLimit);
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
    const [characteristicKind, characteristicId] = characteristicFilter.split(":");
    return (overview.data?.comparisons ?? [])
      .filter(item => {
        const matchQuery =
          !query ||
          `${item.product.canonicalName} ${item.product.internalCode} ${item.product.variant ?? ""} ${item.product.sizeText ?? ""}`
            .toLocaleLowerCase("ru")
            .includes(query);
        const matchesCharacteristic = !characteristicFilter || (
          characteristicKind === "variant" && String(item.product.variantCharacteristicId ?? "") === characteristicId
        ) || (
          characteristicKind === "size" && String(item.product.sizeCharacteristicId ?? "") === characteristicId
        ) || (
          characteristicKind === "place_contents" && String(item.product.placeContentsCharacteristicId ?? "") === characteristicId
        );
        return (
          matchQuery &&
          matchesVisibility(item.product) &&
          (!categoryFilter || String(item.product.categoryId ?? "") === categoryFilter) &&
          matchesCharacteristic
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
  }, [overview.data?.comparisons, search, categoryFilter, characteristicFilter, supplierFilter, offerMarketFilter, visibilityFilter]);
  const selected =
    filteredComparisons.find(item => item.product.id === selectedProductId) ??
    filteredComparisons[0] ??
    null;
  const comparisonManualDraft =
    comparisonManualOffer && selected && comparisonManualOffer.productId === selected.product.id
      ? comparisonManualOffer.draft
      : null;
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
  const historyData = useMemo<PriceHistoryPoint[]>(() => {
    const dates = new Map<string, PriceHistoryPoint>();
    historyRows.forEach(item => {
      const point: PriceHistoryPoint = dates.get(item.date) ?? { date: item.date, offerDetails: {} };
      const current = point[item.supplierName];
      if (typeof current !== "number" || item.normalizedPrice < current) {
        point[item.supplierName] = item.normalizedPrice;
        point.offerDetails[item.supplierName] = {
          supplierName: item.supplierName,
          rawName: item.rawName,
          packaging: item.packaging,
          manufacturer: item.manufacturer,
          placeContents: item.placeContents,
          priceMode: canonicalPriceMode(item.priceMode),
          market: marketFromPriceMode(item.market, item.priceMode),
          priceAmount: Number(item.priceAmount),
          priceBasis: item.priceBasis as PriceBasis,
          normalizedPrice: item.normalizedPrice,
          normalizedUnit: item.normalizedUnit ?? "unknown",
          sourceDate: item.sourceDate ?? item.date,
          sourcePriceText: item.sourcePriceText,
          priceChange: item.priceChange,
        };
      }
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
  const selectedImportDate = selectedImport
    ? dateDrafts[selectedImport.id] ?? selectedImport.sourceDate ?? ""
    : "";
  const openSavedImport = (importItem: { id: number; supplierName: string }) => {
    setSavedImportsSupplierFilter(importItem.supplierName);
    setSelectedImportId(importItem.id);
    setEditingSavedImportRowId(null);
    window.setTimeout(() => {
      savedImportPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };
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
        .filter(({ index }) => !excludedPreviewRowIndexes.includes(index))
        .sort((left, right) => {
          const newRowDifference = Number(previewNewRowIndexes.has(right.index)) - Number(previewNewRowIndexes.has(left.index));
          return newRowDifference || left.index - right.index;
        }),
    [preview?.rows, excludedPreviewRowIndexes, previewNewRowIndexes]
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
    setPreviewProductLinkSearches({});
    setPreviewLinkNameDrafts({});
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
        linkNames: preview.rows
          .map((row, rowIndex) => ({ rowIndex, canonicalName: (previewLinkNameDrafts[rowIndex] ?? previewNameEdits[rowIndex] ?? row.rawName).trim() }))
          .filter(({ rowIndex }) => !excludedPreviewRowIndexes.includes(rowIndex) && !Number(previewProductLinks[rowIndex]))
          .filter(({ canonicalName }) => canonicalName.length >= 2),
        excludedRowIndexes: excludedPreviewRowIndexes,
      });
      await invalidate();
      toast.success("Прайс‑лист сохранен", {
        description: `Связано с именами: ${result.linked}; создано новых имен: ${result.createdProducts ?? 0}.`,
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
  const linkExisting = (rowId: number, target?: string) => {
    const productId = Number(target ?? linkTargets[rowId]);
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
    if (canonicalName.length < 2) {
      toast.error("Укажите имя связи длиной не менее двух символов.");
      return;
    }
    try {
      const product = await createProduct.mutateAsync({
        canonicalName,
        ...(categoryId ? { categoryId } : {}),
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
      setPreviewLinkNameDrafts(current => {
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
          <section className="packet-card price-comparison">
              <div className="card-title">
                <div>
                  <span>СРАВНЕНИЕ ПО ИМЕНИ СВЯЗИ</span>
                  <h3>Выберите товар — увидите все варианты поставщиков</h3>
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
                Характеристика
                <PriceSelect
                  value={characteristicFilter}
                  onValueChange={value => {
                    setCharacteristicFilter(value === "__all_characteristics" ? "" : value);
                    setSelectedProductId(null);
                  }}
                  placeholder="Все характеристики"
                  options={[
                    { value: "__all_characteristics", label: "Все характеристики" },
                    ...characteristicGroups
                      .filter(group => group.kind !== "manufacturer")
                      .flatMap(group => group.items.filter(item => item.isActive).map(item => ({
                        value: `${group.kind}:${item.id}`,
                        label: `${group.label} · ${item.value}`,
                      }))),
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
              <small className="price-toolbar-note">
                Фильтры применяются сразу ко всему сравнению. Для сопоставимых
                фасовок цена приводится к кг или литру; Москва и СПБ не
                сравниваются между собой.
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
                <aside className="price-product-panel">
                  <div className="price-product-panel-heading">
                    <span>ИМЕНА СВЯЗЕЙ</span>
                    <strong>{filteredComparisons.length}</strong>
                    <small>найдите нужный товар и откройте его предложения</small>
                  </div>
                  <div
                    className="price-product-list"
                    role="list"
                    aria-label="Имена связей для сравнения"
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
                </aside>
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
                        {canEdit && (
                          <button
                            type="button"
                            className="packet-link compact price-add-history-action"
                            aria-label="Добавить цену в историю выбранного имени связи"
                            title="Добавить цену в историю"
                            onClick={() =>
                              setComparisonManualOffer({
                                productId: selected.product.id,
                                draft: createManualOfferDraft(selected.product.baseUnit),
                              })
                            }
                          >
                            <Plus size={14} /> Добавить цену
                          </button>
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
                    {comparisonManualDraft && (
                      <section className="price-comparison-manual-offer" aria-label="Добавить цену в историю">
                        <div>
                          <span>ДОБАВИТЬ ЦЕНУ В ИСТОРИЮ</span>
                          <h5>{selected.product.canonicalName}</h5>
                          <p>Цена появится в таблице и на графике только у выбранного имени связи.</p>
                        </div>
                        <div className="price-comparison-manual-fields">
                          <label>
                            Поставщик
                            <PriceSelect
                              value={comparisonManualDraft.supplierId}
                              onValueChange={supplierId => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, supplierId } } : current)}
                              placeholder="Выберите поставщика"
                              options={selectableSuppliers.map(supplier => ({ value: String(supplier.id), label: supplier.name }))}
                            />
                          </label>
                          <ExactDateControl
                            value={comparisonManualDraft.sourceDate}
                            onChange={sourceDate => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, sourceDate } } : current)}
                            title="ДАТА ПРЕДЛОЖЕНИЯ"
                            ariaLabel="Указать дату ручной цены"
                          />
                          <label>
                            Цена
                            <input
                              data-decimal-input
                              inputMode="decimal"
                              value={comparisonManualDraft.priceAmount}
                              onChange={event => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, priceAmount: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") } } : current)}
                              placeholder="Например, 925"
                            />
                          </label>
                          <label>
                            База цены
                            <PriceSelect
                              value={comparisonManualDraft.priceBasis}
                              onValueChange={priceBasis => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, priceBasis: priceBasis as PriceBasis } } : current)}
                              placeholder="База цены"
                              options={priceBasisOptions(null)}
                            />
                          </label>
                          <label>
                            Условие оплаты
                            <PriceSelect
                              value={comparisonManualDraft.priceMode}
                              onValueChange={priceMode => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, priceMode: priceMode as PricePaymentMode } } : current)}
                              placeholder="Условие оплаты"
                              options={editablePriceModes}
                            />
                          </label>
                          <label>
                            Город
                            <PriceSelect
                              value={comparisonManualDraft.market}
                              onValueChange={market => setComparisonManualOffer(current => current ? { ...current, draft: { ...current.draft, market: market as PriceMarket } } : current)}
                              placeholder="Город"
                              options={priceMarketOptions}
                            />
                          </label>
                        </div>
                        <div className="price-comparison-manual-actions">
                          <button
                            type="button"
                            className="packet-link compact"
                            disabled={createManualOffer.isPending || !Number(comparisonManualDraft.supplierId) || !Number(comparisonManualDraft.priceAmount)}
                            onClick={() => createManualOffer.mutate({
                              productId: selected.product.id,
                              supplierId: Number(comparisonManualDraft.supplierId),
                              sourceDate: comparisonManualDraft.sourceDate,
                              priceAmount: Number(comparisonManualDraft.priceAmount),
                              priceBasis: comparisonManualDraft.priceBasis,
                              priceMode: comparisonManualDraft.priceMode,
                              market: comparisonManualDraft.market,
                            })}
                          >
                            <Save size={14} /> Сохранить цену
                          </button>
                          <button type="button" className="packet-link compact subtle" onClick={() => setComparisonManualOffer(null)}>Отмена</button>
                        </div>
                      </section>
                    )}
                    <section className="price-history-chart">
                      <div>
                        <span>ИСТОРИЯ ЦЕН</span>
                        <h5>Нормализованная цена по датам</h5>
                      </div>
                      {historyData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={230}>
                          <LineChart
                            data={historyData}
                            margin={{ top: 8, right: 8, left: 8, bottom: 6 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 5"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              interval="preserveStartEnd"
                              minTickGap={18}
                              tick={{ fontSize: 11 }}
                              tickFormatter={value =>
                                dateLabel(String(value)).replace(/\s+\d{4}/, "")
                              }
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              width={54}
                              tickFormatter={value => `${formatMoney(value)} ₽`}
                            />
                            <Tooltip
                              content={<PriceHistoryTooltip />}
                              allowEscapeViewBox={{ x: false, y: false }}
                              wrapperStyle={{ outline: "none" }}
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
                                dot={{ r: 3, stroke: "var(--price-surface)", strokeWidth: 2 }}
                                activeDot={{ r: 5, stroke: "var(--price-surface)", strokeWidth: 2 }}
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
                        const isEditingOffer = editingOfferId === offer.priceId;
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
                            <span className="price-offer-price">
                              <strong>{formatMoney(offer.priceAmount)} ₽/{offer.priceBasis === "kg" ? "кг" : offer.priceBasis === "l" ? "л" : "шт"}</strong>
                              <small>{modeLabel[currentDraft.priceMode]} · {marketLabel[currentDraft.market]}</small>
                              {canEdit && !isEditingOffer && <button type="button" className="price-offer-edit-action" onClick={() => setEditingOfferId(offer.priceId)}><Pencil size={13} /> Изменить</button>}
                            </span>
                            <span className="price-offer-normalized">
                              <strong>{priceLabel({ normalizedPrice: offer.normalizedPrice, normalizedUnit: offer.normalizedUnit ?? "kg" })}</strong>
                              <PriceChangeBadge change={offer.priceChange} unit={offer.normalizedUnit ?? "kg"} />
                              {offer.minimumQuantityKg && <small>от {formatMoney(offer.minimumQuantityKg)} кг</small>}
                            </span>
                            {canEdit && isEditingOffer && (
                              <div className="price-offer-edit-panel">
                                <div className="price-offer-edit-heading"><strong>Изменение предложения</strong><button type="button" onClick={() => setEditingOfferId(null)} aria-label="Свернуть изменение предложения"><X size={14} /></button></div>
                                <label>Цена, ₽<input data-decimal-input inputMode="decimal" value={currentDraft.priceAmount} onChange={event => patchDraft({ priceAmount: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") })} /></label>
                                <label>База цены<PriceSelect value={currentDraft.priceBasis} onValueChange={value => patchDraft({ priceBasis: value as PriceBasis })} placeholder="База цены" options={priceBasisOptions(offer.packaging ?? offer.rawName)} /></label>
                                <label>Условие оплаты<PriceSelect value={currentDraft.priceMode} onValueChange={value => patchDraft({ priceMode: value as PricePaymentMode })} placeholder="Условие цены" options={editablePriceModes} /></label>
                                <label>Город<PriceSelect value={currentDraft.market} onValueChange={value => patchDraft({ market: value as PriceMarket })} placeholder="Город" options={priceMarketOptions} /></label>
                                <label>Производитель<PriceSelect value={currentDraft.manufacturer} onValueChange={manufacturer => patchDraft({ manufacturer })} placeholder="Производитель" options={offerCharacteristicOptions("manufacturer", currentDraft.manufacturer)} /></label>
                                <label>Состав места<PriceSelect value={currentDraft.placeContents} onValueChange={placeContents => patchDraft({ placeContents })} placeholder="Состав места" options={offerCharacteristicOptions("place_contents", currentDraft.placeContents)} /></label>
                                <ExactDateControl value={currentDraft.manufacturedOn} onChange={manufacturedOn => patchDraft({ manufacturedOn })} title="ДАТА ИЗГОТОВЛЕНИЯ" ariaLabel="Указать дату изготовления" emptyLabel="Дата изготовления" />
                                <div className="price-shelf-life-picker" aria-label="Срок годности">{shelfLifeOptions.map(option => <button type="button" key={option.value} className={currentDraft.shelfLifeMonths === option.value ? "active" : ""} onClick={() => patchDraft({ shelfLifeMonths: option.value })}>{option.label}</button>)}</div>
                                <small className="price-expiry-date">{currentDraft.expiresOn ? `Годен до: ${dateLabel(currentDraft.expiresOn)}` : "Срок годности не указан"}</small>
                                <button type="button" className="packet-link compact" onClick={() => {
                                  const value = Number(currentDraft.priceAmount.replace(/\s/g, "").replace(",", "."));
                                  if (value > 0) updateOffer.mutate({ priceId: offer.priceId, priceAmount: value, priceBasis: currentDraft.priceBasis, priceMode: currentDraft.priceMode, market: currentDraft.market, manufacturer: currentDraft.manufacturer.trim() || null, placeContents: currentDraft.placeContents.trim() || null, manufacturedOn: currentDraft.manufacturedOn || null, shelfLifeMonths: currentDraft.shelfLifeMonths, expiresOn: currentDraft.expiresOn || null }, { onSuccess: () => setEditingOfferId(null) });
                                }} disabled={updateOffer.isPending}><Save size={13} /> Сохранить изменения</button>
                              </div>
                            )}
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
                          явно создайте новую категорию. Имена связей появятся только
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
                      const linkedProduct = previewProductLinks[index]
                        ? catalogProducts.find(product => product.id === Number(previewProductLinks[index])) ?? null
                        : null;
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
                                      data-decimal-input
                                      inputMode="decimal"
                                      value={draft?.priceAmount ?? (option.priceAmount === null ? "" : String(option.priceAmount))}
                                      onChange={event => updatePreviewPriceDraft(index, optionIndex, option, { priceAmount: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") })}
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
                                  data-decimal-input
                                  inputMode="decimal"
                                  value={option.priceAmount}
                                  onChange={event => updatePreviewAddedPriceOption(index, option.id, { priceAmount: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") })}
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
                          <label className="price-preview-product-link">
                            <span>Имя связи для сравнения</span>
                            <input
                              className="price-product-link-search"
                              value={previewProductLinkSearches[index] ?? ""}
                              onChange={event => setPreviewProductLinkSearches(current => ({
                                ...current,
                                [index]: event.target.value,
                              }))}
                              placeholder="Поиск имени связи или кода"
                              aria-label={`Поиск имени связи для «${row.rawName}»`}
                            />
                            <PriceSelect
                              value={previewProductLinks[index] ?? "__unlinked"}
                              onValueChange={value => setPreviewProductLink(index, value)}
                              placeholder="Имя связи для сравнения"
                              options={[
                                { value: "__unlinked", label: "Создать новое имя связи" },
                                ...productLinkOptions(
                                  previewProductLinkSearches[index] ?? "",
                                  previewProductLinks[index] ?? ""
                                ),
                              ]}
                            />
                            {!linkedProduct && (
                              <input
                                value={previewLinkNameDrafts[index] ?? previewNameEdits[index] ?? row.rawName}
                                onChange={event => setPreviewLinkNameDrafts(current => ({ ...current, [index]: event.target.value }))}
                                placeholder="Новое имя связи"
                                maxLength={255}
                                aria-label={`Новое имя связи для «${row.rawName}»`}
                              />
                            )}
                            <small>{linkedProduct ? `Связано: ${linkedProduct.linkCode ?? linkedProduct.internalCode} · ${linkedProduct.canonicalName}` : "Без выбранной связи будет создано это имя; затем к нему можно добавить варианты любых поставщиков."}</small>
                          </label>
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
                  <li><b>4</b><span>Сначала применяет подтвержденные связи: название поставщика → имя связи для сравнения.</span></li>
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
              <>
                <div className="price-import-controls">
                  <PriceSelect
                    value={savedImportsSupplierFilter || "__all"}
                    onValueChange={value => {
                      setSavedImportsSupplierFilter(value === "__all" ? "" : value);
                      setSelectedImportId(null);
                      setSavedImportsLimit(8);
                    }}
                    placeholder="Все поставщики"
                    options={[
                      { value: "__all", label: "Все поставщики" },
                      ...savedImportSuppliers.map(supplier => ({ value: supplier, label: supplier })),
                    ]}
                  />
                  <small>Показано: {visibleSavedImports.length} из {savedImports.length}</small>
                  {selectedImportId && (
                    <button
                      type="button"
                      className="packet-link compact subtle"
                      onClick={() => setSelectedImportId(null)}
                    >
                      Показать список
                    </button>
                  )}
                </div>
                <div className="price-import-list">
                {visibleSavedImports.map(importItem => (
                  <article
                    className={
                      selectedImport?.id === importItem.id ? "active" : ""
                    }
                    key={importItem.id}
                  >
                    <button
                      type="button"
                      className="price-import-open"
                      onClick={() => openSavedImport(importItem)}
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
                        onClick={() => openSavedImport(importItem)}
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
                {!selectedImportId && savedImports.length > visibleSavedImports.length && (
                  <button
                    type="button"
                    className="packet-link price-directory-show-more"
                    onClick={() => setSavedImportsLimit(current => Math.min(current + 8, savedImports.length))}
                  >
                    Показать еще · {Math.min(8, savedImports.length - visibleSavedImports.length)}
                  </button>
                )}
                {!savedImports.length && (
                  <div className="empty-state compact">
                    <Search size={22} />
                    <p>У выбранного поставщика пока нет сохраненных прайс‑листов.</p>
                  </div>
                )}
              </>
            )}
          </section>
          {selectedImport && (
            <section ref={savedImportPreviewRef} className="packet-card price-import-preview">
              <div className="card-title">
                <div>
                  <span>ПРЕДПРОСМОТР СОХРАНЕННОГО ПРАЙСА</span>
                  <h3>{selectedImport.fileName}</h3>
                </div>
                <Eye size={21} />
              </div>
              <div className="price-import-meta">
                <strong>{selectedImport.supplierName}</strong>
                <div className="price-import-date-control">
                  <span>Дата прайса</span>
                  {canEdit ? (
                    <ExactDateControl
                      value={selectedImportDate}
                      onChange={sourceDate =>
                        setDateDrafts(current => ({
                          ...current,
                          [selectedImport.id]: sourceDate,
                        }))
                      }
                      title="ДАТА ПРАЙСА"
                      ariaLabel="Изменить дату сохраненного прайс-листа"
                      emptyLabel="Дата не указана"
                    />
                  ) : (
                    <strong>{selectedImportDate ? dateLabel(selectedImportDate) : "Дата не указана"}</strong>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={() =>
                      updateImportDate.mutate({
                        importId: selectedImport.id,
                        sourceDate: selectedImportDate || null,
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
                {selectedImportPreview?.rows.map((row, position) => {
                  const isEditing = editingSavedImportRowId === row.rowId;
                  const currentTarget = savedImportLinkTargets[row.rowId] ?? "";
                  return (
                    <div key={row.rowId} className={isEditing ? "price-saved-import-row is-editing" : "price-saved-import-row"}>
                      <span className="price-saved-import-number" aria-label={`Позиция ${position + 1}`}>№ {position + 1}</span>
                      <div className="price-saved-import-main">
                        <strong>{row.rawName}</strong>
                        <span>
                          {row.rawCategory || "Без категории"} · {row.rawPackaging || "фасовка не указана"}
                        </span>
                      </div>
                      <b>
                        {row.priceAmount === null ? "цена не указана" : `${formatMoney(row.priceAmount)} ₽`}
                      </b>
                      <small className={row.productName ? "price-saved-import-linked" : "price-saved-import-unlinked"}>
                        {row.productName ? `Имя связи: ${row.productName}` : "Имя связи будет создано при изменении"}
                      </small>
                      {canEdit && (
                        <div className="price-saved-import-actions">
                          <button
                            type="button"
                            className="packet-link compact"
                            onClick={() => setEditingSavedImportRowId(current => current === row.rowId ? null : row.rowId)}
                          >
                            <Pencil size={14} />
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="price-preview-remove"
                            onClick={() => setDeleteSavedRowCandidate({ rowId: row.rowId, name: row.rawName })}
                            aria-label={`Удалить сохраненную позицию «${row.rawName}»`}
                            title="Удалить позицию из сохраненного прайса"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                      {canEdit && isEditing && (
                        <div className="price-saved-import-editor">
                          <label>
                            Выбрать имя связи
                            <input
                              className="price-product-link-search"
                              value={savedImportLinkSearches[row.rowId] ?? ""}
                              onChange={event => setSavedImportLinkSearches(current => ({
                                ...current,
                                [row.rowId]: event.target.value,
                              }))}
                              placeholder="Поиск имени связи или кода"
                              aria-label={`Поиск имени связи для «${row.rawName}»`}
                            />
                            <PriceSelect
                              value={currentTarget}
                              onValueChange={value => setSavedImportLinkTargets(current => ({ ...current, [row.rowId]: value }))}
                              placeholder={row.productName ? `Оставить: ${row.productName}` : "Выберите имя связи"}
                              options={productLinkOptions(
                                savedImportLinkSearches[row.rowId] ?? "",
                                currentTarget
                              )}
                            />
                          </label>
                          {!currentTarget && (
                            <label>
                              Новое имя связи
                              <input
                                value={newNames[row.rowId] ?? row.rawName}
                                onChange={event => setNewNames(current => ({ ...current, [row.rowId]: event.target.value }))}
                                placeholder="Имя связи"
                                maxLength={255}
                              />
                            </label>
                          )}
                          <label>
                            Категория импортированного товара
                            <PriceSelect
                              value={savedImportCategoryDrafts[row.rowId] ?? row.rawCategory ?? ""}
                              onValueChange={category => setSavedImportCategoryDrafts(current => ({ ...current, [row.rowId]: category }))}
                              placeholder="Выберите категорию"
                              options={selectableCategories.map(category => ({ value: category.name, label: category.name }))}
                            />
                          </label>
                          <small>Имя связи объединяет разные названия поставщиков. Следующие прайсы этого поставщика будут находить его автоматически.</small>
                          <div>
                            <button
                              type="button"
                              className="packet-link compact"
                              disabled={!Number(currentTarget) || linkRow.isPending}
                              onClick={() => linkExisting(row.rowId, currentTarget)}
                            >
                              <Save size={14} /> Сохранить связь
                            </button>
                            {!currentTarget && (
                              <button
                                type="button"
                                className="packet-link compact subtle"
                                disabled={linkRow.isPending || (newNames[row.rowId] ?? row.rawName).trim().length < 2}
                                onClick={() => void createAndLink(row.rowId, row.rawName, row.rawCategory)}
                              >
                                <Plus size={14} /> Создать связь
                              </button>
                            )}
                            <button
                              type="button"
                              className="packet-link compact subtle"
                              disabled={updateImportRowCategory.isPending || !(savedImportCategoryDrafts[row.rowId] ?? row.rawCategory ?? "").trim()}
                              onClick={() => updateImportRowCategory.mutate({ rowId: row.rowId, category: (savedImportCategoryDrafts[row.rowId] ?? row.rawCategory ?? "").trim() })}
                            >
                              <Save size={14} /> Сохранить категорию
                            </button>
                            <button type="button" className="packet-link compact subtle" onClick={() => setEditingSavedImportRowId(null)}>Готово</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="packet-note price-saved-import-limit">
                Показано позиций: {selectedImportPreview?.rows.length ?? 0} из {selectedImport.rowCount}. Для каждой строки доступны порядковый номер, имя связи и изменение.
              </p>
            </section>
          )}
        </>
      )}
      {section === "directory" && (
        <>
          <section className="page-lede price-lede">
            <div>
              <span>СПРАВОЧНИК ПРАЙС‑КОНТРОЛЯ</span>
              <h2>Товары, связи, категории и поставщики</h2>
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
            <button
              type="button"
              className={directoryTab === "links" ? "active" : ""}
              onClick={() => setDirectoryTab("links")}
            >
              Связи
            </button>
          </nav>
          {directoryTab === "products" && (
          <section className="packet-card price-directory">
            <div className="card-title">
              <div>
                <span>ТОВАРЫ</span>
                <h3>Самостоятельные товары, цены и характеристики</h3>
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
                Добавить товар
              </button>
            )}
            <section className="price-characteristics-panel" aria-label="Характеристики товаров">
              <div>
                <span>ХАРАКТЕРИСТИКИ ТОВАРОВ</span>
                <p>Вариант, фасовка, состав места и производитель выбираются из повторно используемых значений, а не вводятся заново в каждой позиции.</p>
              </div>
              {canEdit && (
                <div className="price-characteristics-actions">
                  {overview.data?.repairableVariants.count ? (
                    <button
                      type="button"
                      className="packet-link compact price-repair-variants"
                      onClick={() => repairRecognizedVariants.mutate()}
                      disabled={repairRecognizedVariants.isPending}
                      title={`Добавить варианты из ${overview.data.repairableVariants.count} сохраненных названий`}
                    >
                      <WandSparkles size={13} />
                      {repairRecognizedVariants.isPending
                        ? "Проверяем…"
                        : `Добавить варианты · ${overview.data.repairableVariants.count}`}
                    </button>
                  ) : null}
                  {overview.data?.repairablePlaceContents.count ? (
                    <button
                      type="button"
                      className="packet-link compact price-repair-place-contents"
                      onClick={() => refreshPlaceContents.mutate()}
                      disabled={refreshPlaceContents.isPending}
                      title={`Добавить ${overview.data.repairablePlaceContents.count} значений состава места из сохраненных прайсов`}
                    >
                      <WandSparkles size={13} />
                      {refreshPlaceContents.isPending
                        ? "Добавляем…"
                        : `Добавить состав мест · ${overview.data.repairablePlaceContents.count}`}
                    </button>
                  ) : null}
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
                <div className="price-characteristics-list" aria-label="Списки характеристик товаров">
                  {characteristicGroups.filter(group => group.items.length).map(group => (
                    <details key={group.kind} className="price-characteristics-group">
                      <summary>
                        <span>{group.label}</span>
                        <strong>{group.items.length}</strong>
                        <ChevronRight size={15} aria-hidden="true" />
                      </summary>
                      <div role="list">
                        {group.items.map(item => (
                          <article key={item.id} className={item.isActive ? "" : "is-hidden"} role="listitem">
                            <div>
                              <strong>{item.value}</strong>
                              <small>{item.isActive ? "Доступна в новых выборах" : "Скрыта из новых выборов"}</small>
                            </div>
                            {canEdit && (
                              <div className="price-characteristic-actions">
                                <button
                                  type="button"
                                  className="price-characteristic-action"
                                  onClick={() => updateCharacteristic.mutate({ id: item.id, value: item.value, isActive: !item.isActive })}
                                  disabled={updateCharacteristic.isPending}
                                  aria-label={`${item.isActive ? "Скрыть" : "Показать"} характеристику «${item.value}»`}
                                  title={item.isActive ? "Скрыть из новых выборов" : "Показать в новых выборах"}
                                >
                                  {item.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                                <button
                                  type="button"
                                  className="price-characteristic-action"
                                  onClick={() => setCharacteristicDraft({ id: item.id, kind: item.kind, value: item.value, isActive: item.isActive })}
                                  aria-label={`Изменить характеристику «${item.value}»`}
                                  title="Изменить характеристику"
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
            {productDraft && (
              <div ref={productEditorRef} className="price-directory-editor">
                <label>
                  Наименование товара <em>*</em>
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
                  Код товара
                  <input
                    value={productDraft.internalCode}
                    onChange={event =>
                      setProductDraft({
                        ...productDraft,
                        internalCode: event.target.value,
                      })
                    }
                  placeholder="Внутренний код товара"
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
                  placeholder="Необязательно"
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
                          data-decimal-input
                          inputMode="decimal"
                          value={productDraft.manualOffer.priceAmount}
                          onChange={event => patchProductManualOffer({ priceAmount: normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "") })}
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
                  onChange={event => {
                    setDirectoryProductSearch(event.target.value);
                    setDirectoryProductLimit(60);
                  }}
                  placeholder="Поиск товара, коду или категории"
                  aria-label="Поиск товаров"
                />
              </label>
              <PriceSelect
                value={directoryCategoryPresence}
                onValueChange={value => {
                  setDirectoryCategoryPresence(value as "all" | "assigned" | "unassigned");
                  setDirectoryProductLimit(60);
                }}
                placeholder="Категории"
                options={[
                  { value: "all", label: "Все категории" },
                  { value: "unassigned", label: `Без категории · ${catalogProducts.filter(product => !product.category).length}` },
                  { value: "assigned", label: "Только с категорией" },
                ]}
              />
              <small>
                По текущему фильтру: {directoryProducts.length} · скрыто: {hiddenProductsCount}
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
                <PriceSelect
                  value={bulkOfferMarket}
                  onValueChange={value => setBulkOfferMarket(value as PriceMarket)}
                  placeholder="Город предложений"
                  options={priceMarketOptions.filter(option => option.value !== "unknown")}
                />
                <button
                  type="button"
                  className="packet-link compact"
                  disabled={!bulkOfferMarket || bulkSetOfferMarket.isPending}
                  onClick={() => bulkSetOfferMarket.mutate({ productIds: selectedDirectoryProductIds, market: bulkOfferMarket as PriceMarket })}
                >
                  <MapPin size={14} />
                  Назначить город
                </button>
                {selectedDirectoryProductsHaveActive && (
                  <button
                    type="button"
                    className="packet-link compact subtle"
                    disabled={bulkSetProductActive.isPending}
                    onClick={() => bulkSetProductActive.mutate({ productIds: selectedDirectoryProductIds, isActive: false })}
                  >
                    <EyeOff size={14} />
                    Скрыть выбранные
                  </button>
                )}
                {selectedDirectoryProductsHaveHidden && (
                  <button
                    type="button"
                    className="packet-link compact subtle"
                    disabled={bulkSetProductActive.isPending}
                    onClick={() => bulkSetProductActive.mutate({ productIds: selectedDirectoryProductIds, isActive: true })}
                  >
                    <Eye size={14} />
                    Показать выбранные
                  </button>
                )}
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
              {visibleDirectoryProducts.map((product, position) => (
                <article key={product.id}>
                  {canEdit && (
                    <div className="price-directory-selection-marker">
                      <label className="price-preview-check">
                        <input
                          type="checkbox"
                          checked={selectedDirectoryProductIds.includes(product.id)}
                          onChange={() => toggleDirectoryProduct(product.id)}
                          aria-label={`Выбрать товар «${product.canonicalName}»`}
                        />
                        <span aria-hidden="true"><Check size={12} /></span>
                      </label>
                      <span className="price-directory-row-number" aria-label={`Позиция ${position + 1}`}>№ {position + 1}</span>
                    </div>
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
                    {(() => {
                      const offers = overview.data?.comparisons.find(item => item.product.id === product.id)?.offers ?? [];
                      const lowest = offers.reduce<number | null>((minimum, offer) => minimum === null || offer.normalizedPrice < minimum ? offer.normalizedPrice : minimum, null);
                      return (
                        <small className="price-directory-prices">
                          {lowest === null
                            ? "Сохранённых цен пока нет"
                            : `Цен: ${offers.length} · от ${formatMoney(lowest)} ₽/${offers[0]?.normalizedUnit === "piece" ? "шт" : offers[0]?.normalizedUnit}`}
                        </small>
                      );
                    })()}
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
              {directoryProducts.length > visibleDirectoryProducts.length && (
                <button
                  type="button"
                  className="packet-link price-directory-show-more"
                  onClick={() => setDirectoryProductLimit(current => Math.min(current + 60, directoryProducts.length))}
                >
                  Показать еще · {Math.min(60, directoryProducts.length - visibleDirectoryProducts.length)}
                </button>
              )}
              {directoryProducts.length > 60 && visibleDirectoryProducts.length === directoryProducts.length && (
                <small className="price-directory-all-shown">Показаны все {directoryProducts.length} товаров по текущему фильтру.</small>
              )}
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
                          {(categoryMembers.get(category.id) ?? []).length > 0 ? (
                            <details className="price-category-members">
                              <summary>Имена связей в категории · {(categoryMembers.get(category.id) ?? []).length}</summary>
                              <div>
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
                            </details>
                          ) : <small>Имена связей пока не добавлены</small>}
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
          {directoryTab === "links" && canEdit && filteredUnmappedRows.length > 0 && (
            <section className="packet-card price-mapping">
              <div className="card-title">
                <div>
                  <span>СВЯЗАТЬ НАЗВАНИЕ ПОСТАВЩИКА</span>
                  <h3>
                    Одно имя связи — все варианты названий
                  </h3>
                </div>
                <Link2 size={21} />
              </div>
              <p className="packet-note">
                Выберите имя, под которым позиция будет показываться в
                сравнении. Это объединяет разные названия одного товара у
                поставщиков; исходное название и фасовка сохраняются рядом для контроля.
              </p>
              <div className="price-links-toolbar" role="search">
                <label className="price-directory-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={directoryLinkSearch}
                    onChange={event => {
                      setDirectoryLinkSearch(event.target.value);
                      setDirectoryLinkLimit(40);
                    }}
                    placeholder="Поиск по имени связи, поставщику или названию"
                    aria-label="Поиск связей поставщиков"
                  />
                </label>
                <small>
                  Нераспознано: {filteredUnmappedRows.length} · связей: {filteredLinkGroups.length}
                </small>
                {catalogProducts.some(product => !product.linkCode) && (
                  <button type="button" className="packet-link compact subtle" onClick={() => repairLinkCodes.mutate()} disabled={repairLinkCodes.isPending}>
                    {repairLinkCodes.isPending ? "Нумеруем…" : "Назначить коды A001"}
                  </button>
                )}
                {filteredUnmappedRows.length > 0 && (
                  <button
                    type="button"
                    className="packet-link compact"
                    onClick={() => backfillLinkNames.mutate()}
                    disabled={backfillLinkNames.isPending}
                    title="Создать отдельное редактируемое имя связи для каждой ранее сохраненной несвязанной строки"
                  >
                    <WandSparkles size={13} />
                    {backfillLinkNames.isPending
                      ? "Создаем…"
                      : `Создать имена связей · ${filteredUnmappedRows.length}`}
                  </button>
                )}
              </div>
              {!filteredUnmappedRows.length ? (
                <div className="empty-state compact">
                  <CheckCircle2 size={22} />
                  <p>
                    {directoryLinkSearch
                      ? "Нераспознанных названий по этому поиску нет."
                      : "Все распознанные строки уже имеют имя связи."}
                  </p>
                </div>
              ) : (
                <>
                <div id="unmapped-price-links" className="price-mapping-list">
                  {visibleUnmappedRows.map(row => (
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
                        <label className="price-alias-search">
                          <Search size={14} />
                          <input
                            value={linkSearches[row.rowId] ?? ""}
                            onChange={event => setLinkSearches(current => ({ ...current, [row.rowId]: event.target.value }))}
                            placeholder="Найти имя связи или код"
                            aria-label={`Поиск имени связи для «${row.rawName}»`}
                          />
                        </label>
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
                          placeholder="Выберите имя связи"
                          options={productLinkOptions(linkSearches[row.rowId] ?? "", String(linkTargets[row.rowId] ?? row.suggestedProduct?.id ?? ""))}
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
                          Подтвердить связь
                        </button>
                        <details>
                          <summary>Создать новое имя связи</summary>
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
                              placeholder="Категория · необязательно"
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
                                (newNames[row.rowId] ?? row.rawName).trim().length < 2
                              }
                            >
                              <WandSparkles size={14} />
                              Создать связь
                            </button>
                          </div>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
                </>
              )}
            </section>
          )}
          {directoryTab === "links" && canEdit && (
            <section className="packet-card price-aliases">
              <div className="card-title"><div><span>СВЯЗИ</span><h3>Одно имя связи — несколько отдельных товаров</h3></div><Link2 size={21} /></div>
              <p className="packet-note">Товар хранит собственное название, категорию и цены. Имя связи — только общая группа для сравнения. Переименование связи не меняет товары и историю цен.</p>
              {visibleLinkGroups.length ? <div className="price-alias-list">
                {visibleLinkGroups.map(group => {
                  const draft = newGroupProductDrafts[group.id] ?? { productIds: [] };
                  return <article key={group.id} className="price-alias-group">
                    <div className="price-alias-group-heading">
                      <span>ИМЯ СВЯЗИ · {group.linkCode}</span><strong>{group.canonicalName}</strong>
                      <small>Товаров в связи: {group.products.length}</small>
                      {editingLinkNameProductId === group.id ? <div className="price-link-name-editor"><input value={linkNameDrafts[group.id] ?? group.canonicalName} onChange={event => setLinkNameDrafts(current => ({ ...current, [group.id]: event.target.value }))} aria-label={`Изменить имя связи «${group.canonicalName}»`}/><button type="button" className="packet-link compact" disabled={updateLinkGroup.isPending} onClick={() => { const canonicalName = (linkNameDrafts[group.id] ?? group.canonicalName).trim(); if (canonicalName.length < 2) { toast.error("Имя связи должно содержать не менее двух символов."); return; } updateLinkGroup.mutate({ id: group.id, canonicalName }); setEditingLinkNameProductId(null); }}><Save size={13}/>Сохранить</button><button type="button" className="packet-link compact subtle" onClick={() => setEditingLinkNameProductId(null)}>Отменить</button></div> : <div className="price-link-name-actions"><button type="button" className="packet-link compact subtle" onClick={() => { setLinkNameDrafts(current => ({ ...current, [group.id]: group.canonicalName })); setEditingLinkNameProductId(group.id); }}><Pencil size={13}/>Изменить связь</button><button type="button" className="packet-link compact subtle" onClick={() => setNewGroupProductDrafts(current => ({ ...current, [group.id]: current[group.id] ?? { productIds: [] } }))}><Plus size={13}/>Добавить товары</button></div>}
                      {newGroupProductDrafts[group.id] && <form className="price-link-new-product" onSubmit={async event => { event.preventDefault(); if (!draft.productIds.length) return; await Promise.all(draft.productIds.map(productId => assignProductLinkGroup.mutateAsync({ productId: Number(productId), linkGroupId: group.id }))); setNewGroupProductDrafts(current => { const next = { ...current }; delete next[group.id]; return next; }); }}><PriceSelect value="" onValueChange={productId => setNewGroupProductDrafts(current => ({ ...current, [group.id]: { productIds: Array.from(new Set([...(current[group.id]?.productIds ?? []), productId])) } }))} placeholder="Найти и добавить товар" options={catalogProducts.filter(product => product.linkGroupId !== group.id && !draft.productIds.includes(String(product.id))).map(product => ({ value: String(product.id), label: `${product.canonicalName} · ${product.category ?? "Без категории"}` }))}/>{draft.productIds.length > 0 && <div className="price-link-picked-products">{draft.productIds.map(productId => { const product = catalogProducts.find(item => String(item.id) === productId); return <button type="button" key={productId} onClick={() => setNewGroupProductDrafts(current => ({ ...current, [group.id]: { productIds: (current[group.id]?.productIds ?? []).filter(item => item !== productId) } }))}>{product?.canonicalName ?? "Товар"}<X size={12}/></button>; })}</div>}<button className="packet-link compact" disabled={assignProductLinkGroup.isPending || !draft.productIds.length}><Plus size={13}/>Добавить выбранные</button><button type="button" className="packet-link compact subtle" onClick={() => setNewGroupProductDrafts(current => { const next = { ...current }; delete next[group.id]; return next; })}>Отменить</button></form>}
                    </div>
                    <div className="price-link-products"><span>Товары в связи</span>{group.products.map(product => <div key={product.id}><strong>{product.canonicalName}</strong><small>{product.internalCode} · {product.category ?? "Без категории"}</small><button type="button" className="packet-link compact subtle" onClick={() => { setDirectoryTab("products"); setDirectoryProductSearch(product.canonicalName); }}>Открыть товар</button></div>)}</div>
                  </article>;
                })}
              </div> : <div className="empty-state compact"><Search size={22}/><p>Связи по этому поиску не найдены.</p></div>}
              {filteredLinkGroups.length > visibleLinkGroups.length && <div className="price-directory-show-more"><button type="button" className="packet-link compact" onClick={() => setDirectoryLinkLimit(current => current + 40)}>Показать еще</button></div>}
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
              Связи названий поставщиков с именами сравнения сохранятся для следующих
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
