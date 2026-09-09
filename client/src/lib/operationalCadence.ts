import { monthBounds } from "./dateAllocation";

export type CadenceMetric = "revenue" | "netProfit" | "purchases" | "expenses" | "writeoffFrozen";
export type CadenceSource = { monthDate: string; entryDate: string; importId: number | null; metrics: Record<string, unknown> };
export type CadencePoint = { date: string; month: string; revenue: number; netProfit: number; purchases: number; expenses: number; writeoffFrozen: number };
export type CadenceResult = { daily: CadencePoint[]; weekly: CadencePoint[]; monthlySources: number; manualRows: number };

const DAY_MS = 86_400_000;
const expenseCodes = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "cash_operating_costs", "driver_cashless", "utilities_cashless", "rent", "bank_fee", "gross_profit_tax", "salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_22"];

const toUtc = (value: string) => Date.parse(`${value}T00:00:00Z`);
const dateString = (timestamp: number) => { const date = new Date(timestamp); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; };
const dateLabel = (value: string) => value.slice(8, 10) + "." + value.slice(5, 7);
const metricNumber = (metrics: Record<string, unknown>, key: string) => Number(metrics[key] ?? 0);
const valuesFor = (metrics: Record<string, unknown>) => ({ revenue: metricNumber(metrics, "revenue"), netProfit: metricNumber(metrics, "net_profit"), purchases: metricNumber(metrics, "purchases"), expenses: expenseCodes.reduce((total, key) => total + Math.abs(metricNumber(metrics, key)), 0), writeoffFrozen: metricNumber(metrics, "writeoff_frozen") });

const isoWeek = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const week = Math.ceil((((date.getTime() - start) / DAY_MS) + 1) / 7);
  return { key: `${year}-${String(week).padStart(2, "0")}`, label: `Нед. ${week} · ${year}` };
};

const blank = (date: string): CadencePoint => ({ date, month: dateLabel(date), revenue: 0, netProfit: 0, purchases: 0, expenses: 0, writeoffFrozen: 0 });
const add = (target: CadencePoint, source: ReturnType<typeof valuesFor>, divisor = 1) => { target.revenue += source.revenue / divisor; target.netProfit += source.netProfit / divisor; target.purchases += source.purchases / divisor; target.expenses += source.expenses / divisor; target.writeoffFrozen += source.writeoffFrozen / divisor; };

/** Builds an explicitly calculated daily/weekly view from already range-filtered monthly flows; stock snapshots are intentionally excluded. */
export function buildOperationalCadence(rows: CadenceSource[], range: { from: string; to: string }): CadenceResult {
  const dailyByDate = new Map<string, CadencePoint>();
  for (let timestamp = toUtc(range.from); timestamp <= toUtc(range.to); timestamp += DAY_MS) { const date = dateString(timestamp); dailyByDate.set(date, blank(date)); }
  let monthlySources = 0;
  let manualRows = 0;
  for (const row of rows) {
    const values = valuesFor(row.metrics);
    const importedMonthly = row.importId !== null && row.entryDate === `${row.monthDate}-01`;
    if (!importedMonthly) {
      if (dailyByDate.has(row.entryDate)) { add(dailyByDate.get(row.entryDate)!, values); manualRows += 1; }
      continue;
    }
    const bounds = monthBounds(row.monthDate);
    const from = Math.max(toUtc(bounds.from), toUtc(range.from));
    const to = Math.min(toUtc(bounds.to), toUtc(range.to));
    if (to < from) continue;
    const days = Math.round((to - from) / DAY_MS) + 1;
    monthlySources += 1;
    for (let timestamp = from; timestamp <= to; timestamp += DAY_MS) add(dailyByDate.get(dateString(timestamp))!, values, days);
  }
  const daily = Array.from(dailyByDate.values());
  const weeklyByKey = new Map<string, CadencePoint>();
  for (const day of daily) { const week = isoWeek(day.date); const point = weeklyByKey.get(week.key) ?? { ...blank(week.key), month: week.label }; point.revenue += day.revenue; point.netProfit += day.netProfit; point.purchases += day.purchases; point.expenses += day.expenses; point.writeoffFrozen += day.writeoffFrozen; weeklyByKey.set(week.key, point); }
  return { daily, weekly: Array.from(weeklyByKey.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point), monthlySources, manualRows };
}
