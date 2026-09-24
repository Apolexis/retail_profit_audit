type PreviewMetric = { code: string; amount: number };
type PreviewPeriod = { store: string; monthDate: string; entryDate: string; metrics: PreviewMetric[] };
type PreviewConflict = { store: string; monthDate: string; entryDate: string };
type PreviewProtectedMetric = { store: string; entryDate: string; metricCode: string };
type PreviewThresholdBreach = { entryDate: string };

const CASH_ARTICLE_CODES = new Set([
  "household",
  "delivery",
  "cleaning",
  "bonus",
  "seniority",
  "supplement",
  "driver_cash",
  "utilities_cash",
  "operating_costs",
]);

type DailyPreviewTotal = {
  entryDate: string;
  periodCount: number;
  cashTotals: Record<string, number>;
  ndflTotal: number;
  conflictCount: number;
  protectedMetricCount: number;
  thresholdBreachCount: number;
};

const ensureDay = (days: Map<string, DailyPreviewTotal>, entryDate: string) => {
  const current = days.get(entryDate);
  if (current) return current;
  const created: DailyPreviewTotal = {
    entryDate,
    periodCount: 0,
    cashTotals: {},
    ndflTotal: 0,
    conflictCount: 0,
    protectedMetricCount: 0,
    thresholdBreachCount: 0,
  };
  days.set(entryDate, created);
  return created;
};

/**
 * Keeps large workbook preview responses small enough for an interactive browser.
 * The full parsed detail remains server-side for commit; the UI receives only the
 * exact calendar aggregates and a limited set of human-readable examples.
 */
export function buildImportPreviewSummary<T extends PreviewThresholdBreach>(
  preview: {
    year: number;
    stores: string[];
    periods: PreviewPeriod[];
    recognitionIssues: Array<{ sheet: string; message: string }>;
    conflicts: PreviewConflict[];
    protectedMetrics: PreviewProtectedMetric[];
  },
  thresholdBreaches: T[],
) {
  const days = new Map<string, DailyPreviewTotal>();

  preview.periods.forEach(period => {
    const day = ensureDay(days, period.entryDate);
    day.periodCount += 1;
    period.metrics.forEach(metric => {
      if (CASH_ARTICLE_CODES.has(metric.code)) {
        day.cashTotals[metric.code] = (day.cashTotals[metric.code] ?? 0) + Math.abs(Number(metric.amount));
      }
      if (metric.code === "personal_income_tax_22") day.ndflTotal += Math.abs(Number(metric.amount));
    });
  });

  preview.conflicts.forEach(conflict => {
    ensureDay(days, conflict.entryDate).conflictCount += 1;
  });
  preview.protectedMetrics.forEach(metric => {
    ensureDay(days, metric.entryDate).protectedMetricCount += 1;
  });
  thresholdBreaches.forEach(breach => {
    ensureDay(days, breach.entryDate).thresholdBreachCount += 1;
  });

  return {
    year: preview.year,
    stores: preview.stores,
    periodCount: preview.periods.length,
    recognitionIssues: preview.recognitionIssues,
    technicalDays: Array.from(days.values()).map(day => ({ entryDate: day.entryDate, periodCount: day.periodCount, conflictCount: day.conflictCount, protectedMetricCount: day.protectedMetricCount })).sort((left, right) => left.entryDate.localeCompare(right.entryDate)),
    dailyTotals: Array.from(days.values()).sort((left, right) => left.entryDate.localeCompare(right.entryDate)),
    conflictCount: preview.conflicts.length,
    conflictSamples: preview.conflicts.slice(0, 24),
    protectedMetricCount: preview.protectedMetrics.length,
    protectedMetricSamples: preview.protectedMetrics.slice(0, 24),
    thresholdBreachCount: thresholdBreaches.length,
    thresholdBreaches: thresholdBreaches.slice(0, 12),
  };
}
