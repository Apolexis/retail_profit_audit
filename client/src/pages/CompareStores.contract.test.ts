import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./CompareStores.tsx", import.meta.url), "utf8");

describe("страница «Сравнить»", () => {
  it("содержит полный сгруппированный выбор уже рассчитанных показателей", () => {
    expect(page).toContain("Детализация расходов");
    expect(page).toContain("stockChange");
    expect(page).toContain("coverDays");
    expect(page).toContain("expenseDefinitions.map");
  });

  it("корректно различает деньги, проценты и дни покрытия", () => {
    expect(page).toContain('type MetricKind = "money" | "percent" | "number"');
    expect(page).toContain("displayMode={chartMode}");
    expect(page).toContain("Дней покрытия");
  });
});
