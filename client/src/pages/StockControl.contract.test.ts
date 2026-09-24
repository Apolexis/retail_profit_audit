import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./StockControl.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../stock-control.css", import.meta.url), "utf8");

describe("интерфейс операционных остатков", () => {
  it("отделяет остатки от ревизии и открывает выбранную строку в пересчете", () => {
    expect(page).toContain("Остатки магазинов");
    expect(page).toContain("«Не посчитан» — это не ноль");
    expect(page).toContain("сразу открывает черновик инвентаризации выбранного магазина и товара");
    expect(page).toContain("Новая ревизия");
    expect(page).toContain("Изменить в пересчете");
    expect(page).toContain('href={revisionHref(item)}');
    expect(page).toContain('new URLSearchParams({ store: String(item.storeId), product: String(item.productId) })');
    expect(page).not.toContain("stock-adjust-dialog");
  });

		  it("дает выбрать одну точку или смотреть все доступные, с поиском и постраничной загрузкой", () => {
		    expect(page).toContain("Все доступные магазины");
		    expect(page).toContain('searchable searchPlaceholder="Найти магазин"');
		    expect(page).toContain('<label>Категория<ThemedSelect value={category}');
		    expect(page).not.toContain('searchable searchPlaceholder="Найти категорию"');
		    expect(page).toContain("Название, код или не полное имя");
	    expect(page).toContain("Показать еще");
		    expect(page).toContain("trpc.inventoryRegistry.stock");
		    expect(page).toContain('sort, direction');
		    expect(page).toContain('const toggleStockSort = (nextSort: StockSort)');
		    expect(page).toContain('className="stock-sort-heading"');
		    expect(page).not.toContain('className="table-sort-button"');
    expect(page).not.toContain('aria-sort={sort === key ? (direction === "asc" ? "ascending" : "descending") : "none"}');
    expect(page).not.toContain('tabIndex={0}');
	    expect(page).toContain('<label>Порядок<ThemedSelect value={`${sort}:${direction}`}');
	  });

	it("показывает продажную цену без раскрытия себестоимости и помещает поиск справа", () => {
    expect(page).toContain("внутренняя себестоимость не раскрывается");
    expect(page).toContain("Продажная цена");
    expect(page).toContain("Сумма по цене");
    expect(css).toContain(".packet .stock-search > svg { position: absolute; right: 10px;");
    expect(page).toContain('className="data-table-wrap stock-table-wrap" data-drag-scroll="false"');
    expect(css).toContain('.packet .stock-table-wrap { width: 100%; min-width: 0; overflow: visible; cursor: default;');
	  expect(css).toContain('--stock-accent: var(--packet-accent);');
	  expect(css).toContain('no page-local palette is introduced');
	  expect(css).toContain('--stock-card: #f7fbff;');
	  expect(css).toContain('--stock-panel: #edf6ff;');
	  expect(css).toContain('--stock-card: #16101a;');
	  expect(css).toContain('--stock-panel: #1c1420;');
		  expect(css).toContain('--stock-accent: #ff765f;');
		  expect(page).toContain("ИТОГО ПО ФИЛЬТРУ");
		  expect(page).toContain("const [loadedItems, setLoadedItems]");
		  expect(page).toContain("<tbody>{listedItems.map");
		  expect(page).toContain('stock.isFetching ? "Загружаем…" : "Показать еще"');
		  expect(page).toContain('className="table-total stock-table-total"');
		  expect(css).toContain(".packet .stock-table.data-table tfoot .stock-table-total");
		  expect(page).toContain("formatMoneyRubles");
		  expect(page).not.toContain("maximumFractionDigits: 2");
		});

		it("на узком экране заменяет широкую таблицу подписанными карточками", () => {
		  expect(page).toContain('data-label="Учетный остаток"');
		  expect(page).toContain('data-label="Действие"');
		  expect(css).toContain(".stock-table.data-table tbody tr:nth-child(even) { display: grid");
	  expect(css).toContain("content: attr(data-label)");
		  expect(css).toContain("@media (max-width: 1680px)");
		  expect(css).toContain(".stock-table-wrap.data-table-wrap { overflow: visible !important; cursor: default !important;");
		});

		it("не обрезает длинные названия магазина и категории в карточном режиме", () => {
		  expect(css).toContain(".packet .stock-table td:nth-child(3),\n  .packet .stock-table td:nth-child(9) { grid-column: 1 / -1; }");
		  expect(css).toContain(".packet .stock-table td:nth-child(2),\n  .packet .stock-table td:nth-child(3) { overflow-wrap: anywhere; word-break: normal; }");
		  expect(css).toContain(".packet .stock-table td:nth-child(4) small { overflow-wrap: anywhere; }");
		});

		it("не даёт implicit grid-track растянуть mobile-карточку шире контейнера", () => {
		  expect(css).toContain(".packet .stock-table-card {\n  grid-template-columns: minmax(0, 1fr);");
		  expect(css).toContain(".packet .stock-table-card > * { min-width: 0; max-width: 100%; }");
			  expect(css).toContain(".packet .stock-controls { display: grid; grid-template-columns: minmax(170px, .65fr) minmax(180px, .72fr) minmax(220px, 1.08fr) minmax(210px, .78fr); width: 100%; min-width: 0;");
			  expect(css).toContain(".packet .stock-table { display: block; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }");
			  expect(css).toContain(".packet .stock-table tbody { display: grid; width: 100%; min-width: 0; gap: 9px; }");
			  expect(css).toContain("display: grid; width: 100%; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr));");
			  expect(css).toContain(".packet .stock-table .stock-sort-heading");
			  expect(css).not.toContain(".packet .stock-table .table-sort-button");
			});

		it("перестраивает фильтры в две колонки до узкой рабочей области", () => {
			  expect(css).toContain("@media (min-width: 761px) and (max-width: 1100px) {");
			  expect(css).toContain(".packet .stock-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
			  expect(css).toContain(".packet .stock-controls > label:nth-child(3) { grid-column: 1 / -1; }");
			});

		it("показывает две карточки остатков только при читаемой ширине рабочей области", () => {
		  expect(css).toContain("@media (min-width: 761px) and (max-width: 1680px) {");
		  expect(css).toContain(".packet .stock-table tbody { grid-template-columns: repeat(auto-fit, minmax(min(100%, 288px), 1fr)); align-items: start; }");
		  expect(css).toContain(".packet .stock-table.data-table tbody tr:nth-child(even) { width: auto; }");
		});

		it("на wide-экране выделяет действие в настоящую колонку, а не расширяет таблицу", () => {
		  expect(css).toContain(".packet .stock-table :is(th, td):nth-child(9) { width: 14%; }");
		  expect(css).toContain(".packet .stock-table td:nth-child(9) .stock-revision-action { display: flex; width: 100%; min-width: 0; justify-content: center; padding-inline: 8px; white-space: normal; text-align: center; }");
		});

		it("показывает административному персоналу отдельную read-only сводку БМ и СРС", () => {
		  expect(page).toContain("onecWarehouseSummary");
		  expect(page).toContain("ОСНОВНЫЕ СКЛАДЫ · 1С");
		  expect(page).toContain("Не заменяет учетный остаток магазина");
		  expect(page).toContain("isAdmin || isManager");
		  expect(css).toContain(".packet .stock-primary-warehouses");
		});

		it("дает выбрать единый read-only срез БМ или СРС без поиска и без влияния на остаток магазина", () => {
		  expect(page).toContain('const [primaryWarehouseCode, setPrimaryWarehouseCode]');
		  expect(page).toContain('const selectedPrimaryWarehouse = primaryWarehouses.find');
		  expect(page).toContain("Показать склад 1С");
		  expect(page).toContain('<option value="BM">БМ</option>');
		  expect(page).toContain('<option value="SRS">СРС</option>');
		  expect(page).not.toContain('primaryWarehouseCode} searchable');
		  expect(page).toContain('data-warehouse-code={selectedPrimaryWarehouse.warehouseCode}');
		  expect(css).toContain(".packet .stock-primary-warehouse-select { display: grid;");
		});
});
