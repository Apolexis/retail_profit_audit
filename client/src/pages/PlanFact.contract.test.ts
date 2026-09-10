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
});
