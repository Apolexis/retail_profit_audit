/** Shared visual language for the CFO reporting packet: concise labels and all granular amounts in thousand RUB. */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const formatK = (value:number, digits=0) => `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} тыс. ₽`;
export const formatM = (value:number, digits=1) => `${value.toLocaleString("ru-RU", {minimumFractionDigits:digits, maximumFractionDigits:digits})} млн ₽`;
export const formatPct = (value:number, digits=1) => `${value.toFixed(digits)}%`;

export function TinyTooltip({ active, payload, label }: { active?:boolean; payload?:Array<{name:string;value:number;color:string}>; label?:string }) {
  if (!active || !payload?.length) return null;
  return <div className="tiny-tooltip"><b>{label}</b>{payload.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}: <strong>{typeof item.value==='number' ? item.value.toLocaleString('ru-RU') : item.value}</strong></span>)}</div>;
}

export function MetricLineChart({ data, lines, percent=false }: { data: readonly Record<string, unknown>[]; lines: {key:string;name:string;color:string}[]; percent?:boolean }) {
  return <ResponsiveContainer width="100%" height={300}><LineChart data={[...data]} margin={{top:12,right:12,left:-18,bottom:0}}><CartesianGrid vertical={false} stroke="#dfd7c8"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v)=>percent?`${v}%`:`${v} тыс.`}/><Tooltip content={<TinyTooltip/>}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/>{lines.map((line)=><Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2.5} dot={{r:3}}/>)}</LineChart></ResponsiveContainer>;
}
