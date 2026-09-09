/** Shared visual language for the CFO reporting packet: adaptive units and interactive series controls. */
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const formatK = (value:number, digits=0) => {
  const absolute = Math.abs(value);
  if (absolute < 0.5) return "0 тыс. ₽";
  if (absolute >= 1000) return `${(value / 1000).toLocaleString("ru-RU", {minimumFractionDigits:1, maximumFractionDigits:1})} млн ₽`;
  return `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} тыс. ₽`;
};
export const formatM = (value:number, digits=1) => `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} млн ₽`;
export const formatPct = (value:number, digits=1) => `${value.toFixed(digits)}%`;

type TooltipMode = "amount" | "million" | "percent" | "number";
const chartTick = (value:number, mode:TooltipMode) => mode === "percent" ? `${value.toFixed(1)}%` : mode === "million" ? `${value.toLocaleString("ru-RU", {maximumFractionDigits:1})} млн` : mode === "number" ? `${value.toLocaleString("ru-RU", {maximumFractionDigits:1})}` : formatK(value).replace(" ₽", "");

export function TinyTooltip({ active, payload, label, mode="amount" }: { active?:boolean; payload?:Array<{name:string;value:number;color:string}>; label?:string; mode?:TooltipMode }) {
  if (!active || !payload?.length) return null;
  return <div className="tiny-tooltip"><b>{label}</b>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}: <strong>{typeof item.value==='number' ? chartTick(item.value, mode) : item.value}</strong></span>)}</div>;
}

export function MetricLineChart({ data, lines, percent=false, unit="k" }: { data: readonly Record<string, unknown>[]; lines: {key:string;name:string;color:string}[]; percent?:boolean; unit?:"k"|"m" }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const mode:TooltipMode = percent ? "percent" : unit === "m" ? "million" : "amount";
  const toggle = (key:string) => setHidden(current=>current.includes(key) ? current.filter(value=>value!==key) : [...current,key]);
  return <div className="metric-chart"><div className="chart-series-control" aria-label="Управление рядами графика">{lines.map(line=>{const muted=hidden.includes(line.key);return <button type="button" aria-pressed={!muted} key={line.key} onClick={()=>toggle(line.key)} className={muted?"series-toggle muted":"series-toggle"}><i style={{background:line.color}}/>{line.name}</button>})}</div><ResponsiveContainer width="100%" height={306}><LineChart data={[...data]} margin={{top:18,right:32,left:20,bottom:10}}><CartesianGrid vertical={false} stroke="#3a2031"/><XAxis dataKey="month" axisLine={false} tickLine={false} stroke="#b490a2"/><YAxis axisLine={false} tickLine={false} width={72} stroke="#b490a2" tickFormatter={(v)=>chartTick(v,mode)}/><Tooltip content={<TinyTooltip mode={mode}/>}/>{lines.filter(line=>!hidden.includes(line.key)).map((line)=><Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.7} dot={{r:3.5,strokeWidth:2,fill:"#130b12"}} activeDot={{r:6}} isAnimationActive animationDuration={720} animationEasing="ease-out"/>)}</LineChart></ResponsiveContainer></div>;
}

export function BenchmarkBars({ data, median, mode="percent", selectedLabel }: {data:{store:string;value:number;selected:boolean}[];median:number;mode?:TooltipMode;selectedLabel:string}) {
  const height=Math.max(600,data.length*27+70);
  return <div className="benchmark-chart"><div className="median-badge"><i/> Медиана сети: <b>{chartTick(median,mode)}</b> · {selectedLabel} — акцентный маркер</div><ResponsiveContainer width="100%" height={height}><BarChart data={data} layout="vertical" margin={{top:16,right:30,left:18,bottom:14}} barCategoryGap={6}><CartesianGrid horizontal={false} stroke="#3a2031"/><XAxis type="number" tickFormatter={value=>chartTick(value,mode)} axisLine={false} tickLine={false} stroke="#ab90a0"/><YAxis type="category" dataKey="store" width={108} tick={{fontSize:11,fill:"#d9c7d0"}} axisLine={false} tickLine={false}/><Tooltip cursor={false} content={<TinyTooltip mode={mode}/>}/><ReferenceLine x={median} stroke="#ff597c" strokeWidth={2} strokeDasharray="5 5"/><Bar dataKey="value" name="Значение" radius={[0,6,6,0]} activeBar={false} isAnimationActive animationDuration={650}>{data.map(row=><Cell key={row.store} fill={row.selected?"#ffc15e":"#762c4b"}/>)}</Bar></BarChart></ResponsiveContainer></div>
}
