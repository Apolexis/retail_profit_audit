import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, RotateCcw } from "lucide-react";
import { endOfMonth, endOfQuarter, endOfWeek, format, parseISO, startOfMonth, startOfQuarter, startOfWeek, subMonths, subWeeks } from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { dateRangePreview } from "@/lib/dateRangePreview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import "@/calendar-range.css";

const toIso=(date:Date)=>format(date,"yyyy-MM-dd");
const labelFor=(value:DateRangeValue)=>`${format(parseISO(value.from),"d MMM yyyy",{locale:ru})} — ${format(parseISO(value.to),"d MMM yyyy",{locale:ru})}`;
type Shortcut={label:string;from:string;to:string;group:"Быстрые"|"Месяцы"|"Кварталы"};
type Props={compact?:boolean;value?:DateRangeValue;onChange?:(value:DateRangeValue)=>void;title?:string;ariaLabel?:string};

export function DateRangeControl({compact=false,value,onChange,title="ПЕРИОД АНАЛИЗА",ariaLabel="Изменить период анализа"}:Props){
  const audit=useAudit(); const current=value??audit.range; const setCurrent=onChange??audit.setRange;
  const [open,setOpen]=useState(false); const [showStandard,setShowStandard]=useState(false); const [draft,setDraft]=useState<DateRange>(); const [hovered,setHovered]=useState<Date>(); const selected:{from:Date;to:Date}={from:parseISO(current.from),to:parseISO(current.to)};
  useEffect(()=>{if(!open){setDraft(undefined);setHovered(undefined)}},[open]);
  const applyRange=(next:DateRangeValue,close=true)=>{setCurrent(next);setDraft({from:parseISO(next.from),to:parseISO(next.to)});if(close)window.setTimeout(()=>setOpen(false),260)};
  const pickDay=(day:Date)=>{if(!draft?.from||draft.to||day<draft.from){setDraft({from:day});setHovered(undefined);return}applyRange({from:toIso(draft.from),to:toIso(day)})};
  const localToday=new Date(); const localDayKey=toIso(localToday); const year=localToday.getFullYear();
  const shortcuts=useMemo<Shortcut[]>(()=>{const anchor=new Date(`${localDayKey}T12:00:00`);const currentMonthStart=startOfMonth(anchor);const previousMonthStart=startOfMonth(subMonths(anchor,1));const currentWeekStart=startOfWeek(anchor,{weekStartsOn:1});const previousWeekStart=startOfWeek(subWeeks(anchor,1),{weekStartsOn:1});return [{group:"Быстрые",label:"Сегодня",from:toIso(anchor),to:toIso(anchor)},{group:"Быстрые",label:"Текущая неделя",from:toIso(currentWeekStart),to:toIso(endOfWeek(anchor,{weekStartsOn:1}))},{group:"Быстрые",label:"Прошлая неделя",from:toIso(previousWeekStart),to:toIso(endOfWeek(subWeeks(anchor,1),{weekStartsOn:1}))},{group:"Быстрые",label:"С начала этого года",from:`${year}-01-01`,to:localDayKey},{group:"Месяцы",label:"Текущий месяц",from:toIso(currentMonthStart),to:toIso(endOfMonth(anchor))},{group:"Месяцы",label:"Предыдущий месяц",from:toIso(previousMonthStart),to:toIso(endOfMonth(previousMonthStart))},{group:"Кварталы",label:"I квартал",from:toIso(startOfQuarter(new Date(year,0,1))),to:toIso(endOfQuarter(new Date(year,0,1)))},{group:"Кварталы",label:"II квартал",from:toIso(startOfQuarter(new Date(year,3,1))),to:toIso(endOfQuarter(new Date(year,3,1)))},{group:"Кварталы",label:"III квартал",from:toIso(startOfQuarter(new Date(year,6,1))),to:toIso(endOfQuarter(new Date(year,6,1)))},{group:"Кварталы",label:"IV квартал",from:toIso(startOfQuarter(new Date(year,9,1))),to:toIso(endOfQuarter(new Date(year,9,1)))}]},[localDayKey,year]);
  const preview=draft?.from&&!draft.to&&hovered&&hovered>draft.from?{from:draft.from,to:hovered}:undefined;
  const draftStart=draft?.from;const previewEnd=preview?.to??draft?.to;const mobilePreview=dateRangePreview(draftStart,previewEnd,selected);
  const label=draft?.from?(draft.to?`${format(draft.from,"d MMMM yyyy",{locale:ru})} — ${format(draft.to,"d MMMM yyyy",{locale:ru})}`:`Начало: ${format(draft.from,"d MMMM yyyy",{locale:ru})} · выберите конец`):labelFor(current);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button className={compact?"date-range-control compact":"date-range-control"} aria-label={ariaLabel}><CalendarDays size={15}/><span>{labelFor(current)}</span><ChevronDown size={13}/></button></PopoverTrigger>
    <PopoverContent className="date-popover" align="end" sideOffset={10}>
      <div className="date-popover-head"><span>{title}</span><b>{label}</b>{draftStart&&<button type="button" className="date-reset" onClick={()=>{setDraft(undefined);setHovered(undefined)}}><RotateCcw size={13}/>Начать заново</button>}</div>
      <div className="mobile-range-preview" aria-live="polite"><small>{mobilePreview.eyebrow}</small><strong>{mobilePreview.title}</strong><span>{mobilePreview.detail}</span></div>
      <Calendar mode="range" locale={ru} selected={draft??selected} defaultMonth={draftStart??selected.from} numberOfMonths={2} showOutsideDays={false} onDayClick={pickDay} onDayMouseLeave={()=>setHovered(undefined)} components={{DayButton:({day,modifiers,className,...props})=><CalendarDayButton day={day} modifiers={modifiers} className={[className,modifiers.preview?"range-preview-day":""].filter(Boolean).join(" ")} {...props} onMouseEnter={()=>setHovered(day.date)}/>}} modifiers={preview?{preview}:undefined} modifiersClassNames={{preview:"range-preview"}}/>
      <div className="date-shortcut-toggle"><button type="button" onClick={()=>setShowStandard(item=>!item)}>Стандартные периоды <ChevronDown size={13} className={showStandard?"rotated":""}/></button></div>
      {showStandard&&<div className="date-shortcuts">{(["Быстрые","Месяцы","Кварталы"] as const).map(group=><div key={group} className="date-shortcut-group"><small>{group}</small><div>{shortcuts.filter(shortcut=>shortcut.group===group).map(shortcut=><button type="button" key={shortcut.label} onClick={()=>applyRange(shortcut)}>{shortcut.label}</button>)}</div></div>)}</div>}
      <p className="date-popover-hint">Первый клик — начало; наведите для preview, второй — применит.</p>
    </PopoverContent>
  </Popover>;
}
