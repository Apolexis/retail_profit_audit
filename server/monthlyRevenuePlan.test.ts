import { describe, expect, it } from "vitest";
import { __monthlyRevenuePlanTestUtils } from "./monthlyRevenuePlan";

describe("месячный план выручки Эвотор", () => {
  it("считает только достигнутые процентные точки, включая точное 100%", () => {
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(100_000, 24_999.99)).toEqual([]);
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(100_000, 25_000)).toEqual([25]);
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(100_000, 76_000)).toEqual([25, 50, 75]);
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(100_000, 100_000)).toEqual([25, 50, 75, 100]);
  });

  it("не создает достижений при нулевом плане или отрицательном факте", () => {
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(0, 10_000)).toEqual([]);
    expect(__monthlyRevenuePlanTestUtils.monthlyRevenuePlanMilestones(100_000, -1)).toEqual([]);
    expect(__monthlyRevenuePlanTestUtils.revenuePlanPercent(0, 10_000)).toBeNull();
    expect(__monthlyRevenuePlanTestUtils.revenuePlanPercent(100_000, 95_000)).toBe(95);
  });

  it("строит календарные границы месяца в МСК, а не в UTC браузера", () => {
    expect(__monthlyRevenuePlanTestUtils.evotorMoscowBoundary("2026-09-01", "start")).toBe("2026-08-31T21:00:00.000+0000");
    expect(__monthlyRevenuePlanTestUtils.evotorMoscowBoundary("2026-09-30", "end")).toBe("2026-09-30T20:59:59.999+0000");
    expect(__monthlyRevenuePlanTestUtils.monthEnd("2024-02")).toBe("2024-02-29");
  });

  it("предлагает сохранить прошлогодний уровень, когда текущий темп ниже", () => {
    expect(__monthlyRevenuePlanTestUtils.suggestMonthlyRevenuePlan({
      lastYearAmount: 1_000_000,
      currentYearAmount: 400_000,
      isCurrentMonth: true,
      elapsedDays: 15,
      daysInMonth: 30,
    })).toMatchObject({
      mode: "preserve",
      recommendedAmount: 1_000_000,
      currentYearForecast: 800_000,
    });
  });

  it("добавляет умеренную цель роста, когда текущий темп уже выше прошлого года", () => {
    expect(__monthlyRevenuePlanTestUtils.suggestMonthlyRevenuePlan({
      lastYearAmount: 1_000_000,
      currentYearAmount: 600_000,
      isCurrentMonth: true,
      elapsedDays: 15,
      daysInMonth: 30,
    })).toMatchObject({
      mode: "growth",
      recommendedAmount: 1_236_000,
      currentYearForecast: 1_200_000,
    });
  });

  it("не выдумывает рекомендацию, если данных продаж нет", () => {
    expect(__monthlyRevenuePlanTestUtils.suggestMonthlyRevenuePlan({
      lastYearAmount: null,
      currentYearAmount: null,
      isCurrentMonth: true,
      elapsedDays: 15,
      daysInMonth: 30,
    })).toMatchObject({ mode: "unavailable", recommendedAmount: null });
  });
});
