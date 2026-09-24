export type InventoryBoundaryRow = { store: string; entryDate: string; metrics: Record<string, unknown> };

const value = (row: InventoryBoundaryRow, key: "stock_open" | "stock_close") => Number(row.metrics[key] ?? 0);

/** Sums each included store's own first or last inventory snapshot; never sums snapshots across months. */
export function boundaryStock(rows: InventoryBoundaryRow[], key: "stock_open" | "stock_close", edge: "first" | "last") {
  const rowsByStore = new Map<string, InventoryBoundaryRow[]>();
  rows.forEach(row => rowsByStore.set(row.store, [...(rowsByStore.get(row.store) ?? []), row]));
  return Array.from(rowsByStore.values()).reduce((total, storeRows) => {
    const sorted = [...storeRows].sort((left, right) => left.entryDate.localeCompare(right.entryDate));
    return total + value(edge === "first" ? sorted[0] : sorted.at(-1)!, key);
  }, 0);
}

/** Network coverage uses the selected calendar interval, its common final stock and common revenue. */
export const coverageDays = (stockClose: number, revenue: number, rangeDays: number) => revenue > 0 ? stockClose / revenue * Math.max(1, rangeDays) : 0;
