import { describe, expect, it } from "vitest";
import { chartPalette } from "./chartPalette";

describe("палитра графиков", () => {
  it("выделяет выбранную серию светлой темы коралловым, а не интерфейсным синим", () => {
    expect(chartPalette("light").selected).toBe("#FF453A");
    expect(chartPalette("light").selected).not.toBe("#0A84FF");
  });
});
