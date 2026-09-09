import { useCallback, useMemo } from "react";
import { useAudit } from "@/contexts/AuditContext";
import { enrich, monthLabel, useImportedAudit, type ImportedPeriod } from "@/hooks/useImportedAudit";

export const expenseDefinitions = [
  ["household", "Хоз. нужды"], ["delivery", "Доставка"], ["cleaning", "Уборка"], ["bonus", "Премия"], ["seniority", "Выслуга"], ["supplement", "Доплата"], ["driver_cash", "Водитель"], ["utilities_cash", "Ком. платежи"], ["cash_operating_costs", "Траты нал"], ["driver_cashless", "Водитель б/нал"], ["utilities_cashless", "Ком. б/нал"], ["rent", "Аренда"], ["bank_fee", "Банк"], ["gross_profit_tax", "Налоги"], ["salary_cashless", "Зарплата б/нал"], ["payroll_tax", "Налоги з/п"], ["vacation_cashless", "Отпускные"], ["vacation_tax", "Налоги отпуск."], ["salary_cash", "Зарплата нал"], ["vacation_cash", "Отпускные нал"], ["personal_income_tax_22", "НДФЛ 22%"],
] as const;
export type ExpenseCode = (typeof expenseDefinitions)[number][0];
export type FactSummary = { store:string; storeId?:number; revenue:number; grossProfit:number; netProfit:number; purchases:number; purchaseSmoked:number; purchaseFrozen:number; salesSmoked:number; salesFrozen:number; writeoffSmoked:number; writeoffFrozen:number; stockOpen:number; stockClose:number; expenses:number; netMargin:number; grossMargin:number; markup:number; coverDays:number; expenseByCode:Record<string,number> };

const number = (row:ImportedPeriod, key:string) => Number(row.metrics[key] ?? 0);
const sum = (rows:ImportedPeriod[], key:string) => rows.reduce((total,row) => total + number(row,key),0);
const last = (rows:ImportedPeriod[], key:string) => [...rows].sort((a,b)=>a.monthDate.localeCompare(b.monthDate)).at(-1) ? number([...rows].sort((a,b)=>a.monthDate.localeCompare(b.monthDate)).at(-1)!,key) : 0;
const median=(items:number[])=>{const sorted=[...items].sort((a,b)=>a-b);if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};

export function useAuditFacts(){
  const imported=useImportedAudit();
  const {range}=useAudit();
  const periods=useMemo(()=>imported.periods.filter(row=>row.monthDate>=range.from.slice(0,7)&&row.monthDate<=range.to.slice(0,7)),[imported.periods,range.from,range.to]);
  const storeNames=useMemo(()=>Array.from(new Set(periods.map(row=>row.store))).sort(),[periods]);
  const summaryFor=useCallback((rows:ImportedPeriod[],store:string,storeId?:number):FactSummary=>{const revenue=sum(rows,"revenue"),grossProfit=sum(rows,"gross_profit"),netProfit=sum(rows,"net_profit"),purchases=sum(rows,"purchases"),purchaseSmoked=sum(rows,"purchase_smoked"),purchaseFrozen=sum(rows,"purchase_frozen"),salesSmoked=sum(rows,"sales_smoked"),salesFrozen=sum(rows,"sales_frozen"),writeoffSmoked=sum(rows,"writeoff_smoked"),writeoffFrozen=sum(rows,"writeoff_frozen"),stockOpen=rows.length?number([...rows].sort((a,b)=>a.monthDate.localeCompare(b.monthDate))[0],"stock_open"):0,stockClose=last(rows,"stock_close"),expenseByCode=Object.fromEntries(expenseDefinitions.map(([code])=>[code,sum(rows,code)])),expenses=expenseDefinitions.reduce((total,[code])=>total+Math.abs(expenseByCode[code]),0),sales=salesSmoked+salesFrozen;return {store,storeId,revenue,grossProfit,netProfit,purchases,purchaseSmoked,purchaseFrozen,salesSmoked,salesFrozen,writeoffSmoked,writeoffFrozen,stockOpen,stockClose,expenses,netMargin:revenue?netProfit/revenue*100:0,grossMargin:revenue?grossProfit/revenue*100:0,markup:purchases?(sales/purchases-1)*100:0,coverDays:revenue?stockClose/(revenue/Math.max(rows.length,1))*30:0,expenseByCode};},[]);
  const summaries=useMemo(()=>storeNames.map(name=>{const rows=periods.filter(row=>row.store===name);return summaryFor(rows,name,rows[0]?.storeId)}),[periods,storeNames,summaryFor]);
  const network=useMemo(()=>summaryFor(periods,"Все магазины"),[periods,summaryFor]);
  const rowsFor=useCallback((store:string)=>store==="__all__"?periods:periods.filter(row=>row.store===store),[periods]);
  const monthlyFor=useCallback((store:string)=>{const rows=rowsFor(store);const dates=Array.from(new Set(rows.map(row=>row.monthDate))).sort();return dates.map(monthDate=>{const monthRows=rows.filter(row=>row.monthDate===monthDate);const summary=summaryFor(monthRows,store);return {month:monthLabel(monthDate),monthDate,...summary,raw:monthRows.map(enrich)}})},[rowsFor,summaryFor]);
  const medianFor=useCallback((field:keyof FactSummary)=>median(summaries.map(summary=>Number(summary[field]??0))),[summaries]);
  return {available:imported.available,loading:imported.loading,error:imported.error,periods,storeNames,summaries,network,rowsFor,summaryFor,monthlyFor,medianFor,range};
}
