import { readFileSync } from "node:fs";
import { parseWorkbook } from "../server/audit.ts";

const files = ["/home/ubuntu/upload/учет2026.xlsm", "/home/ubuntu/upload/2026.xlsx"];
const summarize = fileName => {
  const parsed = parseWorkbook(readFileSync(fileName), fileName);
  const totals = Object.fromEntries(["revenue", "net_profit", "stock_close"].map(code => [code, parsed.periods.reduce((sum, period) => sum + Number(period.metrics.find(metric => metric.code === code)?.amount ?? 0), 0)]));
  const dates = parsed.periods.map(period => period.entryDate).sort();
  return { fileName: fileName.split("/").at(-1), stores: parsed.stores.length, periods: parsed.periods.length, firstDate: dates[0], lastDate: dates.at(-1), ...totals };
};

console.log(JSON.stringify(files.map(summarize), null, 2));
