import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./OceanLoader.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("векторная загрузка", () => {
  it("использует общий круговой SVG с последовательным косяком без растровых изображений", () => {
    expect(component).toContain("<svg className=\"facts-loader-art\"");
    expect(component).toContain("FishSpinner");
    expect(component).toContain('{ id: "h"');
    expect(component).toContain("SCHOOL_PATHS.map");
    expect(component).toContain("SCHOOL_RING");
    expect(component).toContain("begin={begin} repeatCount=\"indefinite\" rotate=\"auto\"");
    expect(component).toContain('begin: "-1.10s"');
    expect(component).not.toContain("<img");
  });

  it("не вращает весь косяк и отключает вторичное движение при системном уменьшении анимации", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".ocean-loader *");
    expect(styles).toContain("facts-fish-glide");
    expect(styles).toContain(".facts-loader .facts-school { animation: none !important;");
    expect(styles).toContain("backdrop-filter: blur(18px)");
    expect(styles).toContain(".ocean-loader.overlay .ocean-loader-art");
    expect(styles).toContain(".ocean-loader .facts-loader-art");
  });
});
