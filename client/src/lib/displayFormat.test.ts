import { describe, expect, it } from "vitest";
import { formatMoneyRubles, formatMoneyWithKopecks, formatQuantity, formatQuantityWithUnit, normalizeEvotorQuantityUnit, quantityUnitLabel } from "./displayFormat";

describe("единые форматы витрин", () => {
  it("показывает количества с точкой без незначимых нулей", () => {
    expect(formatQuantity(15)).toBe("15");
    expect(formatQuantity(15.5)).toBe("15.5");
    expect(formatQuantity(1_234.567)).toBe("1 234.57");
    expect(formatQuantity(-0.1)).toBe("−0.1");
    expect(formatQuantity(null)).toBe("—");
  });

  it("пишет единицу без пробела после количества", () => {
    expect(formatQuantityWithUnit(60, "piece")).toBe("60шт");
    expect(formatQuantityWithUnit(73.07, "fraction")).toBe("73.07кг");
    expect(formatQuantityWithUnit(null, "kg")).toBe("—");
  });

	  it("показывает денежные значения только полными рублями", () => {
    expect(formatMoneyRubles(3_673_572.88)).toBe("3 673 573 ₽");
    expect(formatMoneyRubles(499.32)).toBe("499 ₽");
    expect(formatMoneyRubles(-1.6)).toBe("−2 ₽");
	    expect(formatMoneyRubles(undefined)).toBe("—");
	  });

	  it("не округляет денежные факты Эвотор до рублей", () => {
	    expect(formatMoneyWithKopecks(3_673_572.88)).toBe("3 673 572.88 ₽");
	    expect(formatMoneyWithKopecks(499)).toBe("499 ₽");
	    expect(formatMoneyWithKopecks(-1.6)).toBe("−1.60 ₽");
	    expect(formatMoneyWithKopecks(undefined)).toBe("—");
	  });

  it("визуально переводит raw fraction Эвотор в кг", () => {
    expect(normalizeEvotorQuantityUnit("fraction")).toBe("kg");
    expect(normalizeEvotorQuantityUnit("дроб")).toBe("kg");
    expect(normalizeEvotorQuantityUnit("piece")).toBe("piece");
    expect(quantityUnitLabel("fraction")).toBe("кг");
    expect(quantityUnitLabel("дроб")).toBe("кг");
    expect(quantityUnitLabel("piece")).toBe("шт");
  });

  it("сохраняет явную единицу для количества чеков", () => {
    expect(normalizeEvotorQuantityUnit("checks")).toBe("check");
    expect(quantityUnitLabel("check")).toBe("чек.");
  });
});
