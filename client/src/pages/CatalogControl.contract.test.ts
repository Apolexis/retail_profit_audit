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
    expect(page).toContain("Показать еще");
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
    expect(editor).toContain("Эвотор: не подключено");
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
    expect(editor).toContain("Эвотор: не подключено");
    expect(editor).toContain("Обратная запись в Эвотор пока не подключена");
  });

  it("объединяет штрихкоды в одном поле и раскрывает алкогольные поля для алкоголя и маркированного пива", () => {
    expect(editor).toContain("Эвотор и ручные, строго через ;");
    expect(editor).not.toContain("Штрихкоды Эвотор");
    expect(editor).toContain('marking === "alcohol" || marking === "beer_marked"');
    expect(editor).toContain("Алкокод");
    expect(editor).toContain("Код вида АП (ФСРАР)");
    expect(editor).toContain("Крепость, %");
    expect(editor).toContain("Объем тары, л");
	  expect(editor).toContain("Код типа товара Эвотор");
	  expect(editor).toContain('beer_marked: "ALCOHOL_MARKED"');
	  expect(editor).toContain("сейчас read-only");
  });

	it("использует обычные ссылки для самостоятельных маршрутов номенклатуры", () => {
	  expect(page).toContain('href="/catalog-control/new"');
	  expect(page).toContain('href={`/catalog-control/${product.id}/edit`}');
	  expect(editor).toContain('href="/catalog-control"');
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

	it("оставляет действия списка компактными и доступными", () => {
		expect(page).toContain('className="subtle-button catalog-table-action"');
		expect(page).toContain('aria-label={`Изменить товар: ${product.canonicalName}`}');
		expect(page).toContain('<ArrowDown size={14}/>Показать еще');
		expect(css).toContain(".packet .catalog-table-action { width: 32px;");
	});
});
