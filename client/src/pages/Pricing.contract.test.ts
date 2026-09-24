import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Pricing.tsx", import.meta.url), "utf8");

describe("страница «Цены»", () => {
  it("формирует рекомендацию только по фактической наценке и ее изменению", () => {
    expect(page).toContain("function recommendationFor");
    expect(page).toContain("Наценка заметно снижается");
    expect(page).toContain("Наценка ниже типичного уровня сети");
    expect(page).toContain("markupDelta");
  });

  it("заполняет блок месячной наценки фактическими выводами под графиком", () => {
    expect(page).toContain("pricing-monthly-facts");
    expect(page).toContain("pricing-recommendation");
    expect(page).toContain("Последний месяц с наценкой");
  });

  it("использует расчетную наценку из фактических продаж и закупок с корректной агрегацией", () => {
    expect(page).toContain("summary.markupSmoked");
    expect(page).toContain("summary.markupFrozen");
    expect(page).toContain("summary.markupTotal");
    expect(page).toContain('"% наценки Общий"');
    expect(page).toContain("Наценка рассчитывается из фактических продаж и закупок");
    expect(page).toContain("(продажи − закупки) ÷ закупки × 100");
    expect(page).not.toContain("values.sales / values.purchase");
  });

  it("дает детальную сопоставимую раскладку трех видов наценки", () => {
    expect(page).toContain("const markupDetails = useMemo");
    expect(page).toContain("pricing-markup-detail");
    expect(page).toContain("Копченая, мороженая и общий товарный поток");
    expect(page).toContain("Продажи {money(item.selectedPair.sales)}");
    expect(page).toContain("Закупки {money(item.selectedPair.purchase)}");
    const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
    expect(styles).toContain(".packet .pricing-markup-detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
  });

  it("дает KPI отклонения от медианы самостоятельную тему и оставляет риск отдельным состоянием", () => {
    const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
    expect(page).toContain('"packet-kpi pricing-median-gap"');
    expect(page).toContain('"packet-kpi pricing-median-gap risk"');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .pricing-median-gap { background: #f4f8ff');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .pricing-median-gap.risk { background: #fff5f5');
  });
});
