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
    expect(styles).toContain('.free-scroll-select-content { position: relative; z-index: 90 !important;');
    expect(styles).toContain('overflow-y: auto;');
    expect(styles).toContain('animation: none !important; transition: none !important;');
    expect(styles).toContain('.packet [data-slot="select-trigger"] { align-items: center; line-height: 1.2; }');
  });

  it("прокручивает длинный список наведением на верхнюю или нижнюю кромку, а на touch оставляет свайп", () => {
    expect(component).toContain('className="free-scroll-select-viewport"');
    expect(component).toContain('free-scroll-select-edge free-scroll-select-edge-up${canScroll.up ? " is-active" : ""}');
    expect(component).toContain('free-scroll-select-edge free-scroll-select-edge-down${canScroll.down ? " is-active" : ""}');
    expect(component).toContain('onPointerEnter={() => startEdgeScroll(-1)}');
    expect(component).toContain('onPointerEnter={() => startEdgeScroll(1)}');
    expect(component).toContain('viewport.scrollTop += direction * 9');
    expect(styles).toContain('.free-scroll-select-viewport { max-height: min(42vh, 320px);');
    expect(styles).toContain('scrollbar-width: none; touch-action: pan-y;');
    expect(styles).toContain('@media (hover: hover) and (pointer: fine) { .free-scroll-select-edge.is-active { display: flex; }');
    expect(styles).toContain('@media (hover: none), (pointer: coarse) { .free-scroll-select-edge { display: none; } }');
  });
});
