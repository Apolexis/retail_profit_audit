export type DailyFactSource = {
  storeId: number;
  store: string;
  isHidden: boolean;
  importId: number | null;
  monthDate: string;
  entryDate: string;
  metrics: Record<string, number>;
};

/** Confirmed by the business owner: these columns are entered once per month and may be allocated across calendar days. */
export const MONTHLY_ALLOCATED_CODES = new Set([
  "delivery", "cleaning", "bonus", "seniority", "supplement", "driver_cash", "utilities_cash", "operating_costs", "cashless_operating_costs",
  "driver_cashless", "utilities_cashless", "rent", "salary_cashless", "salary_cash", "payroll_tax", "vacation_cashless", "vacation_tax", "vacation_cash", "net_profit",
]);

const DAY_MS = 86_400_000;
const toUtc = (value: string) => Date.parse(`${value}T00:00:00Z`);
const toIso = (timestamp: number) => { const date = new Date(timestamp); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`; };
const monthEnd = (monthDate: string) => { const [year, month] = monthDate.split("-").map(Number); return `${monthDate}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`; };
const datesFor = (monthDate: string, range: { from: string; to: string }) => { const first = Math.max(toUtc(`${monthDate}-01`), toUtc(range.from)); const last = Math.min(toUtc(monthEnd(monthDate)), toUtc(range.to)); const result: string[] = []; for (let date = first; date <= last; date += DAY_MS) result.push(toIso(date)); return result; };
const number = (metrics: Record<string, number>, code: string) => Number(metrics[code] ?? 0);
const fixedMetrics = (metrics: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(metrics).filter(([code]) => !MONTHLY_ALLOCATED_CODES.has(code))) as Record<string, number>;

/** Keeps operating figures at their actual dates; only owner-approved monthly entries are spread across calendar days. */
export function prepareDailyFacts(rows: DailyFactSource[], range: { from: string; to: string }): DailyFactSource[] {
  const grouped = new Map<string, DailyFactSource[]>();
  rows.forEach(row => grouped.set(`${row.storeId}:${row.monthDate}`, [...(grouped.get(`${row.storeId}:${row.monthDate}`) ?? []), row]));
  const result: DailyFactSource[] = [];

  for (const storeMonthRows of Array.from(grouped.values())) {
    const monthDate = storeMonthRows[0]!.monthDate;
    const imported: DailyFactSource[] = storeMonthRows.filter((row: DailyFactSource) => row.importId !== null);
    const manual: DailyFactSource[] = storeMonthRows.filter((row: DailyFactSource) => row.importId === null);
    const hasPrimaryDailyRows = imported.some(row => row.entryDate !== `${monthDate}-01`);

    if (hasPrimaryDailyRows) {
      const byDate = new Map<string, DailyFactSource>(imported.map((row: DailyFactSource) => [row.entryDate, row]));
      const monthlyTotals: Record<string, number> = Object.fromEntries(Array.from(MONTHLY_ALLOCATED_CODES).map(code => [code, imported.reduce((total: number, row: DailyFactSource) => total + number(row.metrics, code), 0)]));
      const allMonthDays = Math.round((toUtc(monthEnd(monthDate)) - toUtc(`${monthDate}-01`)) / DAY_MS) + 1;
      for (const date of datesFor(monthDate, range)) {
        const source = byDate.get(date) ?? imported[0]!;
        const metrics: Record<string, number> = { ...fixedMetrics(source.metrics) };
        for (const [code, amount] of Object.entries(monthlyTotals) as Array<[string, number]>) if (amount) metrics[code] = amount / allMonthDays;
        result.push({ ...source, entryDate: date, metrics });
      }
    }

    manual.filter((row: DailyFactSource) => row.entryDate >= range.from && row.entryDate <= range.to).forEach((row: DailyFactSource) => result.push(row));
  }
  return result.sort((left, right) => left.entryDate.localeCompare(right.entryDate) || left.store.localeCompare(right.store));
}
