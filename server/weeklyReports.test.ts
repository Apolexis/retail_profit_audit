import { describe, expect, it } from "vitest";
import { previousCalendarWeek } from "./weeklyReports";

describe("еженедельный отчет",()=>{
  it("в понедельник выбирает предшествующую календарную неделю",()=>{
    expect(previousCalendarWeek(new Date("2026-09-07T09:00:00.000Z"))).toEqual({periodStart:"2026-08-31",periodEnd:"2026-09-06"});
  });
  it("в любой другой день выбирает завершившуюся неделю с понедельника по воскресенье",()=>{
    expect(previousCalendarWeek(new Date("2026-09-09T09:00:00.000Z"))).toEqual({periodStart:"2026-08-31",periodEnd:"2026-09-06"});
  });
});
