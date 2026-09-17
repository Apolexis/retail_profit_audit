import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./InventoryRegistry.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");

describe("интерфейс операционной инвентаризации", () => {
  it("не переиспользует старую финансовую страницу остатков", () => {
    expect(page).toContain("отдельный операционный регистр");
    expect(page).toContain("а не старая аналитическая страница «Остатки»");
    expect(page).toContain("trpc.inventoryRegistry");
    expect(page).not.toContain("trpc.audit.metrics");
  });

  it("берет товар только из рабочего справочника и не создает вымышленные строки", () => {
    expect(page).toContain("Выберите товар из внутреннего справочника");
    expect(page).toContain("Поиск не подставляет товары сам");
    expect(page).toContain("Ноль — это посчитанный остаток, а не пустая строка");
  });

  it("дает продавцу создать черновик, но не закрыть пересчет", () => {
    expect(page).toContain("Вы можете подготовить пересчет");
    expect(page).toContain("Закрыть и создать корректировки может назначенный руководитель или администратор");
    expect(page).toContain("Проверить и закрыть");
  });

  it("использует общий календарь и одно-колоночную мобильную форму", () => {
    expect(page).toContain("ExactDateControl");
    expect(page).not.toContain('type="date"');
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".packet .inventory-line-create { grid-template-columns: 1fr; }");
  });
});
