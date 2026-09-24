import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

describe("защищенная книга 2025 года", () => {
  it("открывается с паролем из защищенного окружения", () => {
    const password = process.env.WORKBOOK_2025_PASSWORD;
    expect(password).toBeTruthy();
    const book = XLSX.read(readFileSync("/home/ubuntu/upload/Учетмагазинов2025.xlsx"), {
      type: "buffer",
      password,
      cellFormula: false,
    });
    expect(book.SheetNames.length).toBeGreaterThan(3);
  });
});
