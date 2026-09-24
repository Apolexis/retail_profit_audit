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
    expect(styles).toContain('html[data-audit-theme="light"] .packet .plan-editor input[type="number"] { border-color: #cbd9ee !important; background: #f4f9ff !important;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .plan-editor .plan-month-picker-trigger { border-color: #cbd9ee; background: #f4f9ff;');
    expect(styles).toContain('html[data-audit-theme="light"] .plan-month-picker-popover { border-color: #bdd9f6; background: #f7fbff;');
  });

  it("не допускает буквенный ввод суммы плана", () => {
    expect(page).toContain('type="number" inputMode="decimal" min="0" step="0.01"');
    expect(page).not.toContain('type="text" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*"');
  });

  it("заменяет запятую на точку при ручном вводе и вставке", () => {
    expect(page).toContain('const normalizePlanAmount=(value:string)=>');
    expect(page).toContain('value.replace(",", ".").replace(/[^0-9.]/g, "")');
    expect(page).toContain('onBeforeInput={event=>{const data=(event.nativeEvent as InputEvent).data;if(data!==",")return;');
    expect(page).toContain('onPaste={event=>{const pasted=event.clipboardData.getData("text");if(!pasted.includes(","))return;');
    expect(page).toContain('amount:normalizePlanAmount(event.target.value)');
  });

  it("использует в светлой теме общий iOS‑синий контур полей, а не коралловый", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .plan-editor .plan-month-picker-trigger:hover');
    expect(styles).toContain("border-color: #0a84ff !important");
    expect(styles).not.toContain("border-color: #e84f5f !important; box-shadow: 0 0 0 2px rgba(232,79,95,.16)");
  });

	it("дает focus через одну тематичную границу без второго контура", () => {
	  expect(styles).toContain('.packet .plan-editor input[type="number"]:focus-visible');
	  expect(styles).toContain('box-shadow: none !important; outline: none;');
	  expect(styles).not.toContain('input[type="number"]:hover, .packet .plan-editor input[type="number"]:focus');
	});

	it("не возвращает белые controls в темной теме", () => {
	  expect(styles).toContain('html[data-audit-theme="dark"] .packet :is(.forecast-controls > :is(label, div), .plan-editor) { background: #21141d !important;');
	  expect(styles).toContain('html[data-audit-theme="dark"] .packet .plan-editor :is(button, select, input, textarea) { background: #25141e !important;');
	});

	it("на промежуточной ширине укладывает форму плана в две колонки и полную строку сохранения", () => {
	  expect(styles).toContain('@media (min-width: 561px) and (max-width: 900px)');
	  expect(styles).toContain('.packet .plan-editor { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }');
	  expect(styles).toContain('.packet .plan-editor > .packet-link { grid-column: 1 / -1; width: 100%; justify-content: center; }');
	});
});
