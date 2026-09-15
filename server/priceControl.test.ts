import { describe, expect, it } from "vitest";
import { calculatePriceChanges, normalizePrice, normalizeProductName, packagingSignature, productSignature, resolvePriceMapping, sourceDateFromText } from "./priceControl";

describe("прайс‑контроль: нормализация товарных строк", () => {
  it("сводит сёмгу, скобки и размерный диапазон к одной товарной сигнатуре", () => {
    expect(normalizeProductName("Лосось 2-3")).toBe("лосось 2-3");
    expect(normalizeProductName("Лосось (2–3)")).toBe("лосось 2-3");
    expect(productSignature("Сёмга 2-3")).toBe(productSignature("Лосось (2–3)"));
    expect(productSignature("Лосось 2-3 Sup")).toBe(productSignature("Лосось 2-3"));
  });

  it("сохраняет фасовку и переводит цену упаковки в цену за килограмм", () => {
    expect(packagingSignature("банка 430 г")).toBe("g430");
    expect(normalizePrice(344, "package", "банка 430 г")).toEqual({ normalizedPrice: 800, normalizedUnit: "kg" });
    expect(normalizePrice(180, "package", "бутылка 500 мл")).toEqual({ normalizedPrice: 360, normalizedUnit: "l" });
  });

  it("распознает дату из русской шапки прайс‑листа", () => {
    expect(sourceDateFromText("14 сентября 2026 года, 38-я неделя")).toBe("2026-09-14");
  });

  it("сначала использует подтвержденную связь конкретного поставщика, а не текстовую догадку", () => {
    const row = { normalizedName: normalizeProductName("Сёмга 2-3"), normalizedSignature: productSignature("Сёмга 2-3"), packagingSignature: "g1000" } as any;
    const aliases = [{ supplierId: 7, productId: 42, normalizedName: row.normalizedName, packagingSignature: "g1000" }];
    const products = [{ id: 12, normalizedSignature: row.normalizedSignature }];
    expect(resolvePriceMapping(row, 7, aliases, products)).toMatchObject({ productId: 42, mappingStatus: "linked", matchedBy: "supplier_alias", matchConfidence: 100 });
  });

  it("предлагает, но не подтверждает автоматически новую сигнатуру", () => {
    const row = { normalizedName: normalizeProductName("Лосось 2-3"), normalizedSignature: productSignature("Лосось 2-3"), packagingSignature: "" } as any;
    expect(resolvePriceMapping(row, 1, [], [{ id: 12, normalizedSignature: row.normalizedSignature }])).toMatchObject({ productId: 12, mappingStatus: "suggested", matchedBy: "signature", matchConfidence: 92 });
  });

  it("считает изменение только относительно предыдущей сопоставимой цены того же поставщика", () => {
    const changes = calculatePriceChanges([
      { priceId: 1, importId: 1, productId: 11, supplierId: 4, priceMode: "standard", normalizedUnit: "kg", normalizedPrice: 800, sourceDate: "2026-09-01", importedAt: new Date("2026-09-01") },
      { priceId: 2, importId: 2, productId: 11, supplierId: 4, priceMode: "standard", normalizedUnit: "kg", normalizedPrice: 920, sourceDate: "2026-09-10", importedAt: new Date("2026-09-10") },
      { priceId: 3, importId: 2, productId: 11, supplierId: 8, priceMode: "standard", normalizedUnit: "kg", normalizedPrice: 760, sourceDate: "2026-09-10", importedAt: new Date("2026-09-10") },
    ]);
    expect(changes.get(2)).toMatchObject({ previousPrice: 800, delta: 120, percent: 15, direction: "up" });
    expect(changes.get(3)).toBeUndefined();
  });
});
