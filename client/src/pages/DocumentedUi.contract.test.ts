import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("правки из документа", () => {
  it("раскладывает KPI и независимые графики последовательно", () => {
    expect(read("./Home.tsx")).toContain('className="packet-kpis home-kpis"');
    expect(read("./Pricing.tsx")).toContain("pricing-chart-stack");
    expect(read("./MonthlyComparison.tsx")).toContain("monthly-chart-stack");
    expect(read("./ControlCenter.tsx")).toContain("comparison-chart-stack");
  });

  it("строит фактический состав расходов и безопасный календарный popover", () => {
    const monthly = read("./MonthlyComparison.tsx");
    expect(monthly).toContain("expenseDefinitions");
    expect(monthly).toContain("expenseCompositionDefinitions");
    expect(monthly).toContain("expense-composition-card");
    expect(monthly).toContain('definition.group === "expense"');
    const dateRange = read("../components/DateRangeControl.tsx");
    expect(dateRange).toContain('collisionPadding={12}');
  });

  it("закрепляет единый каскад колонок tooltip и светлых единиц", () => {
    const css = read("../final-overrides.css");
    expect(css).toContain("pricing-chart-stack");
    expect(css).toContain("tiny-tooltip-values-3");
    expect(css).toContain("tiny-tooltip-single");
    expect(css).toContain("minmax(6ch, 1fr)");
    expect(css).toContain("min-width: 6ch;");
    expect(css).toContain('html[data-audit-theme="light"] .packet .card-title > small');
    expect(css).toContain("max-block-size: calc(100dvh - 24px)");
  });
});
