import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

describe("мобильное fixed-позиционирование", () => {
  it("фиксирует нижнюю навигацию и кнопку наверх относительно stable safe-area, а диалог — относительно малого viewport", () => {
    expect(styles).toContain('@media (max-width: 720px) {\n  html,\n  body { overscroll-behavior-y: none; }');
    expect(styles).not.toContain('top: calc(100svh - env(safe-area-inset-bottom, 0px)');
    expect(styles).toContain('inset-block-end: calc(env(safe-area-inset-bottom, 0px) + 8px) !important;');
    expect(styles).toContain('inset-block-end: calc(env(safe-area-inset-bottom, 0px) + 80px) !important;');
    expect(styles).toContain('top: 50svh !important;');
  });

  it("сохраняет светлую кнопку наверх чистой, без стеклянной наружной текстуры", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .scroll-top');
    expect(styles).toContain('background: #ffffff !important;');
    expect(styles).toContain('backdrop-filter: none !important;');
    expect(styles).toContain('-webkit-backdrop-filter: none !important;');
  });
});
