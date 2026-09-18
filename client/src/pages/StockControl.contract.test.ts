import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./StockControl.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../stock-control.css", import.meta.url), "utf8");

describe("интерфейс операционных остатков", () => {
  it("отделяет остатки от ревизии и сохраняет прямую корректировку отдельным действием", () => {
    expect(page).toContain("Остатки магазинов");
    expect(page).toContain("«Не посчитан» — это не ноль");
    expect(page).toContain("сохраняет отдельное неизменяемое движение");
    expect(page).toContain("Новая ревизия");
    expect(page).toContain("Ревизия");
    expect(page).toContain('href={revisionHref(item)}');
    expect(page).toContain("trpc.inventoryRegistry.adjustStock.useMutation");
    expect(page).toContain("Изменить остаток");
    expect(page).toContain("Причина корректировки");
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
    expect(css).toContain('--stock-accent: #ff765f;');
    expect(css).toContain('--stock-accent: #0a84ff;');
  });
});
