import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, CircleAlert, Clock3, Download, FileText, RefreshCw, Save, ShieldAlert, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { DateRangeControl } from "@/components/DateRangeControl";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAudit, type DateRangeValue } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";

type Summary={periodStart:string;periodEnd:string;snapshotMonth:string|null;periodType?:"week"|"month"|"custom";revenue:number;netProfit:number;margin:number;stores:number;lossStores:number;changeCount:number;topProfit:Array<{store:string;value:number}>;riskStores:Array<{store:string;reason:string;value:number}>;methodology:string};
type SavedReport={id:number;periodStart:string;periodEnd:string;summary:unknown;createdAt:string|Date};
type ReportTimelinePeriod={entryDate:string;store:string;isHidden:boolean;metrics:Record<string,unknown>};
export type ReportTimelinePoint={date:string;revenue:number;netProfit:number;stores:number};
const money=(value:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽";
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"});
const weekdays=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const moneyClass=(value:number)=>value>0?"positive":value<0?"negative":"neutral";
const periodLabel=(summary:Summary)=>`${summary.periodType==="month"?"Месяц":summary.periodType==="custom"?"Период":"Неделя"} · ${summary.periodStart.slice(5).split("-").reverse().join(".")}—${summary.periodEnd.slice(5).split("-").reverse().join(".")}`;
const periodTypeLabel=(periodType:Summary["periodType"])=>periodType==="month"?"Ежемесячная сводка":periodType==="custom"?"Произвольная сводка":"Еженедельная сводка";
const previousMonthRange=():DateRangeValue=>{const now=new Date();const first=new Date(now.getFullYear(),now.getMonth(),1);const end=new Date(first);end.setDate(0);const start=new Date(end.getFullYear(),end.getMonth(),1);const iso=(value:Date)=>value.toISOString().slice(0,10);return {from:iso(start),to:iso(end)}};
const REPORTS_PAGE_SIZE=8;
export const reportMethodology=(summary:Pick<Summary,"periodStart"|"periodEnd">)=>`P&L рассчитан из первичных дневных фактов за период ${summary.periodStart} — ${summary.periodEnd}. Остаток — последний доступный снапшот каждой включенной точки внутри этого среза; журнал действий учитывается за тот же период.`;
const pdfTimestamp=(value:Date)=>new Intl.DateTimeFormat("ru-RU",{dateStyle:"long",timeStyle:"short"}).format(value);
const ReportPdfBrandGlyph=({theme}:{theme:"dark"|"light"})=><svg className="report-pdf-brand-glyph" viewBox="0 0 48 48" aria-label="Фирменный знак Аналитики Рыбный" role="img"><circle cx="24" cy="24" r="22" fill={theme==="dark"?"#1c1b26":"#edf6ff"}/><path d="M10 28h7l5-10 5 13 5-8h6" fill="none" stroke="#ff765f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 16c4-3 7 0 7 2s-3 5-7 2l-3 3v-10z" fill="#f6c94d"/><circle cx="14" cy="18" r=".9" fill="#16263a"/><path d="M32 31c4-3 7 0 7 2s-3 5-7 2l-3 3v-10z" fill="#ff765f"/><circle cx="35" cy="33" r=".9" fill="#fff"/></svg>;
const reportPdfBrandIcon={dark:"/manus-storage/rybny_pwa_dark_transparent_110da59a.png",light:"/manus-storage/rybny_pwa_light_transparent_d1223d9d.png"} as const;
const blobToDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
const loadPdfBrand=async(theme:"dark"|"light")=>{const response=await fetch(reportPdfBrandIcon[theme],{cache:"force-cache"});if(!response.ok)throw new Error("Не удалось загрузить фирменный знак");return blobToDataUrl(await response.blob());};
const drawPdfBrand=async(context:CanvasRenderingContext2D,source:string|undefined,x:number,y:number,size=48)=>{if(!source)return;const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Не удалось отрисовать фирменный знак"));image.src=source;});context.drawImage(image,x,y,size,size);};
export const shouldFitPdfSummaryOnOnePage=(imageHeight:number,printableHeight:number)=>imageHeight<=printableHeight*1.12;
const shortDate=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"});
const finite=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:Number(value??0)||0;
export const reportTimeline=(periods:readonly ReportTimelinePeriod[]):ReportTimelinePoint[]=>{
  const byDate=new Map<string,{revenue:number;netProfit:number;stores:Set<string>}>();
  periods.filter(period=>!period.isHidden).forEach(period=>{
    const current=byDate.get(period.entryDate)??{revenue:0,netProfit:0,stores:new Set<string>()};
    current.revenue+=finite(period.metrics.revenue);
    current.netProfit+=finite(period.metrics.net_profit);
    current.stores.add(period.store);
    byDate.set(period.entryDate,current);
  });
  return Array.from(byDate.entries()).sort(([left],[right])=>left.localeCompare(right)).map(([date,point])=>({date,revenue:point.revenue,netProfit:point.netProfit,stores:point.stores.size}));
};
const formatCompact=(value:number)=>Math.abs(value)>=1_000_000?`${(value/1_000_000).toLocaleString("ru-RU",{maximumFractionDigits:1})} млн ₽`:`${Math.round(value/1000).toLocaleString("ru-RU")} тыс. ₽`;
const createReportDynamicsCanvas=async(summary:Summary,points:readonly ReportTimelinePoint[],theme:"dark"|"light",brandSource?:string)=>{
  const canvas=document.createElement("canvas");
  canvas.width=1240;canvas.height=1754;
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Не удалось подготовить страницу динамики PDF");
  const dark=theme==="dark";
  const ink=dark?"#edf2fa":"#16263a";
  const muted=dark?"#9caabd":"#66778d";
  const surface=dark?"#121824":"#f8fbff";
  const panel=dark?"#171e2b":"#ffffff";
  const grid=dark?"#334154":"#d7e4f2";
  const blue="#0a84ff", coral="#ff765f", green="#08745d", red="#bf3e52";
  context.fillStyle=surface;context.fillRect(0,0,canvas.width,canvas.height);
  await drawPdfBrand(context,brandSource,52,52,48);
  context.fillStyle=muted;context.font="700 18px Arial";context.fillText("АНАЛИТИКА «РЫБНЫЙ»",120,68);
  context.fillStyle=ink;context.font="800 40px Arial";context.fillText("Динамика фактических показателей",54,148);
  context.fillStyle=muted;context.font="500 22px Arial";context.fillText(`${date(summary.periodStart)} — ${date(summary.periodEnd)} · выбранная сохраненная сводка`,54,186);
  const padding=54, chartWidth=canvas.width-padding*2;
  const drawCard=(x:number,title:string,value:string,color:string)=>{context.fillStyle=panel;context.strokeStyle=grid;context.lineWidth=2;context.beginPath();context.roundRect(x,226,chartWidth/3-12,120,18);context.fill();context.stroke();context.fillStyle=muted;context.font="700 16px Arial";context.fillText(title,x+22,264);context.fillStyle=color;context.font="800 29px Arial";context.fillText(value,x+22,312);};
  const topRevenue=points.length?points.reduce((best,point)=>point.revenue>best.revenue?point:best):null;
  const topProfit=points.length?points.reduce((best,point)=>point.netProfit>best.netProfit?point:best):null;
  const lossDays=points.filter(point=>point.netProfit<0).length;
  drawCard(padding,"ПИК ВЫРУЧКИ",topRevenue?`${shortDate(topRevenue.date)} · ${formatCompact(topRevenue.revenue)}`:"Нет фактов",blue);
  drawCard(padding+chartWidth/3+6,"ПИК ПРИБЫЛИ",topProfit?`${shortDate(topProfit.date)} · ${formatCompact(topProfit.netProfit)}`:"Нет фактов",topProfit&&topProfit.netProfit<0?red:green);
  drawCard(padding+(chartWidth/3+6)*2,"ДНЕЙ С УБЫТКОМ",`${lossDays} из ${points.length}`,lossDays?red:green);
  const drawChart=(top:number,title:string,series:"revenue"|"netProfit",color:string,zero=false)=>{
    const x=padding,y=top,width=chartWidth,height=480;
    context.fillStyle=panel;context.strokeStyle=grid;context.lineWidth=2;context.beginPath();context.roundRect(x,y,width,height,18);context.fill();context.stroke();
    context.fillStyle=ink;context.font="800 25px Arial";context.fillText(title,x+24,y+42);
    const values=points.map(point=>point[series]);const rawMin=values.length?Math.min(...values):0;const rawMax=values.length?Math.max(...values):0;const min=zero?Math.min(0,rawMin):rawMin;const max=zero?Math.max(0,rawMax):rawMax;const span=Math.max(1,max-min);const plot={x:x+62,y:y+78,width:width-88,height:height-136};
    context.strokeStyle=grid;context.lineWidth=1;for(let step=0;step<5;step+=1){const cy=plot.y+plot.height/4*step;context.beginPath();context.moveTo(plot.x,cy);context.lineTo(plot.x+plot.width,cy);context.stroke();const amount=max-span/4*step;context.fillStyle=muted;context.font="500 15px Arial";context.fillText(formatCompact(amount),x+18,cy+5);}
    if(zero&&min<0&&max>0){const zeroY=plot.y+max/span*plot.height;context.strokeStyle=muted;context.setLineDash([7,7]);context.beginPath();context.moveTo(plot.x,zeroY);context.lineTo(plot.x+plot.width,zeroY);context.stroke();context.setLineDash([]);}
    if(points.length){context.strokeStyle=color;context.lineWidth=5;context.lineJoin="round";context.lineCap="round";context.beginPath();points.forEach((point,index)=>{const px=plot.x+(points.length===1?plot.width/2:index/(points.length-1)*plot.width);const py=plot.y+(max-point[series])/span*plot.height;index?context.lineTo(px,py):context.moveTo(px,py);});context.stroke();points.forEach((point,index)=>{const px=plot.x+(points.length===1?plot.width/2:index/(points.length-1)*plot.width);const py=plot.y+(max-point[series])/span*plot.height;context.fillStyle=color;context.beginPath();context.arc(px,py,5,0,Math.PI*2);context.fill();if(index===0||index===points.length-1||index===Math.floor((points.length-1)/2)){context.fillStyle=muted;context.font="500 15px Arial";context.textAlign=index===0?"left":index===points.length-1?"right":"center";context.fillText(shortDate(point.date),px,plot.y+plot.height+31);}});context.textAlign="left";}
  };
  drawChart(382,"Выручка по дням", "revenue",blue);
  drawChart(904,"Чистая прибыль по дням", "netProfit",coral,true);
  context.fillStyle=muted;context.font="500 17px Arial";context.fillText("Источник: фактические дневные записи видимых точек в периоде выбранного отчета.",54,1480);
  context.fillText("Страница сформирована локально в браузере; данные не передаются во внешние сервисы.",54,1510);
  return canvas;
};
const drawPdfText=(context:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number,maxLines=3)=>{const words=text.split(/\s+/);let line="",lines=0;for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width>width&&line){context.fillText(line,x,y+lines*lineHeight);lines+=1;if(lines===maxLines)return y+lines*lineHeight;line=word;}else line=next;}if(line&&lines<maxLines){context.fillText(line,x,y+lines*lineHeight);lines+=1;}return y+lines*lineHeight;};
const createReportInsightsCanvas=async(summary:Summary,points:readonly ReportTimelinePoint[],theme:"dark"|"light",brandSource?:string)=>{
  const canvas=document.createElement("canvas");canvas.width=1240;canvas.height=1754;const context=canvas.getContext("2d");if(!context)throw new Error("Не удалось подготовить страницу управленческого реестра PDF");
  const dark=theme==="dark",ink=dark?"#edf2fa":"#16263a",muted=dark?"#9caabd":"#66778d",surface=dark?"#121824":"#f8fbff",panel=dark?"#171e2b":"#ffffff",grid=dark?"#334154":"#d7e4f2",blue="#0a84ff",coral="#ff765f",green="#08745d",red="#bf3e52";
  context.fillStyle=surface;context.fillRect(0,0,canvas.width,canvas.height);await drawPdfBrand(context,brandSource,52,52,48);context.fillStyle=muted;context.font="700 18px Arial";context.fillText("АНАЛИТИКА «РЫБНЫЙ»",120,68);context.fillStyle=ink;context.font="800 40px Arial";context.fillText("Управленческий реестр фактов",54,148);context.fillStyle=muted;context.font="500 22px Arial";context.fillText(`${date(summary.periodStart)} — ${date(summary.periodEnd)} · сохраненная сводка`,54,186);
  const card=(x:number,title:string,value:string,detail:string,color:string)=>{context.fillStyle=panel;context.strokeStyle=grid;context.lineWidth=2;context.beginPath();context.roundRect(x,226,365,136,18);context.fill();context.stroke();context.fillStyle=muted;context.font="700 15px Arial";context.fillText(title,x+20,260);context.fillStyle=color;context.font="800 28px Arial";context.fillText(value,x+20,304);context.fillStyle=muted;context.font="500 15px Arial";drawPdfText(context,detail,x+20,332,324,19,1);};
  card(54,"ВЫРУЧКА",formatCompact(summary.revenue),"Факт выбранного периода",blue);card(438,"ЧИСТАЯ ПРИБЫЛЬ",formatCompact(summary.netProfit),`${summary.margin.toFixed(1)}% чистая маржа`,summary.netProfit<0?red:green);card(822,"ТОЧКИ В СРЕЗЕ",String(summary.stores),`${summary.lossStores} с отрицательной прибылью`,summary.lossStores?coral:green);
  const box=(x:number,y:number,width:number,height:number,title:string)=>{context.fillStyle=panel;context.strokeStyle=grid;context.lineWidth=2;context.beginPath();context.roundRect(x,y,width,height,18);context.fill();context.stroke();context.fillStyle=ink;context.font="800 24px Arial";context.fillText(title,x+24,y+42);};
  box(54,394,548,510,"Точки-ориентиры по прибыли");summary.topProfit.slice(0,3).forEach((item,index)=>{const y=462+index*112;context.fillStyle=index===0?blue:muted;context.beginPath();context.arc(88,y,16,0,Math.PI*2);context.fill();context.fillStyle="#fff";context.font="800 15px Arial";context.fillText(String(index+1),83,y+5);context.fillStyle=ink;context.font="800 22px Arial";context.fillText(item.store,122,y+2);context.fillStyle=item.value<0?red:green;context.font="800 20px Arial";context.textAlign="right";context.fillText(formatCompact(item.value),568,y+2);context.textAlign="left";context.strokeStyle=grid;context.beginPath();context.moveTo(78,y+44);context.lineTo(570,y+44);context.stroke();});
  box(638,394,548,510,"Риск-сигналы выбранного среза");if(summary.riskStores.length){summary.riskStores.slice(0,4).forEach((item,index)=>{const y=454+index*104;context.fillStyle=coral;context.fillRect(662,y-16,5,58);context.fillStyle=ink;context.font="800 21px Arial";context.fillText(item.store,686,y);context.fillStyle=muted;context.font="500 15px Arial";drawPdfText(context,item.reason,686,y+25,330,19,2);context.fillStyle=item.reason.includes("покрытие")?coral:red;context.font="800 17px Arial";context.textAlign="right";context.fillText(item.reason.includes("покрытие")?`${item.value.toFixed(1)} дн.`:formatCompact(item.value),1152,y);context.textAlign="left";});}else{context.fillStyle=muted;context.font="500 19px Arial";context.fillText("Критичных риск-сигналов в срезе нет.",662,466);}
  box(54,936,1132,314,"Состав и границы фактической базы");const dates=points.length?`${date(points[0]!.date)} — ${date(points[points.length-1]!.date)}`:"дневных строк в срезе нет";const totalDays=points.length;const lossDays=points.filter(point=>point.netProfit<0).length;const dailyRevenue=totalDays?summary.revenue/totalDays:0;context.fillStyle=muted;context.font="500 19px Arial";drawPdfText(context,`Доступно ${totalDays} дневных фактических строк: ${dates}. Средняя дневная выручка по сводке — ${formatCompact(dailyRevenue)}; дней с отрицательной чистой прибылью — ${lossDays}.`,80,1010,1060,27,3);context.fillStyle=ink;context.font="700 18px Arial";drawPdfText(context,reportMethodology(summary),80,1118,1060,26,4);
  box(54,1282,1132,336,"Рекомендуемый порядок проверки");context.fillStyle=ink;context.font="800 20px Arial";context.fillText("1. Сверить риск-сигналы с первичными документами и дневной динамикой.",82,1352);context.fillText("2. Сопоставить лидеров по прибыли с сопоставимыми точками в «Динамике».",82,1418);context.fillText("3. Проверить запас и списания до следующей закупки; отчет не дает автоматических распоряжений.",82,1484);context.fillStyle=muted;context.font="500 16px Arial";context.fillText(`Действий из журнала в периоде: ${summary.changeCount}. Документ создан локально, факты не передавались во внешние сервисы.`,82,1566);
  return canvas;
};

export default function WeeklyReports(){
  const {theme}=useAudit();
  const utils=trpc.useUtils();
  const me=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const [reportOffset,setReportOffset]=useState(0);
  const [visibleReports,setVisibleReports]=useState<SavedReport[]>([]);
  const [reportToDelete,setReportToDelete]=useState<SavedReport>();
  const reports=trpc.audit.weeklyReports.useQuery({limit:REPORTS_PAGE_SIZE,offset:reportOffset},{retry:false});
  const schedule=trpc.audit.weeklyReportSchedule.useQuery(undefined,{retry:false});
  const reportSummaryRef=useRef<HTMLElement>(null);
  const reportPdfRef=useRef<HTMLDivElement>(null);
  const [selectedId,setSelectedId]=useState<number>();
  const [weekday,setWeekday]=useState(1);
  const [reportTime,setReportTime]=useState("09:00");
  const [reportPeriod,setReportPeriod]=useState<"week"|"month"|"custom">("week");
  const [customRange,setCustomRange]=useState<DateRangeValue>(previousMonthRange);
  const [isEnabled,setIsEnabled]=useState(true);
  const [isExporting,setIsExporting]=useState(false);
  const [pdfGeneratedAt,setPdfGeneratedAt]=useState<Date|null>(null);
  const [pdfBrandSrc,setPdfBrandSrc]=useState<string>();
  useEffect(()=>{if(!reports.data)return;setVisibleReports(current=>reportOffset===0?reports.data.items as SavedReport[]:[...current,...(reports.data.items as SavedReport[]).filter(item=>!current.some(saved=>saved.id===item.id))]);},[reports.data,reportOffset]);
  const selectReport=(id:number)=>{setSelectedId(id);window.history.replaceState(null,"",`/reports?report=${id}`);window.setTimeout(()=>reportSummaryRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);};
  const generate=trpc.audit.generateWeeklyReport.useMutation({
    onSuccess:async result=>{
      setReportOffset(0);
      selectReport(result.report.id);
      await utils.audit.weeklyReports.invalidate();
      toast.success(result.created?"Отчет сформирован и открыт":"Сводка уже существует и открыта",{description:`Показан период: ${periodLabel(result.report.summary as unknown as Summary)}.`});
    },
    onError:()=>toast.error("Не удалось сформировать отчет",{description:"Попробуйте еще раз. Если ошибка повторится, проверьте доступность фактов в выбранном периоде."})
  });
  const updateSchedule=trpc.audit.updateWeeklyReportSchedule.useMutation({
    onSuccess:async result=>{
      await Promise.all([utils.audit.weeklyReportSchedule.invalidate(),utils.audit.changes.invalidate()]);
      toast.success(result.isEnabled?"Расписание включено":"Расписание отключено",{description:result.isEnabled?"Параметры формирования отчетов сохранены.":"Сохраненные отчеты остаются доступны, новые будут запускаться только вручную."});
    },
    onError:()=>toast.error("Не удалось сохранить расписание",{description:"Проверьте параметры времени и повторите попытку."})
  });
  const deleteReport=trpc.audit.deleteWeeklyReport.useMutation({onSuccess:async deleted=>{setVisibleReports(current=>current.filter(item=>item.id!==deleted.id));if(selectedId===deleted.id){setSelectedId(undefined);window.history.replaceState(null,"","/reports");}setReportToDelete(undefined);await Promise.all([utils.audit.weeklyReports.invalidate(),utils.audit.changes.invalidate()]);toast.success("Сводка удалена",{description:"Удален только сохраненный отчет; финансовые факты не менялись."});},onError:()=>toast.error("Не удалось удалить сводку",{description:"Повторите попытку. Финансовые факты остаются без изменений."})});
  useEffect(()=>{if(schedule.data){setWeekday(schedule.data.weekday);setReportTime(schedule.data.reportTime);setReportPeriod(schedule.data.reportPeriod as "week"|"month");setIsEnabled(schedule.data.isEnabled)}},[schedule.data]);
  useEffect(()=>{const reportId=Number(new URLSearchParams(window.location.search).get("report"));if(reportId)setSelectedId(reportId)},[]);
  const list=visibleReports;
  const selected=useMemo(()=>list.find(item=>item.id===selectedId)??list[0],[list,selectedId]);
  const storedSummary=selected?.summary as unknown as Partial<Summary>|undefined;
  const summary=selected?{...storedSummary,periodStart:selected.periodStart,periodEnd:selected.periodEnd,periodType:storedSummary?.periodType??(selected.periodStart.slice(0,7)===selected.periodEnd.slice(0,7)?"month":"week")} as Summary:undefined;
  const reportDashboard=trpc.audit.dashboard.useQuery({ranges:[{from:selected?.periodStart??"2026-01-01",to:selected?.periodEnd??"2026-01-01"}]},{enabled:Boolean(selected),retry:false});
  const timeline=useMemo(()=>reportTimeline((reportDashboard.data?.periods??[]) as ReportTimelinePeriod[]),[reportDashboard.data]);
  const scheduleData=schedule.data;
  const isCustomPeriod=reportPeriod==="custom";
  const isDirty=!isCustomPeriod&&scheduleData?weekday!==scheduleData.weekday||reportTime!==scheduleData.reportTime||reportPeriod!==scheduleData.reportPeriod||isEnabled!==scheduleData.isEnabled:false;
  const typeLabel=reportPeriod==="month"?"завершенный месяц":isCustomPeriod?"выбранный период":"прошлую неделю";
  const periodSummaryLabel=reportPeriod==="month"?"за завершенный месяц":isCustomPeriod?"за выбранный период":"за календарную неделю";
  const openReport=(id:number)=>{const report=list.find(item=>item.id===id);selectReport(id);toast.info(report&&id===selected?.id?"Эта сводка уже открыта":"Открыта сохраненная сводка",{description:report?periodLabel(report.summary as unknown as Summary):"Показан выбранный период."});};
  const exportPdf=async()=>{
    if(!summary||!reportPdfRef.current||isExporting)return;
    setIsExporting(true);
    try{
      const [{default:html2canvas},{jsPDF}]=await Promise.all([import("html2canvas"),import("jspdf")]);
      const pdfTheme=document.documentElement.dataset.auditTheme==="light"?"light":"dark";
      const brandSource=await loadPdfBrand(pdfTheme).catch(error=>{
        console.warn("Не удалось загрузить тематическую иконку для PDF; используем встроенный знак",error);
        return undefined;
      });
      setPdfBrandSrc(brandSource);
      setPdfGeneratedAt(new Date());
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      const canvas=await html2canvas(reportPdfRef.current,{backgroundColor:pdfTheme==="light"?"#f8fbff":"#0c0b12",scale:Math.min(2,window.devicePixelRatio||1),useCORS:true,logging:false});
      const pdf=new jsPDF({orientation:"p",unit:"mm",format:"a4",compress:true});
      const pageWidth=pdf.internal.pageSize.getWidth();
      const pageHeight=pdf.internal.pageSize.getHeight();
      const margin=10;
      const imageWidth=pageWidth-margin*2;
      const imageHeight=canvas.height*imageWidth/canvas.width;
      const printableHeight=pageHeight-margin*2;
      const image=canvas.toDataURL("image/png");
      if(shouldFitPdfSummaryOnOnePage(imageHeight,printableHeight)){
        const scale=printableHeight/imageHeight;
        const renderedWidth=imageWidth*scale;
        pdf.addImage(image,"PNG",margin+(imageWidth-renderedWidth)/2,margin,renderedWidth,printableHeight,undefined,"FAST");
      }else{
        let remaining=imageHeight;
        let position=margin;
        pdf.addImage(image,"PNG",margin,position,imageWidth,imageHeight,undefined,"FAST");
        remaining-=printableHeight;
        while(remaining>0){position=margin-(imageHeight-remaining);pdf.addPage();pdf.addImage(image,"PNG",margin,position,imageWidth,imageHeight,undefined,"FAST");remaining-=printableHeight;}
      }
      const dynamics=await createReportDynamicsCanvas(summary,timeline,pdfTheme,brandSource);
      pdf.addPage();
      pdf.addImage(dynamics.toDataURL("image/png"),"PNG",0,0,pageWidth,pageHeight,undefined,"FAST");
      const insights=await createReportInsightsCanvas(summary,timeline,pdfTheme,brandSource);
      pdf.addPage();
      pdf.addImage(insights.toDataURL("image/png"),"PNG",0,0,pageWidth,pageHeight,undefined,"FAST");
      pdf.save(`Рыбный_отчет_${summary.periodStart}_${summary.periodEnd}.pdf`);
      toast.success("PDF-отчет выгружен",{description:`Сохранена выбранная сводка: ${date(summary.periodStart)} — ${date(summary.periodEnd)}.`});
    }catch(error){
      console.error("Не удалось выгрузить PDF-отчет",error);
      toast.error("Не удалось выгрузить PDF",{description:"Проверьте доступность выбранной сводки и повторите выгрузку."});
    }finally{setPdfGeneratedAt(null);setPdfBrandSrc(undefined);setIsExporting(false);}
  };
  if(me.data?.role!=="admin")return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярные отчеты"><section className="empty-state"><ShieldAlert size={30}/><h2>Отчеты доступны администратору</h2><p>Сводка предназначена для руководителей и использует только факты, доступные в Аналитике «Рыбный».</p></section></AuditShell>;
  return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярный отчет руководителя">
    <AlertDialog open={Boolean(reportToDelete)} onOpenChange={open=>{if(!open)setReportToDelete(undefined)}}><AlertDialogContent className="danger-confirm-dialog"><AlertDialogHeader><AlertDialogTitle>Удалить сформированную сводку?</AlertDialogTitle><AlertDialogDescription>Будет удалена только сохраненная сводка за период {reportToDelete&&`${date(reportToDelete.periodStart)} — ${date(reportToDelete.periodEnd)}`}. Первичные финансовые факты, импорты и права доступа останутся без изменений.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="danger-confirm-action" disabled={deleteReport.isPending} onClick={()=>reportToDelete&&deleteReport.mutate({reportId:reportToDelete.id})}>{deleteReport.isPending?"Удаляем…":"Удалить сводку"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <section className="page-lede"><div><span>РАСПИСАНИЕ · МОСКВА</span><h2>Короткая сводка по точному завершенному периоду</h2><p>P&amp;L собирается из дневных фактов за предыдущую календарную неделю, завершенный месяц или выбранный вручную диапазон. Действия из журнала учитываются в границах того же периода.</p></div><button className="packet-link compact" disabled={generate.isPending} onClick={()=>generate.mutate(isCustomPeriod?{range:customRange}:undefined)}><RefreshCw size={15}/>{generate.isPending?"Формируем…":`Сформировать за ${typeLabel}`}</button></section>
    <section className="packet-card report-schedule"><div className="card-title"><div><span><Clock3 size={15}/> НАСТРОЙКА ОТЧЕТА</span><h3>Период и график следующей сводки</h3></div></div><div className="report-schedule-controls"><label>Период отчета<select value={reportPeriod} onChange={event=>setReportPeriod(event.target.value as "week"|"month"|"custom")}><option value="week">За предыдущую неделю</option><option value="month">За завершенный месяц</option><option value="custom">Произвольный период</option></select></label>{isCustomPeriod?<label className="report-custom-period"><span>Даты произвольного периода</span><DateRangeControl value={customRange} onChange={setCustomRange} title="ПЕРИОД ОТЧЕТА" ariaLabel="Выбрать произвольный период отчета"/></label>:<>{reportPeriod==="week"?<label>День недели<select value={weekday} onChange={event=>setWeekday(Number(event.target.value))}>{weekdays.map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label>:<label>Периодичность<strong className="schedule-static">1-го числа каждого месяца</strong></label>}<label>Время, МСК<input type="time" value={reportTime} onChange={event=>setReportTime(event.target.value)}/></label><label className="schedule-enabled"><span>Расписание</span><button type="button" className={isEnabled?"schedule-toggle active":"schedule-toggle"} onClick={()=>setIsEnabled(value=>!value)} aria-pressed={isEnabled}>{isEnabled?"Включено":"Отключено"}</button></label><button className="packet-link compact" disabled={updateSchedule.isPending||!isDirty} onClick={()=>updateSchedule.mutate({weekday,reportTime,reportPeriod,isEnabled})}><Save size={15}/>{updateSchedule.isPending?"Сохраняем…":"Сохранить расписание"}</button></>}</div><p className="packet-note">{isCustomPeriod?`Произвольный период: ${date(customRange.from)} — ${date(customRange.to)}. Он формируется вручную и не меняет сохраненное недельное или месячное расписание.`:isEnabled?reportPeriod==="week"?`Автоматическое формирование: ${weekdays[weekday-1]} · ${reportTime} МСК, за предыдущую календарную неделю.`:`Автоматическое формирование: 1-го числа · ${reportTime} МСК, за завершенный календарный месяц.`:"Автоматическое формирование отключено. Сохраненные отчеты останутся доступны, а новую сводку можно сформировать вручную."}</p></section>
    {reports.isLoading?<section className="packet-card"><p className="packet-note">Загружаем сохраненные отчеты…</p></section>:!summary?<section className="empty-state"><FileText size={30}/><h2>Отчетов пока нет</h2><p>Сформируйте первую сводку вручную. Далее отчет будет появляться только если расписание включено.</p></section>:<>
      <div ref={reportPdfRef} className="report-pdf-source">
      {pdfGeneratedAt&&<header className="report-pdf-brand"><div className="report-pdf-brand-mark">{pdfBrandSrc?<img className="report-pdf-brand-glyph" src={pdfBrandSrc} alt=""/>:<ReportPdfBrandGlyph theme={theme}/>}<div><span>АНАЛИТИКА «РЫБНЫЙ»</span><strong>Регулярный отчет руководителя</strong></div></div><div className="report-pdf-generated"><span>СФОРМИРОВАНО</span><strong>{pdfTimestamp(pdfGeneratedAt)}</strong></div></header>}
      <section className="packet-kpis equal"><article className="packet-kpi"><span>ВЫРУЧКА</span><strong>{money(summary.revenue)}</strong><small>{summary.periodType==="month"?"за завершенный месяц":summary.periodType==="custom"?"за выбранный период":"за календарную неделю"}</small></article><article className={`packet-kpi ${summary.netProfit<0?"risk":""}`}><span>ЧИСТАЯ ПРИБЫЛЬ</span><strong className={moneyClass(summary.netProfit)}>{money(summary.netProfit)}</strong><small>{summary.margin.toFixed(1)}% маржа сети</small></article><article className="packet-kpi"><span>ТОЧКИ В СРЕЗЕ</span><strong>{summary.stores}</strong><small>{summary.lossStores} с отрицательной прибылью</small></article><article className="packet-kpi"><span>ДЕЙСТВИЯ В СРЕЗЕ</span><strong>{summary.changeCount}</strong><small>из журнала изменений</small></article></section>
      <section className="report-layout" ref={reportSummaryRef}><article className="packet-card report-hero"><div className="card-title"><div><span><CalendarDays size={15}/> ВЫБРАННЫЙ ОТЧЕТ</span><h3 key={`report-period-${selected.id}`}>{date(summary.periodStart)} — {date(summary.periodEnd)}</h3></div></div><p>{reportMethodology(summary)}</p><div className="report-history"><div><strong>Сохраненные отчеты</strong><small>Откройте сохраненную сводку или удалите только ненужный сформированный отчет.</small></div><div className="report-history-list">{list.map(item=>{const itemSummary=item.summary as unknown as Summary;const isActive=item.id===selected?.id;return <div className="report-history-row" key={item.id}><button type="button" className={isActive?"report-history-item active":"report-history-item"} onClick={()=>openReport(item.id)}><span><small>{periodTypeLabel(itemSummary.periodType)}</small><strong>{periodLabel(itemSummary)}</strong></span><b>{isActive?"Открыта":"Показать"}</b></button><button type="button" className="report-history-delete" onClick={()=>setReportToDelete(item)} aria-label={`Удалить сводку ${periodLabel(itemSummary)}`}><Trash2 size={15}/></button></div>})}{reports.data?.hasMore&&<button type="button" className="report-history-more" disabled={reports.isFetching} onClick={()=>setReportOffset(reports.data?.nextOffset??reportOffset)}>{reports.isFetching?"Загружаем…":"Показать следующие"}</button>}</div></div></article><article className="packet-card"><div className="card-title"><div><span><TrendingUp size={15}/> ТОП ПО ПРИБЫЛИ</span><h3>Три точки-ориентира</h3></div></div><div className="report-ranking">{summary.topProfit.map((item,index)=><div key={item.store}><b>{String(index+1).padStart(2,"0")}</b><span>{item.store}</span><strong className={moneyClass(item.value)}>{money(item.value)}</strong></div>)}</div></article><article className="packet-card"><div className="card-title"><div><span><CircleAlert size={15}/> РИСКИ</span><h3>Что проверить в первую очередь</h3></div></div>{summary.riskStores.length?<div className="report-risks">{summary.riskStores.map(item=>{const isCoverage=item.reason.includes("покрытие");return <div key={`${item.store}-${item.reason}`}><div><strong>{item.store}</strong><span>{item.reason}</span></div><b className={isCoverage?"neutral":moneyClass(item.value)}>{isCoverage?`${item.value.toFixed(1)} дн.`:money(item.value)}</b></div>})}</div>:<p className="packet-note">По правилам отчета критичных риск-сигналов в срезе нет.</p>}</article></section>
      <section className="packet-card report-actions"><div><BarChart3 size={20}/><div><strong>Рекомендуемый порядок проверки</strong><p>Откройте «Сигналы» для событий и «Динамику» для сопоставления периодов. Отчет указывает точки внимания, а не является автоматической рекомендацией закрытия или изменения цен.</p></div></div><span>{summary.lossStores?<><TrendingDown size={16}/> Есть точки с убытком</>:<><TrendingUp size={16}/> Убыточных точек в срезе нет</>}</span></section>
      </div>
      <div className="report-export-actions"><button type="button" className="packet-link compact report-export-button" disabled={isExporting||reportDashboard.isLoading} onClick={()=>void exportPdf()} aria-label="Выгрузить выбранный отчет в PDF"><Download size={15}/>{isExporting?"Готовим PDF…":reportDashboard.isLoading?"Загружаем динамику…":"Выгрузить PDF"}</button></div>
    </>}
  </AuditShell>;
}
