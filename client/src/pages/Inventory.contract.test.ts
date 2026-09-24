import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Inventory.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Остатки»", () => {
  it("разделяет уровень запаса, товарный поток и потери", () => {
    expect(page).toContain("Уровень запаса");
    expect(page).toContain("Товарный поток");
    expect(page).toContain("Потери запаса");
    expect(page).toContain("Количественные остатки в книге не ведутся");
  });

  it("добавляет закупки, продажи и оба вида списаний к выбору показателей", () => {
    expect(page).toContain("purchases");
    expect(page).toContain("salesSmoked");
    expect(page).toContain("salesFrozen");
    expect(page).toContain("writeoffsTotal");
    expect(page).toContain("lossesTotal");
  });

  it("сводит длинный остаточный профиль к ключевым метрикам и аналитическому выводу", () => {
    expect(page).toContain("inventory-profile-card");
    expect(page).toContain("inventory-profile-grid");
    expect(page).toContain("profileInsight");
    expect(page).toContain("Покрытие выше медианы");
    expect(page).toContain("Потери запаса составляют");
  });

  it("позволяет разложить динамику по дням, неделям и месяцам с граничными остатками", () => {
    expect(page).toContain('type DetailLevel = "days" | "weeks" | "months";');
    expect(page).toContain('aria-label="Детализация графика"');
    expect(page).toContain("current.first");
    expect(page).toContain("current.last");
    expect(page).toContain('level === "days" ? "Дни"');
  });

  it("выстраивает четыре вторичных графика запасов вертикально", () => {
    expect(page).toContain('className="inventory-secondary-charts"');
    expect(overrides).toContain(".packet .inventory-secondary-charts");
    expect(overrides).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("фильтрует локальные строки и итог таблицы под графиком", () => {
    expect(page).toContain('const [tableQuery, setTableQuery] = useState("")');
    expect(page).toContain("const inventoryTableRows = trendData.filter");
    expect(page).toContain('ariaLabel="Поиск в таблице остатков под графиком"');
    expect(page).toContain("inventoryTableRows.map");
    expect(page).toContain('"Итого по выборке"');
  });
});
