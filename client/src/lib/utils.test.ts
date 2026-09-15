import { describe, expect, it } from "vitest";
import { formatMoscowDateTime, MOSCOW_TIME_ZONE } from "./utils";

describe("московский формат времени", () => {
  it("показывает абсолютную UTC‑метку в часовом поясе Москвы", () => {
    expect(MOSCOW_TIME_ZONE).toBe("Europe/Moscow");
    expect(formatMoscowDateTime("2026-09-15T09:05:07.000Z")).toMatch(/^15\.09\.2026,? 12:05:07$/);
  });

  it("не подменяет некорректную метку текущим временем", () => {
    expect(formatMoscowDateTime("не дата")).toBe("время не указано");
  });
});
