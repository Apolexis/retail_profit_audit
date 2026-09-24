import { describe, expect, it } from "vitest";
import { normalizeEvotorCatalogPreviewItem, normalizeEvotorDocumentPreview, normalizeEvotorStore } from "./evotorCatalog";

describe("Эвотор V2: preview номенклатуры", () => {
  it("нормализует только безопасные поля магазина", () => {
    expect(normalizeEvotorStore({ id: "store-1", name: "Точка 1", address: "Адрес", user_id: "private" })).toEqual({ id: "store-1", name: "Точка 1", address: "Адрес" });
    expect(normalizeEvotorStore({ id: "store-1" })).toBeNull();
  });

  it("сохраняет в preview идентификаторы и товарные признаки без цены и себестоимости", () => {
    const preview = normalizeEvotorCatalogPreviewItem({
      id: "product-1", name: "Форель", code: "F-1", barcodes: ["123", "123", "456"], quantity: 2.5, measure_name: "дроб", tax: "vat10", type: "commodity", parent_id: "group-1", price: 1000, cost_price: 700,
    });
    expect(preview).toEqual({ id: "product-1", name: "Форель", code: "F-1", barcodes: ["123", "456"], quantity: 2.5, unit: "дроб", tax: "vat10", vatRate: "VAT_10", type: "commodity", parentId: "group-1", categoryName: null, alcoholCode: null, alcoholTypeCode: null, alcoholStrengthPercent: null, alcoholVolumeLiters: null });
    expect(preview).not.toHaveProperty("price");
    expect(preview).not.toHaveProperty("costPrice");
  });

  it("показывает прочитанное количество Эвотор без скрытого преобразования", () => {
    expect(normalizeEvotorCatalogPreviewItem({ id: "product-2", name: "Товар", quantity: 1_000_000 })?.quantity).toBe(1_000_000);
  });

  it("извлекает явные поля маркированного алкоголя без цен и фискальных данных", () => {
    const preview = normalizeEvotorCatalogPreviewItem({ id: "beer-1", name: "Пиво", type: "BEER_MARKED", alcocodes: { 0: "01234567890123456789" }, alcohol_product_kind_code: 500, alcohol_by_volume: "4,7", tare_volume: "0.45" });
    expect(preview).toMatchObject({ alcoholCode: "01234567890123456789", alcoholTypeCode: "500", alcoholStrengthPercent: 4.7, alcoholVolumeLiters: 0.45 });
    expect(preview).not.toHaveProperty("price");
  });

  it("агрегирует CASH и ELECTRON без реквизитов и частей, вычитая сдачу из наличной оплаты", () => {
    const preview = normalizeEvotorDocumentPreview({
      id: "doc-1", number: "42-7", type: "SELL", created_at: "2026-09-18T10:00:00Z", close_date: "2026-09-18T10:01:00Z", device_id: "private-device",
      body: {
        result_sum: 480,
        discount_amount: 25,
        payments: [
          { type: "CASH", sum: "120.50", change: 20, merchant_info: "private" },
          { type: "ELECTRON", sum: 379.5, parts: [{ part_sum: 379.5, app_id: "private" }] },
        ],
        positions: [{ uuid: "product-1", product_name: "Форель", quantity: 2, initial_quantity: 8, measure_name: "кг", result_sum: 500, settlement_method: { type: "CHECKOUT_FULL" }, fiscal_sign: "private" }],
      },
    });
    expect(preview).toEqual({
      id: "doc-1", receiptNumber: "42-7", type: "SELL", createdAt: "2026-09-18T10:00:00Z", closedAt: "2026-09-18T10:01:00Z", total: 480, discountAmount: 25,
      paymentSummary: { cashAmount: 100.5, cashTenderedAmount: 120.5, cashChangeAmount: 20, cashlessAmount: 379.5, otherPaymentAmount: 0, unknownPaymentAmount: 0, captureStatus: "complete", reconciliationDelta: 0 },
      positions: [{ productId: "product-1", productName: "Форель", quantity: 2, initialQuantity: 8, unit: "кг", settlementMethod: "CHECKOUT_FULL", resultSum: 500 }],
    });
    expect(JSON.stringify(preview)).not.toContain("private");
    expect(JSON.stringify(preview)).not.toContain("part_sum");
  });

  it("не превращает отсутствующие, неизвестные или некорректные оплаты в наличные", () => {
    expect(normalizeEvotorDocumentPreview({ id: "none", type: "SELL", body: { result_sum: 10 } })?.paymentSummary).toEqual({ cashAmount: null, cashTenderedAmount: null, cashChangeAmount: null, cashlessAmount: null, otherPaymentAmount: null, unknownPaymentAmount: null, captureStatus: "unavailable", reconciliationDelta: null });
    expect(normalizeEvotorDocumentPreview({ id: "other", type: "SELL", body: { result_sum: 10, payments: [{ type: "UNKNOWN", sum: 10 }] } })?.paymentSummary).toEqual({ cashAmount: 0, cashTenderedAmount: 0, cashChangeAmount: 0, cashlessAmount: 0, otherPaymentAmount: 0, unknownPaymentAmount: 10, captureStatus: "complete", reconciliationDelta: 0 });
    expect(normalizeEvotorDocumentPreview({ id: "bad", type: "SELL", body: { result_sum: 10, payments: [{ type: "CASH" }] } })?.paymentSummary.captureStatus).toBe("malformed");
    expect(normalizeEvotorDocumentPreview({ id: "bad-change", type: "SELL", body: { result_sum: 10, payments: [{ type: "CASH", sum: 10, change: 11 }] } })?.paymentSummary.captureStatus).toBe("malformed");
  });

  it("выводит только недостающую сдачу из точного баланса CASH и ELECTRON", () => {
    const preview = normalizeEvotorDocumentPreview({
      id: "mixed-change", type: "SELL", body: {
        result_sum: 7_267.84,
        payments: [{ type: "CASH", sum: 500 }, { type: "ELECTRON", sum: 7_000 }],
      },
    });
    expect(preview?.paymentSummary).toEqual({ cashAmount: 267.84, cashTenderedAmount: 500, cashChangeAmount: 232.16, cashlessAmount: 7_000, otherPaymentAmount: 0, unknownPaymentAmount: 0, captureStatus: "complete", reconciliationDelta: 0 });
  });

  it("не подменяет номером чека технический идентификатор и отбрасывает небезопасное значение", () => {
    expect(normalizeEvotorDocumentPreview({ id: "not-a-receipt-number", type: "SELL", body: { result_sum: 10 } })?.receiptNumber).toBeNull();
    expect(normalizeEvotorDocumentPreview({ id: "doc-2", number: "<private>", type: "SELL", body: { result_sum: 10 } })?.receiptNumber).toBeNull();
  });
});
