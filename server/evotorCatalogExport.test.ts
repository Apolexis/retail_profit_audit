import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { __evotorCatalogExportInternals } from "./evotorCatalogExport";

const { stableEvotorProductId, evotorMeasureName, evotorProductType, buildEvotorProductPayload } = __evotorCatalogExportInternals;
const inventoryRegistry = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");

const base = {
  id: 17,
  catalogNumber: 17,
  canonicalName: "Камбала с/м",
  baseUnit: "fraction" as const,
  vatRate: "VAT_10" as const,
  markingCategory: "none" as const,
  alcoholCode: null,
  alcoholTypeCode: null,
  alcoholStrengthPercent: null,
  alcoholVolumeLiters: null,
  manualBarcodes: "123; 456\n123",
  barcodes: ["456", "789"],
  quantity: 12.3456,
  parentId: "24be66b4-4dbe-4e23-82c0-3924b2d43391",
};

describe("Эвотор: автоматический payload номенклатуры и остатка", () => {
  it("создает повторяемый UUID магазина и товара для retry", () => {
    const first = stableEvotorProductId("store", 42);
    const second = stableEvotorProductId("store", 42);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

	it("передает весовой fraction в Эвотор как технический «дроб»", () => {
	  expect(evotorMeasureName("fraction")).toBe("дроб");
    expect(evotorMeasureName("l")).toBe("л");
    expect(evotorMeasureName("piece")).toBe("шт");
    expect(() => evotorMeasureName("unknown")).toThrow("единица измерения");
  });

  it("передает фактический остаток и цену, если цена задана для точки", () => {
    const payload = buildEvotorProductPayload({ ...base, price: 199.999 }, "product-17");
    expect(payload).toEqual({
      id: "product-17",
      code: "17",
      article_number: "17",
      name: "Камбала с/м",
      type: "NORMAL",
	    measure_name: "дроб",
      tax: "VAT_10",
      barcodes: ["123", "456"],
      parent_id: "24be66b4-4dbe-4e23-82c0-3924b2d43391",
      quantity: 12.346,
      allow_to_sell: true,
      cost_price: 0,
      price: 200,
    });
  });

  it("передает артикул из порядкового номера номенклатуры, а не технического ID записи", () => {
    const payload = buildEvotorProductPayload({ ...base, id: 60001, catalogNumber: 817 }, "product-817");
    expect(payload.code).toBe("817");
    expect(payload.article_number).toBe("817");
    expect(payload.article_number).not.toBe("60001");
  });

  it("не блокирует выгрузку без назначенной цены и передает требуемые V2 defaults", () => {
    const payload = buildEvotorProductPayload({ ...base, quantity: 0 }, "product-17");
    expect(payload.quantity).toBe(0);
    expect(payload.price).toBe(0);
    expect(payload.cost_price).toBe(0);
    expect(payload.allow_to_sell).toBe(true);
    expect(payload).not.toHaveProperty("internalCostPrice");
  });

  it("включает новую номенклатуру в автоматическую выгрузку, если администратор не снял флаг", () => {
    expect(inventoryRegistry).toContain("isEvotorExportEnabled: input.isEvotorExportEnabled ?? true");
  });

  it("передает закупочную цену только при отдельном включенном флаге", () => {
    const published = buildEvotorProductPayload({ ...base, internalCostPrice: "73.076", isEvotorCostExportEnabled: true }, "product-17");
    const privateCost = buildEvotorProductPayload({ ...base, internalCostPrice: "73.076", isEvotorCostExportEnabled: false }, "product-17");
    expect(published.cost_price).toBe(73.08);
    expect(privateCost.cost_price).toBe(0);
  });

  it("считает сохранённый набор штрихкодов, включая пустой, приоритетнее входящего Эвотор", () => {
    const preserved = buildEvotorProductPayload({ ...base, manualBarcodes: "111; 222", barcodes: ["456", "789"] }, "product-17");
    const cleared = buildEvotorProductPayload({ ...base, manualBarcodes: "", barcodes: ["456", "789"] }, "product-17");
    const sourceOnly = buildEvotorProductPayload({ ...base, manualBarcodes: null, barcodes: ["456", "789"] }, "product-17");
    expect(preserved.barcodes).toEqual(["111", "222"]);
    expect(cleared.barcodes).toEqual([]);
    expect(sourceOnly.barcodes).toEqual(["456", "789"]);
  });

  it("передает разрешенные алкогольные поля только для подходящей категории", () => {
    const payload = buildEvotorProductPayload({
      ...base,
      catalogNumber: 18,
      canonicalName: "Пиво",
      baseUnit: "piece",
      vatRate: "VAT_22",
      markingCategory: "beer_marked",
      alcoholCode: "ABC",
      alcoholTypeCode: "500",
      alcoholStrengthPercent: "4.7",
      alcoholVolumeLiters: "0.5",
    }, "product-18");
    expect(payload).toMatchObject({ type: "BEER_MARKED", alcocodes: ["ABC"], alcohol_product_kind_code: "500", alcohol_by_volume: 4.7, tare_volume: 0.5 });
    expect(evotorProductType("seafood_caviar")).toBe("CAVIAR_MARKED");
    expect(evotorProductType("water")).toBe("WATER_MARKED");
  });
});
