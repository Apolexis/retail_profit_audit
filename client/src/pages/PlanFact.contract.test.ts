import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./PlanFact.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../components/MonthPicker.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("форма план‑факта", () => {
  it("использует тематичный выбор месяца вместо системного календаря", () => {
    expect(page).toContain('<MonthPicker value={form.monthDate}');
    expect(page).toContain('<div className="plan-editor-field"><span>Месяц</span><MonthPicker');
    expect(page).not.toContain('<label>Месяц<MonthPicker');
    expect(page).not.toContain('type="month"');
    expect(picker).toContain('plan-month-picker-grid');
    expect(picker).toContain('aria-expanded={open}');
    expect(picker).toContain('role="dialog"');
    expect(picker).toContain('event.key === "Escape"');
    expect(picker).not.toContain('PopoverTrigger');
    expect(picker).toContain('aria-label="Предыдущий год"');
  });

  it("оформляет поле суммы тем же фоном, что и месяц", () => {
    expect(styles).toContain('.packet .plan-editor input[type="number"]');
  });

  it("использует в светлой теме общий iOS‑синий контур полей, а не коралловый", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .plan-editor .plan-month-picker-trigger:hover');
    expect(styles).toContain("border-color: #0a84ff !important");
    expect(styles).not.toContain("border-color: #e84f5f !important; box-shadow: 0 0 0 2px rgba(232,79,95,.16)");
  });
});
