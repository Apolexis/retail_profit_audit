import { Search } from "lucide-react";
import "./chart-table-search.css";

type ChartTableSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  shownRows: number;
  totalRows: number;
};

export function chartTableMatches(query: string, ...values: Array<string | number | null | undefined>) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  if (!normalizedQuery) return true;
  return values.some(value => String(value ?? "").toLocaleLowerCase("ru-RU").includes(normalizedQuery));
}

/** A local, non-focusing search. It filters only the already rendered table rows. */
export function ChartTableSearch({ value, onChange, placeholder, ariaLabel, shownRows, totalRows }: ChartTableSearchProps) {
  void shownRows;
  void totalRows;
  return <label className="chart-table-search" role="search">
    <input
      type="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
    <Search size={16} aria-hidden="true" />
  </label>;
}
