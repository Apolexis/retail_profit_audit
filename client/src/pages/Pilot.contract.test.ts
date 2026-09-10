import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rankClosureCandidates, summarizeClosureScenario } from "@/lib/closureScenario";

const page=readFileSync(resolve(process.cwd(),"client/src/pages/Pilot.tsx"),"utf8");

describe("Pilot scenario outcome contract",()=>{
  it("shows the base, scenario delta, and final profit in the right order",()=>{
    expect(page).toContain("const scenarioDelta=model.profit-store.netProfit+closureProfitChange");
    expect(page).toContain("const scenarioProfit=model.profit+closureProfitChange");
    expect(page).toContain("Исходная прибыль");
    expect(page).toContain("Изменение сценария");
    expect(page).toContain("Итоговая прибыль");
    expect(page).toContain("result(store.netProfit,false)");
    expect(page).toContain("result(scenarioProfit,false)");
  });

  it("does not mark zero money values as positive",()=>{
    expect(page).toContain('value>0?"positive":value<0?"negative":"neutral"');
  });

  it("supports several store closures and explains an evidence-based priority",()=>{
    expect(page).toContain("closingStores");
    expect(page).toContain("Выбрать убыточные");
    expect(page).toContain("Изменение закрытия");
    expect(page).toContain("Оценка чистой прибыли сети");
    expect(page).toContain("Закрытие {closureSelectedInScope.length}");
    expect(page).toContain("closureScenario.profitChange");
    expect(page).toContain("const closureSelectedInScope=useMemo(()=>isNetwork?closureSelected:closureSelected.filter(candidate=>candidate.store===name)");
    expect(page).toContain("const hasClosureInScope=closureSelectedInScope.length>0");
    expect(page).toContain("const closureProfitChange=hasClosureInScope?closureScenario.profitChange:0");
    expect(page).toContain("Закупки Коп. сократятся");
    expect(page).toContain("Закупки Мор. сократятся");
    expect(page).toContain("Остаток сети после закрытия");
    expect(page).toContain("ПРЕКРАЩАЕМЫЕ РАСХОДЫ");
    expect(page).toContain("Общий итог и статьи выбранных точек");
    const candidates=rankClosureCandidates([{store:"Убыток",revenue:1_000,expenses:1_100,netProfit:-100,netMargin:-10,purchaseSmoked:250,purchaseFrozen:150,stockClose:90,expenseByCode:{rent:400,delivery:50}},{store:"Плюс",revenue:2_000,expenses:1_500,netProfit:200,netMargin:10}]);
    expect(candidates[0]).toMatchObject({store:"Убыток",shouldReviewForClosure:true});
    expect(candidates[0]?.reason).toContain("Убыток");
    const scenario=summarizeClosureScenario({revenue:3_000,expenses:2_600,netProfit:100,purchaseSmoked:600,purchaseFrozen:300,stockClose:200},[candidates[0]!]);
    expect(scenario).toMatchObject({closedRevenue:1_000,closedExpenses:1_100,closedPurchaseSmoked:250,closedPurchaseFrozen:150,closedPurchases:400,closedStock:90,remainingStock:110,profitChange:100,remainingProfit:200,closedExpenseByCode:{rent:400,delivery:50}});
  });

  it("limits a single-store scenario to the closure selected in its contour",()=>{
    expect(page).toContain('closureSelected.filter(candidate=>candidate.store===name)');
    expect(page).toContain("{hasClosureInScope&&<div className=\"closure-expense-breakdown\">");
    expect(page).toContain("{hasClosureInScope&&<div><span>Закрытие {closureSelectedInScope.length}");
    expect(page).toContain('чистая прибыль {isNetwork?"сети":"контура"}');
  });
});
