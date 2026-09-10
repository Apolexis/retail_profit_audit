import { describe, expect, it } from "vitest";
import { summarizeImportThresholdBreaches } from "./importBinaryRoutes";

describe("summarizeImportThresholdBreaches", () => {
  it("сводит множественные риски импорта в одно уведомление вместо сотен одинаковых карточек", () => {
    const summary = summarizeImportThresholdBreaches("2025.xlsx", [
      { store: "ПОРТ", storeId: 1, entryDate: "2025-01-01", amount: -100, rule: { ruleKey: "negative_profit", label: "Отрицательная чистая прибыль", severity: "critical", description: "", threshold: 0 } },
      { store: "ПОРТ", storeId: 1, entryDate: "2025-01-02", amount: -50, rule: { ruleKey: "negative_profit", label: "Отрицательная чистая прибыль", severity: "critical", description: "", threshold: 0 } },
      { store: "КНИП", storeId: 2, entryDate: "2025-01-03", amount: 0, rule: { ruleKey: "low_revenue", label: "Низкая выручка", severity: "warning", description: "", threshold: 30_000 } },
    ]);
    expect(summary.severity).toBe("critical");
    expect(summary.title).toBe("Импорт: 3 пороговых сигналов");
    expect(summary.message).toContain("2 магазинах");
    expect(summary.message).toContain("Отрицательная чистая прибыль — 2");
  });

  it("предусматривает переход из итогового сигнала в ленту подробных рисков", () => {
    const source = require("node:fs").readFileSync(new URL("./importBinaryRoutes.ts", import.meta.url), "utf8");
    expect(source).toContain('entityType: "alert_feed"');
  });
});
