import { and, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { operationalEvotorDocuments, operationalEvotorRevenuePlanMilestones, planFacts, stores } from "../drizzle/schema";
import { getDataFreshnessSignalRecipients } from "./accessControl";
import { getDb } from "./db";
import { createNotifications } from "./notifications";

export const EVOTOR_REVENUE_PLAN_METRIC = "evotor_revenue" as const;
export const REVENUE_PLAN_MILESTONES = [25, 50, 75, 100] as const;
export const REVENUE_PLAN_VISUAL_MARKERS = [75, 95, 100] as const;

export type RevenuePlanMilestone = (typeof REVENUE_PLAN_MILESTONES)[number];
export type RevenuePlanRecommendationMode = "growth" | "preserve" | "history" | "forecast" | "unavailable";
export type RevenuePlanRecommendation = {
  recommendedAmount: number | null;
  mode: RevenuePlanRecommendationMode;
  lastYearAmount: number | null;
  currentYearAmount: number | null;
  currentYearForecast: number | null;
};

type RevenueTotals = { actualAmount: number; checks: number };
type PlanRecord = { planAmount: number; rewardText: string | null };

export function evotorMoscowBoundary(date: string, edge: "start" | "end") {
  const localTime = edge === "start" ? "00:00:00.000" : "23:59:59.999";
  return new Date(`${date}T${localTime}+03:00`).toISOString().replace("Z", "+0000");
}

export function monthlyRevenuePlanMilestones(planAmount: number, actualAmount: number): RevenuePlanMilestone[] {
  if (!Number.isFinite(planAmount) || planAmount <= 0 || !Number.isFinite(actualAmount) || actualAmount < 0) return [];
  return REVENUE_PLAN_MILESTONES.filter(milestone => actualAmount >= planAmount * milestone / 100);
}

export function revenuePlanPercent(planAmount: number, actualAmount: number) {
  if (!Number.isFinite(planAmount) || planAmount <= 0 || !Number.isFinite(actualAmount) || actualAmount < 0) return null;
  return actualAmount / planAmount * 100;
}

export function moscowBusinessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const take = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";
  return `${take("year")}-${take("month")}-${take("day")}`;
}

export function monthEnd(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${monthDate}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

function monthStart(monthDate: string) {
  return `${monthDate}-01`;
}

function previousYearMonth(monthDate: string) {
  const [year, month] = monthDate.split("-").map(Number);
  return `${year - 1}-${String(month).padStart(2, "0")}`;
}

function roundPlanAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.ceil(value / 1_000) * 1_000 : null;
}

/**
 * Produces a transparent, editable proposal — never an automatic plan.
 * For the current month it compares the projected run-rate with the complete
 * corresponding month of last year: when the run-rate is weaker, retention is
 * proposed; when it is stronger, the proposal carries a modest 3% growth goal.
 */
export function suggestMonthlyRevenuePlan(input: {
  lastYearAmount: number | null;
  currentYearAmount: number | null;
  isCurrentMonth: boolean;
  elapsedDays: number;
  daysInMonth: number;
}): RevenuePlanRecommendation {
  const lastYearAmount = input.lastYearAmount !== null && input.lastYearAmount > 0 ? input.lastYearAmount : null;
  const currentYearAmount = input.currentYearAmount !== null && input.currentYearAmount >= 0 ? input.currentYearAmount : null;
  const currentYearForecast = input.isCurrentMonth && currentYearAmount !== null && input.elapsedDays > 0 && input.daysInMonth > 0
    ? currentYearAmount / input.elapsedDays * input.daysInMonth
    : null;

  if (input.isCurrentMonth) {
    if (lastYearAmount !== null && currentYearForecast !== null) {
      if (currentYearForecast < lastYearAmount) {
        return { recommendedAmount: roundPlanAmount(lastYearAmount), mode: "preserve", lastYearAmount, currentYearAmount, currentYearForecast };
      }
      return { recommendedAmount: roundPlanAmount(currentYearForecast * 1.03), mode: "growth", lastYearAmount, currentYearAmount, currentYearForecast };
    }
    if (lastYearAmount !== null) return { recommendedAmount: roundPlanAmount(lastYearAmount * 1.03), mode: "history", lastYearAmount, currentYearAmount, currentYearForecast };
    if (currentYearForecast !== null && currentYearForecast > 0) return { recommendedAmount: roundPlanAmount(currentYearForecast * 1.03), mode: "forecast", lastYearAmount, currentYearAmount, currentYearForecast };
    return { recommendedAmount: null, mode: "unavailable", lastYearAmount, currentYearAmount, currentYearForecast };
  }

  const strongestFact = Math.max(lastYearAmount ?? 0, currentYearAmount ?? 0);
  if (!strongestFact) return { recommendedAmount: null, mode: "unavailable", lastYearAmount, currentYearAmount, currentYearForecast };
  return {
    recommendedAmount: roundPlanAmount(strongestFact * 1.03),
    mode: currentYearAmount !== null && currentYearAmount >= (lastYearAmount ?? 0) ? "growth" : "history",
    lastYearAmount,
    currentYearAmount,
    currentYearForecast,
  };
}

async function listSellTotals(input: { storeIds: number[]; fromDate: string; throughDate: string }): Promise<Map<number, RevenueTotals>> {
  const db = await getDb();
  if (!db || !input.storeIds.length) return new Map();
  const rows = await db.select({
    storeId: operationalEvotorDocuments.storeId,
    actualAmount: sql<string>`COALESCE(SUM(${operationalEvotorDocuments.total}), 0)`,
    checks: sql<number>`COUNT(*)`,
  }).from(operationalEvotorDocuments).where(and(
    inArray(operationalEvotorDocuments.storeId, input.storeIds),
    eq(operationalEvotorDocuments.documentType, "SELL"),
    isNotNull(operationalEvotorDocuments.occurredAt),
    gte(operationalEvotorDocuments.occurredAt, evotorMoscowBoundary(input.fromDate, "start")),
    lte(operationalEvotorDocuments.occurredAt, evotorMoscowBoundary(input.throughDate, "end")),
  )).groupBy(operationalEvotorDocuments.storeId);
  return new Map(rows.map(row => [row.storeId, { actualAmount: Number(row.actualAmount ?? 0), checks: Number(row.checks ?? 0) }]));
}

async function listPlanRecords(input: { storeIds: number[]; monthDate: string }): Promise<Map<number, PlanRecord>> {
  const db = await getDb();
  if (!db || !input.storeIds.length) return new Map();
  const rows = await db.select({ storeId: planFacts.storeId, amount: planFacts.amount, rewardText: planFacts.rewardText })
    .from(planFacts)
    .where(and(
      inArray(planFacts.storeId, input.storeIds),
      eq(planFacts.monthDate, input.monthDate),
      eq(planFacts.metricCode, EVOTOR_REVENUE_PLAN_METRIC),
    ));
  return new Map(rows.map(row => [row.storeId, { planAmount: Number(row.amount), rewardText: row.rewardText }]));
}

/**
 * Read-only projection of monthly Evotor SELL totals. Returns are deliberately
 * shown in the receipt register as a separate business event and are not
 * silently netted into a plan for sales revenue.
 */
export async function listMonthlyEvotorRevenuePlans(input: { storeIds: number[] | null; monthDate: string; now?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const visibleStores = input.storeIds === null
    ? await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false)).orderBy(stores.name)
    : input.storeIds.length
      ? await db.select({ id: stores.id, name: stores.name }).from(stores).where(and(inArray(stores.id, input.storeIds), eq(stores.isHidden, false))).orderBy(stores.name)
      : [];
  if (!visibleStores.length) return { monthDate: input.monthDate, throughDate: null as string | null, isCurrentMonth: false, rows: [] };

  const today = moscowBusinessDate(input.now);
  const currentMonth = today.slice(0, 7);
  const isFutureMonth = input.monthDate > currentMonth;
  const isCurrentMonth = input.monthDate === currentMonth;
  const throughDate = isFutureMonth ? null : isCurrentMonth ? today : monthEnd(input.monthDate);
  const storeIds = visibleStores.map(store => store.id);
  const previousMonth = previousYearMonth(input.monthDate);
  const [plans, currentTotals, lastYearTotals] = await Promise.all([
    listPlanRecords({ storeIds, monthDate: input.monthDate }),
    throughDate ? listSellTotals({ storeIds, fromDate: monthStart(input.monthDate), throughDate }) : Promise.resolve(new Map<number, RevenueTotals>()),
    listSellTotals({ storeIds, fromDate: monthStart(previousMonth), throughDate: monthEnd(previousMonth) }),
  ]);
  const elapsedDays = isCurrentMonth ? Number(today.slice(-2)) : Number(monthEnd(input.monthDate).slice(-2));
  const daysInMonth = Number(monthEnd(input.monthDate).slice(-2));

  return {
    monthDate: input.monthDate,
    throughDate,
    isCurrentMonth,
    rows: visibleStores.map(store => {
      const plan = plans.get(store.id);
      const currentTotal = currentTotals.get(store.id);
      const currentYearAmount = currentTotal?.actualAmount ?? null;
      const actualAmount = currentYearAmount ?? 0;
      const planAmount = plan?.planAmount ?? null;
      const recommendation = suggestMonthlyRevenuePlan({
        lastYearAmount: lastYearTotals.get(store.id)?.actualAmount ?? null,
        currentYearAmount,
        isCurrentMonth,
        elapsedDays,
        daysInMonth,
      });
      return {
        storeId: store.id,
        storeName: store.name,
        planAmount,
        actualAmount,
        checks: currentTotal?.checks ?? 0,
        percent: planAmount === null ? null : revenuePlanPercent(planAmount, actualAmount),
        reachedMilestones: planAmount === null ? [] as RevenuePlanMilestone[] : monthlyRevenuePlanMilestones(planAmount, actualAmount),
        rewardText: plan?.rewardText ?? null,
        recommendation,
      };
    }),
  };
}

/**
 * Current-day intake calls this after a durable receipt write. Its unique
 * ledger makes a repeated webhook, overlap page, and minute lane safe: each
 * percentage is announced only once per store and calendar month.
 */
export async function evaluateCurrentEvotorRevenuePlanMilestones(now = new Date()) {
  const db = await getDb();
  if (!db) return { monthDate: moscowBusinessDate(now).slice(0, 7), created: 0 };
  const businessDate = moscowBusinessDate(now);
  const monthDate = businessDate.slice(0, 7);
  const visibleStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.isHidden, false));
  if (!visibleStores.length) return { monthDate, created: 0 };
  const storeIds = visibleStores.map(store => store.id);
  const [plans, currentTotals] = await Promise.all([
    listPlanRecords({ storeIds, monthDate }),
    listSellTotals({ storeIds, fromDate: monthStart(monthDate), throughDate: businessDate }),
  ]);
  const facts = Array.from(plans.entries()).map(([storeId, plan]) => ({
    storeId,
    planAmount: plan.planAmount,
    rewardText: plan.rewardText,
    actualAmount: currentTotals.get(storeId)?.actualAmount ?? 0,
  }));
  if (!facts.length) return { monthDate, created: 0 };
  const storeNameById = new Map(visibleStores.map(store => [store.id, store.name]));
  const candidates = facts.flatMap(fact => monthlyRevenuePlanMilestones(fact.planAmount, fact.actualAmount).map(milestone => ({ fact, milestone })));
  if (!candidates.length) return { monthDate, created: 0 };
  const existingRows = await db.select({ storeId: operationalEvotorRevenuePlanMilestones.storeId, milestonePercent: operationalEvotorRevenuePlanMilestones.milestonePercent })
    .from(operationalEvotorRevenuePlanMilestones)
    .where(and(
      eq(operationalEvotorRevenuePlanMilestones.monthDate, monthDate),
      inArray(operationalEvotorRevenuePlanMilestones.storeId, Array.from(new Set(candidates.map(candidate => candidate.fact.storeId)))),
    ));
  const existingKeys = new Set(existingRows.map(row => `${row.storeId}:${row.milestonePercent}`));
  let created = 0;
  for (const { fact, milestone } of candidates) {
    if (existingKeys.has(`${fact.storeId}:${milestone}`)) continue;
    try {
      await db.insert(operationalEvotorRevenuePlanMilestones).values({
        storeId: fact.storeId,
        monthDate,
        milestonePercent: milestone,
        planAmount: String(fact.planAmount),
        actualAmount: String(fact.actualAmount),
      });
    } catch (error) {
      // A concurrent current-day lane may win the unique key. It has already
      // recorded this exact milestone, therefore no second notification is due.
      const [raceWinner] = await db.select({ id: operationalEvotorRevenuePlanMilestones.id })
        .from(operationalEvotorRevenuePlanMilestones)
        .where(and(
          eq(operationalEvotorRevenuePlanMilestones.storeId, fact.storeId),
          eq(operationalEvotorRevenuePlanMilestones.monthDate, monthDate),
          eq(operationalEvotorRevenuePlanMilestones.milestonePercent, milestone),
        )).limit(1);
      if (raceWinner) continue;
      throw error;
    }
    const storeName = storeNameById.get(fact.storeId) ?? "Магазин";
    const recipients = await getDataFreshnessSignalRecipients([fact.storeId]);
    const milestoneLabel = milestone === 100 ? "План выполнен на 100%" : `План выполнен на ${milestone}%`;
    await createNotifications({
      accountIds: recipients,
      severity: "info",
      title: milestoneLabel,
      message: `${storeName}: достигнута ключевая точка месячного плана выручки Эвотор. Откройте «План», чтобы увидеть прогресс.${milestone === 100 && fact.rewardText ? " Награда доступна на шкале плана." : ""}`,
      entityType: "operational_signal",
      entityId: `evotor_revenue_plan:${fact.storeId}:${monthDate}:${milestone}`,
      sendMobilePush: false,
    });
    created += 1;
  }
  return { monthDate, created };
}

export const __monthlyRevenuePlanTestUtils = {
  evotorMoscowBoundary,
  monthlyRevenuePlanMilestones,
  revenuePlanPercent,
  monthEnd,
  suggestMonthlyRevenuePlan,
};
