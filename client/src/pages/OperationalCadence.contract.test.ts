import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./OperationalCadence.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Ритм»", () => {
  it("дает выбрать несколько показателей и сохраняет хотя бы один", () => {
    expect(page).toContain("Показатели для сравнения");
    expect(page).toContain("без лимита; минимум один");
    expect(page).toContain("current.length === 1 ? current");
    expect(page).toContain("selectedMetrics.map(metric");
  });

  it("добавляет детализацию по месяцам", () => {
    expect(page).toContain('value="month">По месяцам');
    expect(page).toContain("cadence.monthly");
  });

  it("дает выбрать магазины без лимита и показывает полную таблицу под графиком", () => {
    expect(page).toContain("Магазины для суммарного среза");
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).toContain("Все интервалы активного среза");
  });

  it("выделяет наличные расходы и НДФЛ 22% в понятную группу", () => {
    expect(page).toContain("Наличные расходы и налоги");
    expect(page).toContain("cash-control-group");
    expect(page).not.toContain("нал + НДФЛ 22%");
    expect(page).toContain("cadence-group-label");
  });

  it("использует для группы наличных расходов обычный цвет заголовков в обеих темах", () => {
    expect(styles).toContain(".packet .cadence-group-label > span { color: var(--faint);");
    expect(styles).not.toContain(".cash-control-group .cadence-group-label > span { color:");
  });

  it("показывает последние интервалы карточками с отдельными значениями", () => {
    expect(page).toContain("cadence-interval-card");
    expect(page).toContain("cadence-interval-values");
  });

  it("не добавляет пустые нулевые интервалы в график, таблицу и последние карточки", () => {
    expect(page).toContain("const visibleSource = source.filter(point => selectedMetrics.some(metric => point[metric] !== 0));");
    expect(page).toContain("const data = visibleSource.map(point");
    expect(page).toContain("const tableRows = [...visibleSource].slice(-8).reverse();");
    expect(page).toContain("{visibleSource.map(point => <tr");
  });
});
