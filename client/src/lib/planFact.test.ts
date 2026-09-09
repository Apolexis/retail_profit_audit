import { describe, expect, it } from "vitest";
import { planForRange, sumPlan, type PlanFactRow } from "./planFact";

const row:PlanFactRow={id:1,storeId:1,store:"ПОРТ",isHidden:false,monthDate:"2026-02",metricCode:"revenue",amount:280000};
describe("план‑факт",()=>{
  it("пропорционально показывает план в неполном календарном месяце",()=>expect(planForRange(280000,"2026-02",{from:"2026-02-01",to:"2026-02-14"})).toBe(140000));
  it("суммирует сеть и учитывает выбранный магазин",()=>{expect(sumPlan([row,{...row,id:2,store:"РОС",storeId:2,amount:140000}],{from:"2026-02-01",to:"2026-02-28"},"revenue","__all__")).toBe(420000);expect(sumPlan([row],{from:"2026-02-01",to:"2026-02-28"},"revenue","РОС")).toBe(0)});
});
