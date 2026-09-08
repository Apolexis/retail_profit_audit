import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudit } from "@/contexts/AuditContext";
import "@/calendar-range.css";
const toIso=(date:Date)=>format(date,"yyyy-MM-dd");
export function DateRangeControl({compact=false}:{compact?:boolean}){const {range,setRange,rangeLabel}=useAudit();const [open,setOpen]=useState(false);const selected:DateRange={from:parseISO(range.from),to:parseISO(range.to)};const applyRange=(next:{from:string;to:string})=>{setRange(next);setOpen(false)};return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button className={compact?"date-range-control compact":"date-range-control"}><CalendarDays size={15}/><span>{rangeLabel}</span></button></PopoverTrigger><PopoverContent className="date-popover" align="end"><div className="date-popover-head"><span>Период анализа</span><b>{rangeLabel}</b></div><Calendar mode="range" locale={ru} selected={selected} defaultMonth={selected.from} numberOfMonths={2} onSelect={next=>{if(next?.from&&next?.to)applyRange({from:toIso(next.from),to:toIso(next.to)})}}/><div className="date-shortcuts"><button onClick={()=>applyRange({from:"2026-01-01",to:"2026-04-30"})}>Янв–апр</button><button onClick={()=>applyRange({from:"2026-05-01",to:"2026-08-31"})}>Май–авг</button><button onClick={()=>applyRange({from:"2026-01-01",to:"2026-08-31"})}>Янв–авг</button></div></PopoverContent></Popover>}
