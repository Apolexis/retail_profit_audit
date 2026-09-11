import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("оставляет наличные траты и НДФЛ самостоятельными карточками порогов", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const overrides = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");
  expect(page).toContain('className="threshold-grid threshold-grid-cash"');
  expect(page).not.toContain('className="threshold-control-group"');
  expect(page).toContain('cashControlRules.map(rule => <ThresholdRuleCard');
  expect(overrides).toContain('html[data-audit-theme="light"] .packet .threshold-rule .threshold-amount > span { color: #61728a !important; }');
});
