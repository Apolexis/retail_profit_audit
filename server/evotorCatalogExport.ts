import { createHash } from "node:crypto";

type CatalogUnit = "fraction" | "l" | "piece" | "unknown";
type CatalogMarking = "none" | "supplement" | "seafood_caviar" | "seafood_canned" | "alcohol" | "beer_marked" | "beer_non_alcoholic" | "soft_drinks" | "water" | "dairy";

/** Cloud V2 accepts both catalogue metadata and the current factual quantity. */
export type EvotorProductPayload = Record<string, string | string[] | number | boolean>;

type ExportableProduct = {
  id: number;
  catalogNumber: number;
  canonicalName: string;
  baseUnit: CatalogUnit;
  vatRate: "VAT_10" | "VAT_22";
  markingCategory: CatalogMarking;
  alcoholCode: string | null;
  alcoholTypeCode: string | null;
  alcoholStrengthPercent: string | null;
  alcoholVolumeLiters: string | null;
  manualBarcodes: string | null;
  barcodes: unknown;
  internalCostPrice?: string | number | null;
  isEvotorCostExportEnabled?: boolean;
  /** A missing price remains missing in the payload: Evotor shows it as not set. */
  price?: number;
  /** Zero is factual and must be sent, not dropped. */
  quantity: number;
  /** A valid per-store Evotor product-group ID; export never silently strips category placement. */
  parentId: string;
};

/** Stable per-store UUID makes a retry update the same external product. */
export function stableEvotorProductId(storeUuid: string, productId: number) {
  const hex = createHash("sha256").update(`retail-audit:evotor-product:${storeUuid}:${productId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function evotorMeasureName(unit: CatalogUnit) {
  // `fraction` is the technical Эвотор measure. The application renders it as
  // «кг» solely for people; the outbound API must receive «дроб» unchanged.
  if (unit === "fraction") return "дроб";
  if (unit === "l") return "л";
  if (unit === "piece") return "шт";
  throw new Error("У товара не указана единица измерения для выгрузки в Эвотор.");
}

export function evotorProductType(marking: CatalogMarking) {
  if (marking === "supplement") return "DIETARY_SUPPLEMENTS_MARKED";
  if (marking === "seafood_caviar") return "CAVIAR_MARKED";
  if (marking === "seafood_canned") return "GROCERIES_MARKED";
  if (marking === "alcohol") return "ALCOHOL_NOT_MARKED";
  if (marking === "beer_marked") return "BEER_MARKED";
  if (marking === "beer_non_alcoholic") return "NOT_ALCOHOL_BEER_MARKED";
  if (marking === "water") return "WATER_MARKED";
  if (marking === "dairy") return "DAIRY_MARKED";
  if (marking === "soft_drinks") return "JUICE_MARKED";
  return "NORMAL";
}

function manualBarcodes(value: string | null) {
  if (!value) return [];
  return value.split(/[;,\n\r]+/).map(item => item.trim()).filter(Boolean);
}

function sourceBarcodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map(item => item.trim());
}

function numberOrNull(value: string | null) {
  if (value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

/**
 * Builds the complete replacement-safe object required by the Cloud API. V2
 * requires a numeric price in PUT even when the business side did not set one;
 * `0` is the agreed "price not assigned" value. Purchase cost is also zero
 * unless the product's independent publication flag is explicitly enabled.
 */
export function buildEvotorProductPayload(row: ExportableProduct, externalProductId: string): EvotorProductPayload {
  if (!Number.isFinite(row.quantity) || row.quantity < 0) throw new Error("Фактический остаток для выгрузки должен быть неотрицательным числом.");
  if (!row.parentId.trim()) throw new Error("Для выгрузки товара не сопоставлена категория Эвотор.");
  const payload: EvotorProductPayload = {
    id: externalProductId,
    code: String(row.catalogNumber),
    // Business article is the visible sequential catalog number used by the site and 1С,
    // never the technical database primary key and never a value supplied by Evotor.
    article_number: String(row.catalogNumber),
    name: row.canonicalName,
    type: evotorProductType(row.markingCategory),
    measure_name: evotorMeasureName(row.baseUnit),
    tax: row.vatRate,
    // A saved editor value is authoritative even when it is an empty string:
    // clearing the field must remove previous Cloud source barcodes on export.
    barcodes: Array.from(new Set(row.manualBarcodes === null ? sourceBarcodes(row.barcodes) : manualBarcodes(row.manualBarcodes))),
    parent_id: row.parentId,
    quantity: Math.round(row.quantity * 1_000) / 1_000,
    allow_to_sell: true,
    cost_price: row.isEvotorCostExportEnabled && Number.isFinite(Number(row.internalCostPrice)) && Number(row.internalCostPrice) >= 0 ? Math.round(Number(row.internalCostPrice) * 100) / 100 : 0,
    price: 0,
  };
  if (row.price !== undefined && Number.isFinite(row.price) && row.price >= 0) payload.price = Math.round(row.price * 100) / 100;
  if (row.markingCategory === "alcohol" || row.markingCategory === "beer_marked") {
    // V2 exposes and accepts the EGAIS value as the `alcocodes` array. A former
    // singular `alcocode` key was silently ignored by the platform.
    if (row.alcoholCode) payload.alcocodes = [row.alcoholCode];
    if (row.alcoholTypeCode) payload.alcohol_product_kind_code = row.alcoholTypeCode;
    const strength = numberOrNull(row.alcoholStrengthPercent);
    const volume = numberOrNull(row.alcoholVolumeLiters);
    if (strength !== null) payload.alcohol_by_volume = strength;
    if (volume !== null) payload.tare_volume = volume;
  }
  return payload;
}

export const __evotorCatalogExportInternals = { stableEvotorProductId, evotorMeasureName, evotorProductType, buildEvotorProductPayload };
