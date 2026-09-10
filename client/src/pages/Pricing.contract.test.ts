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
    expect(page).toContain("Последний месяц с закупкой");
  });
});
