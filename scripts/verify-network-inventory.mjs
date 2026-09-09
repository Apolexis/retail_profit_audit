import { getAuditDashboard } from "../server/audit.ts";
import { boundaryStock, coverageDays } from "../client/src/lib/inventoryCalculations.ts";

const range = { from: "2026-01-01", to: "2026-12-31" };
const dashboard = await getAuditDashboard(null);
const rows = dashboard.periods
  .filter(row => !row.isHidden && row.entryDate >= range.from && row.entryDate <= range.to)
  .map(row => ({ store: row.store, entryDate: row.entryDate, metrics: row.metrics }));
const stores = new Set(rows.map(row => row.store));
const revenue = rows.reduce((total, row) => total + Number(row.metrics.revenue ?? 0), 0);
const stockOpen = boundaryStock(rows, "stock_open", "first");
const stockClose = boundaryStock(rows, "stock_close", "last");

console.log(JSON.stringify({
  range,
  stores: stores.size,
  stockOpen,
  stockClose,
  revenue,
  coverageDays: Number(coverageDays(stockClose, revenue, 365).toFixed(6)),
}, null, 2));
