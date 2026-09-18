import { describe, expect, it } from "vitest";
import { normalizeEvotorCatalogPreviewItem, normalizeEvotorDocumentPreview, normalizeEvotorStore } from "./evotorCatalog";

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
      quantity: 2.5,
      measure_name: "дроб",
      tax: "vat10",
      type: "commodity",
      parent_id: "group-1",
      price: 1000,
      cost_price: 700,
    });
    expect(preview).toEqual({ id: "product-1", name: "Форель", code: "F-1", barcodes: ["123", "456"], quantity: 2.5, unit: "дроб", tax: "vat10", vatRate: "VAT_10", type: "commodity", parentId: "group-1", categoryName: null });
    expect(preview).not.toHaveProperty("price");
    expect(preview).not.toHaveProperty("costPrice");
  });

  it("показывает прочитанное количество Эвотор без скрытого преобразования", () => {
    expect(normalizeEvotorCatalogPreviewItem({ id: "product-2", name: "Товар", quantity: 1_000_000 })?.quantity).toBe(1_000_000);
  });

  it("нормализует только необходимые поля документа и строки без фискальных реквизитов", () => {
    const preview = normalizeEvotorDocumentPreview({
      id: "doc-1", type: "SELL", created_at: "2026-09-18T10:00:00Z", close_date: "2026-09-18T10:01:00Z", device_id: "private-device",
      body: { result_sum: 500, payments: [{ merchant_info: "private" }], positions: [{ uuid: "product-1", product_name: "Форель", quantity: 2, initial_quantity: 8, measure_name: "кг", result_sum: 500, settlement_method: { type: "CHECKOUT_FULL" }, fiscal_sign: "private" }] },
    });
    expect(preview).toEqual({ id: "doc-1", type: "SELL", createdAt: "2026-09-18T10:00:00Z", closedAt: "2026-09-18T10:01:00Z", total: 500, positions: [{ productId: "product-1", productName: "Форель", quantity: 2, initialQuantity: 8, unit: "кг", settlementMethod: "CHECKOUT_FULL", resultSum: 500 }] });
    expect(JSON.stringify(preview)).not.toContain("private");
  });
});
