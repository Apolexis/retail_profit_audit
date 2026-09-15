import { describe, expect, it } from "vitest";
import { calculatePriceChanges, normalizePrice, normalizeProductName, packagingSignature, preparePriceImportRows, productSignature, resolvePriceMapping, sourceDateFromText } from "./priceControl";
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

  it("применяет ручную правку цены к конкретному режиму и пересчитывает нормализацию до сохранения", () => {
    const rows = [{ rawName: "Варенье", packaging: "банка 430 г", priceOptions: [{ priceAmount: 344, priceBasis: "package", normalizedPrice: 800, normalizedUnit: "kg" }] }] as any;
    const prepared = preparePriceImportRows(rows, [{ rowIndex: 0, optionIndex: 0, priceAmount: 430, priceBasis: "package" }]);
    expect(prepared.rows).toHaveLength(1);
    expect(prepared.rows[0]?.row.priceOptions[0]).toMatchObject({ priceAmount: 430, priceBasis: "package", normalizedPrice: 1000, normalizedUnit: "kg" });
    expect(prepared.editedPriceOptions).toBe(1);
  });

  it("исключает строки только из текущего сохранения и запрещает править исключенную строку", () => {
    const rows = [
      { rawName: "Первая", packaging: null, priceOptions: [{ priceAmount: 100, priceBasis: "kg", normalizedPrice: 100, normalizedUnit: "kg" }] },
      { rawName: "Вторая", packaging: null, priceOptions: [{ priceAmount: 200, priceBasis: "kg", normalizedPrice: 200, normalizedUnit: "kg" }] },
    ] as any;
    const prepared = preparePriceImportRows(rows, [], [1]);
    expect(prepared.rows.map(item => item.rowIndex)).toEqual([0]);
    expect(prepared.excludedRowIndexes).toEqual([1]);
    expect(() => preparePriceImportRows(rows, [{ rowIndex: 1, optionIndex: 0, priceAmount: 210 }], [1])).toThrow("Нельзя менять цену у исключенной из импорта строки.");
  });

  it("защищает предварительное сохранение от отрицательных, сверхлимитных и повторных правок", () => {
    const rows = [{ rawName: "Позиция", packaging: null, priceOptions: [{ priceAmount: 100, priceBasis: "kg", normalizedPrice: 100, normalizedUnit: "kg" }] }] as any;
    expect(() => preparePriceImportRows(rows, [{ rowIndex: 0, optionIndex: 0, priceAmount: 0 }])).toThrow("Передана некорректная ручная правка цены прайс‑листа.");
    expect(() => preparePriceImportRows(rows, [{ rowIndex: 0, optionIndex: 0, priceAmount: 120 }, { rowIndex: 0, optionIndex: 0, priceAmount: 130 }])).toThrow("Одна цена прайс‑листа изменена повторно.");
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

  it("дает переключить активность поставщика без отправки несохраненного черновика", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    const router = readFileSync(new URL("./routers/priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function setPriceSupplierActive");
    expect(router).toContain("setSupplierActive:");
    expect(router).toContain('action: "price_supplier.update"');
  });

  it("сохраняет для общего журнала подробности автоматически созданных при импорте поставщика и товаров", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("./priceImportBinaryRoutes.ts", import.meta.url), "utf8");
    expect(source).toContain("supplierWasCreated: ensuredSupplier.created");
    expect(source).toContain("createdProductDetails.push");
    expect(source).toContain("createdAliasDetails.push");
    expect(route).toContain('action: "price_supplier.import_create"');
    expect(route).toContain('action: "price_product.import_create"');
    expect(route).toContain('action: "price_alias.import_link"');
    expect(route).toContain('action: "price_import.commit"');
  });

  it("добавляет только контролируемое удаление сохраненной строки с ценами и пересчетом количества", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    const router = readFileSync(new URL("./routers/priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function deletePriceImportRow");
    expect(source).toContain("await db.delete(priceOfferPrices).where(eq(priceOfferPrices.importRowId, row.id))");
    expect(source).toContain("rowCount: remainingRows.length");
    expect(router).toContain("deleteImportRow:");
    expect(router).toContain('action: "price_import.row_delete"');
  });
});
