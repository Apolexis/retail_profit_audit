import XLSX from "xlsx";

const workbookPath = process.argv[2] ?? "/home/ubuntu/upload/учет2026.xlsm";
const workbook = XLSX.readFile(workbookPath, { cellFormula: true });
const storeName = workbook.SheetNames[3];
const sheet = workbook.Sheets[storeName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
const totalRows = rows
  .map((row, index) => ({ row: index + 1, label: row[0], stock: row[1], grossProfit: row[11], total: row[42] }))
  .filter(row => row.label === "Итого");

console.log(JSON.stringify({
  sheets: workbook.SheetNames.slice(0, 6),
  inspectedStore: storeName,
  headers: (rows[1] ?? []).map((label, index) => ({ column: XLSX.utils.encode_col(index), label })).filter(item => item.label),
  totalRows,
  rows: rows.slice(0, 46).map((row, index) => ({ row: index + 1, values: row.slice(0, 43) })),
}, null, 2));
