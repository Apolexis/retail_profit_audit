import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "./audit";

describe("parseWorkbook", () => {
  it("skips the first three sheets and turns a month block into normalized metrics", () => {
    const workbook = XLSX.utils.book_new();
    ["tech-1", "tech-2", "tech-3"].forEach(name => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[name]]), name));
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Январь"],
      [1, 100, 10, 20, 30, 40, 50, 100, null, null, null, 50, 60, 40, 100, 0, 2, 1],
      ["Итого", 100, 10, 20, 30, 40, 50, 100, null, null, null, 50, 60, 40, 100, 0, 2, 1],
    ]);
    sheet["AQ2"] = { t: "n", v: 17 };
    sheet["!ref"] = "A1:AQ3";
    XLSX.utils.book_append_sheet(workbook, sheet, "Новый магазин");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = parseWorkbook(buffer, "операционный_2026.xlsx");

    expect(result.year).toBe(2026);
    expect(result.stores).toEqual(["Новый магазин"]);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]?.monthDate).toBe("2026-01");
    expect(result.periods[0]?.metrics).toEqual(expect.arrayContaining([
      { code: "revenue", amount: 100 },
      { code: "net_profit", amount: 17 },
      { code: "stock_open", amount: 100 },
    ]));
  });
});
