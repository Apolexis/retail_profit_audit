import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const files = [
  "access.css",
  "audit.css",
  "calendar-range.css",
  "design-system.css",
  "index.css",
  "ios-light-theme.css",
  "mobile-nav.css",
  "theme-refresh.css",
];

function closingBrace(source: string, opening: number): number {
  let depth = 1;
  let quote: string | null = null;
  let escaped = false;

  for (let index = opening + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error("Unclosed CSS block");
}

function unguardedHoverSelectors(source: string, inheritsHoverCapability = false): string[] {
  const result: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const opening = source.indexOf("{", cursor);
    if (opening < 0) break;
    const closing = closingBrace(source, opening);
    const prelude = source.slice(cursor, opening);
    const body = source.slice(opening + 1, closing);
    const trimmed = prelude.trim();

    if (trimmed.startsWith("@")) {
      result.push(
        ...unguardedHoverSelectors(body, inheritsHoverCapability || trimmed.includes("hover: hover")),
      );
    } else if (prelude.includes(":hover") && !inheritsHoverCapability) {
      result.push(prelude.replace(/\s+/g, " ").trim());
    }

    cursor = closing + 1;
  }

  return result;
}

describe("global touch-hover contract", () => {
  it("ограничивает интерактивный hover возможностями точного указателя", () => {
    for (const filename of files) {
      const source = readFileSync(resolve(root, filename), "utf8");
      expect(source, filename).toContain("@media (hover: hover) and (pointer: fine)");
      expect(unguardedHoverSelectors(source), filename).toEqual([]);
    }
  });

  it("не прячет keyboard focus в hover capability media", () => {
    const source = readFileSync(resolve(root, "design-system.css"), "utf8");
    expect(source).toContain("button:focus-visible");
    expect(source).toContain("select:focus");
    expect(source).toContain("input[type=\"time\"]:focus");
  });

  it("сохраняет выбранный магазин отдельным persistent-состоянием", () => {
    const source = readFileSync(resolve(root, "index.css"), "utf8");
    expect(source).toContain(".store-index-grid button.active-store{background:#dcebe3}");
  });
});
