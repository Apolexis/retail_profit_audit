import { describe, expect, it } from "vitest";
import { calculateInventoryAdjustment, calculateOperationalStockCoverageDays, catalogUnitFromEvotor, evotorReceiptStockDelta, inventoryUnitFromCatalogUnit, markingFromEvotorCategory, normalizeAlcoholProductKindCode, projectSnapshotAwareStock, validateCountedQuantity, validateInventoryDate, validateStockTransferQuantity, validateStoreRequestQuantity } from "./inventoryRegistry";

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

	it("исправляет временно отрицательное сальдо подтвержденным физическим фактом", () => {
	  expect(calculateInventoryAdjustment(-1, 5)).toBe(6);
	  expect(() => calculateInventoryAdjustment(-1.0001, 5)).toThrow("Учетный остаток");
	});
});

describe("операционные перемещения: количество", () => {
  it("принимает только положительное количество с точностью до грамма", () => {
    expect(validateStockTransferQuantity(0.001)).toBe(0.001);
    expect(validateStockTransferQuantity(12.5)).toBe(12.5);
  });

  it("не подменяет ноль, минус или четвертый знак движением", () => {
    expect(() => validateStockTransferQuantity(0)).toThrow("больше нуля");
    expect(() => validateStockTransferQuantity(-1)).toThrow("больше нуля");
    expect(() => validateStockTransferQuantity(1.0001)).toThrow("трех знаков");
  });
});

describe("временная сверка снимка Эвотор и локальных движений", () => {
	it("применяет продажу и возврат как отдельные идемпотентные чековые дельты", () => {
	  expect(evotorReceiptStockDelta("SELL", 1.215)).toBe(-1.215);
	  expect(evotorReceiptStockDelta("PAYBACK", 1.215)).toBe(1.215);
	  expect(evotorReceiptStockDelta("RETURN", 1)).toBe(1);
	  expect(evotorReceiptStockDelta("SELL_RETURN", 1)).toBe(1);
	  expect(evotorReceiptStockDelta("UNKNOWN", 1)).toBeNull();
	});

  it("не складывает с новым snapshot движение, которое уже было учтено Эвотор", () => {
    const projection = projectSnapshotAwareStock(
      [{ storeId: 1, productId: 10, quantity: "8.000", updatedAt: new Date("2026-09-20T10:05:00Z") }],
      [{ storeId: 1, productId: 10, quantityDelta: "10.000", createdAt: new Date("2026-09-20T10:00:00Z") }],
    );
    expect(projection.values.get("1:10")).toBe(8);
  });

  it("добавляет только движение, возникшее после последнего snapshot", () => {
    const projection = projectSnapshotAwareStock(
      [{ storeId: 1, productId: 10, quantity: "8.000", updatedAt: new Date("2026-09-20T10:05:00Z") }],
      [{ storeId: 1, productId: 10, quantityDelta: "10.000", createdAt: new Date("2026-09-20T10:06:00Z") }],
    );
    expect(projection.values.get("1:10")).toBe(18);
  });

  it("заменяет временно проведённую приёмку более поздним снимком Эвотор", () => {
    const projection = projectSnapshotAwareStock(
      [{ storeId: 1, productId: 10, quantity: "18.000", updatedAt: new Date("2026-09-20T10:06:00Z") }],
      [{ storeId: 1, productId: 10, quantityDelta: "10.000", createdAt: new Date("2026-09-20T10:00:00Z") }],
    );
    expect(projection.values.get("1:10")).toBe(18);
  });

	it("учитывает сохранённый остаток Эвотор 1 000 000 как физическое количество", () => {
	  const projection = projectSnapshotAwareStock(
	    [{ storeId: 1, productId: 10, quantity: "1000000.000", updatedAt: new Date("2026-09-20T10:06:00Z") }],
	    [{ storeId: 1, productId: 10, quantityDelta: "10.000", createdAt: new Date("2026-09-20T10:07:00Z") }],
	  );
	  expect(projection.known.has("1:10")).toBe(true);
	  expect(projection.values.get("1:10")).toBe(1_000_010);
	});

	it("не считает одиночное перемещение остатком при закрытии пересчета", () => {
	  const projection = projectSnapshotAwareStock(
	    [{ storeId: 28, productId: 60001, quantity: "1000000.000", updatedAt: new Date("2026-09-22T20:10:00Z") }],
	    [{ storeId: 28, productId: 60001, quantityDelta: "-1.000", createdAt: new Date("2026-09-22T20:11:41Z") }],
	  );
	  expect(projection.values.get("28:60001")).toBe(999_999);
	  expect(calculateInventoryAdjustment(projection.values.get("28:60001")!, 5)).toBe(-999_994);
	});
});

describe("операционный контроль покрытия остатка", () => {
  it("считает дни покрытия только от подтвержденного остатка и семидневной продажи", () => {
    expect(calculateOperationalStockCoverageDays(45, 105)).toBe(3);
    expect(calculateOperationalStockCoverageDays(17, 105)).toBe(1.1);
  });

  it("не создает сигнал при отсутствующем остатке, продаже или нулевой базе", () => {
    expect(calculateOperationalStockCoverageDays(null, 105)).toBeNull();
    expect(calculateOperationalStockCoverageDays(45, null)).toBeNull();
    expect(calculateOperationalStockCoverageDays(0, 105)).toBeNull();
    expect(calculateOperationalStockCoverageDays(45, 0)).toBeNull();
  });
});

describe("заявки магазинов: количество", () => {
  it("принимает только положительное количество с точностью до 0,1", () => {
    expect(validateStoreRequestQuantity(1)).toBe(1);
    expect(validateStoreRequestQuantity(2.5)).toBe(2.5);
  });

  it("не подменяет отсутствие или отрицательное количество строкой заявки", () => {
    expect(() => validateStoreRequestQuantity(0)).toThrow("больше нуля");
    expect(() => validateStoreRequestQuantity(-0.1)).toThrow("больше нуля");
    expect(() => validateStoreRequestQuantity(1.23)).toThrow("одного знака");
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

  it("оставляет ровно два согласованных кода вида АП и подставляет 500", () => {
    expect(normalizeAlcoholProductKindCode(undefined, true)).toBe("500");
    expect(normalizeAlcoholProductKindCode("510", true)).toBe("510");
    expect(normalizeAlcoholProductKindCode("500", false)).toBeNull();
    expect(() => normalizeAlcoholProductKindCode("999", true)).toThrow("500 или 510");
  });
});

describe("Эвотор V2: весовая единица", () => {
  it("сохраняет код fraction внутри каталога и выводит его в инвентаризации как килограммы", () => {
    expect(catalogUnitFromEvotor("дроб")).toBe("fraction");
    expect(catalogUnitFromEvotor("кг")).toBe("fraction");
    expect(catalogUnitFromEvotor("fraction")).toBe("fraction");
    expect(catalogUnitFromEvotor("piece")).toBe("piece");
    expect(catalogUnitFromEvotor("PCS")).toBe("piece");
    expect(inventoryUnitFromCatalogUnit("fraction")).toBe("kg");
  });
});
