import { readFileSync } from "node:fs";
import { commitWorkbook, previewWorkbook } from "../server/audit";

const filePath = process.argv[2];
const resolution = process.argv[3] === "skip" ? "skip" : "replace";
if (!filePath) throw new Error("Передайте путь к книге");
const fileName = filePath.split("/").at(-1) ?? filePath;
const buffer = readFileSync(filePath);
const preview = await previewWorkbook(buffer, fileName);
console.log(JSON.stringify({ stage: "preview", fileName, year: preview.year, stores: preview.stores.length, periods: preview.periods.length, conflicts: preview.conflicts.length }, null, 2));
const result = await commitWorkbook(buffer, fileName, resolution);
console.log(JSON.stringify({ stage: "commit", fileName, ...result, riskEvents: result.riskEvents.length }, null, 2));
