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

  it("движет весь видимый косяк по часовой окружности и отключает движение при системном уменьшении анимации", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(component).toContain('className="facts-school-orbit"');
    expect(component).toContain('type="rotate" from="0 80 80" to="360 80 80" dur="4.8s"');
    expect(component).toContain('transform="translate(0 -10)"');
    expect(styles).toContain(".facts-loader .facts-loader-art { width: 142px !important; height: 142px !important; }");
    expect(styles).toContain(".facts-loader .facts-school-orbit");
    expect(styles).toContain("backdrop-filter: blur(18px)");
    expect(styles).toContain(".ocean-loader.overlay .ocean-loader-art");
    expect(styles).toContain(".ocean-loader .facts-loader-art");
  });
});
