import { describe, expect, it } from "vitest";
import { dateRangePreview } from "./dateRangePreview";

describe("мобильный предпросмотр диапазона", () => {
  const saved = { from: new Date("2026-01-01T12:00:00"), to: new Date("2026-01-31T12:00:00") };

  it("показывает сохраненный диапазон и его календарную длительность", () => {
    const preview = dateRangePreview(undefined, undefined, saved);
    expect(preview.eyebrow).toBe("ТЕКУЩИЙ ПЕРИОД");
    expect(preview.detail).toBe("31 календарных дн.");
  });

  it("показывает старт до второго клика и обе даты после hover", () => {
    expect(dateRangePreview(new Date("2026-01-10T12:00:00"), undefined, saved).detail).toContain("выберите дату конца");
    const preview = dateRangePreview(new Date("2026-01-10T12:00:00"), new Date("2026-01-20T12:00:00"), saved);
    expect(preview.title).toContain("10 января 2026");
    expect(preview.detail).toBe("11 календарных дн.");
  });
});
