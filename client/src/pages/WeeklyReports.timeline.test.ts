import { describe, expect, it } from "vitest";
import { reportTimeline } from "./WeeklyReports";

describe("динамика PDF регулярного отчета",()=>{
  it("суммирует только видимые фактические дневные строки и сортирует их по дате",()=>{
    expect(reportTimeline([
      {entryDate:"2026-08-02",store:"Б",isHidden:false,metrics:{revenue:80,net_profit:-8}},
      {entryDate:"2026-08-01",store:"А",isHidden:false,metrics:{revenue:100,net_profit:10}},
      {entryDate:"2026-08-01",store:"Б",isHidden:false,metrics:{revenue:40,net_profit:4}},
      {entryDate:"2026-08-01",store:"Скрыт",isHidden:true,metrics:{revenue:999,net_profit:999}},
    ])).toEqual([
      {date:"2026-08-01",revenue:140,netProfit:14,stores:2},
      {date:"2026-08-02",revenue:80,netProfit:-8,stores:1},
    ]);
  });
});
