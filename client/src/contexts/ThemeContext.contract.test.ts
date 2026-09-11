import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ThemeContext.tsx", import.meta.url), "utf8");

describe("глобальное touch-hover поведение", () => {
  it("на coarse-устройствах исключает только hover-селекторы, сохраняя active и focus-visible", () => {
    expect(source).toContain('const touchHoverQuery = "(hover: none), (pointer: coarse)"');
    expect(source).toContain("function splitTopLevelSelectors(value: string)");
    expect(source).toContain("function useTouchHoverGuard()");
    expect(source).toContain("splitTopLevelSelectors(original)");
    expect(source).toContain('filter(selector => !selector.includes(":hover"))');
    expect(source).toContain('rule.selectorText = preserved || ".touch-hover-rule-disabled"');
    expect(source).toContain('document.documentElement.dataset.touchHoverDisabled = "true"');
    expect(source).toContain("useTouchHoverGuard();");
  });
});
