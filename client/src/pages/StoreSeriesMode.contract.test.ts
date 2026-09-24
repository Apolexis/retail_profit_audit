import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const charts = readFileSync(new URL("../components/AuditCharts.tsx", import.meta.url), "utf8");
const months = readFileSync(new URL("./MonthlyComparison.tsx", import.meta.url), "utf8");
const pricing = readFileSync(new URL("./Pricing.tsx", import.meta.url), "utf8");

describe("режим отображения рядов вне медианных графиков", () => {
  it("дает общий доступный переключатель с явными состояниями", () => {
    expect(charts).toContain("export function StoreSeriesModeToggle");
    expect(charts).toContain('aria-label="Ряды: выбор режима отображения на графике"');
    expect(charts).toContain('?"Магазины":"Итого"');
  });

  it("показывает фактические магазинные ряды в месячном разборе только для сети", () => {
    expect(months).toContain("const [showStoreSeries, setShowStoreSeries] = useState(false);");
    expect(months).toContain("const storeSeriesChart = useMemo");
    expect(months).toContain("if (!all || !showStoreSeries) return null;");
    expect(months).toContain("<StoreSeriesModeToggle active={showStoreSeries}");
  });

  it("показывает фактические магазинные ряды наценки только для сети", () => {
    expect(pricing).toContain("const [showStoreSeries, setShowStoreSeries] = useState(false);");
    expect(pricing).toContain("const storeMonthly = useMemo");
    expect(pricing).toContain("if (!all || !showStoreSeries) return null;");
    expect(pricing).toContain("<StoreSeriesModeToggle active={showStoreSeries}");
  });
});
