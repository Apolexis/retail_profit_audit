import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./OceanLoader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("векторная загрузка", () => {
  it("показывает единственный косяк на круге без растровых изображений", () => {
    expect(component).toContain('<svg className="facts-loader-art"');
    expect(component).toContain("FishSpinner");
    expect(component).toContain('{ id: "h", scale: .40, angle: 315 }');
    expect(component).toContain("SCHOOL_PATHS.map");
    expect(component).toContain('transform={`rotate(${angle} 80 80)`}');
    expect(component).toContain('transform="translate(80 18)"');
    expect(component).not.toContain("<img");
  });

  it("запускает движение из исходной точки каждой рыбы и не рисует переходный слой", () => {
    expect(component).toContain('<animateTransform attributeName="transform" type="rotate" from={`${angle} 80 80`} to={`${angle + 360} 80 80`} dur="8.8s" begin="0s" repeatCount="indefinite" />');
    expect(component).toContain("function useReducedMotion()");
    expect(component).toContain('className="facts-school"');
    expect(component).not.toContain("FirstFrameFish");
    expect(component).not.toContain("facts-school-first-frame");
    expect(styles).toContain(".facts-loader .facts-school { opacity: 1; transform: none !important; animation: none !important; }");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".facts-loader .facts-fish-body { transform-box: fill-box; transform-origin: 50% 50%; animation: facts-fish-pulse");
    expect(styles).toContain("@keyframes facts-fish-pulse");
  });
});
