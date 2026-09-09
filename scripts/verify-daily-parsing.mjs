import { readFileSync } from "node:fs";
import { parseWorkbook } from "../server/audit.ts";

const files = ["/home/ubuntu/upload/учет2026.xlsm", "/home/ubuntu/upload/Учетмагазинов2025.xlsx"];
const summaries = files.map(fileName => {
  const parsed = parseWorkbook(readFileSync(fileName), fileName);
  const dates = new Set(parsed.periods.map(period => period.entryDate));
  const sum = code => parsed.periods.reduce((total, period) => total + Number(period.metrics.find(metric => metric.code === code)?.amount ?? 0), 0);
  return {
    fileName: fileName.split("/").at(-1),
    year: parsed.year,
    stores: parsed.stores.length,
    periods: parsed.periods.length,
    distinctDates: dates.size,
    firstDate: [...dates].sort()[0],
    lastDate: [...dates].sort().at(-1),
    revenue: sum("revenue"),
    netProfit: sum("net_profit"),
  };
});
console.log(JSON.stringify(summaries, null, 2));
