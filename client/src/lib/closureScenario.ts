export type ClosureEconomics={store:string;revenue:number;expenses:number;netProfit:number;netMargin:number;purchaseSmoked?:number;purchaseFrozen?:number;stockClose?:number;expenseByCode?:Record<string,number>};
export type ClosureCandidate=ClosureEconomics&{priority:number;shouldReviewForClosure:boolean;reason:string};

const finite=(value:number)=>Number.isFinite(value)?value:0;

export function rankClosureCandidates(stores:ClosureEconomics[]):ClosureCandidate[]{
  return stores.map(store=>{
    const revenue=finite(store.revenue),expenses=Math.abs(finite(store.expenses)),netProfit=finite(store.netProfit),netMargin=finite(store.netMargin);
    const expenseShare=revenue>0?expenses/revenue*100:0;
    const shouldReviewForClosure=netProfit<0;
    const priority=(shouldReviewForClosure?Math.abs(netProfit):0)+(netMargin<0?Math.abs(netMargin)*Math.max(revenue,1)/100:0);
    const reason=netProfit<0&&netMargin<0
      ? `Убыток и отрицательная чистая маржа ${netMargin.toFixed(1)}%; при закрытии убыток перестанет снижать результат сети.`
      :netProfit<0
        ? `Убыток при марже ${netMargin.toFixed(1)}%; сначала проверьте, какие постоянные расходы действительно можно убрать.`
        :netMargin<1
          ? `Низкая чистая маржа ${netMargin.toFixed(1)}% при доле расходов ${expenseShare.toFixed(1)}%; требуется проверка экономики, а не рекомендация закрытия.`
          :`Положительная чистая прибыль и маржа ${netMargin.toFixed(1)}%; закрытие не рекомендуется по текущему срезу.`;
    return {...store,revenue,expenses,netProfit,netMargin,priority,shouldReviewForClosure,reason};
  }).sort((left,right)=>Number(right.shouldReviewForClosure)-Number(left.shouldReviewForClosure)||right.priority-left.priority||left.netProfit-right.netProfit);
}

export function summarizeClosureScenario(network:{revenue:number;expenses:number;netProfit:number;purchaseSmoked?:number;purchaseFrozen?:number;stockClose?:number},closed:ClosureEconomics[]){
  const closedRevenue=closed.reduce((sum,store)=>sum+finite(store.revenue),0);
  const closedExpenses=closed.reduce((sum,store)=>sum+Math.abs(finite(store.expenses)),0);
  const closedProfit=closed.reduce((sum,store)=>sum+finite(store.netProfit),0);
  const closedPurchaseSmoked=closed.reduce((sum,store)=>sum+Math.abs(finite(store.purchaseSmoked??0)),0);
  const closedPurchaseFrozen=closed.reduce((sum,store)=>sum+Math.abs(finite(store.purchaseFrozen??0)),0);
  const closedStock=closed.reduce((sum,store)=>sum+Math.abs(finite(store.stockClose??0)),0);
  const closedExpenseByCode:Record<string,number>={};
  closed.forEach(store=>Object.entries(store.expenseByCode??{}).forEach(([code,value])=>{closedExpenseByCode[code]=(closedExpenseByCode[code]??0)+Math.abs(finite(value));}));
  return {closedRevenue,closedExpenses,closedProfit,closedPurchaseSmoked,closedPurchaseFrozen,closedPurchases:closedPurchaseSmoked+closedPurchaseFrozen,closedStock,closedExpenseByCode,profitChange:-closedProfit,remainingRevenue:finite(network.revenue)-closedRevenue,remainingExpenses:Math.abs(finite(network.expenses))-closedExpenses,remainingProfit:finite(network.netProfit)-closedProfit,remainingStock:finite(network.stockClose??0)-closedStock};
}
