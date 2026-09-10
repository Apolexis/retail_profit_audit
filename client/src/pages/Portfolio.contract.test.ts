import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Portfolio.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Портфель»", () => {
  it("оставляет на точечных картах только выбранную и приоритетные подписи", () => {
    expect(page).toContain("const labelledStores = new Set(priority.slice(0, 6)");
    expect(page).toContain("label: labelledStores.has(item.store) ? item.store : \"\"");
    expect(page).toContain("<LabelList dataKey=\"label\"");
    expect(page).toContain("Точка на графике");
  });

  it("показывает отдельные цветовые причины риска и точные значения при наведении", () => {
    expect(page).toContain("Отрицательная маржа");
    expect(page).toContain("Запас выше 20 дней");
    expect(page).toContain("Запас ниже 7 дней");
    expect(page).toContain("Покрытие:");
    expect(page).toContain("Маржа:");
  });

  it("заменяет плотное облако точек на мобильную карту приоритетов", () => {
    expect(page).toContain("portfolio-mobile-map");
    expect(page).toContain("portfolio-mobile-priority-list");
    expect(page).toContain("portfolio-meter");
    expect(styles).toContain(".packet .portfolio-mobile-map { display: grid;");
    expect(styles).toContain(".packet .portfolio-plot-grid { display: none;");
  });
});
