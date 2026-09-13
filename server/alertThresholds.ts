import { asc, eq } from "drizzle-orm";
import { auditAlertThresholds } from "../drizzle/schema";
import { getDb } from "./db";

export type ThresholdComparison = "gte" | "lte";
export type ThresholdSeverity = "critical" | "warning";
export type AlertThresholdDefinition = { ruleKey: string; metricCode: string; comparison: ThresholdComparison; threshold: number; severity: ThresholdSeverity; label: string; description: string; unit: string };

export const ALERT_THRESHOLD_DEFAULTS: AlertThresholdDefinition[] = [
  { ruleKey: "cash_expense_daily", metricCode: "cash_operating_costs", comparison: "gte", threshold: 15_000, severity: "warning", label: "Общие траты нал", description: "сумма наличных расходов за день", unit: "₽" },
  { ruleKey: "ndfl_22_daily", metricCode: "personal_income_tax_22", comparison: "gte", threshold: 5_000, severity: "warning", label: "НДФЛ 22%", description: "начисление НДФЛ 22% за день", unit: "₽" },
  { ruleKey: "stock_low", metricCode: "stock_close", comparison: "lte", threshold: 15_000, severity: "critical", label: "Низкий остаток", description: "конечный остаток на дату", unit: "₽" },
  { ruleKey: "stock_high", metricCode: "stock_close", comparison: "gte", threshold: 300_000, severity: "warning", label: "Высокий остаток", description: "конечный остаток на дату", unit: "₽" },
  { ruleKey: "negative_profit", metricCode: "net_profit", comparison: "lte", threshold: 0, severity: "critical", label: "Отрицательная чистая прибыль", description: "чистая прибыль за день", unit: "₽" },
  { ruleKey: "frozen_writeoff_daily", metricCode: "writeoff_frozen", comparison: "gte", threshold: 50_000, severity: "warning", label: "Списания М.", description: "списания мороженой продукции за день", unit: "₽" },
  { ruleKey: "smoked_writeoff_daily", metricCode: "writeoff_smoked", comparison: "gte", threshold: 50_000, severity: "warning", label: "Списания К.", description: "списания копченой продукции за день", unit: "₽" },
  { ruleKey: "low_revenue_daily", metricCode: "revenue", comparison: "lte", threshold: 30_000, severity: "warning", label: "Низкая выручка", description: "выручка за день", unit: "₽" },
  { ruleKey: "discount_daily", metricCode: "discount", comparison: "gte", threshold: 15_000, severity: "warning", label: "Высокая уценка", description: "уценка товара за день", unit: "₽" },
  { ruleKey: "gross_profit_nonpositive", metricCode: "gross_profit", comparison: "lte", threshold: 0, severity: "critical", label: "Неваловая прибыль", description: "валовая прибыль не выше нуля за день", unit: "₽" },
  { ruleKey: "gross_margin_low", metricCode: "gross_margin_pct", comparison: "lte", threshold: 20, severity: "warning", label: "Низкая валовая маржа", description: "доля валовой прибыли в выручке за день", unit: "%" },
  { ruleKey: "net_profit_drop", metricCode: "net_profit_delta", comparison: "lte", threshold: -30_000, severity: "warning", label: "Резкое снижение чистой прибыли", description: "снижение к предыдущей доступной дате", unit: "₽" },
  { ruleKey: "cashless_expense_daily", metricCode: "cashless_operating_costs", comparison: "gte", threshold: 20_000, severity: "warning", label: "Расходы безнал", description: "безналичные операционные расходы за день", unit: "₽" },
  { ruleKey: "payroll_cost_daily", metricCode: "payroll_costs", comparison: "gte", threshold: 35_000, severity: "warning", label: "ФОТ и отпускные", description: "зарплата, налоги и отпускные за день", unit: "₽" },
  { ruleKey: "markup_median_deviation", metricCode: "markup_median_deviation_pp", comparison: "gte", threshold: 8, severity: "warning", label: "Наценка отклоняется от медианы", description: "абсолютный разрыв расчетной общей наценки с медианой сети за дату", unit: "п.п." },
];

export const CASH_OPERATING_COMPONENT_CODES = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs"] as const;
const cashOperatingComponentSet = new Set<string>(CASH_OPERATING_COMPONENT_CODES);
export const PAYROLL_COMPONENT_CODES = ["salary_cashless", "salary_cash", "payroll_tax", "vacation_cashless", "vacation_tax", "vacation_cash"] as const;
const payrollComponentSet = new Set<string>(PAYROLL_COMPONENT_CODES);

export type AlertThreshold = AlertThresholdDefinition & { id?: number; isEnabled: boolean };

export async function ensureAlertThresholds() {
  const db = await getDb();
  if (!db) return [] as AlertThreshold[];
  for (const rule of ALERT_THRESHOLD_DEFAULTS) {
    await db.insert(auditAlertThresholds).values({ ruleKey: rule.ruleKey, metricCode: rule.metricCode, comparison: rule.comparison, threshold: String(rule.threshold), severity: rule.severity, isEnabled: true }).onDuplicateKeyUpdate({ set: { ruleKey: rule.ruleKey } });
  }
  return listAlertThresholds();
}

export async function listAlertThresholds(): Promise<AlertThreshold[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(auditAlertThresholds).orderBy(asc(auditAlertThresholds.id));
  const defaultsByKey = new Map(ALERT_THRESHOLD_DEFAULTS.map(rule => [rule.ruleKey, rule]));
  return rows.flatMap(row => {
    const base = defaultsByKey.get(row.ruleKey);
    if (!base) return [];
    return [{ ...base, id: row.id, threshold: Number(row.threshold), severity: row.severity as ThresholdSeverity, comparison: row.comparison as ThresholdComparison, isEnabled: row.isEnabled }];
  });
}

export async function updateAlertThreshold(input: { ruleKey: string; threshold: number; isEnabled: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const definition = ALERT_THRESHOLD_DEFAULTS.find(rule => rule.ruleKey === input.ruleKey);
  if (!definition) throw new Error("Порог не найден");
  await db.insert(auditAlertThresholds).values({ ruleKey: definition.ruleKey, metricCode: definition.metricCode, comparison: definition.comparison, threshold: String(input.threshold), severity: definition.severity, isEnabled: input.isEnabled }).onDuplicateKeyUpdate({ set: { threshold: String(input.threshold), isEnabled: input.isEnabled } });
  return (await listAlertThresholds()).find(rule => rule.ruleKey === input.ruleKey)!;
}

export function evaluateAlertThresholds(metricCode: string, amount: number, thresholds: AlertThreshold[]) {
  return thresholds.filter(rule => rule.isEnabled && rule.metricCode === metricCode && (rule.comparison === "gte" ? amount >= rule.threshold : amount <= rule.threshold));
}

export type ThresholdCandidate = { storeId: number; store: string; entryDate: string; metricCode: string; amount: number; context?: { markup: number; median: number; direction: "выше" | "ниже" } };
export type ThresholdBreach = ThresholdCandidate & { rule: AlertThreshold };

const median = (items: number[]) => {
  const sorted = [...items].sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Adds the same total-markup formula that powers the analytics UI: (sales − purchases) ÷ purchases × 100. */
export function withDerivedMarkupMedianDeviationCandidates(candidates: ThresholdCandidate[]) {
  const byStoreDate = new Map<string, { storeId: number; store: string; entryDate: string; sales: number; purchases: number }>();
  for (const candidate of candidates) {
    if (!["sales_smoked", "sales_frozen", "purchase_smoked", "purchase_frozen"].includes(candidate.metricCode)) continue;
    const key = `${candidate.storeId}:${candidate.entryDate}`;
    const current = byStoreDate.get(key) ?? { storeId: candidate.storeId, store: candidate.store, entryDate: candidate.entryDate, sales: 0, purchases: 0 };
    if (candidate.metricCode === "sales_smoked" || candidate.metricCode === "sales_frozen") current.sales += candidate.amount;
    else current.purchases += candidate.amount;
    byStoreDate.set(key, current);
  }
  const markupByDate = new Map<string, Array<{ storeId: number; store: string; entryDate: string; markup: number }>>();
  for (const item of Array.from(byStoreDate.values())) {
    if (item.purchases === 0) continue;
    const markup = ((item.sales - item.purchases) / item.purchases) * 100;
    if (!Number.isFinite(markup)) continue;
    const values = markupByDate.get(item.entryDate) ?? [];
    values.push({ ...item, markup });
    markupByDate.set(item.entryDate, values);
  }
  const derived: ThresholdCandidate[] = [];
  for (const values of Array.from(markupByDate.values())) {
    if (values.length < 2) continue;
    const networkMedian = median(values.map(item => item.markup));
    for (const item of values) {
      const difference = item.markup - networkMedian;
      if (difference === 0) continue;
      derived.push({
        storeId: item.storeId,
        store: item.store,
        entryDate: item.entryDate,
        metricCode: "markup_median_deviation_pp",
        amount: Math.abs(difference),
        context: { markup: item.markup, median: networkMedian, direction: difference > 0 ? "выше" : "ниже" },
      });
    }
  }
  return [...candidates, ...derived];
}

/** Converts the mutually independent cash articles into one controllable daily cash-expense candidate. */
export function withDerivedCashOperatingCostCandidates(candidates: ThresholdCandidate[]) {
  const passthrough: ThresholdCandidate[] = [];
  const grouped = new Map<string, { storeId: number; store: string; entryDate: string; cashTotal: number; payrollTotal: number; directCashAmount?: number }>();
  const financial = new Map<string, { storeId: number; store: string; entryDate: string; revenue?: number; grossProfit?: number; netProfit?: number }>();
  for (const candidate of candidates) {
    if (candidate.metricCode === "revenue" || candidate.metricCode === "gross_profit" || candidate.metricCode === "net_profit") {
      const key = `${candidate.storeId}:${candidate.entryDate}`;
      const current = financial.get(key) ?? { storeId: candidate.storeId, store: candidate.store, entryDate: candidate.entryDate };
      if (candidate.metricCode === "revenue") current.revenue = candidate.amount;
      if (candidate.metricCode === "gross_profit") current.grossProfit = candidate.amount;
      if (candidate.metricCode === "net_profit") current.netProfit = candidate.amount;
      financial.set(key, current);
    }
    if (candidate.metricCode !== "cash_operating_costs" && !cashOperatingComponentSet.has(candidate.metricCode) && !payrollComponentSet.has(candidate.metricCode)) {
      passthrough.push(candidate);
      continue;
    }
    const key = `${candidate.storeId}:${candidate.entryDate}`;
    const current = grouped.get(key) ?? { storeId: candidate.storeId, store: candidate.store, entryDate: candidate.entryDate, cashTotal: 0, payrollTotal: 0 };
    if (candidate.metricCode === "cash_operating_costs") current.directCashAmount = Math.abs(candidate.amount);
    else if (cashOperatingComponentSet.has(candidate.metricCode)) current.cashTotal += Math.abs(candidate.amount);
    else current.payrollTotal += Math.abs(candidate.amount);
    grouped.set(key, current);
  }
  const dailyCandidates = [...passthrough, ...Array.from(grouped.values()).flatMap(item => [
    { storeId: item.storeId, store: item.store, entryDate: item.entryDate, metricCode: "cash_operating_costs", amount: item.cashTotal || item.directCashAmount || 0 },
    { storeId: item.storeId, store: item.store, entryDate: item.entryDate, metricCode: "payroll_costs", amount: item.payrollTotal },
  ])];
  const netProfitByStore = new Map<number, Array<{ storeId: number; store: string; entryDate: string; amount: number }>>();
  for (const row of Array.from(financial.values())) {
    if (row.revenue !== undefined && row.grossProfit !== undefined && row.revenue !== 0) dailyCandidates.push({ storeId: row.storeId, store: row.store, entryDate: row.entryDate, metricCode: "gross_margin_pct", amount: (row.grossProfit / row.revenue) * 100 });
    if (row.netProfit !== undefined) {
      const list = netProfitByStore.get(row.storeId) ?? [];
      list.push({ storeId: row.storeId, store: row.store, entryDate: row.entryDate, amount: row.netProfit });
      netProfitByStore.set(row.storeId, list);
    }
  }
  for (const values of Array.from(netProfitByStore.values())) {
    values.sort((left, right) => left.entryDate.localeCompare(right.entryDate));
    for (let index = 1; index < values.length; index += 1) {
      const current = values[index], previous = values[index - 1];
      dailyCandidates.push({ storeId: current.storeId, store: current.store, entryDate: current.entryDate, metricCode: "net_profit_delta", amount: current.amount - previous.amount });
    }
  }
  return dailyCandidates;
}

export function collectThresholdBreaches(candidates: ThresholdCandidate[], thresholds: AlertThreshold[]) {
  const strongest = new Map<string, ThresholdBreach>();
  for (const candidate of candidates) for (const rule of evaluateAlertThresholds(candidate.metricCode, candidate.amount, thresholds)) {
    const key = `${candidate.storeId}:${rule.ruleKey}`;
    const current = strongest.get(key);
    const isStronger = !current || (rule.comparison === "gte" ? candidate.amount > current.amount : candidate.amount < current.amount);
    if (isStronger) strongest.set(key, { ...candidate, rule });
  }
  return Array.from(strongest.values());
}
