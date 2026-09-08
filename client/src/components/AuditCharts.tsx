/** Shared visual language for the CFO reporting packet: adaptive units and interactive series controls. */
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const formatK = (value:number, digits=0) => {
  const absolute = Math.abs(value);
  if (absolute < 0.5) return "0 тыс. ₽";
  if (absolute >= 1000) return `${(value / 1000).toLocaleString("ru-RU", {minimumFractionDigits:1, maximumFractionDigits:1})} млн ₽`;
  return `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} тыс. ₽`;
};
export const formatM = (value:number, digits=1) => `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} млн ₽`;
export const formatPct = (value:number, digits=1) => `${value.toFixed(digits)}%`;

type TooltipMode = "amount" | "million" | "percent" | "number";
const chartTick = (value:number, mode:TooltipMode) => mode === "percent" ? `${value}%` : mode === "million" ? `${value.toLocaleString("ru-RU", {maximumFractionDigits:1})} млн` : mode === "number" ? `${value}` : formatK(value).replace(" ₽", "");

export function TinyTooltip({ active, payload, label, mode="amount" }: { active?:boolean; payload?:Array<{name:string;value:number;color:string}>; label?:string; mode?:TooltipMode }) {
  if (!active || !payload?.length) return null;
  return <div className="tiny-tooltip"><b>{label}</b>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}: <strong>{typeof item.value==='number' ? chartTick(item.value, mode) : item.value}</strong></span>)}</div>;
}

export function MetricLineChart({ data, lines, percent=false, unit="k" }: { data: readonly Record<string, unknown>[]; lines: {key:string;name:string;color:string}[]; percent?:boolean; unit?:"k"|"m" }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const mode:TooltipMode = percent ? "percent" : unit === "m" ? "million" : "amount";
  const toggle = (key:string) => setHidden(current=>current.includes(key) ? current.filter(value=>value!==key) : [...current,key]);
  return <div className="metric-chart"><div className="chart-series-control" aria-label="Управление рядами графика">{lines.map(line=>{const muted=hidden.includes(line.key);return <button type="button" aria-pressed={!muted} key={line.key} onClick={()=>toggle(line.key)} className={muted?"series-toggle muted":"series-toggle"}><i style={{background:line.color}}/>{line.name}</button>})}</div><ResponsiveContainer width="100%" height={285}><LineChart data={[...data]} margin={{top:12,right:26,left:16,bottom:2}}><CartesianGrid vertical={false} stroke="#263142"/><XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#748096"/><YAxis axisLine={false} tickLine={false} width={62} stroke="#748096" tickFormatter={(v)=>chartTick(v,mode)}/><Tooltip content={<TinyTooltip mode={mode}/>}/>{lines.filter(line=>!hidden.includes(line.key)).map((line)=><Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}} isAnimationActive animationDuration={720} animationEasing="ease-out"/>)}</LineChart></ResponsiveContainer></div>;
}
