import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./OceanLoader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("векторная загрузка", () => {
  it("использует SVG-орбиты версии 1c6f03bd без растровых изображений", () => {
    expect(component).toContain("<svg className=\"facts-loader-art\"");
    expect(component).toContain("FishSpinner");
    expect(component).toContain('{ id: "h"');
    expect(component).toContain("SCHOOL_PATHS.map");
    expect(component).toContain('const SCHOOL_RING = "M80 18 A62 62 0 1 1 80 142 A62 62 0 1 1 80 18"');
    expect(component).toContain('begin: "-7.70s", duration: "8.8s"');
    expect(component).toContain('<animateMotion path={SCHOOL_RING} dur={duration} begin={begin} repeatCount="indefinite" rotate="auto" />');
    expect(component).not.toContain("<img");
  });

  it("сохраняет траекторию версии 1c6f03bd, показывает рыб уже в первом кадре и уважает системное уменьшение анимации", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(component).toContain('className="facts-school"');
    expect(component).not.toContain('className="facts-school" opacity="0"');
    expect(component).not.toContain('<animate attributeName="opacity"');
    expect(component).not.toContain("facts-school-orbit");
    expect(component).not.toContain("animateTransform");
    expect(styles).toContain(".facts-loader .facts-school { transform: none !important; animation: none !important; }");
    expect(styles).toContain(".facts-loader .facts-fish-body { transform-box: fill-box; transform-origin: 50% 50%; animation: facts-fish-pulse");
    expect(styles).toContain("@keyframes facts-fish-pulse");
    expect(styles).toContain(".facts-loader .facts-loader-art { width: 150px !important; height: 150px !important; }");
    expect(styles).toContain(".ocean-loader .facts-loader-art { width: min(268px, 68vw) !important;");
  });
});
