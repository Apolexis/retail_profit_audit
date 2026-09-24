import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./NotFound.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница 404", () => {
  it("остается русской и возвращает пользователя в сводку", () => {
    expect(page).toContain("Страница не найдена");
    expect(page).toContain("На главную");
    expect(page).toContain('setLocation("/")');
    expect(page).toContain("Такой страницы нет или она была перемещена.");
  });

  it("использует отдельные светлую iOS-синюю и тёмную graphite/plum поверхности", () => {
    expect(page).toContain("useAudit");
    expect(page).toContain("not-found-shell--${theme}");
    expect(overrides).toContain('html[data-audit-theme="light"] .not-found-shell');
    expect(overrides).toContain("background: #edf5ff;");
    expect(overrides).toContain(".not-found-shell {\n  display: grid;\n  min-height: 100dvh;");
    expect(overrides).toContain("background: #0c0b12;");
    expect(overrides).toContain("@media (hover: hover) and (pointer: fine)");
  });
});
