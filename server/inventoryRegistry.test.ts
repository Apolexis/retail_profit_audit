import { describe, expect, it } from "vitest";
import { calculateInventoryAdjustment, catalogUnitFromEvotor, inventoryUnitFromCatalogUnit, markingFromEvotorCategory, validateCountedQuantity, validateInventoryDate, validateStoreRequestQuantity } from "./inventoryRegistry";

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

describe("заявки магазинов: количество", () => {
  it("принимает только положительное количество с точностью до грамма", () => {
    expect(validateStoreRequestQuantity(1)).toBe(1);
    expect(validateStoreRequestQuantity(2.345)).toBe(2.345);
  });

  it("не подменяет отсутствие или отрицательное количество строкой заявки", () => {
    expect(() => validateStoreRequestQuantity(0)).toThrow("больше нуля");
    expect(() => validateStoreRequestQuantity(-0.1)).toThrow("больше нуля");
    expect(() => validateStoreRequestQuantity(1.2345)).toThrow("трех знаков");
  });
});

describe("Эвотор V2: типы маркировки", () => {
  it("сопоставляет документированные типы В2 без эвристики", () => {
    expect(markingFromEvotorCategory({ name: "БАД", categoryName: null, type: "DIETARY_SUPPLEMENTS_MARKED" })).toBe("supplement");
    expect(markingFromEvotorCategory({ name: "Икра", categoryName: null, type: "CAVIAR_MARKED" })).toBe("seafood_caviar");
    expect(markingFromEvotorCategory({ name: "Консервы", categoryName: null, type: "GROCERIES_MARKED" })).toBe("seafood_canned");
    expect(markingFromEvotorCategory({ name: "Пиво", categoryName: null, type: "BEER_MARKED" })).toBe("beer_marked");
    expect(markingFromEvotorCategory({ name: "Пиво в кеге", categoryName: null, type: "BEER_MARKED_KEG" })).toBe("beer_marked");
    expect(markingFromEvotorCategory({ name: "Безалкогольное", categoryName: null, type: "NOT_ALCOHOL_BEER_MARKED" })).toBe("beer_non_alcoholic");
    expect(markingFromEvotorCategory({ name: "Вода", categoryName: null, type: "WATER_MARKED" })).toBe("water");
    expect(markingFromEvotorCategory({ name: "Молоко", categoryName: null, type: "DAIRY_MARKED" })).toBe("dairy");
    expect(markingFromEvotorCategory({ name: "Вино", categoryName: null, type: "ALCOHOL_MARKED" })).toBe("alcohol");
    expect(markingFromEvotorCategory({ name: "Вино", categoryName: null, type: "ALCOHOL_NOT_MARKED" })).toBe("alcohol");
    expect(markingFromEvotorCategory({ name: "Пиво", categoryName: null, type: "NORMAL" })).toBe("none");
    expect(markingFromEvotorCategory({ name: "Пиво", categoryName: null, type: "UNRECOGNIZED_SOURCE_TYPE" })).toBe("none");
  });
});

describe("Эвотор V2: весовая единица", () => {
  it("сохраняет код fraction внутри каталога и выводит его в инвентаризации как килограммы", () => {
    expect(catalogUnitFromEvotor("дроб")).toBe("fraction");
    expect(catalogUnitFromEvotor("кг")).toBe("fraction");
    expect(catalogUnitFromEvotor("fraction")).toBe("fraction");
    expect(inventoryUnitFromCatalogUnit("fraction")).toBe("kg");
  });
});
