export type PlanFactRow={id:number;storeId:number;store:string;isHidden:boolean;monthDate:string;metricCode:string;amount:number};
export type PlanRange={from:string;to:string};

const monthEnd=(monthDate:string)=>{const [year,month]=monthDate.split("-").map(Number);return `${monthDate}-${String(new Date(Date.UTC(year,month,0)).getUTCDate()).padStart(2,"0")}`};
const calendarDays=(from:string,to:string)=>Math.max(0,Math.floor((new Date(`${to}T12:00:00`).getTime()-new Date(`${from}T12:00:00`).getTime())/86400000)+1);

/** A monthly plan is shown pro rata only when the user selects a partial calendar month. */
export function planForRange(amount:number,monthDate:string,range:PlanRange){const from=range.from>`${monthDate}-01`?range.from:`${monthDate}-01`;const end=range.to<monthEnd(monthDate)?range.to:monthEnd(monthDate);if(from>end)return 0;return amount*calendarDays(from,end)/calendarDays(`${monthDate}-01`,monthEnd(monthDate));}
export function sumPlan(rows:PlanFactRow[],range:PlanRange,metricCode:string,store:string){return rows.filter(row=>row.metricCode===metricCode&&(store==="__all__"||row.store===store)).reduce((sum,row)=>sum+planForRange(row.amount,row.monthDate,range),0);}
export function rangeMonths(range:PlanRange){const months:string[]=[];for(const cursor=new Date(`${range.from.slice(0,7)}-01T12:00:00`),end=new Date(`${range.to.slice(0,7)}-01T12:00:00`);cursor<=end;cursor.setMonth(cursor.getMonth()+1))months.push(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`);return months;}
