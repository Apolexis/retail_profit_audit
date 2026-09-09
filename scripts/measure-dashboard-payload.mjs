import { getAuditDashboard } from "../server/audit.ts";

const dashboard = await getAuditDashboard(null, [{ from: "2026-01-01", to: "2026-12-31" }]);
const bytes = Buffer.byteLength(JSON.stringify(dashboard));
console.log(JSON.stringify({
  stores: dashboard.stores.length,
  periods: dashboard.periods.length,
  jsonMegabytes: Number((bytes / 1024 / 1024).toFixed(2)),
}, null, 2));
