import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./ChartTableSearch.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./chart-table-search.css", import.meta.url), "utf8");

describe("поиск в таблицах под графиками", () => {
  it("фильтрует только локальные строки и не переводит фокус в поле", () => {
    expect(component).toContain("export function chartTableMatches");
    expect(component).toContain('type="search"');
    expect(component).not.toContain("autoFocus");
    expect(component).toContain('role="search"');
    expect(component).not.toContain("Показано: ${shownRows} из ${totalRows}");
    expect(component).not.toContain("Строк: ${totalRows}");
  });

  it("сохраняет тематичную цельную поверхность в обеих темах и на телефоне", () => {
    expect(css).toContain(".packet .chart-table-search");
    expect(css).toContain('html[data-audit-theme="light"] .packet .chart-table-search');
    expect(css).toContain('html[data-audit-theme="dark"] .packet .chart-table-search');
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
    expect(css).toContain("@media (max-width: 560px)");
  });
});
