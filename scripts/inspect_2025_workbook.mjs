import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const filePath = "/home/ubuntu/upload/Учетмагазинов2025.xlsx";
const workbook = XLSX.read(readFileSync(filePath), { type: "buffer", cellFormula: false, password: process.env.WORKBOOK_PASSWORD });
const name = workbook.SheetNames[3];
const sheet = workbook.Sheets[name];
const firstRows = [];
for (let row = 1; row <= 45; row += 1) {
  const values = [];
  for (let col = 0; col < 44; col += 1) {
    const address = XLSX.utils.encode_cell({ r: row - 1, c: col });
    const value = sheet?.[address]?.v;
    if (value !== undefined && value !== null && value !== "") values.push(`${address}=${value}`);
  }
  if (values.length) firstRows.push(values.join(" | "));
}
console.log(JSON.stringify({ sheets: workbook.SheetNames, sampleSheet: name, rows: firstRows }, null, 2));
