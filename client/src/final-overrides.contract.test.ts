import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

describe("скрытые полосы прокрутки", () => {
  it("скрывает системные scrollbar без запрета прокрутки", () => {
    expect(styles).toContain("scrollbar-width: none;");
    expect(styles).toContain(".packet *::-webkit-scrollbar");
    expect(styles).not.toMatch(/overflow:\s*hidden\s*!important;\s*\/\*\s*global-scrollbar/);
  });
});

describe("триггеры категорий темной навигации", () => {
  it("не меняют визуальное состояние на границе hover", () => {
    expect(styles).toContain('html[data-audit-theme="dark"] .packet :is(.nav-section-trigger, .nav-drawer-section-trigger) { transition: none !important; }');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet :is(.nav-section-trigger, .nav-drawer-section-trigger):hover { border-color: var(--line) !important; background: var(--surface-2) !important; box-shadow: none !important; }');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .nav-section:not(.is-open) .nav-section-trigger:hover');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .nav-section.is-open .nav-section-trigger:hover');
  });
});
