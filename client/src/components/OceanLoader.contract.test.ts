import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./OceanLoader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("векторная загрузка", () => {
  it("использует общий круговой SVG с видимым в первом кадре косяком без растровых изображений", () => {
    expect(component).toContain("<svg className=\"facts-loader-art\"");
    expect(component).toContain("FishSpinner");
    expect(component).toContain('{ id: "h"');
    expect(component).toContain("SCHOOL_PATHS.map");
    expect(component).toContain("x: 73, y: 10");
    expect(component).toContain("rotation: 138");
    expect(component).toContain("transform={`translate(${x} ${y}) rotate(${rotation})`}");
    expect(component).not.toContain("<img");
  });

  it("использует единый заметный вращающийся косяк во всех состояниях загрузки и отключает движение при системном уменьшении анимации", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(component).toContain('className="facts-school"');
    expect(component).not.toContain("facts-school-orbit");
    expect(component).not.toContain("animateTransform");
    expect(styles).toContain(".facts-loader .facts-school { transform-box: fill-box; transform-origin: center; animation: facts-school-spin 3.8s linear infinite !important;");
    expect(styles).toContain(".facts-loader .facts-fish-body { animation: facts-fish-glide");
    expect(styles).toContain(".facts-loader .facts-loader-art { width: 240px !important; height: 240px !important; }");
    expect(styles).toContain("backdrop-filter: blur(18px)");
    expect(styles).toContain(".ocean-loader.overlay .ocean-loader-art");
    expect(styles).toContain(".ocean-loader .facts-loader-art");
  });
});
