import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

it("сохраняет сценарные блоки закрытия внутри мобильной ширины", () => {
  expect(css).toContain("@media (max-width: 420px)");
  expect(css).toContain(".packet .closure-planner,");
  expect(css).toContain(".packet .closure-expense-list { grid-template-columns: minmax(0, 1fr) !important; }");
  expect(css).toContain(".packet .closure-choice-main em { overflow-wrap: anywhere; }");
});
