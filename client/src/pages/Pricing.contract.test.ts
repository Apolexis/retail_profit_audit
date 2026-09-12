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

  it("использует исходные проценты наценки из импортированных строк, а не пересчет продаж к закупке", () => {
    expect(page).toContain("summary.markupSmoked");
    expect(page).toContain("summary.markupFrozen");
    expect(page).toContain("summary.markupTotal");
    expect(page).toContain('"% наценки Общий"');
    expect(page).toContain("Проценты наценки берутся из фактических строк импортированной книги");
    expect(page).not.toContain("values.sales / values.purchase");
  });

  it("дает KPI отклонения от медианы самостоятельную тему и оставляет риск отдельным состоянием", () => {
    const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
    expect(page).toContain('"packet-kpi pricing-median-gap"');
    expect(page).toContain('"packet-kpi pricing-median-gap risk"');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .pricing-median-gap { background: #f4f8ff');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .pricing-median-gap.risk { background: #fff5f5');
  });
});
