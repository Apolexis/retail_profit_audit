import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const pilot = readFileSync(new URL("./Pilot.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("./ControlCenter.tsx", import.meta.url), "utf8");
const charts = readFileSync(new URL("../components/AuditCharts.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("повторный документ: hover и устойчивые контролы", () => {
  it("сохраняет целевые блоки Пилота и Динамики для тематического hover-контура", () => {
    expect(pilot).toContain("scenario-result");
    expect(control).toContain("comparison-periods");
    expect(styles).toContain('.packet .scenario-result:hover');
    expect(styles).toContain('.packet .comparison-periods article:hover');
  });

  it("не позволяет выбранному режиму «Магазины» переноситься", () => {
    expect(charts).toContain("Ряды (выбор режима отображения на графике)");
    expect(styles).toContain("white-space: nowrap; overflow-wrap: normal; word-break: keep-all;");
  });
});
