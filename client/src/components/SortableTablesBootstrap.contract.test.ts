import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./SortableTablesBootstrap.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const manageData = readFileSync(new URL("../pages/ManageData.tsx", import.meta.url), "utf8");

describe("горизонтальное перетаскивание аналитических таблиц", () => {
  it("подключает drag только к прокручиваемому контейнеру и не перехватывает интерактивные элементы", () => {
    expect(source).toContain("function bindMouseDragScroll");
    expect(source).toContain("wrap.scrollWidth <= wrap.clientWidth");
    expect(source).toContain("button, a, input, select, textarea, label");
    expect(source).toContain("th[data-sortable='true']");
    expect(source).toContain("window.getSelection()?.removeAllRanges()");
    expect(source).toContain(".data-table-wrap");
  });
  it("показывает grab только для устройств с мышью", () => {
    expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
    expect(styles).toContain(".data-table-wrap.table-mouse-dragging");
    expect(styles).toContain(".packet .scenario-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }");
  });

	  it("оставляет короткий клик по заголовку сортировке, а не drag‑прокрутке", () => {
    expect(source).toContain("const header = target?.closest<HTMLTableCellElement>(\"table.data-table th[data-sortable='true']\")");
    expect(source).toContain("sortTableByHeader(header)");
	  });

	  it("не включает drag-scroll в адаптивной таблице управления фактами", () => {
	    expect(source).toContain('wrap.dataset.dragScroll === "false"');
	    expect(manageData).toContain('className="data-table-wrap" data-drag-scroll="false"');
	    expect(styles).toContain('.data-table-wrap[data-drag-scroll="false"]');
	  });
});
