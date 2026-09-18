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
    expect(editor).toContain("Показывать в заявках");
    expect(editor).toContain("Разрешить выгрузку в Эвотор");
    expect(editor).toContain("обратная запись пока отключена");
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
});
