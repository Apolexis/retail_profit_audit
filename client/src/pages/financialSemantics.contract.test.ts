import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pagesDirectory = resolve(import.meta.dirname);
const financialPages = [
  "CompareStores.tsx",
  "ControlCenter.tsx",
  "Expenses.tsx",
  "Forecast.tsx",
  "Home.tsx",
  "MonthlyComparison.tsx",
  "Pilot.tsx",
  "PlanFact.tsx",
  "Portfolio.tsx",
  "Pricing.tsx",
  "Stores.tsx",
  "WeeklyReports.tsx",
];

describe("финансовая семантика страниц", () => {
  it("разделяет положительные и отрицательные денежные результаты на всех ключевых аналитических экранах", () => {
    for (const filename of financialPages) {
      const source = readFileSync(resolve(pagesDirectory, filename), "utf8");
      expect(source, filename).toContain("positive");
      expect(source, filename).toContain("negative");
    }
  });
});
