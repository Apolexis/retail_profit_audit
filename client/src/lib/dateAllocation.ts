export type MonthFactSource = {
  monthDate: string;
  entryDate: string;
  importId: number | null;
};

const DAY_MS = 86_400_000;

const utcDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const dateString = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

export function monthBounds(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  const from = Date.UTC(year, month - 1, 1);
  const to = Date.UTC(year, month, 0);
  return { from: dateString(from), to: dateString(to), days: Math.round((to - from) / DAY_MS) + 1 };
}

/**
 * Imported facts are monthly totals. For a partial day/week range they are allocated
 * equally across every calendar day because the stores operate all seven days.
 * Manually entered daily records stay exact and are never allocated.
 */
export function allocationRatio(source: MonthFactSource, range: { from: string; to: string }) {
  const isImportedMonthly = source.importId !== null && source.entryDate === `${source.monthDate}-01`;
  if (!isImportedMonthly) return source.entryDate >= range.from && source.entryDate <= range.to ? 1 : 0;
  const month = monthBounds(source.monthDate);
  const start = Math.max(utcDay(month.from), utcDay(range.from));
  const end = Math.min(utcDay(month.to), utcDay(range.to));
  if (end < start) return 0;
  return (Math.round((end - start) / DAY_MS) + 1) / month.days;
}

export function allocateMetric(metricCode: string, value: number, ratio: number) {
  // Inventory is a monthly snapshot, not a flow. Keep the source snapshot visible.
  if (metricCode === "stock_open" || metricCode === "stock_close") return value;
  return value * ratio;
}
