import { describe, expect, it } from "vitest";
import { previousCompletedMoscowMonthRange, reportOperations, reportTimeline } from "./WeeklyReports";

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

  it("берет завершенный месяц по календарю Москвы, а не по часовому поясу устройства",()=>{
    expect(previousCompletedMoscowMonthRange(new Date("2026-09-30T21:30:00.000Z"))).toEqual({from:"2026-09-01",to:"2026-09-30"});
    expect(previousCompletedMoscowMonthRange(new Date("2026-10-31T21:30:00.000Z"))).toEqual({from:"2026-10-01",to:"2026-10-31"});
  });

  it("отделяет отсутствующую операционную статью от подтвержденного нуля и исключает скрытые магазины",()=>{
    const operations=reportOperations([
      {entryDate:"2026-09-01",store:"А",isHidden:false,metrics:{delivery:120,discount:-40,movement:15,writeoff_smoked:0}},
      {entryDate:"2026-09-01",store:"Скрыт",isHidden:true,metrics:{delivery:999,discount:-999}},
    ]);
    expect(operations.find(item=>item.code==="delivery")).toMatchObject({value:120,hasFact:true,kind:"expense"});
    expect(operations.find(item=>item.code==="writeoff_smoked")).toMatchObject({value:0,hasFact:true,kind:"loss"});
    expect(operations.find(item=>item.code==="rent")).toMatchObject({value:0,hasFact:false,kind:"expense"});
    expect(operations.find(item=>item.code==="discount")).toMatchObject({value:-40,hasFact:true,kind:"loss"});
  });
});
