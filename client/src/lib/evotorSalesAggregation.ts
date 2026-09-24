export type ProductMetric = "quantity" | "amount";

export type ProductTimelineRow = {
  key: string;
  label: string;
  storeId: number;
  storeName: string;
  productKey: string;
  productName: string;
  unit: string | null;
  amount: number;
  quantity: number;
};

export type ProductSeries = { key: string; unit?: string | null };
export type ProductChartDatum = Record<string, string | number> & { month: string; sort: string };

const compactLabel = (value: string) => value.charAt(0).toLocaleUpperCase("ru-RU") + value.slice(1);
const scaledValue = (value: number, metric: ProductMetric) => metric === "amount" ? value / 1_000 : value;
const sourceValue = (row: ProductTimelineRow, metric: ProductMetric) => metric === "amount" ? row.amount : row.quantity;

/**
 * Builds one series per selected product. The server deliberately returns one
 * interval row per product and store, so a network (or multi-store) series must
 * add those rows instead of letting the last store overwrite the prior value.
 */
export function buildSelectedProductTimeline(rows: ProductTimelineRow[], products: ProductSeries[], metric: ProductMetric): ProductChartDatum[] {
  const selectedKeys = new Set(products.map(product => product.key));
  const intervals = new Map<string, ProductChartDatum>();
  rows.filter(row => selectedKeys.has(row.productKey)).forEach(row => {
    const current = intervals.get(row.key) ?? { month: compactLabel(row.label), sort: row.key };
    current[row.productKey] = Number(current[row.productKey] ?? 0) + scaledValue(sourceValue(row, metric), metric);
    intervals.set(row.key, current);
  });
  return Array.from(intervals.values()).sort((left, right) => left.sort.localeCompare(right.sort)).map(row => ({
    ...Object.fromEntries(products.map(product => [product.key, row[product.key] ?? 0])),
    ...row,
  }));
}

/** Builds one selected-product series per store for the Rhythm "Ряды" mode. */
export function buildSelectedProductStoreTimeline(rows: ProductTimelineRow[], product: ProductSeries, stores: Array<{ id: number; name: string }>, metric: ProductMetric): ProductChartDatum[] {
  const intervals = new Map<string, ProductChartDatum>();
  rows.filter(row => row.productKey === product.key).forEach(row => {
    const current = intervals.get(row.key) ?? { month: compactLabel(row.label), sort: row.key };
    current[row.storeName] = Number(current[row.storeName] ?? 0) + scaledValue(sourceValue(row, metric), metric);
    intervals.set(row.key, current);
  });
  return Array.from(intervals.values()).sort((left, right) => left.sort.localeCompare(right.sort)).map(row => ({
    ...Object.fromEntries(stores.map(store => [store.name, row[store.name] ?? 0])),
    ...row,
  }));
}
