import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./DateRangeControl.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../calendar-range.css", import.meta.url), "utf8");
const finalOverrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const auditContext = readFileSync(new URL("../contexts/AuditContext.tsx", import.meta.url), "utf8");

describe("мобильный контракт календаря", () => {
  it("рендерит доступный предпросмотр выбранного диапазона", () => {
    expect(component).toContain('className="mobile-range-preview"');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain("dateRangePreview(draftStart,previewEnd,selected)");
  });

  it("показывает предпросмотр только на мобильной ширине", () => {
    expect(styles).toMatch(/\.mobile-range-preview\s*\{\s*display:\s*none/);
    expect(styles).toMatch(/@media\s*\(\s*max-width:\s*560px\s*\)\s*\{[\s\S]*?\.mobile-range-preview\s*\{\s*display:\s*grid/);
  });

  it("использует один месяц и поддерживает обратный выбор", () => {
    expect(component).toContain("numberOfMonths={1}");
    expect(component).toContain("day<draft.from?[day,draft.from]:[draft.from,day]");
  });

  it("выбирает день первым touch без ghost-click, сохраняя второй шаг только для конца диапазона", () => {
    expect(component).toContain('const touchDayRef=useRef<number|null>(null)');
    expect(component).toContain('source==="click"&&touchDayRef.current===dayKey');
    expect(component).toContain('event.pointerType!=="touch"');
    expect(component).toContain('onPointerUp={event=>pickTouchDay(event,day.date)}');
  });

  it("дает «Базе» тот же календарный компонент без стандартных периодов", () => {
    expect(component).toContain("export function ExactDateControl");
    expect(component).toContain('className="date-popover fact-date-popover"');
    expect(component).toContain("modifiers={{singleSelected:selectedDate}}");
  });

  it("задает одинаковую темную поверхность поповерам диапазона и точной даты", () => {
    expect(styles).toMatch(/\.date-popover,\s*\.fact-date-popover\s*\{[\s\S]*?background:\s*var\(--surface\)\s*!important/);
    expect(styles).toMatch(/\.date-popover \[data-slot="calendar"\],\s*\.fact-date-popover \[data-slot="calendar"\]\s*\{[\s\S]*?background:\s*var\(--surface\)\s*!important/);
  });

  it("держит компактные стандартные периоды отдельным блоком после сетки календаря на мобильной ширине", () => {
    expect(styles).toContain('.date-popover { display: flex !important; flex-direction: column !important; align-items: stretch !important; }');
    expect(styles).toContain('.date-popover > [data-slot="calendar"] { order: 3 !important; display: block !important; position: static !important;');
    expect(styles).toContain('.date-popover .date-shortcut-toggle { order: 4 !important; display: block !important; position: static !important;');
    expect(styles).toContain('.date-popover:has(.date-shortcuts) .mobile-range-preview { display: none !important; }');
    expect(styles).toContain('.date-shortcuts button { min-height: 26px !important; }');
    expect(component).toContain('className={shortcut.wide?"date-shortcut-wide":undefined}');
    expect(component).not.toContain('className="date-shortcut-group"');
  });

  it("разводит сетку дней и быстрые периоды в мобильном потоке", () => {
    expect(component).toContain('className={showStandard?"calendar-standard-open":undefined}');
    expect(styles).toContain('.date-popover:has(.date-shortcuts) .calendar-standard-open { display: block !important; position: static !important; z-index: auto !important; margin-bottom: 14px !important; }');
    expect(styles).toContain('.date-popover:has(.date-shortcuts) .date-shortcuts { order: 5 !important; position: static !important;');
    expect(styles).toContain('.date-popover > [data-slot="calendar"] { order: 3 !important; display: block !important; position: static !important;');
    expect(styles).toContain('.date-popover .date-shortcut-toggle { order: 4 !important; display: block !important; position: static !important;');
    expect(styles).toContain('.date-popover > [data-slot="calendar"].calendar-standard-open { position: static !important; margin-bottom: 0 !important; }');
    expect(styles).toContain('.date-popover > .date-shortcut-toggle { position: static !important; order: 4 !important; width: 100% !important; margin: 12px 0 0 !important; padding-top: 10px !important;');
    expect(styles).toContain('.date-popover > .date-shortcuts { position: static !important; order: 5 !important; width: 100% !important; margin-top: 8px !important; }');
    expect(finalOverrides).toContain('.date-popover:has(.date-shortcuts) > [data-slot="calendar"].calendar-standard-open { margin-bottom: calc(var(--cell-size, 24px) * 1.3 + 18px) !important; }');
  });

  it("дает быстрый YTD только по завершенным месяцам", () => {
    expect(component).toContain('label:"Год до конца прошлого месяца"');
    expect(component).toContain('from:`${year}-01-01`,to:toIso(previousMonthEnd)');
    expect(component).toContain('label:"С начала года"');
    expect(component).toContain("anchor.getMonth()===0?[]");
    expect(component).not.toContain('label:"Текущий месяц"');
    expect(component).not.toContain('label:"Год по сегодня"');
    expect(component).not.toContain('label:"Сегодня"');
  });

  it("сохраняет срез, примененный стандартной кнопкой, при следующем открытии", () => {
    expect(auditContext).toContain('localStorage.getItem("audit-range")');
    expect(auditContext).toContain("stored?.from && stored.to ? normalizeRange(stored) : defaultRange");
    expect(auditContext).toContain('localStorage.setItem("audit-range", JSON.stringify(range))');
    expect(auditContext).not.toContain('normalized.from==="2026-01-01"&&normalized.to==="2026-08-31"');
  });

  it("не обрезает точный календарь у нижней границы viewport", () => {
    expect(component).toContain('side="top" sideOffset={8} collisionPadding={8} sticky="always"');
    expect(finalOverrides).toContain('body > [data-radix-popper-content-wrapper]:has(.fact-date-popover)');
    expect(finalOverrides).toContain('bottom: max(88px, env(safe-area-inset-bottom, 0px)) !important;');
    expect(finalOverrides).toContain('justify-content: center !important;');
  });
});
