import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { calculatePriceChanges, calculatePriceOfferExpiry, deduplicatePdfRows, normalizePackagingDisplay, normalizePlaceContents, normalizePrice, normalizeProductDisplayName, normalizeProductName, packagingSignature, parseDocxTableRows, parseExcel, parsePdfExtractedText, parsePdfPositionedPages, preparePriceImportRows, productSignature, resolvePriceMapping, sourceDateFromText, synchronizePlaceContentsBasis } from "./priceControl";
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

  it("читает Word-строку по ячейкам: цена берется из последней колонки, а не из веса в названии", () => {
    const rows = parseDocxTableRows([[
      ["№", "Наименование", "Цена за 1 банку (руб.) опт"],
      ["", "Варенье из морошки 100 гр.", "270"],
      ["", "Варенье из морошки 250 гр.", "600"],
    ]]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rawName: "Варенье из морошки 100гр", packaging: "100гр" });
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: 270, priceBasis: "package", normalizedPrice: 2700, normalizedUnit: "kg" });
    expect(rows[1]?.priceOptions[0]?.priceAmount).toBe(600);
  });

  it("сохраняет договорную Word-цену как ручную и не наследует соседнюю цену", () => {
    const rows = parseDocxTableRows([[
      ["Форель 1,0 - ПСГ", "Короб, эл. вес", "РФ, ЧФ", "Склад", "550"],
      ["Масляная рыба тушка 1-3 кг", "Мешок, эл. вес", "Китай, Вьетнам", "Подход", "Дог."],
      ["Тунец обрезь в/у", "Короб, 1/20кг", "Таиланд", "Склад", "490"],
    ]]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: 550, priceBasis: "kg" });
    expect(rows[1]?.priceOptions[0]).toMatchObject({ priceAmount: null, priceBasis: "kg", sourcePriceText: "Дог." });
    expect(rows[2]?.priceOptions[0]).toMatchObject({ priceAmount: 490, priceBasis: "kg", normalizedPrice: 490 });
  });

  it("импортирует все самостоятельные ценовые колонки Excel, но не надбавку мелкого опта", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Наименование", "Фасовка", "Наличные", "Безнал без НДС", "Безнал с НДС 22%", "Мелкий ОПТ до 100 кг плюс к цене"],
      ["Икра горбуши", "125гр", "1500", "1550", "1600", "50"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Прайс");
    const rows = parseExcel(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.priceOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ priceAmount: 1500, priceMode: "cash" }),
      expect.objectContaining({ priceAmount: 1550, priceMode: "cashless_no_vat" }),
      expect.objectContaining({ priceAmount: 1600, priceMode: "cashless_vat", includesVat: true }),
    ]));
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: 1600, priceMode: "cashless_vat" });
    expect(rows[0]?.priceOptions).toHaveLength(3);
  });

  it("сохраняет цену из наличной и безналичных колонок за кг, а коробку и фасовку — в составе места", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Наименование", "Коробка", "Наличные", "Безнал без НДС", "Безнал с НДС 22%", "Фасовка/навеска кг/шт", "Мелкий ОПТ до 100 кг плюс к цене"],
      ["Конечности краба Стригуна", "8 кг", "1350", "1500", "-", "250г", "100"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Прайс");
    const rows = parseExcel(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ packaging: "250гр", placeContents: "1/8кг/250гр" });
    expect(rows[0]?.priceOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ priceAmount: 1350, priceBasis: "kg", priceMode: "cash" }),
      expect.objectContaining({ priceAmount: 1500, priceBasis: "kg", priceMode: "cashless_no_vat" }),
    ]));
    expect(rows[0]?.priceOptions).toHaveLength(2);
  });

  it("выводит состав места из тары в названии, когда отдельной колонки коробки нет", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Наименование товара", "размер и вес", "Цена, руб/кг с НДС"],
      ["Палтус тушка, тара 21 кг", "XL", "1070"],
      ["Филе тресковых пород, 5 и 7 кг", "90-110", "510"],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Прайс");
    const rows = parseExcel(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })));
    expect(rows.map(row => row.placeContents)).toEqual(["1/21кг", "1/5кг/7кг"]);
    expect(rows.every(row => row.priceOptions[0]?.priceBasis === "kg")).toBe(true);
  });

  it("читает Word-колонку коробки как состав места, не меняя килограммовую цену", () => {
    const rows = parseDocxTableRows([[
      ["Тунец филе", "Короб, 1/25кг", "Таиланд", "Склад", "770"],
    ]]);
    expect(rows[0]).toMatchObject({ packaging: "Короб, 1/25кг", placeContents: "1/25кг" });
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: 770, priceBasis: "kg" });
  });

  it("не принимает фасовку и квант PDF за цену и записывает квант как состав места", () => {
    const pages = [[
      { x: 35, y: 700, value: "Наименование", width: 59 }, { x: 297, y: 700, value: "Фасовка", width: 33 }, { x: 362, y: 700, value: "Цена, руб. (с НДС 5%)", width: 84 }, { x: 485, y: 700, value: "Квант (шт/кор.)", width: 61 },
      { x: 35, y: 670, value: "Варенье из морошки", width: 88 }, { x: 306, y: 670, value: "95 г", width: 15 }, { x: 387, y: 670, value: "258,00 ₽", width: 34 }, { x: 503, y: 670, value: "20 шт.", width: 25 },
    ]];
    const row = parsePdfPositionedPages(pages as any)[0];
    expect(row).toMatchObject({ rawName: "Варенье из морошки", packaging: "95гр", placeContents: "1/20шт" });
    expect(row?.priceOptions).toEqual([expect.objectContaining({ priceAmount: 258, priceBasis: "package", priceMode: "cashless_vat" })]);
  });

  it("компактно нормализует единицы, дроби и лишние пробелы в названии без склейки слов", () => {
    expect(normalizeProductDisplayName("Икра нерки соленая мороженая , б ез консерванта 500 гр.")).toBe("Икра нерки соленая мороженая, без консерванта 500гр");
    expect(normalizeProductDisplayName("Креветка 0,5 л; 13 шт")).toBe("Креветка 0.5л; 13шт");
  });

  it("унифицирует состав места с явной единицей и без служебного слова «короб»", () => {
    expect(normalizePlaceContents("4 кг (короб) 500 гр")).toBe("1/4кг/500гр");
    expect(normalizePlaceContents("1/12.5")).toBe("1/12.5кг");
    expect(normalizePlaceContents("1/24", "Икра щуки ст.б. 100гр")).toBe("1/24шт");
  });

  it("меняет базовую единицу только у простого состава места и сохраняет составную фасовку", () => {
    expect(synchronizePlaceContentsBasis("1/13шт", "kg")).toBe("1/13кг");
    expect(synchronizePlaceContentsBasis("1/12.5кг", "piece")).toBe("1/12.5шт");
    expect(synchronizePlaceContentsBasis("1/4кг/500гр", "piece")).toBe("1/4кг/500гр");
    expect(synchronizePlaceContentsBasis("1/36шт/210гр", "kg")).toBe("1/36шт/210гр");
  });

  it("склеивает фрагменты одного PDF-слова по нулевому промежутку, но сохраняет пробел между словами", () => {
    const pages = [[
      { x: 20, y: 700, value: "Наименование", width: 72 }, { x: 260, y: 700, value: "Цена", width: 28 },
      { x: 20, y: 670, value: "Суп Ла", width: 31 }, { x: 51, y: 670, value: "кс", width: 11 }, { x: 62, y: 670, value: "а", width: 5 },
      { x: 260, y: 670, value: "363 ₽ кг", width: 38 },
    ]];
    expect(parsePdfPositionedPages(pages as any)[0]?.rawName).toBe("Суп Лакса");
  });

  it("не теряет строки продолжения над новой шапкой следующей PDF-страницы и собирает многострочное имя с ценой отдельной строкой", () => {
    const pages = [
      [
        { x: 20, y: 700, value: "Наименование", width: 72 }, { x: 260, y: 700, value: "Цена", width: 28 },
        { x: 20, y: 670, value: "Креветка шримс 60/100", width: 110 }, { x: 260, y: 670, value: "1 200 ₽ кг", width: 52 },
      ],
      [
        { x: 20, y: 700, value: "Креветка шримс 80/100", width: 110 }, { x: 260, y: 700, value: "1 100 ₽ кг", width: 52 },
        { x: 20, y: 620, value: "Наименование", width: 72 }, { x: 260, y: 620, value: "Цена", width: 28 },
        { x: 20, y: 590, value: "Чебуреки с кальмаром", width: 120 },
        { x: 20, y: 578, value: "и креветкой", width: 58 }, { x: 260, y: 584, value: "450 ₽ кг", width: 44 },
      ],
    ];
    const rows = parsePdfPositionedPages(pages as any);
    expect(rows.map(row => row.rawName)).toEqual([
      "Креветка шримс 60/100",
      "Креветка шримс 80/100",
      "Чебуреки с кальмаром и креветкой",
    ]);
    expect(rows[1]?.priceOptions[0]).toMatchObject({ priceAmount: 1100, priceBasis: "kg" });
    expect(rows[2]?.priceOptions[0]).toMatchObject({ priceAmount: 450, priceBasis: "kg" });
  });

  it("сохраняет многострочную позицию перед блоком доставки и не добавляет служебный текст к названию", () => {
    const pages = [[
      { x: 20, y: 700, value: "Наименование", width: 72 }, { x: 260, y: 700, value: "Цена", width: 28 },
      { x: 20, y: 670, value: "Чебуреки с кальмаром и креветкой", width: 160 },
      { x: 20, y: 658, value: "обжаренные во фритюре", width: 112 }, { x: 260, y: 664, value: "450 ₽ кг", width: 44 },
      { x: 20, y: 600, value: "УСЛОВИЯ ДОСТАВКИ СО СКЛАДА МОСКВЫ", width: 190 },
      { x: 20, y: 585, value: "Бесплатная доставка", width: 100 },
    ]];
    const row = parsePdfPositionedPages(pages as any)[0];
    expect(row?.rawName).toBe("Чебуреки с кальмаром и креветкой обжаренные во фритюре");
    expect(row?.priceOptions[0]).toMatchObject({ priceAmount: 450, priceBasis: "kg" });
  });

  it("очищает производителя от доставки и приводит состав места PDF к единому виду", () => {
    const pages = [[
      { x: 20, y: 700, value: "Наименование", width: 72 }, { x: 145, y: 700, value: "Производитель", width: 82 }, { x: 210, y: 700, value: "Вес места", width: 56 }, { x: 280, y: 700, value: "Цена", width: 28 },
      { x: 20, y: 670, value: "Чебуреки с кальмаром", width: 132 }, { x: 150, y: 670, value: "Экспрод, Холодная доставка.", width: 142 }, { x: 214, y: 670, value: "4 кг (короб) 500 гр", width: 104 }, { x: 280, y: 670, value: "450 ₽ кг", width: 44 },
    ]];
    const row = parsePdfPositionedPages(pages as any)[0];
    expect(row?.manufacturer).toBe("Экспрод");
    expect(row?.placeContents).toBe("1/4кг/500гр");
  });

  it("объединяет точные дубликаты PDF-строк и не теряет отличающийся вариант цены", () => {
    const template = { sourceSheet: "PDF", sourceRowNumber: 1, sourceSku: null, rawName: "Крабовые палочки КВЭН", normalizedName: "крабовые палочки квэн", canonicalHint: "Крабовые палочки КВЭН", normalizedSignature: "крабовые палочки квэн", category: null, packaging: "200гр", packagingSignature: "g200", manufacturer: "Квэн", placeContents: "1/12", manufacturedOn: null, shelfLifeMonths: null, expiresOn: null, availability: null, variant: null, sizeText: null, rawPayload: {} } as any;
    const first = { ...template, priceOptions: [{ priceAmount: 187, priceBasis: "piece", normalizedPrice: 187, normalizedUnit: "piece", priceMode: "cashless_vat", market: "spb", minimumQuantityKg: null, includesVat: true, sourcePriceText: "187" }] };
    const second = { ...template, sourceRowNumber: 2, priceOptions: [{ ...first.priceOptions[0], priceAmount: 195, normalizedPrice: 195, market: "moscow", sourcePriceText: "195" }] };
    const result = deduplicatePdfRows([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0]?.priceOptions).toHaveLength(2);
  });

  it("рассчитывает дату годности по дате изготовления и выбранному сроку, включая конец месяца", () => {
    expect(calculatePriceOfferExpiry("2026-01-31", 1)).toBe("2026-02-28");
    expect(calculatePriceOfferExpiry("2026-08-15", 18)).toBe("2028-02-15");
    expect(calculatePriceOfferExpiry("2026-08-15", 5)).toBeNull();
  });

  it("распознает дату из русской шапки прайс‑листа", () => {
    expect(sourceDateFromText("14 сентября 2026 года, 38-я неделя")).toBe("2026-09-14");
  });

  it("сохраняет приоритет даты шапки над более поздними датами таблицы PDF", () => {
    const headerBeforeTable = "Санкт-Петербург · 09.09.2026 · Оптовый прайс-лист\nТаблица: годен до 05.03.2026";
    expect(sourceDateFromText(headerBeforeTable)).toBe("2026-09-09");
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

  it("создает ручное предложение через общий контур строк и цен, а не через финансовый импорт", () => {
    const source = readFileSync(new URL("./priceControl.ts", import.meta.url), "utf8");
    const router = readFileSync(new URL("./routers/priceControl.ts", import.meta.url), "utf8");
    expect(source).toContain("export async function createManualPriceOffer");
    expect(source).toContain('sourceType: "manual"');
    expect(source).toContain('sourceSheet: "manual"');
    expect(source).toContain('sourcePriceText: "Введено вручную"');
    expect(source).toContain("const normalized = normalizePrice(input.priceAmount, input.priceBasis, rawPackaging)");
    expect(router).toContain("createManualOffer: protectedProcedure.input");
    expect(router).toContain('action: "price_offer.create"');
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
    const rows = [{ rawName: "Палтус", packaging: "21кг", priceOptions: [{ priceAmount: 530, priceBasis: "kg", priceMode: "cashless_vat", market: "moscow", normalizedPrice: 530, normalizedUnit: "kg" }] }] as any;
    const prepared = preparePriceImportRows(rows, [{ rowIndex: 0, optionIndex: 0, priceAmount: 525, priceMode: "cashless_vat", market: "spb" }]);
    expect(prepared.rows[0]?.row.priceOptions[0]).toMatchObject({ priceAmount: 525, priceMode: "cashless_vat", market: "spb", normalizedPrice: 525, normalizedUnit: "kg" });
  });

  it("сохраняет дату изготовления, допустимый срок и рассчитанную дату годности только для текущей строки preview", () => {
    const rows = [{ rawName: "Икра", packaging: "125гр", manufacturer: null, placeContents: "1/12", manufacturedOn: null, shelfLifeMonths: null, expiresOn: null, priceOptions: [{ priceAmount: 1800, priceBasis: "piece", priceMode: "cashless_vat", market: "spb", normalizedPrice: 1800, normalizedUnit: "piece" }] }] as any;
    const prepared = preparePriceImportRows(rows, [], [], [], [{ rowIndex: 0, manufacturer: "Рыбак", placeContents: "1/12", manufacturedOn: "2026-09-15", shelfLifeMonths: 6, expiresOn: "2027-03-15" }]);
    expect(prepared.rows[0]?.row).toMatchObject({ manufacturer: "Рыбак", placeContents: "1/12кг", manufacturedOn: "2026-09-15", shelfLifeMonths: 6, expiresOn: "2027-03-15" });
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
    expect(rows[0]).toMatchObject({ rawName: "Икра щуки соленая мороженная (пл.б, вакуум, ключ, 200гр) Камшат 56шт (короб) 200гр", packaging: "200гр" });
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
    expect(rows[0]?.rawName).toBe("Икра горбуши Икра горбуши путина Рыбак 1/12.5");
    expect(rows[0]?.rawName).not.toMatch(/^1\s/);
    expect(rows[0]?.priceOptions[0]?.priceAmount).toBe(195);
  });

  it("очищает PDF‑имя от служебного года, НДС и приватного маркера шрифта, но сохраняет полезную фасовку", () => {
    const rows = parsePdfExtractedText([
      "Наименование Производитель Упаковка Цена",
      "с НДС Изменение Остаток Медиа",
      " Икра щуки соленая мороженная 2026 Камшат 6 шт (короб) 500 г 2 950 ₽ шт",
    ].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rawName: "Икра щуки соленая мороженная Камшат 6шт (короб) 500гр", packaging: "500гр" });
    expect(rows[0]?.rawName).not.toMatch(/[\uE000-\uF8FF]|\b2026\b|НДС/i);
  });

  it("не принимает нулевую и годовую псевдофасовку PDF за вес товара", () => {
    const rows = parsePdfExtractedText([
      "Наименование Производитель Упаковка Цена",
      "с НДС Изменение Остаток Медиа",
      "Палтус тушка 000 г 2025г 1 350 ₽ кг",
    ].join("\n"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rawName: "Палтус тушка", packaging: null });
  });

  it("разбирает общую PDF-таблицу по координатам: исключает спецификацию и не берет цену соседней позиции", () => {
    const rows = parsePdfPositionedPages([[
      { x: 25, y: 400, value: "Наименование" }, { x: 182, y: 400, value: "Спецификация" }, { x: 289, y: 400, value: "Производитель" }, { x: 347, y: 400, value: "Упаковка" }, { x: 444, y: 400, value: "Цена" }, { x: 444, y: 388, value: "с НДС" },
      { x: 67, y: 360, value: "Икра горбуши" }, { x: 99, y: 360, value: "пл/б 125 гр" }, { x: 131, y: 360, value: "Икра горбуши, QR Честный знак, пл. банка 125 гр, 2026" }, { x: 287, y: 360, value: "Красный Жемчуг" }, { x: 354, y: 360, value: "1/24" }, { x: 392, y: 360, value: "1 966" }, { x: 405, y: 360, value: "(в СПб)" }, { x: 458, y: 360, value: "15 730 за 1 кг" },
      { x: 67, y: 340, value: "Икра нерки" }, { x: 99, y: 340, value: "пл/б 125 гр" }, { x: 131, y: 340, value: "Икра нерки, QR Честный знак" }, { x: 287, y: 340, value: "Красный Жемчуг" }, { x: 354, y: 340, value: "1/24" }, { x: 392, y: 340, value: "1 879" }, { x: 405, y: 340, value: "(в СПб)" },
    ]]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rawName: "Икра горбуши пл/б 125гр", packaging: "125гр", manufacturer: "Красный Жемчуг", placeContents: "1/24шт" });
    expect(rows[0]?.rawPayload).toMatchObject({ manufacturer: "Красный Жемчуг", specification: "Икра горбуши, QR Честный знак, пл. банка 125 гр, 2026" });
    expect(rows[0]?.priceOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ priceAmount: 1966, priceMode: "cashless_vat", market: "spb", priceBasis: "package", includesVat: true }),
      expect.objectContaining({ priceAmount: 15730, priceBasis: "kg", includesVat: true }),
    ]));
    expect(rows[1]?.priceOptions[0]).toMatchObject({ priceAmount: 1879, priceBasis: "kg", includesVat: true });
  });

  it("для любой одиночной неявной цены PDF использует ₽/кг, но сохраняет базы при нескольких или явных ценах", () => {
    const rows = parsePdfPositionedPages([[
      { x: 25, y: 400, value: "Наименование" }, { x: 250, y: 400, value: "Цена" }, { x: 250, y: 388, value: "с НДС" },
      { x: 25, y: 360, value: "Мясо краба" }, { x: 255, y: 360, value: "4 750" },
      { x: 25, y: 330, value: "Икра горбуши 125гр" }, { x: 255, y: 330, value: "1 966 (в СПб) 15 730 за 1 кг" },
    ]]);
    const crab = rows.find(row => row.rawName === "Мясо краба");
    const caviar = rows.find(row => row.rawName === "Икра горбуши 125гр");
    expect(crab?.priceOptions).toEqual([expect.objectContaining({ priceAmount: 4750, priceBasis: "kg", includesVat: true })]);
    expect(caviar?.priceOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ priceAmount: 1966, priceBasis: "package", market: "spb" }),
      expect.objectContaining({ priceAmount: 15730, priceBasis: "kg" }),
    ]));
  });

  it("читает двухколоночную таблицу «Номенклатура / цена» с обозначением рубля «Р» и ее продолжение на следующей странице", () => {
    const rows = parsePdfPositionedPages([
      [
        { x: 218, y: 700, value: "НОМЕНКЛАТУРА" }, { x: 482, y: 700, value: "цена" },
        { x: 71, y: 680, value: "Лосось атл. Мурманск филе" }, { x: 477, y: 680, value: "1 240 Р" },
      ],
      [
        { x: 71, y: 700, value: "Форель морская Мурманск филе" }, { x: 477, y: 700, value: "1 010 Р" },
      ],
    ]);
    expect(rows.map(row => row.rawName)).toEqual(["Лосось атл. Мурманск филе", "Форель морская Мурманск филе"]);
    expect(rows.map(row => row.priceOptions[0])).toEqual([
      expect.objectContaining({ priceAmount: 1240, priceBasis: "kg" }),
      expect.objectContaining({ priceAmount: 1010, priceBasis: "kg" }),
    ]);
  });

  it("сохраняет строку PDF без цены для ручного заполнения и исключает спецификацию из имени", () => {
    const rows = parsePdfPositionedPages([[
      { x: 25, y: 400, value: "Наименование" }, { x: 246, y: 400, value: "Производитель" }, { x: 330, y: 400, value: "Упаковка" }, { x: 396, y: 400, value: "Цена" }, { x: 394, y: 388, value: "с НДС" },
      { x: 25, y: 360, value: "Икра горбуши соленая мороженая" }, { x: 25, y: 348, value: "(пл.б, вакуум, ключ, 210 г) 2026" }, { x: 258, y: 360, value: "ТМ Даллос" }, { x: 340, y: 348, value: "210 г" }, { x: 387, y: 360, value: "по запросу" },
    ]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rawName: "Икра горбуши соленая мороженая", packaging: "210гр", manufacturer: "ТМ Даллос", placeContents: "1/210гр" });
    expect(rows[0]?.priceOptions[0]).toMatchObject({ priceAmount: null, sourcePriceText: "по запросу", includesVat: true });
  });

  it("показывает фасовку «уп.» как «шт.» и использует ее как единицу цены за штуку", () => {
    expect(normalizePackagingDisplay("6 уп. (короб)")).toBe("6шт (короб)");
    expect(packagingSignature("6 уп. (короб)")).toBe("pc6");
  });

  it("продолжает разбор общей PDF-таблицы на странице без повторенной шапки", () => {
    const rows = parsePdfPositionedPages([
      [
        { x: 25, y: 400, value: "Наименование" }, { x: 240, y: 400, value: "Производитель" }, { x: 330, y: 400, value: "Вес места" }, { x: 415, y: 400, value: "Цена" },
        { x: 25, y: 360, value: "Палтус тушка" }, { x: 245, y: 360, value: "Даллос" }, { x: 340, y: 360, value: "1/21 кг" }, { x: 420, y: 360, value: "530 ₽/кг" },
      ],
      [
        { x: 25, y: 362, value: "Треска филе" }, { x: 245, y: 362, value: "Даллос" }, { x: 340, y: 362, value: "1/12.5 кг" }, { x: 420, y: 362, value: "680 ₽/кг" },
      ],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ rawName: "Треска филе", manufacturer: "Даллос", placeContents: "1/12.5кг" });
    expect(rows[1]?.priceOptions[0]).toMatchObject({ priceAmount: 680, priceBasis: "kg" });
  });
});
