import { describe, expect, it } from "vitest";
import { isWeeklyReportDue, previousCalendarMonth, previousCalendarWeek, reportWindowFor } from "./weeklyReports";

describe("еженедельный отчет",()=>{
  it("в понедельник выбирает предшествующую календарную неделю",()=>{
    expect(previousCalendarWeek(new Date("2026-09-07T09:00:00.000Z"))).toEqual({periodStart:"2026-08-31",periodEnd:"2026-09-06"});
  });
  it("в любой другой день выбирает завершившуюся неделю с понедельника по воскресенье",()=>{
    expect(previousCalendarWeek(new Date("2026-09-09T09:00:00.000Z"))).toEqual({periodStart:"2026-08-31",periodEnd:"2026-09-06"});
  });
  it("для ежемесячной периодичности выбирает завершенный календарный месяц",()=>{
    expect(previousCalendarMonth(new Date("2026-09-07T09:00:00.000Z"))).toEqual({periodStart:"2026-08-01",periodEnd:"2026-08-31"});
    expect(reportWindowFor("month",new Date("2026-01-12T09:00:00.000Z"))).toEqual({periodStart:"2025-12-01",periodEnd:"2025-12-31"});
  });
  it("не запускает выключенное расписание, а месячное запускает первого числа",()=>{
    expect(isWeeklyReportDue({weekday:1,reportTime:"12:00",reportPeriod:"week",isEnabled:false},new Date("2026-09-07T09:00:00.000Z"))).toBe(false);
    expect(isWeeklyReportDue({weekday:1,reportTime:"12:00",reportPeriod:"month",isEnabled:true},new Date("2026-09-01T09:00:00.000Z"))).toBe(true);
  });
});
