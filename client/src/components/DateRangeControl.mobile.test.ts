import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./DateRangeControl.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../calendar-range.css", import.meta.url), "utf8");

describe("мобильный контракт календаря", () => {
  it("рендерит доступный предпросмотр выбранного диапазона", () => {
    expect(component).toContain('className="mobile-range-preview"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("dateRangePreview(draftStart,previewEnd,selected)");
  });

  it("показывает предпросмотр только на мобильной ширине", () => {
    expect(styles).toMatch(/\.mobile-range-preview\s*\{\s*display:\s*none/);
    expect(styles).toMatch(/@media\s*\(\s*max-width:\s*560px\s*\)\s*\{[\s\S]*?\.mobile-range-preview\s*\{\s*display:\s*grid/);
  });

  it("использует один месяц и поддерживает обратный выбор", () => {
    expect(component).toContain("numberOfMonths={1}");
    expect(component).toContain("day<draft.from?[day,draft.from]:[draft.from,day]");
  });

  it("дает «Базе» тот же календарный компонент без стандартных периодов", () => {
    expect(component).toContain("export function ExactDateControl");
    expect(component).toContain('className="date-popover fact-date-popover"');
    expect(component).toContain("modifiers={{singleSelected:selectedDate}}");
  });

  it("задает одинаковую темную поверхность поповерам диапазона и точной даты", () => {
    expect(styles).toMatch(/\.date-popover,\s*\.fact-date-popover\s*\{[\s\S]*?background:\s*var\(--surface\)\s*!important/);
    expect(styles).toMatch(/\.date-popover \[data-slot="calendar"\],\s*\.fact-date-popover \[data-slot="calendar"\]\s*\{[\s\S]*?background:\s*var\(--surface\)\s*!important/);
  });
});
