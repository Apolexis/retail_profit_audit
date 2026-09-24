import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { prepareWorkbookForRead } from "./audit";

describe("защищенная конфигурация импорта", () => {
  it("открывает защищенную OOXML-книгу из серверного окружения в памяти и не меняет исходник", async () => {
    const openPassword = process.env.IMPORT_WORKBOOK_OPEN_PASSWORD;
    const unprotectPassword = process.env.IMPORT_SHEET_UNPROTECT_PASSWORD;
    expect(openPassword).toBeTruthy();
    expect(unprotectPassword).toBeTruthy();
    const sourcePath = "/home/ubuntu/upload/учет2026.xlsx";
    const source = readFileSync(sourcePath);
    const before = createHash("sha256").update(source).digest("hex");
    const decrypted = await prepareWorkbookForRead(source, { workbookPassword: openPassword });
    const book = XLSX.read(decrypted, { type: "buffer", cellFormula: false });
    const after = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
    expect(book.SheetNames.length).toBeGreaterThan(3);
    expect(after).toBe(before);
  });
});
