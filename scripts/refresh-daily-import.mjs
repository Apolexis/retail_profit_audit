import { readFileSync } from "node:fs";
import { commitWorkbookForDateRangeFast as commitWorkbookForDateRange } from "../server/audit.ts";

const fileName = process.argv[2];
const year = Number(process.argv[3]);
if (!fileName || !Number.isInteger(year)) throw new Error("Использование: refresh-daily-import.mjs <файл> <год>");

const result = await commitWorkbookForDateRange(
  readFileSync(fileName),
  fileName.split("/").at(-1),
  "preserve_manual",
  { from: `${year}-01-01`, to: `${year}-12-31` },
);
console.log(JSON.stringify({
  importId: result.importId,
  createdStores: result.createdStores,
  createdPeriods: result.createdPeriods,
  updatedPeriods: result.updatedPeriods,
  protectedMetricCount: result.protectedMetricCount,
  selectedDates: result.selectedDates.length,
}, null, 2));
