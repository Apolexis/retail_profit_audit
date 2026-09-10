import { describe, expect, it } from "vitest";
import { ALERT_THRESHOLD_DEFAULTS, collectThresholdBreaches, evaluateAlertThresholds, type AlertThreshold, withDerivedCashOperatingCostCandidates } from "./alertThresholds";

const thresholds: AlertThreshold[] = [
  { ruleKey: "cash", metricCode: "cash_operating_costs", comparison: "gte", threshold: 10_000, severity: "warning", label: "Траты нал", description: "расходы", unit: "₽", isEnabled: true },
  { ruleKey: "low-stock", metricCode: "stock_close", comparison: "lte", threshold: 5_000, severity: "critical", label: "Низкий остаток", description: "остаток", unit: "₽", isEnabled: true },
  { ruleKey: "disabled", metricCode: "net_profit", comparison: "lte", threshold: 0, severity: "critical", label: "Прибыль", description: "прибыль", unit: "₽", isEnabled: false },
];

describe("операционные пороги уведомлений", () => {
  it("срабатывают только при правильном направлении сравнения и включенном правиле", () => {
    expect(evaluateAlertThresholds("cash_operating_costs", 12_000, thresholds)).toHaveLength(1);
    expect(evaluateAlertThresholds("cash_operating_costs", 9_999, thresholds)).toHaveLength(0);
    expect(evaluateAlertThresholds("stock_close", 4_999, thresholds)).toHaveLength(1);
    expect(evaluateAlertThresholds("net_profit", -1, thresholds)).toHaveLength(0);
  });

  it("оставляют по одному наиболее сильному нарушению для магазина и правила", () => {
    const breaches = collectThresholdBreaches([
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-01", metricCode: "cash_operating_costs", amount: 12_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "cash_operating_costs", amount: 18_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "stock_close", amount: 4_000 },
    ], thresholds);
    expect(breaches).toHaveLength(2);
    expect(breaches.find(item => item.rule.ruleKey === "cash")?.amount).toBe(18_000);
  });

  it("суммируют наличные статьи как единый риск, даже если готовой строки «Траты нал» нет", () => {
    const candidates = withDerivedCashOperatingCostCandidates([
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "household", amount: 3_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "delivery", amount: -4_500 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "driver_cash", amount: 3_100 },
    ]);
    expect(candidates).toContainEqual(expect.objectContaining({ metricCode: "cash_operating_costs", amount: 10_600 }));
    expect(collectThresholdBreaches(candidates, thresholds).find(item => item.rule.ruleKey === "cash")?.amount).toBe(10_600);
  });

  it("суммируют зарплату, налоги и отпускные в отдельный кандидат ФОТ", () => {
    const candidates = withDerivedCashOperatingCostCandidates([
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "salary_cashless", amount: 12_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "salary_cash", amount: 8_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "payroll_tax", amount: 4_000 },
    ]);
    expect(candidates).toContainEqual(expect.objectContaining({ metricCode: "payroll_costs", amount: 24_000 }));
  });

  it("включают настраиваемый контроль списаний К. в общий реестр сигналов", () => {
    expect(ALERT_THRESHOLD_DEFAULTS).toContainEqual(expect.objectContaining({ ruleKey: "smoked_writeoff_daily", metricCode: "writeoff_smoked", label: "Списания К.", comparison: "gte" }));
  });

  it("включают отдельный настраиваемый контроль высокой уценки", () => {
    expect(ALERT_THRESHOLD_DEFAULTS).toContainEqual(expect.objectContaining({ ruleKey: "discount_daily", metricCode: "discount", label: "Высокая уценка", comparison: "gte", unit: "₽" }));
  });

  it("рассчитывают валовую маржу и падение чистой прибыли как отдельные кандидаты", () => {
    const candidates = withDerivedCashOperatingCostCandidates([
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-01", metricCode: "revenue", amount: 100_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-01", metricCode: "gross_profit", amount: 18_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-01", metricCode: "net_profit", amount: 20_000 },
      { storeId: 7, store: "ПОРТ", entryDate: "2026-09-02", metricCode: "net_profit", amount: -15_000 },
    ]);
    expect(candidates).toContainEqual(expect.objectContaining({ metricCode: "gross_margin_pct", amount: 18 }));
    expect(candidates).toContainEqual(expect.objectContaining({ metricCode: "net_profit_delta", amount: -35_000 }));
    expect(ALERT_THRESHOLD_DEFAULTS).toContainEqual(expect.objectContaining({ ruleKey: "gross_margin_low", unit: "%" }));
    expect(ALERT_THRESHOLD_DEFAULTS).toContainEqual(expect.objectContaining({ ruleKey: "net_profit_drop", metricCode: "net_profit_delta" }));
  });
});
