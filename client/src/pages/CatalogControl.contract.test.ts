import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./CatalogControl.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../catalog-control.css", import.meta.url), "utf8");

describe("отдельный операционный справочник", () => {
  it("отделяет номенклатуру и Эвотор от инвентаризации", () => {
    expect(page).toContain("Номенклатура магазинов");
    expect(page).toContain("ЭВОТОР · READ-ONLY");
    expect(page).toContain("только ее закрепленный магазин Эвотор");
    expect(page).toContain("не отправляются обратно в кассу");
  });

  it("позволяет администратору добавлять, менять и архивировать номенклатуру", () => {
    expect(page).toContain("Добавить товар");
    expect(page).toContain("trpc.inventoryRegistry.createCatalogProduct");
    expect(page).toContain("trpc.inventoryRegistry.updateCatalogProduct");
    expect(page).toContain("trpc.inventoryRegistry.archiveCatalogProduct");
    expect(page).toContain("Удаление заменено скрытием");
  });

  it("держит НДС только в согласованном списке с 10% по умолчанию", () => {
    expect(page).toContain('useState<"VAT_10" | "VAT_22">("VAT_10")');
    expect(page).toContain('<option value="VAT_10">НДС 10%</option>');
    expect(page).toContain('<option value="VAT_22">НДС 22%</option>');
  });

  it("не показывает нулевую себестоимость Эвотор и использует тематичные поля", () => {
    expect(page).toContain("«Себестоимость Эвотор» равна 0 и не выводится");
    expect(page).toContain("Внутренняя себестоимость");
    expect(css).toContain('.packet .catalog-search > svg { position: absolute; right: 10px;');
    expect(css).toContain('html[data-audit-theme="dark"] .packet .catalog-store-card');
  });
});
