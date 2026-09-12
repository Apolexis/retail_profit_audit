export type CadenceMetric =
  | "revenue" | "cashRevenue" | "cashlessRevenue" | "receiptsTotal" | "grossProfit" | "netProfit" | "purchases" | "purchaseSmoked" | "purchaseFrozen" | "salesSmoked" | "salesFrozen"
  | "expenses" | "cashExpenses" | "cashTaxes" | "household" | "delivery" | "cleaning" | "bonus" | "seniority" | "supplement" | "driverCash" | "utilitiesCash" | "operatingCosts"
  | "cashlessOperatingCosts" | "driverCashless" | "utilitiesCashless" | "rent" | "bankFee" | "grossProfitTax" | "salaryCashless" | "payrollTax" | "vacationCashless" | "vacationTax" | "salaryCash" | "vacationCash"
  | "writeoffSmoked" | "writeoffFrozen" | "movement" | "discount";

export type CadenceSource = { monthDate: string; entryDate: string; importId: number | null; metrics: Record<string, unknown> };
export type CadencePoint = { date: string; month: string } & Record<CadenceMetric, number>;
export type CadenceResult = { daily: CadencePoint[]; weekly: CadencePoint[]; monthly: CadencePoint[]; monthlySources: number; manualRows: number };

const DAY_MS = 86_400_000;
const expenseCodes = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs", "cashless_operating_costs", "cash_operating_costs", "driver_cashless", "utilities_cashless", "rent", "bank_fee", "gross_profit_tax", "salary_cashless", "payroll_tax", "vacation_cashless", "vacation_tax", "salary_cash", "vacation_cash", "personal_income_tax_22"];
const cashCodes = ["household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs"] as const;

const toUtc = (value: string) => Date.parse(`${value}T00:00:00Z`);
const dateString = (timestamp: number) => { const date = new Date(timestamp); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; };
const dateLabel = (value: string) => value.slice(8, 10) + "." + value.slice(5, 7);
const metricNumber = (metrics: Record<string, unknown>, key: string) => Number(metrics[key] ?? 0);
const expenseAmount = (metrics: Record<string, unknown>, key: string) => Math.abs(metricNumber(metrics, key));

type CadenceValues = Omit<CadencePoint, "date" | "month">;
const valuesFor = (metrics: Record<string, unknown>): CadenceValues => ({
  revenue: metricNumber(metrics, "revenue"), cashRevenue: metricNumber(metrics, "cash_revenue"), cashlessRevenue: metricNumber(metrics, "cashless_revenue"), receiptsTotal: metricNumber(metrics, "receipts_total"), grossProfit: metricNumber(metrics, "gross_profit"), netProfit: metricNumber(metrics, "net_profit"), purchases: metricNumber(metrics, "purchases"), purchaseSmoked: metricNumber(metrics, "purchase_smoked"), purchaseFrozen: metricNumber(metrics, "purchase_frozen"), salesSmoked: metricNumber(metrics, "sales_smoked"), salesFrozen: metricNumber(metrics, "sales_frozen"),
  expenses: expenseCodes.reduce((total, key) => total + expenseAmount(metrics, key), 0), cashExpenses: cashCodes.reduce((total, key) => total + expenseAmount(metrics, key), 0), cashTaxes: expenseAmount(metrics, "personal_income_tax_22"), household: expenseAmount(metrics, "household"), delivery: expenseAmount(metrics, "delivery"), cleaning: expenseAmount(metrics, "cleaning"), bonus: expenseAmount(metrics, "bonus"), seniority: expenseAmount(metrics, "seniority"), supplement: expenseAmount(metrics, "supplement"), driverCash: expenseAmount(metrics, "driver_cash"), utilitiesCash: expenseAmount(metrics, "utilities_cash"), operatingCosts: expenseAmount(metrics, "operating_costs"),
  cashlessOperatingCosts: expenseAmount(metrics, "cashless_operating_costs"), driverCashless: expenseAmount(metrics, "driver_cashless"), utilitiesCashless: expenseAmount(metrics, "utilities_cashless"), rent: expenseAmount(metrics, "rent"), bankFee: expenseAmount(metrics, "bank_fee"), grossProfitTax: expenseAmount(metrics, "gross_profit_tax"), salaryCashless: expenseAmount(metrics, "salary_cashless"), payrollTax: expenseAmount(metrics, "payroll_tax"), vacationCashless: expenseAmount(metrics, "vacation_cashless"), vacationTax: expenseAmount(metrics, "vacation_tax"), salaryCash: expenseAmount(metrics, "salary_cash"), vacationCash: expenseAmount(metrics, "vacation_cash"),
  writeoffSmoked: metricNumber(metrics, "writeoff_smoked"), writeoffFrozen: metricNumber(metrics, "writeoff_frozen"), movement: metricNumber(metrics, "movement"), discount: metricNumber(metrics, "discount"),
});

const cadenceKeys: CadenceMetric[] = ["revenue", "cashRevenue", "cashlessRevenue", "receiptsTotal", "grossProfit", "netProfit", "purchases", "purchaseSmoked", "purchaseFrozen", "salesSmoked", "salesFrozen", "expenses", "cashExpenses", "cashTaxes", "household", "delivery", "cleaning", "bonus", "seniority", "supplement", "driverCash", "utilitiesCash", "operatingCosts", "cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax", "salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash", "writeoffSmoked", "writeoffFrozen", "movement", "discount"];
const blank = (date: string): CadencePoint => { const values = {} as Record<CadenceMetric, number>; cadenceKeys.forEach(key => { values[key] = 0; }); return { date, month: dateLabel(date), ...values }; };
const add = (target: CadencePoint, source: CadenceValues) => { cadenceKeys.forEach(key => { target[key] += source[key]; }); };

const isoWeek = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const week = Math.ceil((((date.getTime() - start) / DAY_MS) + 1) / 7);
  return { key: `${year}-${String(week).padStart(2, "0")}`, label: `Нед. ${week} · ${year}` };
};

const monthLabel = (value: string) => new Intl.DateTimeFormat("ru-RU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`));

/** Aggregates prepared daily facts. Stock snapshots remain intentionally outside the operating cadence. */
export function buildOperationalCadence(rows: CadenceSource[], range: { from: string; to: string }): CadenceResult {
  const dailyByDate = new Map<string, CadencePoint>();
  for (let timestamp = toUtc(range.from); timestamp <= toUtc(range.to); timestamp += DAY_MS) { const date = dateString(timestamp); dailyByDate.set(date, blank(date)); }
  const sourceMonths = new Set<string>();
  let manualRows = 0;
  for (const row of rows) {
    const values = valuesFor(row.metrics);
    if (dailyByDate.has(row.entryDate)) add(dailyByDate.get(row.entryDate)!, values);
    if (row.importId === null) manualRows += 1; else sourceMonths.add(row.monthDate);
  }
  const daily = Array.from(dailyByDate.values());
  const weeklyByKey = new Map<string, CadencePoint>();
  for (const day of daily) { const week = isoWeek(day.date); const point = weeklyByKey.get(week.key) ?? { ...blank(week.key), month: week.label }; const { date: _date, month: _month, ...values } = day; add(point, values); weeklyByKey.set(week.key, point); }
  const monthlyByKey = new Map<string, CadencePoint>();
  for (const day of daily) { const key = day.date.slice(0, 7); const point = monthlyByKey.get(key) ?? { ...blank(key), month: monthLabel(key) }; const { date: _date, month: _month, ...values } = day; add(point, values); monthlyByKey.set(key, point); }
  return { daily, weekly: Array.from(weeklyByKey.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point), monthly: Array.from(monthlyByKey.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point), monthlySources: sourceMonths.size, manualRows };
}
