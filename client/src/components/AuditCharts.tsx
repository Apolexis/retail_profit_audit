import { useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Maximize2 } from "lucide-react";
import { useAudit } from "@/contexts/AuditContext";
import { chartPalette } from "@/lib/chartPalette";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const formatK = (value:number,digits?:number) => { const absolute=Math.abs(value); if(absolute<.01)return "0 ₽"; if(absolute>=1000)return `${(value/1000).toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1})} млн ₽`; const precision=digits??(absolute<100?1:0); return `${value.toLocaleString("ru-RU",{minimumFractionDigits:precision,maximumFractionDigits:precision})} тыс. ₽`; };
export const formatM = (value:number,digits=1) => `${value.toLocaleString("ru-RU",{minimumFractionDigits:digits,maximumFractionDigits:digits})} млн ₽`;
export const formatPct = (value:number,digits=1) => `${value.toFixed(digits)}%`;

export type MetricChartTooltipMode="amount"|"million"|"percent"|"number";
export type MetricChartView="line"|"bar"|"overlay";
type MetricLine={key:string;name:string;color:string};
const iosPalette=["#5E5CE6","#00A3A3","#34C759","#FF9F0A","#FF375F","#64D2FF"];
const chartTick=(value:number,mode:MetricChartTooltipMode)=>mode==="percent"?`${value.toFixed(1)}%`:mode==="million"?`${value.toLocaleString("ru-RU",{maximumFractionDigits:1})} млн`:mode==="number"?value.toLocaleString("ru-RU",{maximumFractionDigits:1}):formatK(value).replace(" ₽","");

export const sortTooltipPayload=<T extends {value:number}>(payload:T[])=>[...payload].sort((a,b)=>b.value-a.value);
export const nonZeroLines=(data:readonly Record<string,unknown>[],lines:MetricLine[])=>lines.filter(line=>data.some(row=>{const value=row[line.key];return typeof value==="number"?value!==0:Number(value??0)!==0;}));
export const resolveMetricChartView=(pointCount:number,requested:MetricChartView):MetricChartView=>pointCount<=1?"bar":requested;
export const resolveMetricChartLayout=(pointCount:number,seriesCount:number)=>pointCount<=1&&seriesCount>1?"single-period-comparison":pointCount<=1?"single-value":"timeline";
export const resolveOverlayBarGeometry=(x:number,width:number,index:number,seriesCount:number)=>({x:x-index*width,width:width*seriesCount});
export const zeroAwareTicks=(values:readonly number[])=>{const finite=values.filter(Number.isFinite);const minimum=Math.min(0,...(finite.length?finite:[0]));const maximum=Math.max(0,...(finite.length?finite:[0]));if(minimum===maximum)return[0];if(minimum>=0)return[0,maximum/4,maximum/2,maximum*.75,maximum];if(maximum<=0)return[minimum,minimum*.75,minimum/2,minimum/4,0];return[minimum,minimum/2,0,maximum/2,maximum];};

export function TinyTooltip({active,payload,label,mode="amount"}:{active?:boolean;payload?:Array<{name:string;value:number;color:string}>;label?:string;mode?:MetricChartTooltipMode}){if(!active||!payload?.length)return null;return <div className="tiny-tooltip"><b>{label}</b>{sortTooltipPayload(payload).map(item=><span key={item.name}><i style={{background:item.color}}/>{item.name}: <strong>{typeof item.value==="number"?chartTick(item.value,mode):item.value}</strong></span>)}</div>;}

function ChartViewControls({view,onChange}:{view:MetricChartView;onChange:(view:MetricChartView)=>void}){return <div className="chart-view-control" aria-label="Вид графика"><button type="button" className={view==="line"?"chart-view-button active":"chart-view-button"} aria-pressed={view==="line"} onClick={()=>onChange("line")}>Волна</button><button type="button" className={view==="bar"?"chart-view-button active":"chart-view-button"} aria-pressed={view==="bar"} onClick={()=>onChange("bar")}>Столбцы</button><button type="button" className={view==="overlay"?"chart-view-button active":"chart-view-button"} aria-pressed={view==="overlay"} onClick={()=>onChange("overlay")}>Наложение</button></div>;}

function ChartExpandButton({title,children}:{title:string;children:ReactNode}){
  const [open,setOpen]=useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="chart-expand-button" aria-label={`Увеличить график: ${title}`}><Maximize2 size={14}/><span>Увеличить</span></button></DialogTrigger><DialogContent className="chart-expand-dialog"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Детальный просмотр графика. Значения доступны по наведению.</DialogDescription></DialogHeader><div className="chart-expand-canvas">{children}</div></DialogContent></Dialog>;
}

type MetricLineChartProps={data:readonly Record<string,unknown>[];lines:MetricLine[];percent?:boolean;unit?:"k"|"m";displayMode?:MetricChartTooltipMode;chartTitle?:string;expanded?:boolean};
export function MetricLineChart({data,lines,percent=false,unit="k",displayMode,chartTitle="Детальный график",expanded=false}:MetricLineChartProps){
  const [hidden,setHidden]=useState<string[]>([]);
  const [requestedView,setRequestedView]=useState<MetricChartView>("line");
  const {theme}=useAudit();
  const palette=chartPalette(theme);
  const mode:MetricChartTooltipMode=displayMode??(percent?"percent":unit==="m"?"million":"amount");
  const activeLines=nonZeroLines(data,lines);
  const visibleLines=activeLines.filter(line=>!hidden.includes(line.key));
  const chartView=resolveMetricChartView(data.length,requestedView);
  const chartLayout=resolveMetricChartLayout(data.length,visibleLines.length);
  const colorFor=(line:MetricLine,index:number)=>theme==="light"?iosPalette[index%iosPalette.length]:line.color;
  const toggle=(key:string)=>setHidden(current=>current.includes(key)?current.filter(value=>value!==key):[...current,key]);
  const plottedValues=data.flatMap(row=>visibleLines.map(line=>Number(row[line.key]??0))).filter(Number.isFinite);
  const ticks=zeroAwareTicks(plottedValues);
  const singleRows=visibleLines.map((line,index)=>({label:line.name,value:Number(data[0]?.[line.key]??0),color:colorFor(line,index)}));
  const singleTicks=zeroAwareTicks(singleRows.map(row=>row.value));
  const cursor={fill:theme==="light"?"rgba(232,79,95,.06)":"rgba(255,118,95,.08)"};
  const peak=(line:MetricLine)=>Math.max(...data.map(row=>Math.abs(Number(row[line.key]??0))));
  const overlayLines=[...visibleLines].sort((left,right)=>peak(right)-peak(left));
  const chartHeight=expanded?Math.max(520,chartLayout==="single-period-comparison"?singleRows.length*52+72:560):chartLayout==="single-period-comparison"?Math.max(300,singleRows.length*44+48):306;
  if(!activeLines.length)return <div className="metric-chart"><p className="chart-empty">За выбранный период ненулевых значений нет.</p></div>;
  return <div className={expanded?"metric-chart metric-chart-expanded":"metric-chart"}>
    <div className="chart-toolbar"><div className="chart-series-control" aria-label="Управление рядами графика">{activeLines.map((line,index)=>{const muted=hidden.includes(line.key);return <button type="button" aria-pressed={!muted} key={line.key} onClick={()=>toggle(line.key)} className={muted?"series-toggle muted":"series-toggle"}><i style={{background:colorFor(line,index)}}/>{line.name}</button>;})}</div><div className="chart-toolbar-actions">{data.length>1&&<ChartViewControls view={chartView} onChange={setRequestedView}/>} {!expanded&&<ChartExpandButton title={chartTitle}><MetricLineChart data={data} lines={lines} percent={percent} unit={unit} displayMode={displayMode} chartTitle={chartTitle} expanded/></ChartExpandButton>}</div></div>
    <ResponsiveContainer width="100%" height={chartHeight}>
      {chartLayout==="single-period-comparison"?
        <BarChart data={singleRows} layout="vertical" margin={{top:16,right:32,left:12,bottom:10}} barCategoryGap={10}><CartesianGrid horizontal={false} stroke={palette.grid}/><XAxis type="number" domain={[singleTicks[0],singleTicks.at(-1)??0]} ticks={singleTicks} axisLine={false} tickLine={false} stroke={palette.axis} tick={{fill:palette.tick,fontSize:11}} tickFormatter={value=>chartTick(value,mode)}/><YAxis type="category" dataKey="label" width={112} axisLine={false} tickLine={false} tick={{fill:palette.tick,fontSize:11}}/><ReferenceLine x={0} stroke={palette.axis} strokeOpacity={.78} strokeWidth={1.2}/><Tooltip cursor={false} wrapperStyle={{pointerEvents:"none",zIndex:20}} content={<TinyTooltip mode={mode}/>}/><Bar dataKey="value" name="Значение" radius={[0,6,6,0]} maxBarSize={28} isAnimationActive animationDuration={650}>{singleRows.map(row=><Cell key={row.label} fill={row.color}/>)}</Bar></BarChart>
      :chartView==="bar"?
        <BarChart data={[...data]} margin={{top:18,right:32,left:20,bottom:10}} barCategoryGap={data.length===1?"34%":"18%"}><CartesianGrid vertical={false} stroke={palette.grid}/><XAxis dataKey="month" axisLine={false} tickLine={false} stroke={palette.axis}/><YAxis domain={[ticks[0],ticks.at(-1)??0]} ticks={ticks} axisLine={false} tickLine={false} width={78} stroke={palette.axis} tick={{fill:palette.tick,fontSize:11}} tickFormatter={value=>chartTick(value,mode)}/><ReferenceLine y={0} stroke={palette.axis} strokeOpacity={.78} strokeWidth={1.2}/><Tooltip cursor={cursor} wrapperStyle={{pointerEvents:"none",zIndex:20}} content={<TinyTooltip mode={mode}/>}/>{visibleLines.map((line,index)=><Bar key={line.key} dataKey={line.key} name={line.name} fill={colorFor(line,index)} radius={[6,6,0,0]} maxBarSize={data.length===1?86:undefined} isAnimationActive animationDuration={650}/>)}</BarChart>
      :chartView==="overlay"?
        <BarChart data={[...data]} margin={{top:18,right:32,left:20,bottom:10}} barCategoryGap="30%" barGap={0}><CartesianGrid vertical={false} stroke={palette.grid}/><XAxis dataKey="month" axisLine={false} tickLine={false} stroke={palette.axis}/><YAxis domain={[ticks[0],ticks.at(-1)??0]} ticks={ticks} axisLine={false} tickLine={false} width={78} stroke={palette.axis} tick={{fill:palette.tick,fontSize:11}} tickFormatter={value=>chartTick(value,mode)}/><ReferenceLine y={0} stroke={palette.axis} strokeOpacity={.78} strokeWidth={1.2}/><Tooltip cursor={cursor} wrapperStyle={{pointerEvents:"none",zIndex:20}} content={<TinyTooltip mode={mode}/>}/>{overlayLines.map((line,index)=>{const color=colorFor(line,visibleLines.indexOf(line));return <Bar key={line.key} dataKey={line.key} name={line.name} fill={color} isAnimationActive animationDuration={650} shape={(props:{x?:number;y?:number;width?:number;height?:number})=>{const geometry=resolveOverlayBarGeometry(Number(props.x??0),Number(props.width??0),index,overlayLines.length);return <rect x={geometry.x} y={Number(props.y??0)} width={geometry.width} height={Number(props.height??0)} fill={color} rx={6} ry={6}/>;}}/>;})}</BarChart>
      :<AreaChart data={[...data]} margin={{top:18,right:32,left:20,bottom:10}}><CartesianGrid vertical={false} stroke={palette.grid}/><XAxis dataKey="month" axisLine={false} tickLine={false} stroke={palette.axis}/><YAxis domain={[ticks[0],ticks.at(-1)??0]} ticks={ticks} axisLine={false} tickLine={false} width={78} stroke={palette.axis} tick={{fill:palette.tick,fontSize:11}} tickFormatter={value=>chartTick(value,mode)}/><ReferenceLine y={0} stroke={palette.axis} strokeOpacity={.78} strokeWidth={1.2}/><Tooltip cursor={cursor} wrapperStyle={{pointerEvents:"none",zIndex:20}} content={<TinyTooltip mode={mode}/>}/>{visibleLines.map((line,index)=>{const color=colorFor(line,index);return <Area key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={color} strokeWidth={2.7} fill={color} fillOpacity={theme==="light"?.14:.18} dot={{r:3.5,stroke:color,strokeWidth:2,fill:color}} activeDot={{r:6,stroke:color,fill:color}} isAnimationActive animationDuration={720} animationEasing="ease-out"/>})}</AreaChart>}
    </ResponsiveContainer>
  </div>;
}

type BenchmarkBarsProps={data:{store:string;value:number;selected:boolean}[];median:number;mode?:MetricChartTooltipMode;selectedLabel:string;chartTitle?:string;expanded?:boolean};
export function BenchmarkBars({data,median,mode="percent",selectedLabel,chartTitle="Сравнение магазинов",expanded=false}:BenchmarkBarsProps){
  const {theme}=useAudit();const palette=chartPalette(theme);const baseHeight=Math.max(600,data.length*27+70);const height=expanded?Math.max(680,baseHeight):baseHeight;const ticks=zeroAwareTicks(data.map(row=>row.value));
  return <div className={expanded?"benchmark-chart benchmark-chart-expanded":"benchmark-chart"}><div className="chart-toolbar"><div className="median-badge"><i style={{background:palette.median}}/> Медиана сети: <b>{chartTick(median,mode)}</b> · {selectedLabel} — акцентный маркер</div>{!expanded&&<ChartExpandButton title={chartTitle}><BenchmarkBars data={data} median={median} mode={mode} selectedLabel={selectedLabel} chartTitle={chartTitle} expanded/></ChartExpandButton>}</div><ResponsiveContainer width="100%" height={height}><BarChart data={data} layout="vertical" margin={{top:16,right:30,left:18,bottom:14}} barCategoryGap={6}><CartesianGrid horizontal={false} stroke={palette.grid}/><XAxis type="number" domain={[ticks[0],ticks.at(-1)??0]} ticks={ticks} tickFormatter={value=>chartTick(value,mode)} axisLine={false} tickLine={false} stroke={palette.axis} tick={{fill:palette.tick,fontSize:11}}/><YAxis type="category" dataKey="store" width={128} tick={{fontSize:11,fill:palette.tick}} axisLine={false} tickLine={false}/><Tooltip cursor={false} wrapperStyle={{pointerEvents:"none",zIndex:20}} content={<TinyTooltip mode={mode}/>}/><ReferenceLine x={0} stroke={palette.axis} strokeOpacity={.78} strokeWidth={1.2}/><ReferenceLine x={median} stroke={palette.median} strokeWidth={2} strokeDasharray="5 5"/><Bar dataKey="value" name="Значение" radius={[0,6,6,0]} activeBar={false} isAnimationActive animationDuration={650}>{data.map(row=><Cell key={row.store} fill={row.selected?palette.selected:palette.bar}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}
