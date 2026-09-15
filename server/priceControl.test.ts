import { describe, expect, it } from "vitest";
import { calculatePriceChanges, normalizePackagingDisplay, normalizePrice, normalizeProductName, packagingSignature, parsePdfExtractedText, preparePriceImportRows, productSignature, resolvePriceMapping, sourceDateFromText } from "./priceControl";
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

  it("сохраняет подтвержденную связь при другой фасовке, если у названия один внутренний товар", () => {
    const row = { normalizedName: normalizeProductName("Палтус тушка"), normalizedSignature: productSignature("Палтус тушка"), packagingSignature: "g23000" } as any;
    const aliases = [{ supplierId: 7, productId: 42, normalizedName: row.normalizedName, packagingSignature: "g21000" }];
    expect(resolvePriceMapping(row, 7, aliases, [])).toMatchObject({ productId: 42, mappingStatus: "linked", matchedBy: "supplier_alias", matchConfidence: 100 });
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

  it("сохраняет вручную уточненный город предложения вместе с ценой", () => {
    const rows = [{ rawName: "Палтус", packaging: "21 кг", priceOptions: [{ priceAmount: 530, priceBasis: "kg", priceMode: "moscow", normalizedPrice: 530, normalizedUnit: "kg" }] }] as any;
    const prepared = preparePriceImportRows(rows, [{ rowIndex: 0, optionIndex: 0, priceAmount: 525, priceMode: "spb" }]);
    expect(prepared.rows[0]?.row.priceOptions[0]).toMatchObject({ priceAmount: 525, priceMode: "spb", normalizedPrice: 525, normalizedUnit: "kg" });
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

  it("применяет исправленное имя только к текущей импортной строке и пересчитывает ее сигнатуру", () => {
    const rows = [{ rawName: "Семга 2-3", normalizedName: normalizeProductName("Семга 2-3"), normalizedSignature: productSignature("Семга 2-3"), canonicalHint: "Семга 2-3", variant: null, sizeText: "2-3", packaging: null, priceOptions: [{ priceAmount: 100, priceBasis: "kg", normalizedPrice: 100, normalizedUnit: "kg" }] }] as any;
    const prepared = preparePriceImportRows(rows, [], [], [{ rowIndex: 0, rawName: "Лосось 2-3" }]);
    expect(prepared.rows[0]?.row).toMatchObject({ rawName: "Лосось 2-3", normalizedName: "лосось 2-3", normalizedSignature: productSignature("Лосось 2-3") });
    expect(prepared.editedNames).toBe(1);
    expect(() => preparePriceImportRows(rows, [], [0], [{ rowIndex: 0, rawName: "Лосось 2-3" }])).toThrow("Нельзя менять название исключенной из импорта строки.");
  });

  it("дает явно связать строку с существующим товаром и сохраняет связь поставщика в общем журнале", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    const route = readFileSync(new URL("./priceImportBinaryRoutes.ts", import.meta.url), "utf8");
    expect(source).toContain("productLinks?: PriceImportProductLink[]");
    expect(source).toContain("Для связанной позиции нельзя одновременно назначать новую категорию.");
    expect(source).toContain("explicitlyLinked += 1");
    expect(route).toContain("productLinks: Array<{ rowIndex: number; productId: number }>");
    expect(route).toContain("explicitlyLinked: result.explicitlyLinked");
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

  it("собирает многострочную товарную строку PDF Даллос, но не добавляет в имя НДС, фасовку и служебные фрагменты", () => {
    const rows = parsePdfExtractedText([
      "| Икра щуки весовая / фасованная",
      "Наименование Производитель Упаковка Цена",
      "с НДС Изменение Остаток Медиа",
      "Икра щуки соленая мороженная",
      "(пл.б, вакуум, ключ, 200 г) Камшат 56 шт (короб) 200 г 1 270 ₽ кг −",
      "Условия доставки по Москве",
      "500 г",
    ].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rawName: "Икра щуки соленая мороженная (пл.б, вакуум, ключ, 200 г) Камшат 56 шт (короб) 200 г", packaging: "200 г" });
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: 1270, priceBasis: "kg" });
  });

  it("исключает порядковый номер RedGM из имени, связывает его с городской ценой и не принимает заголовки секций за товары", () => {
    const rows = parsePdfExtractedText([
      "RedGM",
      "1 Икра горбуши 2026",
      "Икра горбуши путина 2026 Рыбак 1/12,5 с НДС",
      "2026 ИКРА НЕРКИ 2026",
      "195 (в СПБ)",
    ].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rawName).toBe("Икра горбуши 2026 Икра горбуши путина 2026 Рыбак 1/12,5 с НДС");
    expect(rows[0]?.rawName).not.toMatch(/^1\s/);
    expect(rows[0]?.priceOptions[0]?.priceAmount).toBe(195);
  });

  it("показывает фасовку «уп.» как «шт.» и использует ее как единицу цены за штуку", () => {
    expect(normalizePackagingDisplay("6 уп. (короб)")).toBe("6 шт (короб)");
    expect(packagingSignature("6 уп. (короб)")).toBe("pc6");
  });
});
