import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inventory = readFileSync(new URL("./Inventory.tsx", import.meta.url), "utf8");
const portfolio = readFileSync(new URL("./Portfolio.tsx", import.meta.url), "utf8");
const controlCenter = readFileSync(new URL("./ControlCenter.tsx", import.meta.url), "utf8");
const stores = readFileSync(new URL("./Stores.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("итоговые строки аналитических таблиц", () => {
  it("отделяет сумму потока от остатка на границе периода", () => {
    expect(inventory).toContain("const inventoryTableSummaryLabel");
    expect(inventory).toContain('trend === "stockOpen" ? "На начало"');
    expect(inventory).toContain('trend === "stockClose" ? "На конец"');
    expect(inventory).toContain('className="table-total"');
  });

  it("выводит агрегаты видимого портфеля без сложения покрытия", () => {
    expect(portfolio).toContain("const visibleTotals");
    expect(portfolio).toContain("const visibleMargin");
    expect(portfolio).toContain("visibleTotals.writeoffs");
    expect(portfolio).toContain("<td>—</td>");
  });

  it("не строит ложную разницу при неполных сопоставимых месяцах", () => {
    expect(controlCenter).toContain("const periodTableTotals");
    expect(controlCenter).toContain("const revenueTotalsComparable");
    expect(controlCenter).toContain("const profitTotalsComparable");
    expect(controlCenter).toContain('revenueTotalsComparable?');
  });

  it("добавляет итог расходов магазина и единый спокойный стиль", () => {
    expect(stores).toContain("const expenseTotal");
    expect(stores).toContain("const expenseShare");
    expect(stores).toContain('className="table-total"');
    expect(styles).toContain(".packet .data-table tfoot .table-total");
  });
});
