import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controls = readFileSync(new URL("../components/PlanFactControlsBootstrap.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("форма план‑факта", () => {
  it("открывает нативный календарь месяца по клику по полю", () => {
    expect(controls).toContain(".plan-editor input[type='month']");
    expect(controls).toContain("showPicker?.()");
  });

  it("оформляет поле суммы тем же фоном, что и месяц", () => {
    expect(styles).toContain('input[type="month"], .packet .plan-editor input[type="number"]');
  });

  it("использует в светлой теме общий iOS‑синий контур полей, а не коралловый", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .plan-editor input[type="month"]:hover');
    expect(styles).toContain("border-color: #0a84ff !important");
    expect(styles).not.toContain("border-color: #e84f5f !important; box-shadow: 0 0 0 2px rgba(232,79,95,.16)");
  });
});
