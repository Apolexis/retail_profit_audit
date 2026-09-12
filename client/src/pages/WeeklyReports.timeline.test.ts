import { describe, expect, it } from "vitest";
import { reportTimeline } from "./WeeklyReports";

describe("динамика PDF регулярного отчета",()=>{
  it("суммирует только видимые фактические дневные строки и сортирует их по дате",()=>{
    expect(reportTimeline([
      {entryDate:"2026-08-02",store:"Б",isHidden:false,metrics:{revenue:80,cash_revenue:30,cashless_revenue:50,net_profit:-8}},
      {entryDate:"2026-08-01",store:"А",isHidden:false,metrics:{revenue:100,cash_revenue:40,cashless_revenue:60,net_profit:10}},
      {entryDate:"2026-08-01",store:"Б",isHidden:false,metrics:{revenue:40,cash_revenue:10,cashless_revenue:30,net_profit:4}},
      {entryDate:"2026-08-01",store:"Скрыт",isHidden:true,metrics:{revenue:999,cash_revenue:999,cashless_revenue:999,net_profit:999}},
    ])).toEqual([
      {date:"2026-08-01",revenue:140,cashRevenue:50,cashlessRevenue:90,netProfit:14,purchaseSmoked:0,purchaseFrozen:0,salesSmoked:0,salesFrozen:0,stores:2},
      {date:"2026-08-02",revenue:80,cashRevenue:30,cashlessRevenue:50,netProfit:-8,purchaseSmoked:0,purchaseFrozen:0,salesSmoked:0,salesFrozen:0,stores:1},
    ]);
  });
});
