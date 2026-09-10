import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CalendarDays, CircleAlert, Clock3, FileText, RefreshCw, Save, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { trpc } from "@/lib/trpc";

type Summary={periodStart:string;periodEnd:string;snapshotMonth:string|null;periodType?:"week"|"month";revenue:number;netProfit:number;margin:number;stores:number;lossStores:number;changeCount:number;topProfit:Array<{store:string;value:number}>;riskStores:Array<{store:string;reason:string;value:number}>;methodology:string};
const money=(value:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value)+" ₽";
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"});
const weekdays=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const moneyClass=(value:number)=>value>0?"positive":value<0?"negative":"neutral";
const periodLabel=(summary:Summary)=>`${summary.periodType==="month"?"Месяц":"Неделя"} · ${summary.periodStart.slice(5).split("-").reverse().join(".")}—${summary.periodEnd.slice(5).split("-").reverse().join(".")}`;
export const reportMethodology=(summary:Pick<Summary,"periodStart"|"periodEnd">)=>`P&L рассчитан из первичных дневных фактов за период ${summary.periodStart} — ${summary.periodEnd}. Остаток — последний доступный снапшот каждой включенной точки внутри этого среза; журнал действий учитывается за тот же период.`;

export default function WeeklyReports(){
  const utils=trpc.useUtils();
  const me=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const reports=trpc.audit.weeklyReports.useQuery(undefined,{retry:false});
  const schedule=trpc.audit.weeklyReportSchedule.useQuery(undefined,{retry:false});
  const reportSummaryRef=useRef<HTMLElement>(null);
  const [selectedId,setSelectedId]=useState<number>();
  const [weekday,setWeekday]=useState(1);
  const [reportTime,setReportTime]=useState("09:00");
  const [reportPeriod,setReportPeriod]=useState<"week"|"month">("week");
  const [isEnabled,setIsEnabled]=useState(true);
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
  const scheduleData=schedule.data;
  const isDirty=scheduleData?weekday!==scheduleData.weekday||reportTime!==scheduleData.reportTime||reportPeriod!==scheduleData.reportPeriod||isEnabled!==scheduleData.isEnabled:false;
  const typeLabel=reportPeriod==="month"?"завершенный месяц":"прошлую неделю";
  const openReport=(id:number)=>{const report=list.find(item=>item.id===id);selectReport(id);toast.info(report&&id===selected?.id?"Эта сводка уже открыта":"Открыта сохраненная сводка",{description:report?periodLabel(report.summary as unknown as Summary):"Показан выбранный период."});};
  if(me.data?.role!=="admin")return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярные отчеты"><section className="empty-state"><ShieldAlert size={30}/><h2>Отчеты доступны администратору</h2><p>Сводка предназначена для руководителей и использует только факты, доступные в Аналитике «Рыбный».</p></section></AuditShell>;
  return <AuditShell kicker="16 / ОТЧЕТЫ" title="Регулярный отчет руководителя">
    <section className="page-lede"><div><span>РАСПИСАНИЕ · МОСКВА</span><h2>Короткая сводка по точному завершенному периоду</h2><p>P&amp;L собирается из дневных фактов за предыдущую календарную неделю или завершенный месяц. Действия из журнала учитываются за тот же период — отчет не использует случайный последний месяц.</p></div><button className="packet-link compact" disabled={generate.isPending} onClick={()=>generate.mutate()}><RefreshCw size={15}/>{generate.isPending?"Формируем…":`Сформировать за ${typeLabel}`}</button></section>
    <section className="packet-card report-schedule"><div className="card-title"><div><span><Clock3 size={15}/> НАСТРОЙКА ОТЧЕТА</span><h3>Период и график следующей сводки</h3></div></div><div className="report-schedule-controls"><label>Период отчета<select value={reportPeriod} onChange={event=>setReportPeriod(event.target.value as "week"|"month")}><option value="week">За предыдущую неделю</option><option value="month">За завершенный месяц</option></select></label>{reportPeriod==="week"?<label>День недели<select value={weekday} onChange={event=>setWeekday(Number(event.target.value))}>{weekdays.map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label>:<label>Периодичность<strong className="schedule-static">1-го числа каждого месяца</strong></label>}<label>Время, МСК<input type="time" value={reportTime} onChange={event=>setReportTime(event.target.value)}/></label><label className="schedule-enabled"><span>Расписание</span><button type="button" className={isEnabled?"schedule-toggle active":"schedule-toggle"} onClick={()=>setIsEnabled(value=>!value)} aria-pressed={isEnabled}>{isEnabled?"Включено":"Отключено"}</button></label><button className="packet-link compact" disabled={updateSchedule.isPending||!isDirty} onClick={()=>updateSchedule.mutate({weekday,reportTime,reportPeriod,isEnabled})}><Save size={15}/>{updateSchedule.isPending?"Сохраняем…":"Сохранить расписание"}</button></div><p className="packet-note">{isEnabled?reportPeriod==="week"?`Автоматическое формирование: ${weekdays[weekday-1]} · ${reportTime} МСК, за предыдущую календарную неделю.`:`Автоматическое формирование: 1-го числа · ${reportTime} МСК, за завершенный календарный месяц.`:"Автоматическое формирование отключено. Сохраненные отчеты останутся доступны, а новую сводку можно сформировать вручную."}</p></section>
    {reports.isLoading?<section className="packet-card"><p className="packet-note">Загружаем сохраненные отчеты…</p></section>:!summary?<section className="empty-state"><FileText size={30}/><h2>Отчетов пока нет</h2><p>Сформируйте первую сводку вручную. Далее отчет будет появляться только если расписание включено.</p></section>:<>
      <section className="packet-kpis equal"><article className="packet-kpi"><span>ВЫРУЧКА</span><strong>{money(summary.revenue)}</strong><small>{summary.periodType==="month"?"за завершенный месяц":"за календарную неделю"}</small></article><article className={`packet-kpi ${summary.netProfit<0?"risk":""}`}><span>ЧИСТАЯ ПРИБЫЛЬ</span><strong className={moneyClass(summary.netProfit)}>{money(summary.netProfit)}</strong><small>{summary.margin.toFixed(1)}% маржа сети</small></article><article className="packet-kpi"><span>ТОЧКИ В СРЕЗЕ</span><strong>{summary.stores}</strong><small>{summary.lossStores} с отрицательной прибылью</small></article><article className="packet-kpi"><span>ДЕЙСТВИЯ В СРЕЗЕ</span><strong>{summary.changeCount}</strong><small>из журнала изменений</small></article></section>
      <section className="report-layout" ref={reportSummaryRef}><article className="packet-card report-hero"><div className="card-title"><div><span><CalendarDays size={15}/> ВЫБРАННЫЙ ОТЧЕТ</span><h3 key={`report-period-${selected.id}`}>{date(summary.periodStart)} — {date(summary.periodEnd)}</h3></div></div><p>{reportMethodology(summary)}</p><div className="report-history"><div><strong>Сохраненные отчеты</strong><small>Нажмите «Показать»<br/>Сводка выше сразу переключится на сохраненный расчет.</small></div><div className="report-history-list">{list.map(item=>{const itemSummary=item.summary as unknown as Summary;const isActive=item.id===selected?.id;return <button type="button" key={item.id} className={isActive?"report-history-item active":"report-history-item"} onClick={()=>openReport(item.id)}><span><small>{itemSummary.periodType==="month"?"Ежемесячная сводка":"Еженедельная сводка"}</small><strong>{periodLabel(itemSummary)}</strong></span><b>{isActive?"Открыта сейчас":"Показать"}</b></button>})}</div></div></article><article className="packet-card"><div className="card-title"><div><span><TrendingUp size={15}/> ТОП ПО ПРИБЫЛИ</span><h3>Три точки-ориентира</h3></div></div><div className="report-ranking">{summary.topProfit.map((item,index)=><div key={item.store}><b>{String(index+1).padStart(2,"0")}</b><span>{item.store}</span><strong className={moneyClass(item.value)}>{money(item.value)}</strong></div>)}</div></article><article className="packet-card"><div className="card-title"><div><span><CircleAlert size={15}/> РИСКИ</span><h3>Что проверить в первую очередь</h3></div></div>{summary.riskStores.length?<div className="report-risks">{summary.riskStores.map(item=>{const isCoverage=item.reason.includes("покрытие");return <div key={`${item.store}-${item.reason}`}><div><strong>{item.store}</strong><span>{item.reason}</span></div><b className={isCoverage?"neutral":moneyClass(item.value)}>{isCoverage?`${item.value.toFixed(1)} дн.`:money(item.value)}</b></div>})}</div>:<p className="packet-note">По правилам отчета критичных риск-сигналов в срезе нет.</p>}</article></section>
      <section className="packet-card report-actions"><div><BarChart3 size={20}/><div><strong>Рекомендуемый порядок проверки</strong><p>Откройте «Сигналы» для событий и «Динамику» для сопоставления периодов. Отчет указывает точки внимания, а не является автоматической рекомендацией закрытия или изменения цен.</p></div></div><span>{summary.lossStores?<><TrendingDown size={16}/> Есть точки с убытком</>:<><TrendingUp size={16}/> Убыточных точек в срезе нет</>}</span></section>
    </>}
  </AuditShell>;
}
