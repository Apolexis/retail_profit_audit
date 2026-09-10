import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

describe("скрытые полосы прокрутки", () => {
  it("скрывает системные scrollbar без запрета прокрутки", () => {
    expect(styles).toContain("scrollbar-width: none;");
    expect(styles).toContain(".packet *::-webkit-scrollbar");
    expect(styles).not.toMatch(/overflow:\s*hidden\s*!important;\s*\/\*\s*global-scrollbar/);
  });
});
