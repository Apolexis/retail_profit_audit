import { describe, expect, it } from "vitest";
import { boundaryStock, coverageDays } from "./inventoryCalculations";

describe("сетевые остатки", () => {
  const rows = [
    { store: "А", entryDate: "2026-01-01", metrics: { stock_open: 100, stock_close: 120 } },
    { store: "А", entryDate: "2026-12-01", metrics: { stock_open: 130, stock_close: 150 } },
    { store: "Б", entryDate: "2026-02-01", metrics: { stock_open: 200, stock_close: 220 } },
    { store: "Б", entryDate: "2026-11-01", metrics: { stock_open: 230, stock_close: 250 } },
  ];

  it("суммирует первый и последний снапшот каждой точки, а не один общий период", () => {
    expect(boundaryStock(rows, "stock_open", "first")).toBe(300);
    expect(boundaryStock(rows, "stock_close", "last")).toBe(400);
  });

  it("для месячного графика складывает снимки точек данного месяца без суммирования месяцев", () => {
    const december = [
      { store: "А", entryDate: "2026-12-01", metrics: { stock_close: 150 } },
      { store: "Б", entryDate: "2026-12-01", metrics: { stock_close: 250 } },
    ];
    expect(boundaryStock(december, "stock_close", "last")).toBe(400);
    expect(boundaryStock(rows, "stock_close", "last")).toBe(400);
  });

  it("рассчитывает покрытие сети из общего остатка, общей выручки и календарных дней", () => {
    expect(coverageDays(400, 4000, 30)).toBe(3);
    expect(coverageDays(400, 0, 30)).toBe(0);
  });
});
