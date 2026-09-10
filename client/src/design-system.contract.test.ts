import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./design-system.css", import.meta.url), "utf8");

describe("общая анимация действий", () => {
  it("не поднимает кнопки и ссылки при наведении", () => {
    expect(styles).toContain(".packet button:not(:disabled):hover");
    expect(styles).toMatch(/\.packet button:not\(:disabled\):hover,[\s\S]*?transform:\s*none;/);
    expect(styles).not.toMatch(/\.packet button:not\(:disabled\):hover,[\s\S]{0,280}?translateY\(-1px\)/);
  });

  it("оставляет тактильное сжатие только при нажатии", () => {
    expect(styles).toMatch(/\.packet button:not\(:disabled\):active,[\s\S]*?transform:\s*translateY\(0\) scale\(\.965\)/);
  });
});
