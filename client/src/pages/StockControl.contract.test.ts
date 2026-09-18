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
    expect(page).toContain("Название или код");
    expect(page).toContain("Показать еще");
    expect(page).toContain("trpc.inventoryRegistry.stock");
  });

	it("показывает продажную цену без раскрытия себестоимости и помещает поиск справа", () => {
    expect(page).toContain("внутренняя себестоимость не раскрывается");
    expect(page).toContain("Продажная цена");
    expect(page).toContain("Сумма по цене");
    expect(css).toContain(".packet .stock-search > svg { position: absolute; right: 10px;");
    expect(page).toContain('className="data-table-wrap stock-table-wrap"');
    expect(css).toContain('.packet .stock-table-wrap { overflow-x: auto; cursor: grab;');
	  expect(css).toContain('--stock-accent: var(--packet-accent);');
	  expect(css).toContain('no page-local palette is introduced');
	  expect(css).toContain('--stock-card: #f7fbff;');
	  expect(css).toContain('--stock-panel: #edf6ff;');
	  expect(css).toContain('--stock-card: #16101a;');
	  expect(css).toContain('--stock-panel: #1c1420;');
	  expect(css).toContain('--stock-accent: #ff765f;');
	});

	it("на узком экране заменяет широкую таблицу подписанными карточками", () => {
	  expect(page).toContain('data-label="Учетный остаток"');
	  expect(page).toContain('data-label="Действие"');
	  expect(css).toContain(".stock-table.data-table tbody tr:nth-child(even) { display: grid");
	  expect(css).toContain("content: attr(data-label)");
	});
});
