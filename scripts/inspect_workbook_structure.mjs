import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const filePath = process.argv[2];
if (!filePath) throw new Error("Передайте путь к книге");
const workbook = XLSX.read(readFileSync(filePath), { type: "buffer", cellFormula: false });
const sampleName = workbook.SheetNames[3] ?? workbook.SheetNames[0];
const sheet = workbook.Sheets[sampleName];
const rows = [];
for (let row = 0; row < 90; row += 1) {
  const values = [];
  for (let col = 0; col < 50; col += 1) {
    const cell = sheet?.[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell?.v !== undefined && cell.v !== null && String(cell.v).trim() !== "") values.push({ c: col, v: String(cell.v).slice(0, 120) });
  }
  if (values.length) rows.push({ row: row + 1, values });
}
console.log(JSON.stringify({ filePath, sheetCount: workbook.SheetNames.length, sheets: workbook.SheetNames, sampleSheet: sampleName, rows }, null, 2));
