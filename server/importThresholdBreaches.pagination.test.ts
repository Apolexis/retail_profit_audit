import { describe, expect, it } from "vitest";
import { pageImportThresholdBreaches } from "./audit";

describe("постраничная выдача подробностей импортного сигнала", () => {
  it("не возвращает весь список за раз и сохраняет курсор следующей страницы", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    const result = pageImportThresholdBreaches(items, { limit: 10 });
    expect(result).toEqual({ items: items.slice(0, 10), nextCursor: 10 });
    expect(pageImportThresholdBreaches(items, { limit: 10, cursor: result.nextCursor ?? 0 })).toEqual({ items: items.slice(10, 20), nextCursor: 20 });
  });

  it("ограничивает размер одной страницы безопасным максимумом", () => {
    const items = Array.from({ length: 105 }, (_, index) => index + 1);
    const result = pageImportThresholdBreaches(items, { limit: 1_000 });
    expect(result.items).toHaveLength(100);
    expect(result.nextCursor).toBe(100);
  });
});
