export type ForecastFact = { store: string; monthDate: string; metrics: Record<string, number> };
export type ForecastRow = { month: string; monthNumber: number; historical: number | null; actual: number | null; forecast: number | null; forecastBasis: "seasonality" | "run_rate" | null };

const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const numeric = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildSeasonalForecast(input: { facts: ForecastFact[]; year: number; store: string; metric: string }) {
  const historyYear = input.year - 1;
  const inScope = input.store === "__all__" ? input.facts : input.facts.filter(row => row.store === input.store);
  const monthRows = (year: number, month: number) => inScope.filter(row => row.monthDate.startsWith(`${year}-${String(month).padStart(2, "0")}`));
  const valueFor = (year: number, month: number) => monthRows(year, month).reduce((sum, row) => sum + numeric(row.metrics[input.metric]), 0);
  const hasMetric = (year: number, month: number) => monthRows(year, month).some(row => Object.hasOwn(row.metrics, input.metric));
  const latestActualMonth = Array.from({ length: 12 }, (_, index) => index + 1).filter(month => hasMetric(input.year, month)).at(-1) ?? 0;
  const historicalToDate = Array.from({ length: latestActualMonth }, (_, index) => valueFor(historyYear, index + 1)).reduce((sum, value) => sum + value, 0);
  const actualToDate = Array.from({ length: latestActualMonth }, (_, index) => valueFor(input.year, index + 1)).reduce((sum, value) => sum + value, 0);
  const recentActualMonths = Array.from({ length: Math.min(3, latestActualMonth) }, (_, index) => latestActualMonth - index).filter(month => hasMetric(input.year, month));
  const recentActualAverage = recentActualMonths.length ? recentActualMonths.reduce((sum, month) => sum + valueFor(input.year, month), 0) / recentActualMonths.length : null;
  const historicalFutureMonths = Array.from({ length: Math.max(0, 12 - latestActualMonth) }, (_, index) => latestActualMonth + index + 1).filter(month => hasMetric(historyYear, month));
  const historicalFutureAverage = historicalFutureMonths.length ? historicalFutureMonths.reduce((sum, month) => sum + valueFor(historyYear, month), 0) / historicalFutureMonths.length : null;
  const scaleFactor = recentActualAverage !== null && historicalFutureAverage !== null && historicalFutureAverage !== 0 ? recentActualAverage / historicalFutureAverage : null;
  const rows: ForecastRow[] = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const historical = hasMetric(historyYear, month) ? valueFor(historyYear, month) : null;
    const actual = month <= latestActualMonth && hasMetric(input.year, month) ? valueFor(input.year, month) : null;
    const forecastBasis = month > latestActualMonth ? historical !== null && scaleFactor !== null ? "seasonality" : recentActualAverage !== null ? "run_rate" : null : null;
    const forecast = forecastBasis === "seasonality" && historical !== null ? historical * Number(scaleFactor) : forecastBasis === "run_rate" ? recentActualAverage : null;
    return { month: monthNames[index], monthNumber: month, historical, actual, forecast, forecastBasis };
  });
  const forecastRows = rows.filter(row => row.forecast !== null);
  const forecastTotal = forecastRows.reduce((sum, row) => sum + Number(row.forecast), 0);
  const yearEndExpected = actualToDate + forecastTotal;
  const peak = [...forecastRows].sort((left, right) => Number(right.forecast) - Number(left.forecast))[0] ?? null;
  const trough = [...forecastRows].sort((left, right) => Number(left.forecast) - Number(right.forecast))[0] ?? null;
  return { historyYear, latestActualMonth, actualToDate, historicalToDate, recentActualAverage, historicalFutureAverage, scaleFactor, rows, forecastRows, forecastTotal, yearEndExpected, peak, trough };
}
