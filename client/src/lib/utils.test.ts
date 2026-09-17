import { describe, expect, it } from "vitest";
import { formatMoscowDateTime, MOSCOW_TIME_ZONE, normalizeDecimalInputText } from "./utils";

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

  it("не подменяет некорректную метку текущим временем", () => {
    expect(formatMoscowDateTime("не дата")).toBe("время не указано");
  });
});
