/** Shared selection plus a calendar-backed range. Month keys match normalized imported data. */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export type DateRangeValue={from:string;to:string};
const monthKeys=["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const monthLong=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const toMonthIndex=(date:string)=>{const parts=date.split("-");return Math.max(0,Math.min(11,Number(parts[1]??1)-1))};
const pretty=(date:string)=>`${monthLong[toMonthIndex(date)]} ${date.slice(0,4)}`;
type AuditState={selectedStore:string;setSelectedStore:(value:string)=>void;range:DateRangeValue;setRange:(value:DateRangeValue)=>void;theme:"dark"|"light";toggleTheme:()=>void;rangeLabel:string;months:string[];includesMonth:(value:string)=>boolean};
const AuditContext=createContext<AuditState|null>(null);
export function AuditProvider({children}:{children:ReactNode}){const [selectedStore,setSelectedStore]=useState(()=>localStorage.getItem("audit-store")??"__all__");const [range,setRange]=useState<DateRangeValue>(()=>{try{return JSON.parse(localStorage.getItem("audit-range")??"{\"from\":\"2026-01-01\",\"to\":\"2026-08-31\"}")}catch{return {from:"2026-01-01",to:"2026-08-31"}}});const [theme,setTheme]=useState<"dark"|"light">(()=>(localStorage.getItem("audit-theme") as "dark"|"light")??"dark");const [location]=useLocation();useEffect(()=>{localStorage.setItem("audit-store",selectedStore)},[selectedStore]);useEffect(()=>{localStorage.setItem("audit-range",JSON.stringify(range))},[range]);useEffect(()=>{localStorage.setItem("audit-theme",theme);document.documentElement.dataset.auditTheme=theme},[theme]);useEffect(()=>{window.scrollTo({top:0,left:0,behavior:"auto"})},[location]);const value=useMemo(()=>{const start=toMonthIndex(range.from),end=toMonthIndex(range.to);const months=monthKeys.slice(Math.min(start,end),Math.max(start,end)+1);return {selectedStore,setSelectedStore,range,setRange,theme,toggleTheme:()=>setTheme(v=>v==="dark"?"light":"dark"),rangeLabel:`${pretty(range.from)} — ${pretty(range.to)}`,months,includesMonth:(month:string)=>months.includes(month.slice(0,3))}},[selectedStore,range,theme]);return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>}
export function useAudit(){const context=useContext(AuditContext);if(!context)throw new Error("useAudit must be inside AuditProvider");return context}
