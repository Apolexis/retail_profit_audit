import type { DateRangeValue } from "@/contexts/AuditContext";

const DAY_MS = 86_400_000;
const isoDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const utcDate = (value: string) => Date.parse(`${value}T00:00:00Z`);

/** Returns the immediately preceding range with exactly the same number of calendar days. */
export function previousComparableRange(range: DateRangeValue): DateRangeValue {
  const from = utcDate(range.from);
  const to = utcDate(range.to);
  const span = Math.max(0, Math.round((to - from) / DAY_MS));
  return { from: isoDate(from - (span + 1) * DAY_MS), to: isoDate(from - DAY_MS) };
}

/**
 * Aligns the prior period against the active period in reverse chronological
 * order. This preserves the approved time orientation of the active period
 * while letting the prior range be read as a counter-series.
 */
export function reverseComparableRows<T extends Record<string, unknown>>(active: readonly T[], previous: readonly T[]) {
  return active.map((row, index) => ({ active: row, previous: previous[previous.length - 1 - index] ?? null }));
}

export function previousSeriesKey(key: string) {
  return `previous:${key}`;
}
