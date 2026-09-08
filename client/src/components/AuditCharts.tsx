/** Shared visual language for the CFO reporting packet: adaptive units for operational figures. */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  const mode:TooltipMode = percent ? "percent" : unit === "m" ? "million" : "amount";
  return <ResponsiveContainer width="100%" height={300}><LineChart data={[...data]} margin={{top:12,right:12,left:-18,bottom:0}}><CartesianGrid vertical={false} stroke="#dfd7c8"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v)=>chartTick(v,mode)}/><Tooltip content={<TinyTooltip mode={mode}/>}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/>{lines.map((line)=><Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{r:3}}/>)}</LineChart></ResponsiveContainer>;
}
