export type QuantityUnit = "kg" | "piece" | "liter" | "check" | "unknown";

const quantityUnitLabels: Record<QuantityUnit, string> = {
  kg: "кг",
  piece: "шт",
  liter: "л",
  check: "чек.",
  unknown: "ед.",
};

const groupInteger = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/**
 * Keeps the raw Evotor unit outside the UI while making `fraction` explicit as
 * kilograms for people. The raw value is still retained server-side for any
 * future read-only reconciliation.
 */
export function normalizeEvotorQuantityUnit(value: string | null | undefined): QuantityUnit {
  const normalized = (value ?? "").trim().toLocaleLowerCase("en-US");
  if (["fraction", "дроб", "kg", "kilogram", "kilograms", "килограмм", "кг"].includes(normalized)) return "kg";
  if (["piece", "pieces", "pcs", "pc", "count", "шт", "штука", "штук"].includes(normalized)) return "piece";
  if (["liter", "litre", "liters", "litres", "l", "л", "литр", "литры"].includes(normalized)) return "liter";
  if (["check", "checks", "receipt", "receipts", "чек", "чеки"].includes(normalized)) return "check";
  return "unknown";
}

export function quantityUnitLabel(value: QuantityUnit | string | null | undefined): string {
  const normalized = value === "kg" || value === "piece" || value === "liter" || value === "check" || value === "unknown"
    ? value
    : normalizeEvotorQuantityUnit(value);
  return quantityUnitLabels[normalized];
}

/** Quantity uses a dot deliberately, without insignificant trailing zeroes. */
export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const numeric = Number(value);
  const sign = numeric < 0 ? "−" : "";
  const absolute = Math.abs(Math.round(numeric * 100) / 100);
  const [integer, fraction] = absolute.toFixed(2).split(".");
  const compactFraction = fraction.replace(/0+$/, "");
  return `${sign}${groupInteger(integer)}${compactFraction ? `.${compactFraction}` : ""}`;
}

/** A quantity and its visual unit are a single compact value: `73.07кг`, `60шт`. */
export function formatQuantityWithUnit(value: number | null | undefined, unit: QuantityUnit | string | null | undefined): string {
  const quantity = formatQuantity(value);
  return quantity === "—" ? quantity : `${quantity}${quantityUnitLabel(unit)}`;
}

/** Monetary UI is rounded to full rubles: no kopecks are displayed. */
export function formatMoneyRubles(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const rounded = Math.round(Number(value));
  const sign = rounded < 0 ? "−" : "";
  return `${sign}${groupInteger(String(Math.abs(rounded)))} ₽`;
}

/** Exact monetary facts from Evotor retain kopecks instead of being rounded in summary KPIs. */
export function formatMoneyWithKopecks(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const numeric = Number(value);
  const sign = numeric < 0 ? "−" : "";
  const absolute = Math.abs(Math.round(numeric * 100) / 100);
  const [integer, fraction] = absolute.toFixed(2).split(".");
  return `${sign}${groupInteger(integer)}${fraction === "00" ? "" : `.${fraction}`} ₽`;
}
