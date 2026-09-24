import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./RevenuePlan.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../revenue-plan.css", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../server/monthlyRevenuePlan.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers/audit.ts", import.meta.url), "utf8");


describe("рекомендация месячного плана выручки", () => {
  it("показывает расчет как редактируемое предложение, а не сохраняет его автоматически", () => {
    expect(page).toContain("РЕКОМЕНДАЦИЯ");
    expect(page).toContain("Подставить");
    expect(page).toContain("setDraftAmount(String(editingRow.recommendation.recommendedAmount))");
    expect(page).toContain("row.planAmount === null && row.recommendation.recommendedAmount !== null ? String(row.recommendation.recommendedAmount)");
    expect(page).toContain("рекомендация не выдумывается");
  });

  it("опирается на продажи Эвотор текущего и соответствующего месяца прошлого года", () => {
    expect(service).toContain("previousYearMonth(input.monthDate)");
    expect(service).toContain("lastYearTotals.get(store.id)?.actualAmount ?? null");
    expect(service).toContain("currentYearAmount");
    expect(service).toContain("suggestMonthlyRevenuePlan");
    expect(service).toContain("eq(operationalEvotorDocuments.documentType, \"SELL\")");
  });

  it("сохраняет адаптивность и тематические цвета блока рекомендации", () => {
    expect(styles).toContain(".revenue-plan-suggestion");
    expect(styles).toContain('html[data-audit-theme="light"] .revenue-plan-suggestion');
    expect(styles).toContain("@media(max-width:780px){.revenue-plan-suggestion{grid-column:1/-1}");
  });

  it("не отдает продавцу суммы и расчетную рекомендацию", () => {
    expect(router).toContain('actor.role==="seller"?{...result,rows:result.rows.map(row=>({...row,planAmount:null,actualAmount:0,checks:0,recommendation:{recommendedAmount:null,mode:"unavailable" as const,lastYearAmount:null,currentYearAmount:null,currentYearForecast:null}}))}:result');
  });
});
