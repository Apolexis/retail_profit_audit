import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "inventoryRegistry.ts"), "utf8");

describe("Эвотор: неполный импорт алкогольной карточки", () => {
	  it("не откатывает сохраненную вручную карточку входящим каталогом Эвотор", () => {
    expect(source).toContain("existingAlcoholMarking");
    expect(source).toContain("resolvedMarkingCategory");
	    expect(source).toContain('const sourceMayRefreshMetadata = existing?.metadataSource !== "manual"');
    expect(source).toContain('metadataSource: "manual"');
	    expect(source).toContain("alcoholCode: sourceMayRefreshMetadata");
	    expect(source).toContain("markingCategory: sourceMayRefreshMetadata");
	  });

	  it("не стирает подтвержденную единицу товара пустым measure_name", () => {
	    expect(source).toContain('baseUnit: sourceMayRefreshMetadata ? (baseUnit === "unknown" ? existing?.baseUnit ?? "unknown" : baseUnit) : undefined');
	  });

	  it("обновляет единый справочник категорий из групп Эвотор, но не возвращает локально архивированную категорию", () => {
    expect(source).toContain("ensureCatalogCategoriesFromEvotor");
    expect(source).toContain("A deliberate local archive wins");
    expect(source).toContain("const categoryIdByName = await ensureCatalogCategoriesFromEvotor");
    expect(source).toContain("catalogCategoryId,");
    expect(source).toContain("actorId === null");
  });

  it("удаляет категорию только из рабочего справочника и отсоединяет живые связи", () => {
    expect(source).toContain("Archive a local category without deleting products, history or the remote source label.");
    expect(source).toContain("set({ catalogCategoryId: null })");
    expect(source).toContain("tx.delete(operationalPrintCategoryGroupMembers)");
    expect(source).toContain("detachedProducts: products.length");
    expect(source).toContain("detachedPrintMembers: printMembers.length");
  });
});
