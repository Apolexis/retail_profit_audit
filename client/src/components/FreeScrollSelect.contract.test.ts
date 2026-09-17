import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./FreeScrollSelect.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("немодальный тематичный select", () => {
  it("использует Popover без scroll lock и закрывает список при прокрутке документа", () => {
    expect(component).toContain('import { Popover, PopoverContent, PopoverTrigger }');
    expect(component).toContain('modal={false}');
    expect(component).toContain('useLayoutEffect(() => {');
    expect(component).toContain('window.addEventListener("scroll", closeOnDocumentScroll, { capture: true, passive: true })');
    expect(component).toContain('window.removeEventListener("scroll", closeOnDocumentScroll, true)');
    expect(component).toContain('{open && <PopoverContent');
    expect(component).not.toContain("RemoveScroll");
  });

  it("сохраняет доступную роль списка, выбранный пункт и групповые заголовки", () => {
    expect(component).toContain('role="listbox"');
    expect(component).toContain('role="option"');
    expect(component).toContain('aria-selected={option.value === value}');
    expect(component).toContain('className="free-scroll-select-group"');
    expect(styles).toContain('.free-scroll-select-content { z-index: 90 !important;');
    expect(styles).toContain('overflow-y: auto;');
    expect(styles).toContain('animation: none !important; transition: none !important;');
    expect(styles).toContain('.packet [data-slot="select-trigger"] { align-items: center; line-height: 1.2; }');
  });
});
