/** Store-versus-store workbench with interactive monthly series and operational totals. */
import { useMemo, useState } from "react";
import { AuditShell } from "@/components/AuditShell";
import { MetricLineChart, formatK, formatPct } from "@/components/AuditCharts";
import { stores } from "@/data/deepAuditData";
import { inventoryStores } from "@/data/inventoryData";
import { monthlyByStore } from "@/data/monthlyComparisonData";

type MonthRow = Record<string, string | number>;
const metrics = [
  ["revenue", "Выручка", false], ["gross_profit", "Валовая прибыль", false], ["net_profit", "Чистая прибыль", false],
  ["net_margin_pct", "Чистая маржа", true], ["sales_smoked", "Продажи Коп.", false], ["sales_frozen", "Продажи Мор.", false],
  ["stock_close", "Конечный остаток", false], ["writeoff_frozen", "Списания М.", false],
] as const;

export default function CompareStores(){
  const names=stores.map(item=>item.store);
  const [left,setLeft]=useState(names[0]);
  const [right,setRight]=useState(names[1] ?? names[0]);
  const [metric,setMetric]=useState<(typeof metrics)[number][0]>("net_profit");
  const definition=metrics.find(item=>item[0]===metric) ?? metrics[0];
  const percent=definition[2];
  const leftStore=stores.find(item=>item.store===left) ?? stores[0];
  const rightStore=stores.find(item=>item.store===right) ?? stores[1] ?? stores[0];
  const leftInventory=inventoryStores.find(item=>item.store===left) ?? inventoryStores[0];
  const rightInventory=inventoryStores.find(item=>item.store===right) ?? inventoryStores[1] ?? inventoryStores[0];
  const chart=useMemo(()=>{
    const a=(monthlyByStore[left as keyof typeof monthlyByStore] ?? []) as unknown as MonthRow[];
    const b=(monthlyByStore[right as keyof typeof monthlyByStore] ?? []) as unknown as MonthRow[];
    return a.map((row,index)=>({month:String(row.month),[left]:Number(row[metric]??0),[right]:Number(b[index]?.[metric]??0)}));
  },[left,right,metric]);
  const display=(value:number)=>percent?formatPct(value):formatK(value);
  const total=(storeName:string)=>chart.reduce((sum,row)=>sum+Number(row[storeName]??0),0)/(percent?8:1);
  const leftValue=total(left), rightValue=total(right);
  const statRows=[
    ["Выручка",formatK(leftStore.revenue*1000),formatK(rightStore.revenue*1000)],
    ["Чистая прибыль",formatK(leftStore.netProfit*1000),formatK(rightStore.netProfit*1000)],
    ["Чистая маржа",formatPct(leftStore.netMargin),formatPct(rightStore.netMargin)],
    ["Все расходы",formatK(leftStore.expenses.reduce((sum,row)=>sum+row.amount,0)*1000),formatK(rightStore.expenses.reduce((sum,row)=>sum+row.amount,0)*1000)],
    ["Конечный остаток",formatK(leftInventory.stockCloseK),formatK(rightInventory.stockCloseK)],
    ["Дней покрытия",`${leftInventory.coverDays.toFixed(1)} дн.`,`${rightInventory.coverDays.toFixed(1)} дн.`],
  ];
  return <AuditShell kicker="06 / СРАВНЕНИЕ МАГАЗИНОВ" title="Две точки: один управленческий экран"><section className="page-lede"><div><h2>Сравнить магазины без ручного сопоставления таблиц.</h2><p>Выберите две точки и показатель. Нажатие на маркер в легенде графика скрывает или возвращает соответствующий ряд.</p></div><div className="page-controls"><label>Магазин A<select value={left} onChange={event=>setLeft(event.target.value as typeof left)}>{names.map(name=><option key={name}>{name}</option>)}</select></label><label>Магазин B<select value={right} onChange={event=>setRight(event.target.value as typeof right)}>{names.map(name=><option key={name}>{name}</option>)}</select></label><label>Показатель<select value={metric} onChange={event=>setMetric(event.target.value as typeof metric)}>{metrics.map(item=><option key={item[0]} value={item[0]}>{item[1]}</option>)}</select></label></div></section><section className="packet-kpis equal"><article className="packet-kpi"><span>{definition[1]} · {left}</span><strong>{display(leftValue)}</strong><small>за январь–август</small></article><article className="packet-kpi"><span>{definition[1]} · {right}</span><strong>{display(rightValue)}</strong><small>за январь–август</small></article><article className={(leftValue-rightValue)<0?"packet-kpi risk":"packet-kpi"}><span>Разница A − B</span><strong>{leftValue-rightValue>0?"+":""}{display(leftValue-rightValue)}</strong><small>по выбранному показателю</small></article><article className="packet-kpi"><span>Ранг по прибыли</span><strong>#{leftStore.profitRank} / #{rightStore.profitRank}</strong><small>{left} / {right}</small></article></section><section className="packet-card"><div className="card-title"><div><span>ПО МЕСЯЦАМ · {definition[1].toUpperCase()}</span><h3>{left} против {right}</h3></div><small>{percent?"%":"млн / тыс. ₽"}</small></div><MetricLineChart data={chart} percent={percent} lines={[{key:left,name:left,color:"#44D7FF"},{key:right,name:right,color:"#A78BFA"}]}/></section><section className="packet-card"><div className="card-title"><div><span>ОБЩАЯ КАРТИНА</span><h3>P&L, остаток и операционный масштаб</h3></div><small>итоги за период</small></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Показатель</th><th>{left}</th><th>{right}</th></tr></thead><tbody>{statRows.map(row=><tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div></section></AuditShell>
}
