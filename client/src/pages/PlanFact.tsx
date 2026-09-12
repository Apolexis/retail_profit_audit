import { ArrowDownRight, ArrowUpRight, ClipboardPenLine, RefreshCcw, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { DateRangeControl } from "@/components/DateRangeControl";
import { useAudit } from "@/contexts/AuditContext";
import { useImportedAudit } from "@/hooks/useImportedAudit";
import { prepareDailyFacts } from "@/lib/dailyFacts";
import { planForRange, rangeMonths, sumPlan } from "@/lib/planFact";
import { trpc } from "@/lib/trpc";

const metrics=[
  ["revenue","Выручка"],
  ["gross_profit","Валовая прибыль"],
  ["net_profit","Чистая прибыль"],
  ["purchases","Закупки"],
  ["writeoff_frozen","Списания М."],
  ["rent","Аренда б/нал"],
  ["cash_operating_costs","Общие траты нал"],
  ["cashless_operating_costs","Расходы безналичные"],
] as const;
type MetricCode=(typeof metrics)[number][0];
const label=(code:string)=>metrics.find(([key])=>key===code)?.[1]??code;
const number=(rows:{store:string;metrics:Record<string,number>}[],code:string,store:string)=>rows.filter(row=>store==="__all__"||row.store===store).reduce((sum,row)=>sum+Number(row.metrics[code]??0),0);
const money=(value:number)=>formatK(value/1000);
const monthLabel=(value:string)=>new Date(`${value}-01T12:00:00`).toLocaleDateString("ru-RU",{month:"short",year:"2-digit"}).replace(".","");

export default function PlanFact(){
  const {range,selectedStore}=useAudit();
  const facts=useImportedAudit();
  const input=useMemo(()=>({range}),[range.from,range.to]);
  const plans=trpc.audit.planFacts.useQuery(input,{retry:false});
  const stores=trpc.audit.stores.useQuery(undefined,{retry:false});
  const session=trpc.localAuth.me.useQuery(undefined,{retry:false});
  const utils=trpc.useUtils();
  const [form,setForm]=useState<{storeId:string;monthDate:string;metricCode:MetricCode;amount:string}>({storeId:"",monthDate:range.from.slice(0,7),metricCode:"revenue",amount:""});
  const prepared=useMemo(()=>prepareDailyFacts(facts.periods,range),[facts.periods,range]);
  const visiblePlans=useMemo(()=>plans.data?.filter(plan=>!plan.isHidden)??[],[plans.data]);
  const metricSummaries=useMemo(()=>metrics.map(([code,name])=>{const actual=number(prepared,code,selectedStore);const plan=sumPlan(visiblePlans,range,code,selectedStore);const delta=actual-plan;return {code,name,actual,plan,delta,hasPlan:plan!==0}}),[prepared,range,selectedStore,visiblePlans]);
  const monthly=useMemo(()=>rangeMonths(range).map(month=>{const slice={from:month===range.from.slice(0,7)?range.from:`${month}-01`,to:month===range.to.slice(0,7)?range.to:`${month}-${new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate()}`};return {month:monthLabel(month),actual:number(prepared.filter(row=>row.entryDate>=slice.from&&row.entryDate<=slice.to),form.metricCode,selectedStore)/1000,plan:visiblePlans.filter(row=>row.metricCode===form.metricCode&&(selectedStore==="__all__"||row.store===selectedStore)).reduce((sum,row)=>sum+planForRange(row.amount,row.monthDate,slice),0)/1000}}),[form.metricCode,prepared,range,selectedStore,visiblePlans]);
  const upsert=trpc.audit.upsertPlanFact.useMutation({onSuccess:async()=>{await utils.audit.planFacts.invalidate();toast.success("План сохранен");setForm(value=>({...value,amount:""}))},onError:error=>toast.error(error.message)});
  const remove=trpc.audit.deletePlanFact.useMutation({onSuccess:()=>utils.audit.planFacts.invalidate(),onError:error=>toast.error(error.message)});
  const isAdmin=session.data?.role==="admin";
  const scope=selectedStore==="__all__"?"Все доступные магазины":selectedStore;
  if(facts.loading||plans.isLoading)return <AuditShell kicker="11 / ПЛАН‑ФАКТ" title="План‑факт"><section className="empty-state"><h2>Готовим план‑факт…</h2></section></AuditShell>;
  return <AuditShell kicker="11 / ПЛАН‑ФАКТ" title="План‑факт по управленческим показателям">
    <section className="page-lede plan-lede"><div><span>ОТДЕЛЬНО ОТ ИМПОРТИРОВАННОГО ФАКТА</span><h2>План не подставляется автоматически</h2><p>Факт берется из загруженной книги. План вводится администратором по магазину, месяцу и показателю; для неполного месяца он показывается пропорционально календарным дням выбранного среза.</p></div><DateRangeControl title="ПЕРИОД ПЛАН‑ФАКТА" ariaLabel="Изменить период план‑факта"/></section>
    <section className="plan-kpis">{metricSummaries.slice(0,4).map(item=><article key={item.code} className={item.hasPlan&&item.delta<0?"packet-kpi risk":"packet-kpi"}><span>{item.name}</span><strong>{item.hasPlan?money(item.delta):money(item.actual)}</strong><small>{item.hasPlan?<>план {money(item.plan)} · факт {money(item.actual)}</>:"План пока не задан"}</small></article>)}</section>
    <section className="two-col plan-main-grid"><article className="packet-card"><div className="card-title"><div><span>ТРАЕКТОРИЯ ПЛАНА И ФАКТА</span><h3>{label(form.metricCode)} · {scope}</h3><small>Срез: {range.from.split("-").reverse().join(".")} — {range.to.split("-").reverse().join(".")}</small></div><Target size={19}/></div><MetricLineChart data={monthly} lines={[{key:"actual",name:"Факт",color:"#ff765f"},{key:"plan",name:"План",color:"#7a8ca8"}]} unit="k"/></article><article className="packet-card"><div className="card-title"><div><span>ОТКЛОНЕНИЯ</span><h3>Что требует внимания</h3></div><ClipboardPenLine size={19}/></div><div className="plan-deviations">{metricSummaries.filter(item=>item.hasPlan).length?metricSummaries.filter(item=>item.hasPlan).map(item=><div key={item.code} className={item.delta<0?"plan-deviation negative":"plan-deviation positive"}><div><span>{item.name}</span><b>{money(item.actual)} факт / {money(item.plan)} план</b></div><strong>{item.delta>=0?<ArrowUpRight size={16}/>:<ArrowDownRight size={16}/>} {money(item.delta)} · {formatPct(item.plan?item.delta/item.plan*100:0)}</strong></div>):<div className="empty-state compact"><Target size={25}/><h2>Нет планов в выбранном срезе</h2><p>{isAdmin?"Добавьте первый план справа — фактические показатели уже готовы к сопоставлению.":"Администратор еще не ввел плановые значения для назначенных вам магазинов."}</p></div>}</div></article></section>
    <section className="packet-card plan-table-card"><div className="card-title"><div><span>ПЛАНОВЫЕ ЗНАЧЕНИЯ</span><h3>Помесячный ввод и контроль</h3><small>План не меняет исходные факты и не участвует в повторном импорте Excel.</small></div><RefreshCcw size={18}/></div>{isAdmin?<form className="plan-editor" onSubmit={event=>{event.preventDefault();if(!form.storeId||!form.amount){toast.error("Выберите магазин и укажите сумму плана");return}upsert.mutate({storeId:Number(form.storeId),monthDate:form.monthDate,metricCode:form.metricCode,amount:Number(form.amount)})}}><label>Магазин<select value={form.storeId} onChange={event=>setForm(value=>({...value,storeId:event.target.value}))}><option value="">Выберите магазин</option>{(stores.data??[]).filter(store=>!store.isHidden).map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>Месяц<input type="month" value={form.monthDate} onChange={event=>setForm(value=>({...value,monthDate:event.target.value}))}/></label><label>Показатель<select value={form.metricCode} onChange={event=>setForm(value=>({...value,metricCode:event.target.value as MetricCode}))}>{metrics.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><label>План, ₽<input type="number" inputMode="decimal" value={form.amount} onChange={event=>setForm(value=>({...value,amount:event.target.value}))} placeholder="0"/></label><button className="packet-link compact" disabled={upsert.isPending}>{upsert.isPending?"Сохраняем…":"Сохранить план"}</button></form>:null}<div className="plan-rows">{visiblePlans.length?visiblePlans.sort((a,b)=>b.monthDate.localeCompare(a.monthDate)||a.store.localeCompare(b.store)).map(row=><article key={row.id}><div><strong>{row.store}</strong><small>{monthLabel(row.monthDate)} · {label(row.metricCode)}</small></div><b>{money(row.amount)}</b>{isAdmin?<button className="subtle-action" onClick={()=>remove.mutate({storeId:row.storeId,monthDate:row.monthDate,metricCode:row.metricCode as MetricCode})} aria-label={`Удалить план ${row.store}`}><Trash2 size={15}/>Удалить</button>:null}</article>):<div className="empty-state compact"><Target size={24}/><h2>Планов еще нет</h2><p>После ввода они появятся здесь и на графике выбранного среза.</p></div>}</div></section>
  </AuditShell>;
}
