import { describe, expect, it } from "vitest";
import { normalizeEvotorCatalogPreviewItem, normalizeEvotorStore } from "./evotorCatalog";

describe("Эвотор V2: preview номенклатуры", () => {
  it("нормализует только безопасные поля магазина", () => {
    expect(normalizeEvotorStore({ id: "store-1", name: "Точка 1", address: "Адрес", user_id: "private" })).toEqual({ id: "store-1", name: "Точка 1", address: "Адрес" });
    expect(normalizeEvotorStore({ id: "store-1" })).toBeNull();
  });

  it("сохраняет в preview идентификаторы и товарные признаки без цены и себестоимости", () => {
    const preview = normalizeEvotorCatalogPreviewItem({
      id: "product-1",
      name: "Форель",
      code: "F-1",
      barcodes: ["123", "123", "456"],
      measure_name: "дроб",
      tax: "vat10",
      type: "commodity",
      parent_id: "group-1",
      price: 1000,
      cost_price: 700,
    });
    expect(preview).toEqual({ id: "product-1", name: "Форель", code: "F-1", barcodes: ["123", "456"], unit: "дроб", tax: "vat10", vatRate: "VAT_10", type: "commodity", parentId: "group-1" });
    expect(preview).not.toHaveProperty("price");
    expect(preview).not.toHaveProperty("costPrice");
  });
});
