import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagesDir = new URL("../pages/", import.meta.url);
const input = readFileSync(new URL("./ui/input.tsx", import.meta.url), "utf8");
const textarea = readFileSync(new URL("./ui/textarea.tsx", import.meta.url), "utf8");
const select = readFileSync(new URL("./ui/select.tsx", import.meta.url), "utf8");
const themedSelect = readFileSync(new URL("./ui/themed-select.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("единый контракт полей и списков", () => {
  it("закрепляет общий размер, радиус и одиночный focus‑контур базовых компонентов", () => {
    expect(input).toContain('h-[42px]');
    expect(input).toContain('rounded-[11px]');
    expect(input).toContain("focus-visible:ring-0");
    expect(textarea).toContain('min-h-[92px]');
    expect(textarea).toContain('rounded-[11px]');
    expect(textarea).toContain("focus-visible:ring-0");
    expect(select).toContain('data-[size=default]:h-[42px]');
    expect(select).toContain('rounded-[11px]');
  });

  it("использует тематичный немодальный список, не блокирующий прокрутку страницы", () => {
    expect(themedSelect).toContain("function ThemedSelect");
    expect(themedSelect).toContain("FreeScrollSelect");
    expect(themedSelect).toContain('contentClassName="app-select-content"');
    expect(themedSelect).toContain("EMPTY_VALUE");
    expect(themedSelect).toContain("child.type === React.Fragment");
    expect(themedSelect).toContain("collectOptions(props.children, group)");
  });

  it("сохраняет коралловый dark-фон поля и при наведении на select-кнопку", () => {
    expect(overrides).toContain('html[data-audit-theme="dark"] .packet :is(input, textarea, select, [data-slot="select-trigger"]) {\n  background: #25141e !important;');
    expect(overrides).toContain('html[data-audit-theme="dark"] .packet button[data-slot="select-trigger"]:not(:disabled):hover { background: #25141e !important; }');
  });

  it("не оставляет native select в страницах приложения", () => {
    const pages = readdirSync(pagesDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith(".tsx"))
      .map(entry => readFileSync(join(pagesDir.pathname, entry.name), "utf8"));
    expect(pages.some(page => /<select\b/.test(page))).toBe(false);
  });
});
