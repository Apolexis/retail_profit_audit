import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./design-system.css", import.meta.url), "utf8");
const overrides = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

describe("общая анимация действий", () => {
  it("не поднимает кнопки и ссылки при наведении", () => {
    expect(styles).toContain(".packet button:not(:disabled):hover");
    expect(styles).toMatch(/\.packet button:not\(:disabled\):hover,[\s\S]*?transform:\s*none;/);
    expect(styles).not.toMatch(/\.packet button:not\(:disabled\):hover,[\s\S]{0,280}?translateY\(-1px\)/);
  });

  it("оставляет тактильное сжатие только при нажатии", () => {
    expect(styles).toMatch(/\.packet button:not\(:disabled\):active,[\s\S]*?transform:\s*translateY\(0\) scale\(\.965\)/);
  });

  it("держит типовые действия в трех явных размерных tiers", () => {
    expect(overrides).toContain("--action-primary-height: 40px;");
    expect(overrides).toContain("--action-secondary-height: 36px;");
    expect(overrides).toContain("--action-compact-height: 28px;");
    expect(overrides).toContain(".packet .packet-link:not(.compact) { min-height: var(--action-primary-height) !important; }");
    expect(overrides).toContain(".packet :is(.packet-link.compact, .subtle-button, .subtle-action, .row-edit, .visibility, .row-delete) { min-height: var(--action-secondary-height); }");
    expect(overrides).toContain(".packet .chart-view-button { min-height: var(--action-compact-height); }");
    expect(overrides).toContain("@media (max-width: 720px) {\n  .packet .chart-view-button { min-height: var(--action-secondary-height); }");
  });
});
