import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("адаптивные расчетные таблицы", () => {
  it("оставляет широкие таблицы внутри прокручиваемого контейнера на средней ширине", () => {
    expect(styles).toContain("@media (max-width: 1050px)");
    expect(styles).toContain(".packet .data-table-wrap { width: 100%; max-width: 100%; overflow-x: auto !important;");
    expect(styles).toContain(".packet .data-table-wrap .data-table { width: max-content; min-width: 100%; }");
  });
});
