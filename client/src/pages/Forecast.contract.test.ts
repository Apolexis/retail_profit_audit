import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/Forecast.tsx"), "utf8");

describe("страница прогноза", () => {
  it("строится только на факте текущего и прошлого годов", () => {
    expect(page).toContain("buildSeasonalForecast");
    expect(page).toContain("useImportedAudit(previousYear)");
    expect(page).toContain("Система не заменяет отсутствующие факты нулями или вымышленными значениями.");
  });

  it("предлагает график и таблицу по полному набору прямых финансовых потоков", () => {
    expect(page).toContain("Выручка");
    expect(page).toContain("Валовая прибыль");
    expect(page).toContain("Чистая прибыль");
    expect(page).toContain("Закупки");
    expect(page).toContain("Продажи Коп.");
    expect(page).toContain("Перемещения");
    expect(page).toContain("Списания М.");
    expect(page).toContain("expenseDefinitions.map");
    expect(page).toContain("<optgroup");
    expect(page).toContain("ТАБЛИЦА РАСЧЕТА");
  });

  it("сохраняет мобильный перенос пояснения графика", () => {
    expect(page).toContain('className="card-title forecast-chart-title"');
  });

  it("передает в общий график суммы в тысячах рублей", () => {
    expect(page).toContain("row.historical / 1000");
    expect(page).toContain("row.actual / 1000");
    expect(page).toContain("row.forecast / 1000");
  });
});
