import { getAuditDashboard } from "../server/audit.ts";
import { buildSeasonalForecast } from "../client/src/lib/forecastLogic.ts";

const dashboard = await getAuditDashboard(null, [
  { from: "2025-01-01", to: "2025-12-31" },
  { from: "2026-01-01", to: "2026-12-31" },
]);
const result = buildSeasonalForecast({ facts: dashboard.periods, year: 2026, store: "__all__", metric: "revenue" });
console.log(JSON.stringify({
  periodCount: dashboard.periods.length,
  monthSamples: Array.from(new Set(dashboard.periods.map(row => row.monthDate))).slice(0, 14),
  latestActualMonth: result.latestActualMonth,
  historicalToDate: result.historicalToDate,
  actualToDate: result.actualToDate,
  scaleFactor: result.scaleFactor,
  forecastMonths: result.forecastRows.map(row => row.month),
}, null, 2));
