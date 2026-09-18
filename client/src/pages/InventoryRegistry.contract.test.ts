import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./InventoryRegistry.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");

describe("интерфейс операционной инвентаризации", () => {
  it("не переиспользует старую финансовую страницу остатков", () => {
    expect(page).toContain("Инвентаризация магазина");
    expect(page).toContain("Номенклатура, остатки и себестоимость ведутся на отдельных страницах");
    expect(page).toContain("trpc.inventoryRegistry");
    expect(page).not.toContain("trpc.audit.metrics");
  });

  it("берет товар только из рабочего справочника и не создает вымышленные строки", () => {
    expect(page).toContain("Выберите товар из внутреннего справочника");
    expect(page).toContain("Поиск не подставляет товары сам");
    expect(page).toContain("ноль означает реально пустую позицию");
  });

  it("дает продавцу создать черновик, но не закрыть пересчет", () => {
    expect(page).toContain("Вы можете подготовить пересчет");
    expect(page).toContain("Закрыть и создать корректировки может назначенный руководитель или администратор");
    expect(page).toContain("Проверить и закрыть");
  });

  it("позволяет удалить только незакрытый черновик без изменения остатка", () => {
    expect(page).toContain("trpc.inventoryRegistry.deleteDraft");
    expect(page).toContain("Удалить черновик");
    expect(page).toContain("Учетные остатки не изменятся");
    expect(page).toContain('active.status === "draft"');
    expect(css).toContain(".packet .inventory-draft-actions");
  });

  it("разделяет учетный остаток, физический факт и расхождение", () => {
    expect(page).toContain("Инвентаризация магазина");
    expect(page).toContain("Учетный остаток и факт — разные значения");
    expect(page).toContain("Учетный остаток");
    expect(page).toContain("Расхождение");
    expect(page).toContain("accountingQuantity");
    expect(css).toContain('.packet .inventory-accounting-readout');
  });

  it("ставит иконку поиска справа и не создает двойной светлый контур в темной теме", () => {
    expect(css).toContain('.packet .inventory-search svg { position: absolute; right: 10px;');
    expect(css).toContain('html[data-audit-theme="dark"] .packet :is(.inventory-create-card');
  });

  it("использует общий календарь и одно-колоночную мобильную форму", () => {
    expect(page).toContain("ExactDateControl");
    expect(page).not.toContain('type="date"');
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".packet .inventory-line-create { grid-template-columns: 1fr; }");
  });

  it("не смешивает каталог и себестоимость с ревизией", () => {
    expect(page).not.toContain("ЭВОТОР · READ-ONLY PREVIEW");
    expect(page).not.toContain("ВНУТРЕННЯЯ СЕБЕСТОИМОСТЬ");
    expect(page).not.toContain("confirmEvotorCatalog.mutate");
    expect(page).not.toContain("updateInternalCost");
  });
});
