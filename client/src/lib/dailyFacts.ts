export type DailyFactSource = {
  storeId: number;
  store: string;
  isHidden: boolean;
  importId: number | null;
  monthDate: string;
  entryDate: string;
  metrics: Record<string, number>;
};

/**
 * The importer materializes approved once-a-month columns into precise calendar-day facts.
 * This selector only filters and copies those stored facts, so the UI never redistributes
 * sales, taxes, daily operations or a manual correction a second time.
 */
export function prepareDailyFacts(rows: DailyFactSource[], range: { from: string; to: string }): DailyFactSource[] {
  return rows
    .filter(row => row.entryDate >= range.from && row.entryDate <= range.to)
    .map(row => ({ ...row, metrics: { ...row.metrics } }))
    .sort((left, right) => left.entryDate.localeCompare(right.entryDate) || left.store.localeCompare(right.store));
}
