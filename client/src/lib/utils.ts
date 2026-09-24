import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalizes editable decimal values while the user types. */
export function normalizeDecimalInputText(value: string) {
  return value.replace(/,/g, ".");
}

export const MOSCOW_TIME_ZONE = "Europe/Moscow";

/** Returns the operational calendar day in Moscow, regardless of device timezone. */
export function moscowBusinessDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Formats an absolute timestamp for the business interface, independent of the device timezone. */
export function formatMoscowDateTime(value: Date | string | number | null | undefined, options: { seconds?: boolean; fallback?: string } = {}) {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) return options.fallback ?? "время не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.seconds !== false ? { second: "2-digit" } : {}),
  }).format(date);
}

/** Formats a business calendar date without interpreting it in the device timezone. */
export function formatBusinessDate(value: string | null | undefined, fallback = "Дата не указана") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

/** Converts a date-only business key to a stable UTC calendar anchor, never device-local time. */
export function businessCalendarDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function businessMonthDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const date = businessCalendarDate(`${value}-01`);
  return date?.toISOString().slice(0, 7) === value ? date : null;
}

export function formatBusinessCalendarDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions, fallback = "Дата не указана") {
  const date = businessCalendarDate(value);
  return date ? new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(date) : fallback;
}

export function formatBusinessMonth(value: string | null | undefined, options: Intl.DateTimeFormatOptions, fallback = "Дата не указана") {
  const date = businessMonthDate(value);
  return date ? new Intl.DateTimeFormat("ru-RU", { ...options, timeZone: "UTC" }).format(date) : fallback;
}

export function businessWeekStart(value: string) {
  const date = businessCalendarDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

/** Shifts a date-only Moscow business key without consulting the device clock. */
export function shiftBusinessDate(value: string, days: number) {
  const date = businessCalendarDate(value);
  if (!date || !Number.isInteger(days)) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function businessMonthEnd(value: string) {
  const date = businessMonthDate(value);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function businessMonthsInRange(range: { from: string; to: string }) {
  const from = businessCalendarDate(range.from);
  const to = businessCalendarDate(range.to);
  if (!from || !to || from > to) return [];
  const result: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const finalYear = to.getUTCFullYear();
  const finalMonth = to.getUTCMonth();
  while (year < finalYear || (year === finalYear && month <= finalMonth)) {
    result.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month === 12) { month = 0; year += 1; }
  }
  return result;
}

/** Returns the immediately preceding calendar interval using only date-only business keys. */
export function previousBusinessPeriod(range: { from: string; to: string }) {
  const from = businessCalendarDate(range.from);
  const to = businessCalendarDate(range.to);
  if (!from || !to || from > to) return range;
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(from);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return { from: previousStart.toISOString().slice(0, 10), to: previousEnd.toISOString().slice(0, 10) };
}
