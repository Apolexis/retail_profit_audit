export type SortDirection = "asc" | "desc";

export function numericTableValue(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".").trim();
  const match = normalized.match(/^[+−-]?(?:\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[0].replace("−", "-"));
  if (!Number.isFinite(parsed)) return null;
  if (normalized.includes("млн")) return parsed * 1_000_000;
  if (normalized.includes("тыс")) return parsed * 1_000;
  return parsed;
}

export function compareTableValues(left: string, right: string, direction: SortDirection): number {
  const leftNumber = numericTableValue(left);
  const rightNumber = numericTableValue(right);
  const comparison = leftNumber !== null && rightNumber !== null
    ? leftNumber - rightNumber
    : left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? comparison : -comparison;
}

export function sortReadableRows<T>(rows: T[], read: (row: T) => string, direction: SortDirection): T[] {
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const comparison = compareTableValues(read(left.row), read(right.row), direction);
    return comparison || left.index - right.index;
  }).map(item => item.row);
}
