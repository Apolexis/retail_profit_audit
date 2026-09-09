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
    expect(styles).toContain(".mobile-range-preview{display:none}");
    expect(styles).toMatch(/@media\(max-width:560px\)\{\.mobile-range-preview\{display:grid/);
  });
});
