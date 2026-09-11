import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./final-overrides.css", import.meta.url), "utf8");

describe("мобильное fixed-позиционирование", () => {
  it("фиксирует нижнюю навигацию, кнопку наверх и диалог относительно устойчивого small viewport только на телефоне", () => {
    expect(styles).toContain('@media (max-width: 720px) {\n  html,\n  body { overscroll-behavior-y: none; }');
    expect(styles).toContain('top: calc(100svh - env(safe-area-inset-bottom, 0px) - 62px) !important;');
    expect(styles).toContain('top: calc(100svh - env(safe-area-inset-bottom, 0px) - 64px) !important;');
    expect(styles).toContain('top: calc(100svh - env(safe-area-inset-bottom, 0px) - 124px) !important;');
    expect(styles).toContain('top: 50svh !important;');
  });

  it("сохраняет светлую кнопку наверх чистой, без стеклянной наружной текстуры", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet .scroll-top');
    expect(styles).toContain('background: #ffffff !important;');
    expect(styles).toContain('backdrop-filter: none !important;');
    expect(styles).toContain('-webkit-backdrop-filter: none !important;');
  });
});
