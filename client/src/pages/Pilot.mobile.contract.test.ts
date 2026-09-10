import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const css = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

it("сохраняет сценарные блоки закрытия внутри мобильной ширины", () => {
  expect(css).toContain("@media (max-width: 420px)");
  expect(css).toContain(".packet .closure-planner,");
  expect(css).toContain(".packet .closure-expense-list { grid-template-columns: minmax(0, 1fr) !important; }");
  expect(css).toContain(".packet .closure-choice-main em { overflow-wrap: anywhere; }");
  expect(css).toContain(".packet .closure-disclaimer,");
  expect(css).toContain(".packet .closure-actions { display: grid !important;");
  expect(css).toContain("@media (max-width: 720px) { .packet .playbook-grid { grid-template-columns: 1fr; } }");
});

it("поднимает сценарий закрытия перед рекомендованными сценариями и выносит предупреждение из заголовка", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Pilot.tsx"), "utf8");
  expect(page.indexOf('className="packet-card closure-planner"')).toBeLessThan(page.indexOf('className="scenario-strip"'));
  expect(page).toContain('className="closure-disclaimer"');
  expect(page).not.toContain('<small>Расчет не изменяет базу и не является автоматическим решением о закрытии.</small>');
});
