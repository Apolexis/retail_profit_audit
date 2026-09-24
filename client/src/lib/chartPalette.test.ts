import { describe, expect, it } from "vitest";
import { chartPalette } from "./chartPalette";

describe("палитра графиков", () => {
  it("выделяет выбранную серию светлой темы коралловым, а не интерфейсным синим", () => {
    expect(chartPalette("light").selected).toBe("#FF453A");
    expect(chartPalette("light").selected).not.toBe("#0A84FF");
  });

  it("использует iOS-синий для медианы в светлой теме, а не коралловый риск-акцент", () => {
    expect(chartPalette("light").median).toBe("#0A84FF");
    expect(chartPalette("light").median).not.toMatch(/ff375f|ff453a/i);
  });
});
