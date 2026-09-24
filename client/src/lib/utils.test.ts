import { describe, expect, it } from "vitest";
import { businessMonthsInRange, businessWeekStart, formatBusinessCalendarDate, formatMoscowDateTime, MOSCOW_TIME_ZONE, moscowBusinessDate, normalizeDecimalInputText, previousBusinessPeriod, shiftBusinessDate } from "./utils";

describe("московский формат времени", () => {
  it("заменяет запятую на точку в редактируемых дробных значениях", () => {
    expect(normalizeDecimalInputText("125,5")).toBe("125.5");
    expect(normalizeDecimalInputText("1,25,5")).toBe("1.25.5");
    expect(normalizeDecimalInputText("125.5")).toBe("125.5");
  });

  it("показывает абсолютную UTC‑метку в часовом поясе Москвы", () => {
    expect(MOSCOW_TIME_ZONE).toBe("Europe/Moscow");
    expect(formatMoscowDateTime("2026-09-15T09:05:07.000Z")).toMatch(/^15\.09\.2026,? 12:05:07$/);
  });

  it("вычисляет операционный день по Москве, а не по часовому поясу устройства", () => {
    expect(moscowBusinessDate(new Date("2026-09-30T21:30:00.000Z"))).toBe("2026-10-01");
    expect(moscowBusinessDate(new Date("2026-09-30T20:59:59.000Z"))).toBe("2026-09-30");
  });

  it("не подменяет некорректную метку текущим временем", () => {
    expect(formatMoscowDateTime("не дата")).toBe("время не указано");
  });

  it("обрабатывает business-даты без локального часового пояса устройства", () => {
    expect(businessWeekStart("2026-09-20")).toBe("2026-09-14");
    expect(formatBusinessCalendarDate("2026-09-20", { day: "2-digit", month: "short" })).toMatch(/^20 сент\.?$/);
    expect(businessMonthsInRange({ from: "2026-01-30", to: "2026-03-02" })).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(previousBusinessPeriod({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-01-29", to: "2026-02-28" });
    expect(shiftBusinessDate("2026-03-01", -30)).toBe("2026-01-30");
    expect(shiftBusinessDate("некорректно", -1)).toBeNull();
  });
});
