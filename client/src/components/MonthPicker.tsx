import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const months = ["Ян", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

type MonthPickerProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
};

const valueYear = (value: string) => /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(0, 4)) : new Date().getFullYear();
const valueMonth = (value: string) => /^\d{4}-\d{2}$/.test(value) ? Number(value.slice(5, 7)) - 1 : 0;

/** Тематичный календарь только для выбора месяца, без системного month-input. */
export function MonthPicker({ value, onChange, ariaLabel = "Выбрать месяц" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(() => valueYear(value));
  const selectedMonth = valueMonth(value);
  const selectedYear = valueYear(value);
  useEffect(() => {
    if (!open) setYear(valueYear(value));
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  const label = `${months[selectedMonth]} ${selectedYear}`;
  return (
    <div className="plan-month-picker" ref={rootRef}>
      <button type="button" className={`plan-month-picker-trigger${open ? " is-open" : ""}`} aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        <CalendarDays size={16} />
        <span>{label}</span>
      </button>
      {open && <div className="plan-month-picker-popover" role="dialog" aria-label={`Выбор месяца ${year} года`}>
        <div className="plan-month-picker-heading">
          <button type="button" aria-label="Предыдущий год" onClick={() => setYear(current => current - 1)}><ChevronLeft size={16} /></button>
          <strong>{year}</strong>
          <button type="button" aria-label="Следующий год" onClick={() => setYear(current => current + 1)}><ChevronRight size={16} /></button>
        </div>
        <div className="plan-month-picker-grid" role="grid" aria-label={`Месяцы ${year} года`}>
          {months.map((name, index) => {
            const active = year === selectedYear && index === selectedMonth;
            return <button key={name} type="button" role="gridcell" className={active ? "active" : ""} aria-pressed={active} onClick={() => { onChange(`${year}-${String(index + 1).padStart(2, "0")}`); setOpen(false); }}>{name}</button>;
          })}
        </div>
      </div>}
    </div>
  );
}
