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
  });

  it("делает виды цен компактной раскрываемой настройкой", () => {
    expect(page).toContain('className="packet-card catalog-price-types"');
    expect(page).toContain("Сделать основным");
    expect(page).toContain("Удалить выбранный");
    expect(page).not.toContain("catalog-price-type-list");
  });

  it("разделяет видимость в заявках и отключенную выгрузку Эвотор", () => {
    expect(page).toContain("Заявки");
    expect(page).toContain("Выключена");
    expect(editor).toContain("В заявках");
    expect(editor).toContain("Не выгружать в Эвотор");
    expect(editor).toContain("aria-pressed={visibleInRequests}");
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
  });

  it("сразу подставляет цену для выбранного вида", () => {
    expect(editor).toContain("item.productId === productId && item.priceTypeId === selectedPriceType.id");
    expect(editor).toContain("setPriceTypeId(event.target.value); const next = ((salePrices.data ?? []) as SalePrice[]).find(item => item.productId === productId && item.priceTypeId === Number(event.target.value)); setSalePrice(next?.salePrice ?? \"\");");
  });

  it("не выдает read-only интеграцию Эвотор за работающую выгрузку", () => {
    expect(editor).toContain("Не выгружать в Эвотор");
    expect(editor).toContain("Обратная запись в Эвотор пока не подключена");
  });

  it("объединяет штрихкоды в одном поле и раскрывает алкогольные поля для алкоголя и маркированного пива", () => {
    expect(editor).not.toContain("Штрихкоды Эвотор");
    expect(editor).toContain('marking === "alcohol" || marking === "beer_marked"');
    expect(editor).toContain("Алкокод");
	    expect(editor).toContain("Код вида АП (ФСРАР)");
	    expect(editor).toContain("Крепость, %");
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
		  expect(editor).toContain('placeholder="Например: 0,5"');
      expect(editor).not.toContain("Справочное соответствие V2 · без выгрузки");
      expect(editor).toContain('value={evotorProductTypeByMarking[marking]} readOnly');
	      expect(editor).toContain('aria-readonly="true"');
	      expect(editor).toContain("catalog-grow-expand");
	      expect(css).toContain(".catalog-editor-barcodes.is-expanded");
	      expect(css).toContain(".catalog-editor-grid > label.catalog-alcohol-code { grid-column: auto; max-width: 280px; }");
	      expect(css).toContain(".packet .catalog-editor-action-group");
		});

		it("использует обычные ссылки для самостоятельных маршрутов номенклатуры", () => {
		  expect(page).toContain('href="/catalog-control/new"');
		  expect(page).toContain('href={`/catalog-control/${product.id}/edit`}');
		  expect(editor).toContain('href="/catalog-control"');
		});

		it("сохраняет одну колонку карточки на телефоне и доступное раскрытие кодов", () => {
		  expect(css).toContain(".packet .catalog-grow-expand {\n  position: absolute; z-index: 1; top: 8px; right: 7px; display: inline-grid;");
		  expect(css).toContain(".packet .catalog-editor-grid { grid-template-columns: minmax(0, 1fr); }");
		  expect(css).toContain(".catalog-editor-grid > label.catalog-editor-barcodes.is-expanded,");
		  expect(css).toContain(".packet .catalog-business-id { display: block;");
		  expect(css).toContain("text-overflow: ellipsis;");
		});

		it("перестраивает карточку товара и виды цен до узкой рабочей области sidebar", () => {
		  expect(css).toContain("@media (max-width: 1180px) {");
		  expect(css).toContain(".packet .catalog-price-secondary form { grid-template-columns: minmax(0, 1fr) auto; width: min(100%, 620px); }");
		  expect(css).toContain(".packet .catalog-editor-grid > label.catalog-alcohol-code { grid-column: auto; max-width: 280px; }");
		  expect(css).toContain(".packet .catalog-editor-card > .card-title { flex-direction: column; align-items: stretch; gap: 11px; }");
		  expect(css).toContain(".packet .catalog-editor-title-actions { width: 100%; justify-content: flex-start; }");
		  expect(css).toContain(".packet .catalog-editor-title-actions .catalog-editor-save { grid-column: 1 / -1; width: 100%; }");
		});

		it("показывает бизнес-номер без технического идентификатора в общем списке", () => {
	  expect(page).toContain('data-label="№ / ID / артикул"');
	  expect(page).toContain("№ / ID / артикул: {product.internalCode}");
	  expect(page).not.toContain("ID {product.id} · артикул Эвотор");
	  expect(editor).toContain("№ / ID / артикул:");
	});

	it("превращает широкую таблицу справочника в подписанные карточки на телефоне", () => {
		expect(css).toContain(".catalog-table tbody tr:nth-child(even) { display: grid");
		expect(css).toContain("content: attr(data-label)");
	});

	it("перестраивает широкий справочник в карточки до планшетной ширины", () => {
		expect(css).toContain("@media (max-width: 1400px) {\n  .packet .catalog-table-wrap.data-table-wrap");
		expect(css).toContain("cursor: default !important");
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

	it("держит справочник категорий свернутым и открывает форму создания только явным действием", () => {
		expect(page).toContain('const [showCategoryCreate, setShowCategoryCreate] = useState(false)');
		expect(page).toContain('className="catalog-category-create-action"');
		expect(page).toContain("showCategoryCreate && <form className=\"catalog-category-create\"");
		expect(css).toContain(".packet .catalog-category-create-action");
	});
});
