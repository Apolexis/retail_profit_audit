import { describe, expect, it } from "vitest";
import { calculateInventoryAdjustment, validateCountedQuantity, validateInventoryDate } from "./inventoryRegistry";

describe("операционная инвентаризация: контроль количества", () => {
  it("принимает вес с точностью до грамма и нулевой фактический остаток", () => {
    expect(validateCountedQuantity(12.345)).toBe(12.345);
    expect(validateCountedQuantity(0)).toBe(0);
  });

  it("не превращает пустое или неточное значение в ноль", () => {
    expect(() => validateCountedQuantity(-0.001)).toThrow("неотрицательным");
    expect(() => validateCountedQuantity(1.2345)).toThrow("трех знаков");
    expect(() => validateCountedQuantity(Number.NaN)).toThrow("неотрицательным");
  });

  it("сохраняет знак корректировки между расчетным и фактическим остатком", () => {
    expect(calculateInventoryAdjustment(10, 12.5)).toBe(2.5);
    expect(calculateInventoryAdjustment(12.5, 10)).toBe(-2.5);
    expect(calculateInventoryAdjustment(3.12, 3.12)).toBe(0);
  });

  it("принимает только явную операционную дату", () => {
    expect(validateInventoryDate("2026-09-17")).toBe("2026-09-17");
    expect(() => validateInventoryDate("17.09.2026")).toThrow("ГГГГ-ММ-ДД");
  });
});

/**
 * Closing requires a row in the service. These pure contracts guard the two
 * material accounting invariants without creating catalogue or stock data.
 */
describe("операционная инвентаризация: закрытие", () => {
  it("фиксирует точный нулевой остаток как списание, а не как отсутствие строки", () => {
    expect(calculateInventoryAdjustment(4.25, 0)).toBe(-4.25);
  });

  it("определяет расхождение только как факт минус учет", () => {
    expect(calculateInventoryAdjustment(0, 6.5)).toBe(6.5);
    expect(calculateInventoryAdjustment(6.5, 0)).toBe(-6.5);
  });
});
