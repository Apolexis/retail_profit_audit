import fs from "node:fs/promises";
import officeCrypto from "officecrypto-tool";
import * as XLSX from "xlsx";

const sourcePath = "/home/ubuntu/upload/учет2026.xlsx";
const password = process.env.IMPORT_WORKBOOK_OPEN_PASSWORD;

if (!password) {
  throw new Error("Пароль открытия защищенной книги не настроен.");
}

const encrypted = await fs.readFile(sourcePath);
const declaredEncrypted = await officeCrypto.isEncrypted(encrypted);
const decrypted = await officeCrypto.decrypt(encrypted, { password });
const workbook = XLSX.read(decrypted, { type: "buffer", cellFormula: true });

console.log(JSON.stringify({
  declaredEncrypted,
  decryptedBytes: decrypted.length,
  sheetCount: workbook.SheetNames.length,
  firstSheets: workbook.SheetNames.slice(0, 4),
}));
