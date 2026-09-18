import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./CatalogControl.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../catalog-control.css", import.meta.url), "utf8");

describe("отдельный операционный справочник", () => {
  it("отделяет номенклатуру и Эвотор от инвентаризации", () => {
    expect(page).toContain("Общая номенклатура сети");
    expect(page).toContain("Каталог Эвотор остается отдельным read-only списком");
    expect(page).toContain("Флаг выгрузки в Эвотор пока недоступен");
    expect(page).toContain("Эвотор: read-only");
  });

  it("позволяет администратору добавлять, менять и архивировать номенклатуру", () => {
    expect(page).toContain("Добавить товар");
    expect(page).toContain("trpc.inventoryRegistry.createCatalogProduct");
    expect(page).toContain("trpc.inventoryRegistry.updateCatalogProduct");
    expect(page).toContain("trpc.inventoryRegistry.archiveCatalogProduct");
    expect(page).toContain("Товар перестанет отображаться в рабочем справочнике");
  });

  it("держит НДС только в согласованном списке с 10% по умолчанию", () => {
    expect(page).toContain('useState<"VAT_10" | "VAT_22">("VAT_10")');
    expect(page).toContain('<option value="VAT_10">НДС 10%</option>');
    expect(page).toContain('<option value="VAT_22">НДС 22%</option>');
  });

  it("не показывает нулевую себестоимость Эвотор и использует тематичные поля", () => {
    expect(page).toContain("Кассовая себестоимость скрыта и равна 0");
    expect(page).toContain("Внутренняя себестоимость");
    expect(css).toContain('.packet .catalog-search > svg { position: absolute; right: 10px;');
    expect(css).toContain('--catalog-accent: #ff765f;');
    expect(css).toContain('--catalog-accent: #0a84ff;');
  });
});
