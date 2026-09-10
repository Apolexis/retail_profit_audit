import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("./forecast.css", import.meta.url), "utf8");
const overrides = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

it("не выводит пояснение прогноза и расчетные таблицы за мобильную или среднюю ширину", () => {
  expect(css).toContain(".forecast-chart-title>small{max-inline-size:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.4}");
  expect(overrides).toContain(".packet .data-table-wrap { max-width: 100%; overflow-x: auto !important; overscroll-behavior-inline: contain; }");
});
