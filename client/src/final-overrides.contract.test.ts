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
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .nav-drawer-section.is-open .nav-drawer-section-trigger:hover { color: var(--text) !important; }');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet :is(.nav-section-trigger, .nav-drawer-section-trigger) :is(.nav-section-label, svg) { pointer-events: none; color: inherit; }');
  });
});

describe("индикатор проверки безопасного доступа", () => {
  it("использует тематический акцент вместо серого или кораллового чужой темы", () => {
    expect(styles).toContain('html[data-audit-theme="dark"] .facts-loader.ocean-loader > p { color: #ff765f !important; }');
    expect(styles).toContain('html[data-audit-theme="light"] .facts-loader.ocean-loader > p { color: var(--muted) !important; }');
  });
});

describe("управленческий фокус светлой темы", () => {
  it("дает заметную синюю подсветку без смещения карточки", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .section-recommendation:hover { transform: none !important; border-color: #0a84ff !important; background: #eef7ff !important; box-shadow: 0 0 0 3px rgba(10, 132, 255, .16), 0 16px 34px rgba(10, 99, 200, .14) !important; }');
  });
});
