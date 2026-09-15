import { describe, expect, it } from "vitest";
import { calculatePriceChanges, normalizePrice, normalizeProductName, packagingSignature, productSignature, resolvePriceMapping, sourceDateFromText } from "./priceControl";
import { readFileSync } from "node:fs";

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

  it("имеет защищенную операцию массового назначения существующей категории", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function bulkAssignPriceCategory");
    expect(source).toContain("Выберите активную категорию прайс‑контроля.");
  });

  it("применяет категорию из предпросмотра только к новой выбранной строке, а не к сохраненным товарам", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export type PriceImportCategorySelection = { rowIndex: number; categoryId: number }");
    expect(source).toContain("if (mapping.productId === null && category)");
    expect(source).toContain("Для импорта можно выбрать только активную существующую категорию.");
    expect(source).toContain("createdProducts");
    expect(source).not.toContain("categoryId: category.id }).where(eq(priceProducts.id");
  });

  it("собирает для общего журнала поставщика, исходное название и переход нашего товара", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("supplierName: row.supplierName");
    expect(source).toContain("supplierProductName: row.rawName");
    expect(source).toContain("productLabel: null");
    expect(source).toContain("reassignPriceSupplierAlias");
  });

  it("дает создать поставщика явно, а удалить только при отсутствии истории и связей", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function createPriceSupplier");
    expect(source).toContain("Поставщик «${existing.name}» уже есть в справочнике.");
    expect(source).toContain("export async function deletePriceSupplier");
    expect(source).toContain("Поставщика с сохраненными прайс‑листами или товарными связями удалять нельзя.");
    expect(source).toContain("Скройте его в справочнике");
  });
});
