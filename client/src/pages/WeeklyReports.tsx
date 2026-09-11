import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, CircleAlert, Clock3, Download, FileText, RefreshCw, Save, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { useAudit } from "@/contexts/AuditContext";
import { trpc } from "@/lib/trpc";

type Summary={periodStart:string;periodEnd:string;snapshotMonth:string|null;periodType?:"week"|"month";revenue:number;netProfit:number;margin:number;stores:number;lossStores:number;changeCount:number;topProfit:Array<{store:string;value:number}>;riskStores:Array<{store:string;reason:string;value:number}>;methodology:string};
type ReportTimelinePeriod={entryDate:string;store:string;isHidden:boolean;metrics:Record<string,unknown>};
export type ReportTimelinePoint={date:string;revenue:number;netProfit:number;stores:number};
const money=(value:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽";
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"});
const weekdays=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const moneyClass=(value:number)=>value>0?"positive":value<0?"negative":"neutral";
const periodLabel=(summary:Summary)=>`${summary.periodType==="month"?"Месяц":"Неделя"} · ${summary.periodStart.slice(5).split("-").reverse().join(".")}—${summary.periodEnd.slice(5).split("-").reverse().join(".")}`;
export const reportMethodology=(summary:Pick<Summary,"periodStart"|"periodEnd">)=>`P&L рассчитан из первичных дневных фактов за период ${summary.periodStart} — ${summary.periodEnd}. Остаток — последний доступный снапшот каждой включенной точки внутри этого среза; журнал действий учитывается за тот же период.`;
const pdfTimestamp=(value:Date)=>new Intl.DateTimeFormat("ru-RU",{dateStyle:"long",timeStyle:"short"}).format(value);
const ReportPdfBrandGlyph=({theme}:{theme:"dark"|"light"})=><svg className="report-pdf-brand-glyph" viewBox="0 0 48 48" aria-label="Фирменный знак Аналитики Рыбный" role="img"><circle cx="24" cy="24" r="22" fill={theme==="dark"?"#1c1b26":"#edf6ff"}/><path d="M10 28h7l5-10 5 13 5-8h6" fill="none" stroke="#ff765f" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 16c4-3 7 0 7 2s-3 5-7 2l-3 3v-10z" fill="#f6c94d"/><circle cx="14" cy="18" r=".9" fill="#16263a"/><path d="M32 31c4-3 7 0 7 2s-3 5-7 2l-3 3v-10z" fill="#ff765f"/><circle cx="35" cy="33" r=".9" fill="#fff"/></svg>;
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
const createReportDynamicsCanvas=(summary:Summary,points:readonly ReportTimelinePoint[],theme:"dark"|"light")=>{
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
  context.fillStyle=dark?"#ff765f":"#0a63c8";context.beginPath();context.arc(76,76,24,0,Math.PI*2);context.fill();
  context.fillStyle="#ffffff";context.font="800 28px Arial";context.fillText("≈",66,85);
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

export default function WeeklyReports(){
  const {theme}=useAudit();
  const utils=trpc.useUtils();
  const me=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const reports=trpc.audit.weeklyReports.useQuery(undefined,{retry:false});
  const schedule=trpc.audit.weeklyReportSchedule.useQuery(undefined,{retry:false});
  const reportSummaryRef=useRef<HTMLElement>(null);
  const reportPdfRef=useRef<HTMLDivElement>(null);
  const [selectedId,setSelectedId]=useState<number>();
  const [weekday,setWeekday]=useState(1);
  const [reportTime,setReportTime]=useState("09:00");
  const [reportPeriod,setReportPeriod]=useState<"week"|"month">("week");
  const [isEnabled,setIsEnabled]=useState(true);
  const [isExporting,setIsExporting]=useState(false);
  const [pdfGeneratedAt,setPdfGeneratedAt]=useState<Date|null>(null);
  const selectReport=(id:number)=>{setSelectedId(id);window.history.replaceState(null,"",`/reports?report=${id}`);window.setTimeout(()=>reportSummaryRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),0);};
  const generate=trpc.audit.generateWeeklyReport.useMutation({
    onSuccess:async result=>{
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
  useEffect(()=>{if(schedule.data){setWeekday(schedule.data.weekday);setReportTime(schedule.data.reportTime);setReportPeriod(schedule.data.reportPeriod as "week"|"month");setIsEnabled(schedule.data.isEnabled)}},[schedule.data]);
  useEffect(()=>{const reportId=Number(new URLSearchParams(window.location.search).get("report"));if(reportId)setSelectedId(reportId)},[]);
  const list=reports.data??[];
  const selected=useMemo(()=>list.find(item=>item.id===selectedId)??list[0],[list,selectedId]);
  const storedSummary=selected?.summary as unknown as Partial<Summary>|undefined;
  const summary=selected?{...storedSummary,periodStart:selected.periodStart,periodEnd:selected.periodEnd,periodType:storedSummary?.periodType??(selected.periodStart.slice(0,7)===selected.periodEnd.slice(0,7)?"month":"week")} as Summary:undefined;
  const reportDashboard=trpc.audit.dashboard.useQuery({ranges:[{from:selected?.periodStart??"2026-01-01",to:selected?.periodEnd??"2026-01-01"}]},{enabled:Boolean(selected),retry:false});
  const timeline=useMemo(()=>reportTimeline((reportDashboard.data?.periods??[]) as ReportTimelinePeriod[]),[reportDashboard.data]);
  const scheduleData=schedule.data;
  const isDirty=scheduleData?weekday!==scheduleData.weekday||reportTime!==scheduleData.reportTime||reportPeriod!==scheduleData.reportPeriod||isEnabled!==scheduleData.isEnabled:false;
  const typeLabel=reportPeriod==="month"?"завершенный месяц":"прошлую неделю";
  const openReport=(id:number)=>{const report=list.find(item=>item.id===id);selectReport(id);toast.info(report&&id===selected?.id?"Эта сводка уже открыта":"Открыта сохраненная сводка",{description:report?periodLabel(report.summary as unknown as Summary):"Показан выбранный период."});};
  const exportPdf=async()=>{
    if(!summary||!reportPdfRef.current||isExporting)return;
    setIsExporting(true);
    setPdfGeneratedAt(new Date());
    try{
      const [{default:html2canvas},{jsPDF}]=await Promise.all([import("html2canvas"),import("jspdf")]);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      const pdfTheme=document.documentElement.dataset.auditTheme==="light"?"light":"dark";
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
      const dynamics=createReportDynamicsCanvas(summary,timeline,pdfTheme);
      pdf.addPage();
      pdf.addImage(dynamics.toDataURL("image/png"),"PNG",0,0,pageWidth,pageHeight,undefined,"FAST");
      pdf.save(`Рыбный_отчет_${summary.periodStart}_${summary.periodEnd}.pdf`);
      toast.success("PDF-отчет выгружен",{description:`Сохранена выбранная сводка: ${date(summary.periodStart)} — ${date(summary.periodEnd)}.`});
    }catch(error){
      console.error("Не удалось выгрузить PDF-отчет",error);
      toast.error("Не удалось выгрузить PDF",{description:"Повторите попытку после полной загрузки отчета."});
    }finally{setPdfGeneratedAt(null);setIsExporting(false);}
  };
  if(me.data?.role!=="admin")return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярные отчеты"><section className="empty-state"><ShieldAlert size={30}/><h2>Отчеты доступны администратору</h2><p>Сводка предназначена для руководителей и использует только факты, доступные в Аналитике «Рыбный».</p></section></AuditShell>;
  return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярный отчет руководителя">
    <section className="page-lede"><div><span>РАСПИСАНИЕ · МОСКВА</span><h2>Короткая сводка по точному завершенному периоду</h2><p>P&amp;L собирается из дневных фактов за предыдущую календарную неделю или завершенный месяц. Действия из журнала учитываются за тот же период — отчет не использует случайный последний месяц.</p></div><button className="packet-link compact" disabled={generate.isPending} onClick={()=>generate.mutate()}><RefreshCw size={15}/>{generate.isPending?"Формируем…":`Сформировать за ${typeLabel}`}</button></section>
    <section className="packet-card report-schedule"><div className="card-title"><div><span><Clock3 size={15}/> НАСТРОЙКА ОТЧЕТА</span><h3>Период и график следующей сводки</h3></div></div><div className="report-schedule-controls"><label>Период отчета<select value={reportPeriod} onChange={event=>setReportPeriod(event.target.value as "week"|"month")}><option value="week">За предыдущую неделю</option><option value="month">За завершенный месяц</option></select></label>{reportPeriod==="week"?<label>День недели<select value={weekday} onChange={event=>setWeekday(Number(event.target.value))}>{weekdays.map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label>:<label>Периодичность<strong className="schedule-static">1-го числа каждого месяца</strong></label>}<label>Время, МСК<input type="time" value={reportTime} onChange={event=>setReportTime(event.target.value)}/></label><label className="schedule-enabled"><span>Расписание</span><button type="button" className={isEnabled?"schedule-toggle active":"schedule-toggle"} onClick={()=>setIsEnabled(value=>!value)} aria-pressed={isEnabled}>{isEnabled?"Включено":"Отключено"}</button></label><button className="packet-link compact" disabled={updateSchedule.isPending||!isDirty} onClick={()=>updateSchedule.mutate({weekday,reportTime,reportPeriod,isEnabled})}><Save size={15}/>{updateSchedule.isPending?"Сохраняем…":"Сохранить расписание"}</button></div><p className="packet-note">{isEnabled?reportPeriod==="week"?`Автоматическое формирование: ${weekdays[weekday-1]} · ${reportTime} МСК, за предыдущую календарную неделю.`:`Автоматическое формирование: 1-го числа · ${reportTime} МСК, за завершенный календарный месяц.`:"Автоматическое формирование отключено. Сохраненные отчеты останутся доступны, а новую сводку можно сформировать вручную."}</p></section>
    {reports.isLoading?<section className="packet-card"><p className="packet-note">Загружаем сохраненные отчеты…</p></section>:!summary?<section className="empty-state"><FileText size={30}/><h2>Отчетов пока нет</h2><p>Сформируйте первую сводку вручную. Далее отчет будет появляться только если расписание включено.</p></section>:<>
      <div ref={reportPdfRef} className="report-pdf-source">
      {pdfGeneratedAt&&<header className="report-pdf-brand"><div className="report-pdf-brand-mark"><ReportPdfBrandGlyph theme={theme}/><div><span>АНАЛИТИКА «РЫБНЫЙ»</span><strong>Регулярный отчет руководителя</strong></div></div><div className="report-pdf-generated"><span>СФОРМИРОВАНО</span><strong>{pdfTimestamp(pdfGeneratedAt)}</strong></div></header>}
      <section className="packet-kpis equal"><article className="packet-kpi"><span>ВЫРУЧКА</span><strong>{money(summary.revenue)}</strong><small>{summary.periodType==="month"?"за завершенный месяц":"за календарную неделю"}</small></article><article className={`packet-kpi ${summary.netProfit<0?"risk":""}`}><span>ЧИСТАЯ ПРИБЫЛЬ</span><strong className={moneyClass(summary.netProfit)}>{money(summary.netProfit)}</strong><small>{summary.margin.toFixed(1)}% маржа сети</small></article><article className="packet-kpi"><span>ТОЧКИ В СРЕЗЕ</span><strong>{summary.stores}</strong><small>{summary.lossStores} с отрицательной прибылью</small></article><article className="packet-kpi"><span>ДЕЙСТВИЯ В СРЕЗЕ</span><strong>{summary.changeCount}</strong><small>из журнала изменений</small></article></section>
      <section className="report-layout" ref={reportSummaryRef}><article className="packet-card report-hero"><div className="card-title"><div><span><CalendarDays size={15}/> ВЫБРАННЫЙ ОТЧЕТ</span><h3 key={`report-period-${selected.id}`}>{date(summary.periodStart)} — {date(summary.periodEnd)}</h3></div></div><p>{reportMethodology(summary)}</p><div className="report-history"><div><strong>Сохраненные отчеты</strong><small>Нажмите «Показать»<br/>Сводка выше сразу переключится на сохраненный расчет.</small></div><div className="report-history-list">{list.map(item=>{const itemSummary=item.summary as unknown as Summary;const isActive=item.id===selected?.id;return <button type="button" key={item.id} className={isActive?"report-history-item active":"report-history-item"} onClick={()=>openReport(item.id)}><span><small>{itemSummary.periodType==="month"?"Ежемесячная сводка":"Еженедельная сводка"}</small><strong>{periodLabel(itemSummary)}</strong></span><b>{isActive?"Открыта сейчас":"Показать"}</b></button>})}</div></div></article><article className="packet-card"><div className="card-title"><div><span><TrendingUp size={15}/> ТОП ПО ПРИБЫЛИ</span><h3>Три точки-ориентира</h3></div></div><div className="report-ranking">{summary.topProfit.map((item,index)=><div key={item.store}><b>{String(index+1).padStart(2,"0")}</b><span>{item.store}</span><strong className={moneyClass(item.value)}>{money(item.value)}</strong></div>)}</div></article><article className="packet-card"><div className="card-title"><div><span><CircleAlert size={15}/> РИСКИ</span><h3>Что проверить в первую очередь</h3></div></div>{summary.riskStores.length?<div className="report-risks">{summary.riskStores.map(item=>{const isCoverage=item.reason.includes("покрытие");return <div key={`${item.store}-${item.reason}`}><div><strong>{item.store}</strong><span>{item.reason}</span></div><b className={isCoverage?"neutral":moneyClass(item.value)}>{isCoverage?`${item.value.toFixed(1)} дн.`:money(item.value)}</b></div>})}</div>:<p className="packet-note">По правилам отчета критичных риск-сигналов в срезе нет.</p>}</article></section>
      <section className="packet-card report-actions"><div><BarChart3 size={20}/><div><strong>Рекомендуемый порядок проверки</strong><p>Откройте «Сигналы» для событий и «Динамику» для сопоставления периодов. Отчет указывает точки внимания, а не является автоматической рекомендацией закрытия или изменения цен.</p></div></div><span>{summary.lossStores?<><TrendingDown size={16}/> Есть точки с убытком</>:<><TrendingUp size={16}/> Убыточных точек в срезе нет</>}</span></section>
      </div>
      <div className="report-export-actions"><button type="button" className="packet-link compact report-export-button" disabled={isExporting||reportDashboard.isLoading} onClick={()=>void exportPdf()} aria-label="Выгрузить выбранный отчет в PDF"><Download size={15}/>{isExporting?"Готовим PDF…":reportDashboard.isLoading?"Загружаем динамику…":"Выгрузить PDF"}</button></div>
    </>}
  </AuditShell>;
}
