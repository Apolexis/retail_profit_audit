import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudit } from "@/contexts/AuditContext";
import "@/calendar-range.css";

const toIso = (date: Date) => format(date, "yyyy-MM-dd");
const endOfMonth = (year: string, month: number) => format(new Date(Number(year), month, 0), "yyyy-MM-dd");

export function DateRangeControl({ compact = false }: { compact?: boolean }) {
  const { range, setRange, rangeLabel } = useAudit();
  const [open, setOpen] = useState(false);
  const [showStandard, setShowStandard] = useState(false);
  const [draft, setDraft] = useState<DateRange>();
  const selected: DateRange = { from: parseISO(range.from), to: parseISO(range.to) };

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, range.from, range.to]);

  const applyRange = (next: { from: string; to: string }, close = true) => {
    setRange(next);
    setDraft({ from: parseISO(next.from), to: parseISO(next.to) });
    if (close) window.setTimeout(() => setOpen(false), 180);
  };
  const selectRange = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from && next?.to) applyRange({ from: toIso(next.from), to: toIso(next.to) });
  };
  const year = range.from.slice(0, 4);
  const shortcuts = [
    { label: "Весь год", from: `${year}-01-01`, to: `${year}-12-31` },
    { label: "I квартал", from: `${year}-01-01`, to: endOfMonth(year, 3) },
    { label: "II квартал", from: `${year}-04-01`, to: endOfMonth(year, 6) },
    { label: "III квартал", from: `${year}-07-01`, to: endOfMonth(year, 9) },
    { label: "IV квартал", from: `${year}-10-01`, to: endOfMonth(year, 12) },
  ];
  const label = draft?.from ? (draft.to ? `${format(draft.from, "d MMMM yyyy", { locale: ru })} — ${format(draft.to, "d MMMM yyyy", { locale: ru })}` : "Выберите конечный месяц") : rangeLabel;

  return <Popover open={open} onOpenChange={value => { setOpen(value); if (!value) setDraft(undefined); }}>
    <PopoverTrigger asChild><button className={compact ? "date-range-control compact" : "date-range-control"} aria-label="Изменить период анализа"><CalendarDays size={15}/><span>{rangeLabel}</span><ChevronDown size={13}/></button></PopoverTrigger>
    <PopoverContent className="date-popover" align="end" sideOffset={10}>
      <div className="date-popover-head"><span>ПЕРИОД АНАЛИЗА</span><b>{label}</b></div>
      <Calendar mode="range" locale={ru} selected={draft} defaultMonth={draft?.from ?? selected.from} numberOfMonths={2} onSelect={selectRange}/>
      <div className="date-shortcut-toggle"><button type="button" onClick={() => setShowStandard(value => !value)}>Показать стандартные периоды <ChevronDown size={13} className={showStandard ? "rotated" : ""}/></button></div>
      {showStandard && <div className="date-shortcuts">{shortcuts.map(shortcut => <button type="button" key={shortcut.label} onClick={() => applyRange(shortcut)}>{shortcut.label}</button>)}</div>}
      <p className="date-popover-hint">Сначала выберите начало, затем конец диапазона. После второго выбора период применится автоматически.</p>
    </PopoverContent>
  </Popover>;
}
