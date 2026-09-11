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
  it("синхронизирует цвета проверки доступа и загрузки фактов по темам", () => {
    expect(styles).toContain('html[data-audit-theme="dark"] .facts-loader.ocean-loader > p { color: #ff765f !important; }');
    expect(styles).toContain('html[data-audit-theme="light"] .facts-loader.ocean-loader > p { color: var(--muted) !important; }');
    expect(styles).toContain('html[data-audit-theme="dark"] .facts-loader:not(.ocean-loader) > p { color: #ff765f !important; }');
  });
});

describe("управленческий фокус светлой темы", () => {
  it("дает заметную синюю подсветку без смещения карточки", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .section-recommendation:hover { transform: none !important; border-color: #0a84ff !important; background: #eef7ff !important; box-shadow: 0 0 0 3px rgba(10, 132, 255, .16), 0 16px 34px rgba(10, 99, 200, .14) !important; }');
  });
});

describe("карточки контроля импорта", () => {
  it("дает спокойную базу обычным карточкам, отдельный риск и единый статус правил", () => {
    expect(styles).toContain('.import-summary > div:nth-child(3):not(.risk)');
    expect(styles).toContain('.import-risk-overview article.risk { border-color: #efbcc3 !important; background: #fff5f5 !important;');
    expect(styles).toContain('.import-threshold-list > div.critical { border-left-color: #6a94bd !important; color: #26384d !important; }');
    expect(styles).toContain('.import-risk-overview article:hover,');
    expect(styles).toContain('.import-cash-breakdown:hover,');
    expect(styles).toContain('.import-threshold-list:hover { border-color: #0a84ff !important;');
  });
});

describe("карточки общего среза и сводки", () => {
  it("дают hover-контур без изменения геометрии в обеих темах", () => {
    expect(styles).toContain('.packet .analysis-filter,\n.packet .cover,\n.packet .cover-note { transition:');
    expect(styles).toContain('.packet .analysis-filter:hover,\n.packet .cover:hover,\n.packet .cover-note:hover { transform: none !important; border-color: rgba(255, 118, 95, .78) !important;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .analysis-filter:hover { border-color: #0a84ff !important;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .cover-note:hover { border-color: #0a84ff !important;');
  });
});
