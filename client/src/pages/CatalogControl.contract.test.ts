import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./CatalogControl.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("./CatalogProductEditor.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../catalog-control.css", import.meta.url), "utf8");

describe("общий операционный справочник", () => {
	  it("показывает номенклатуру сетью в таблице, а не набором inline-карточек", () => {
    expect(page).toContain("Общая номенклатура сети");
    expect(page).toContain('className="data-table catalog-table"');
    expect(page).toContain("/catalog-control/new");
    expect(page).toContain("/catalog-control/${product.id}/edit");
	    expect(page).not.toContain("Показать еще");
	    expect(page).toContain('const [catalogSort, setCatalogSort] = useState<CatalogSort>("code")');
	    expect(page).toContain('const toggleCatalogSort = (nextSort: CatalogSort)');
	    expect(page).not.toContain('className="table-sort-button"');
	    expect(page).toContain('className="catalog-sort-heading"');
	    expect(page).toContain('aria-sort={catalogSort === key ? (catalogSortDirection === "asc" ? "ascending" : "descending") : "none"}');
	    expect(page).not.toContain('aria-hidden="true">{catalogSort');
	    expect(page).not.toContain('" ↑"');
	    expect(page).not.toContain('" ↓"');
	    expect(page).not.toContain('" ↕"');
	    expect(page).toContain('className="catalog-directory-controls"');
	    expect(css).toContain(".packet .catalog-directory-controls { display: grid; grid-template-columns: minmax(0, 1fr) minmax(210px, .42fr);");
	    expect(css).toContain(".packet .catalog-table .catalog-sort-heading");
	  });

	  it("делает виды цен компактной раскрываемой настройкой", () => {
	    expect(page).toContain('className="packet-card catalog-price-types"');
	    expect(page).toContain("Сделать основным");
	    expect(page).toContain("Удалить выбранный");
	    expect(page).not.toContain("catalog-price-type-list");
	  });

	  it("ищет номенклатуру сочетанием частей названия и кода", () => {
	    expect(page).toContain("const catalogSearchTokens = (value: string)");
	    expect(page).toContain("const queryTokens = catalogSearchTokens(catalogSearch)");
	    expect(page).toContain("return queryTokens.every(token => haystack.includes(token));");
	    expect(page).toContain('placeholder="Название, код или не полное имя"');
	  });

	it("разделяет видимость в заявках и автоматическую выгрузку Эвотор", () => {
    expect(page).toContain("Заявки");
    expect(page).toContain("Выключена");
    expect(page).toContain("Готов");
    expect(page).not.toContain("Включить автовыгрузку");
    expect(page).not.toContain("Выбрать отфильтрованные");
    expect(page).not.toContain("setCatalogEvotorExportEnabled.useMutation");
    expect(editor).toContain("В заявках");
    expect(editor).toContain("Не выгружать в Эвотор");
    expect(editor).toContain("Выгружать в Эвотор");
    expect(editor).toContain("aria-pressed={visibleInRequests}");
	    expect(editor).toContain("aria-pressed={evotorExportEnabled}");
	  });

		it("включает выгрузку Эвотор для нового товара и сообщает успех только после server mutation", () => {
		  expect(editor).toContain('const [evotorExportEnabled, setEvotorExportEnabled] = useState(true);');
		  expect(editor).toContain('Новая номенклатура по умолчанию включена в автоматическую выгрузку в Эвотор');
		  expect(editor).toContain('const result = await update.mutateAsync({ id: productId, ...payload });');
		  expect(editor).toContain('await refresh();\n        toast.success("Карточка товара сохранена"');
		  expect(editor).toContain('const created = await create.mutateAsync(payload);');
		  expect(editor).toContain('await refresh();\n      toast.success("Товар добавлен в общий справочник"');
		  expect(editor).toContain('disabled={isCardSaving}');
		});

		it("дает удалить товар из активной номенклатуры с сохранением истории", () => {
		  expect(editor).toContain('trpc.inventoryRegistry.archiveCatalogProduct.useMutation');
		  expect(editor).toContain('Удалить из активной номенклатуры');
		  expect(editor).toContain('Исторические пересчеты, документы и общий аудит сохранятся');
		  expect(editor).toContain('setLocation("/catalog-control")');
		});

		it("держит все четыре действия карточки в одной адаптивной строке при достаточной ширине", () => {
		  expect(editor).toContain('className="catalog-editor-action-group"');
		  expect(editor).toContain('В заявках');
		  expect(editor).toContain('Выгружать в Эвотор');
		  expect(editor).toContain('Удалить');
		  expect(editor).toContain('Сохранить');
		  expect(css).toContain('grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));');
		  expect(css).toContain('@media (max-width: 820px)');
		});

		it("не подставляет старый штрихкод обратно после намеренного очистки", () => {
		  expect(editor).toContain("setBarcodes(product.manualBarcodes ?? evotorBarcodes)");
		  expect(editor).toContain("пустое поле после сохранения означает удаление всех штрихкодов");
		  expect(editor).not.toContain("setBarcodes(product.manualBarcodes || evotorBarcodes)");
		});

		it("передает одним сохранением все редактируемые поля карточки", () => {
		  expect(editor).toContain("const payload = { canonicalName: name, baseUnit: unit, vatRate, catalogCategoryId: categoryId");
		  expect(editor).toContain("markingCategory: marking");
		  expect(editor).toContain("manualBarcodes: barcodes");
		  expect(editor).toContain("isVisibleInRequests: visibleInRequests");
		  expect(editor).toContain("isEvotorExportEnabled: evotorExportEnabled");
		  expect(editor).toContain("...alcohol");
		});

	  it("возвращает архивный товар в справочник вместо необратимого исчезновения", () => {
    expect(page).toContain("restoreCatalogProduct");
    expect(page).toContain("Вернуть");
    expect(page).not.toContain("archiveCatalogProduct");
  });

  it("сохраняет тематичные токены и таблицу без коралла в light", () => {
    expect(css).toContain("--catalog-accent: #0a84ff;");
    expect(css).toContain("--catalog-accent: #ff765f;");
    expect(css).toContain(".packet .catalog-table tbody tr:nth-child(even)");
  });

	it("показывает цену выбранного вида в таблице общего справочника", () => {
	  expect(page).toContain("trpc.inventoryRegistry.salePrices.useQuery");
	  expect(page).toContain("Продажная цена");
	  expect(page).toContain("catalog-table-money");
	  expect(page).toContain("formatMoneyRubles");
	  expect(page).not.toContain("maximumFractionDigits: 2");
	});

		  it("сразу подставляет цену для выбранного вида", () => {
		    expect(editor).toContain("item.productId === productId && item.priceTypeId === selectedPriceType.id");
		    expect(editor).toContain("setPriceTypeId(event.target.value); const next = ((salePrices.data ?? []) as SalePrice[]).find(item => item.productId === productId && item.priceTypeId === Number(event.target.value)); setSalePrice(next?.salePrice ?? \"\");");
		    expect(editor).toContain('<ThemedSelect value={catalogCategoryId} onChange={event => setCatalogCategoryId(event.target.value)}>');
		    expect(editor).not.toContain('searchable searchPlaceholder="Найти категорию" value={catalogCategoryId}');
		  });



		it("не требует ручного preview и объясняет правило цены", () => {
			expect(page).not.toContain("previewCatalogEvotorExport.useQuery");
			expect(page).not.toContain("executeCatalogEvotorExport.useMutation");
			expect(page).not.toContain("Показать preview");
			expect(editor).toContain("Цена закупки передается в Эвотор");
			expect(editor).toContain("Цена закупки не передается в Эвотор");
			expect(editor).toContain("catalog-cost-export-toggle");
			expect(css).toContain(".packet .catalog-cost-export-toggle");
		});

			it("объединяет штрихкоды в одном поле и раскрывает алкогольные поля для алкоголя и маркированного пива", () => {
    expect(editor).not.toContain("Штрихкоды Эвотор");
    expect(editor).toContain('marking === "alcohol" || marking === "beer_marked"');
    expect(editor).toContain("Алкокод");
			    expect(editor).toContain("Код вида АП (ФСРАР)");
			    expect(editor).toContain("Крепость, %");
			    expect(editor).toContain('placeholder="Например: 4.3"');
		    expect(editor).toContain("Объем тары, л");
		  expect(editor).toContain("Тип товара Эвотор");
		  expect(editor).toContain('supplement: "DIETARY_SUPPLEMENTS_MARKED"');
		  expect(editor).toContain('seafood_caviar: "CAVIAR_MARKED"');
		  expect(editor).toContain('seafood_canned: "GROCERIES_MARKED"');
		  expect(editor).toContain('beer_marked: "BEER_MARKED"');
		  expect(editor).toContain('beer_non_alcoholic: "NOT_ALCOHOL_BEER_MARKED"');
		  expect(editor).toContain('const alcoholTypeOptions = ["500", "510"] as const;');
			  expect(editor).toContain('setAlcoholTypeCode(isAlcoholProduct ? productKind : "500")');
			  expect(editor).not.toContain('<option value="">Не задан</option>');
			  expect(editor).toContain('catalog-alcohol-code catalog-grow-field${alcoholCodeExpanded');
			  expect(editor).toContain('placeholder="Например: 0.5"');
      expect(editor).not.toContain("Справочное соответствие V2 · без выгрузки");
      expect(editor).toContain('value={evotorProductTypeByMarking[marking]} readOnly');
			  expect(editor).toContain('aria-readonly="true"');
			  expect(editor).toContain("catalog-grow-expand");
			  expect(editor).not.toContain("Процент этилового спирта в напитке");
		  expect(css).toContain(".catalog-editor-barcodes.is-expanded");
	      expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { grid-column: auto; max-width: 280px; }");
	      expect(css).toContain("@media (min-width: 821px) and (max-width: 1400px)");
	      expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-strength,");
	      expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-volume { grid-column: auto; max-width: none; }");
	      expect(css).toContain(".packet .catalog-editor-action-group");
	});

		it("использует обычные ссылки для самостоятельных маршрутов номенклатуры", () => {
		  expect(page).toContain('href="/catalog-control/new"');
		  expect(page).toContain('href={`/catalog-control/${product.id}/edit`}');
		  expect(editor).toContain('href="/catalog-control"');
		});

		it("сохраняет одну колонку карточки на телефоне и доступное раскрытие кодов", () => {
		  expect(css).toContain(".packet .catalog-grow-expand {\n  position: absolute; z-index: 1; top: 8px; right: 7px; display: none;");
		  expect(css).toContain("@media (hover: none), (pointer: coarse) { .packet .catalog-grow-expand { display: inline-grid; } }");
		  expect(css).toContain(".packet .catalog-editor-grid { grid-template-columns: minmax(0, 1fr); }");
		  expect(css).toContain(".catalog-editor-grid > label.catalog-editor-barcodes.is-expanded,");
		  expect(css).toContain(".packet .catalog-business-id { display: block;");
			expect(css).toContain("text-overflow: ellipsis;");
			expect(css).toContain("min-height: 56px;");
			expect(css).toContain(".catalog-editor-action-group > :is(.subtle-button, .packet-link):not(.catalog-editor-save)");
		});

		it("оставляет категории и короткие списки без навязанного поиска", () => {
			expect(editor).toContain('<ThemedSelect value={catalogCategoryId} onChange={event => setCatalogCategoryId(event.target.value)}>');
			expect(editor).not.toContain('catalogCategoryId} searchable');
			expect(editor).not.toContain('searchPlaceholder="Найти категорию"');
		});

		it("перестраивает карточку товара и виды цен до узкой рабочей области sidebar", () => {
			  expect(css).toContain("@media (max-width: 1180px) {");
			  expect(css).toContain(".packet .catalog-price-secondary form { grid-template-columns: minmax(0, 1fr) auto; width: min(100%, 620px); }");
			  expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { grid-column: auto; max-width: 280px; }");
			  expect(css).toContain(".packet .catalog-editor-card > .card-title { flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 11px; }");
			  expect(css).toContain(".packet .catalog-editor-title-actions { width: 100%; justify-content: flex-start; }");
			  expect(css).toContain(".packet .catalog-editor-title-actions .catalog-editor-save { grid-column: 1 / -1; width: 100%; }");
			  expect(css).toContain("@media (max-width: 820px) {");
			  expect(css).toContain(".packet .catalog-editor-grid { grid-template-columns: minmax(0, 1fr); }");
			  expect(css).toContain(".packet .catalog-editor-grid > label.catalog-editor-barcodes.is-expanded,");
			  expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { grid-column: auto; max-width: 280px; }");
			  expect(css).not.toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { grid-column: span 2; }");
			});

			it("раскладывает реестр в две читаемые карточки и выравнивает текст слева", () => {
			  expect(css).toContain("@media (max-width: 1680px)");
			  expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 288px), 1fr))");
			  expect(css).toContain("text-align: left !important");
			});

			it("сохраняет равную поверхность у двух карточек одной средней строки", () => {
			  expect(css).toContain("Two medium-width cards share one surface");
			  expect(css).toContain(".packet .catalog-table tbody { grid-auto-rows: 1fr; }");
			  expect(css).toContain(".packet .catalog-table tbody > tr { height: 100%; background: var(--catalog-card) !important; }");
			});

			it("сохраняет действия одной гибкой строкой, растягивает алкокод и выравнивает интервалы редактора", () => {
		  expect(editor).toContain('className="packet-link catalog-editor-save"');
		  expect(editor).toContain('className={`catalog-alcohol-code catalog-grow-field${alcoholCodeExpanded ? " is-expanded" : ""}`}');
		  expect(css).toContain(".packet .catalog-editor-card { gap: 18px; margin-bottom: 20px; }");
		  expect(css).toContain(".packet .catalog-editor-grid { column-gap: 12px; row-gap: 18px; }");
		  expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { max-width: none; }");
		  expect(css).toContain(".packet .catalog-editor-action-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(172px, 1fr)); flex: 1 1 100%; width: 100%; gap: 8px; justify-content: stretch; }");
		  expect(css).toContain(".packet .catalog-editor-action-group { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }");
		  expect(css).toContain(".packet .catalog-editor-title-actions .catalog-editor-save { grid-column: auto; width: 100%; }");
		  expect(css).toContain(".packet .catalog-editor-title-actions :is(.subtle-button, .catalog-editor-save) { min-height: 40px; height: 40px; }");
		  expect(css).toContain(".packet .catalog-editor-title-actions .catalog-editor-save { margin: 0; }");
		});

		it("показывает бизнес-номер без технического идентификатора в общем списке", () => {
	  expect(page).toContain('data-label="№ / ID / артикул"');
	  expect(page).not.toContain("№ / ID / артикул: {product.internalCode}");
	  expect(page).not.toContain("ID {product.id} · артикул Эвотор");
	  expect(editor).toContain("№ / ID / артикул:");
	});

		it("превращает широкую таблицу справочника в подписанные карточки на телефоне", () => {
			expect(css).toContain(".catalog-table tbody tr:nth-child(even) { display: grid");
			expect(css).toContain("content: attr(data-label)");
		});

		it("вмещает desktop-таблицу в рабочую ширину без mouse-drag", () => {
			expect(page).toContain('className="data-table-wrap catalog-table-wrap" data-drag-scroll="false"');
			expect(css).toContain(".packet .catalog-table-wrap { width: 100%; min-width: 0; overflow: visible; cursor: default;");
			expect(css).toContain(".packet .catalog-table { width: 100%; min-width: 0; max-width: 100%; table-layout: fixed; }");
		});

		it("сохраняет таблицу на широкой области и перестраивает справочник в две колонки на средней", () => {
			expect(css).toContain(".packet .catalog-working-card { display: grid; grid-template-columns: minmax(0, 1fr);");
			expect(css).toContain("@media (max-width: 1680px) {\n  .packet .catalog-table-wrap.data-table-wrap");
			expect(css).toContain("cursor: default !important");
			expect(css).toContain(".packet .catalog-table { display: block; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }");
			expect(css).toContain(".packet .catalog-table tbody { display: grid; width: 100%; min-width: 0; gap: 9px;");
			expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: hidden;");
			expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 288px), 1fr)); align-items: start;");
			expect(css).toContain("justify-items: start;");
			expect(css).toContain("@media (min-width: 1681px)");
		});

	it("оставляет действия списка компактными и доступными", () => {
		expect(page).toContain('className="subtle-button catalog-table-action"');
		expect(page).toContain('aria-label={`Изменить товар: ${product.canonicalName}`}');
		expect(page).toContain('className="catalog-table-action-label">Изменить');
		expect(page).not.toContain("visibleCatalog");
		expect(css).toContain(".packet .catalog-table-action { width: 32px;");
		expect(css).toContain(".packet .catalog-table-action-label { display: none; }");
	});

		  it("сохраняет весовой код fraction, но отображает его как килограммы", () => {
			expect(editor).toContain('<option value="fraction">кг</option>');
			expect(page).toContain('fraction: "кг"');
			expect(editor).not.toContain('<option value="kg">кг</option>');
		});

		it("сохраняет внутреннюю себестоимость при создании товара одним защищенным запросом", () => {
			expect(editor).toContain("const cost = internalCostPrice.trim() ? Number(internalCostPrice) : null;");
			expect(editor).toContain("Введите неотрицательную внутреннюю себестоимость.");
			expect(editor).toContain("internalCostPrice: cost");
			expect(editor).toContain('Цена закупки и продажная цена сохранятся вместе с новым товаром.');
		});

			it("держит справочник категорий свернутым и открывает форму создания только явным действием", () => {
			expect(page).toContain('const [showCategoryCreate, setShowCategoryCreate] = useState(false)');
			expect(page).toContain('className="catalog-category-create-action"');
			expect(page).toContain("showCategoryCreate && <form className=\"catalog-category-create\"");
			expect(page).toContain('className="catalog-price-create"');
			expect(page).toContain('<X size={14}/>Скрыть форму');
			expect(page).toContain('<X size={14}/>Отменить');
			expect(css).toContain(".packet .catalog-category-create-action");
			expect(css).toContain(".packet .catalog-price-secondary form { display: grid; grid-template-columns: minmax(210px, 1fr) auto; gap: 10px; align-items: end; width: min(100%, 640px); min-width: 0; }");
			expect(css).toContain("@media (hover: hover) and (pointer: fine)");
		});

		it("отделяет подпись новой категории от поля единым интервальным ритмом", () => {
			expect(css).toContain(".packet .catalog-category-create > label { display: grid; gap: 6px;");
			expect(css).toContain("text-transform: uppercase;");
		});
});
