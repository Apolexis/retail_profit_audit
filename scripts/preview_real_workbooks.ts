import { readFileSync } from "node:fs";
import { parseWorkbook } from "../server/audit";

for (const filePath of ["/home/ubuntu/upload/2026.xlsx", "/home/ubuntu/upload/Учетмагазинов2025.xlsx"]) {
  const parsed = parseWorkbook(readFileSync(filePath), filePath.split("/").at(-1) ?? filePath);
  const first = parsed.periods[0];
  console.log(JSON.stringify({
    file: filePath.split("/").at(-1),
    year: parsed.year,
    stores: parsed.stores.length,
    periods: parsed.periods.length,
    first: first ? { store: first.store, month: first.monthDate, metricCodes: first.metrics.map(metric => metric.code).sort() } : null,
  }));
}
