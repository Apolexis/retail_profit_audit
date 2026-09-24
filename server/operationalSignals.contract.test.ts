import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { __operationalSignalTestUtils } from "./operationalSignals";

const source = readFileSync(new URL("./operationalSignals.ts", import.meta.url), "utf8");

describe("сигналы возвратов Эвотор", () => {
  it("считывает только нормализованные возвраты текущего московского дня", () => {
    expect(source).toContain("async function evaluateEvotorReturnSignals");
    expect(source).toContain('inArray(operationalEvotorDocuments.documentType, ["PAYBACK", "RETURN", "SELL_RETURN"])');
    expect(source).toContain('gte(operationalEvotorDocuments.occurredAt, `${input.businessDate}T00:00:00`)');
    expect(source).toContain('lte(operationalEvotorDocuments.occurredAt, `${input.businessDate}T23:59:59.999`)');
  });

  it("создает один audit-сигнал на документ без изменения бизнес-фактов", () => {
    expect(source).toContain("async function returnSignalOnce");
    expect(source).toContain("createReturnSignalNotifications");
    expect(source).toContain('key: `evotor_return:${document.id}`');
    expect(source).toContain("await returnSignalOnce");
    expect(source).toContain('title: "Возврат Эвотор требует просмотра"');
    expect(source).toContain("const returns = await evaluateEvotorReturnSignals");
    expect(source).toContain("returns,");
    expect(source).not.toContain("delete(operationalEvotorDocuments)");
  });

	it("запускает узкую идемпотентную оценку возвратов и порогов плана после intake current-day", () => {
	  expect(source).toContain("export async function evaluateCurrentDayEvotorReturnSignals()");
	  expect(source).toContain("const { businessDate } = moscowNow();");
	  expect(source).toContain("const mappedRows = await db.select({ storeId: operationalStoreMappings.storeId })");
	  expect(source).toContain("returns: await evaluateEvotorReturnSignals");
	  expect(source).toContain("revenuePlanMilestones: (await evaluateCurrentEvotorRevenuePlanMilestones()).created");
	});

	it("выполняет freshness в узкой current-day lane без тяжёлых вечерних контролей", () => {
	  const scheduler = readFileSync(new URL("./operationalEvotorSchedule.ts", import.meta.url), "utf8");
	  expect(scheduler).toContain('kind === ACTIVE_CURRENT_DAY_JOB_KINDS[0]');
	  expect(scheduler).toContain("evaluateCurrentDayEvotorFreshnessAndReturnSignals()");
	  expect(source).toContain("export async function evaluateCurrentDayEvotorFreshnessAndReturnSignals()");
	  expect(source).toContain("intentionally excludes late-day coverage, request,");
	  expect(source).toContain("Evotor plan milestones");
	});

	it("закрывает свежие ключи одним batch, а не N+1 запросами lane", () => {
	  expect(source).toContain("const resolveKeys: string[] = []");
	  expect(source).toContain("one existence query, one recipient lookup and one insert");
	  expect(source).toContain("await resolveOperationalSignalNotifications(resolveKeys);");
	  expect(source).not.toContain("await resolveOperationalSignalNotifications([receiptKey])");
	  expect(source).not.toContain("await resolveOperationalSignalNotifications([stockKey])");
	});

	it("сохраняет in-app freshness по точкам, но посылает не более одного mobile digest за проход", () => {
	  expect(source).toContain("const candidates: Array<");
	  expect(source).toContain("const missing = candidates.filter");
	  expect(source).toContain("createDataFreshnessSignalNotificationsBatch(missing)");
	  expect(source).toContain("const newFreshnessSignals = receiptFreshness + stockFreshness;");
	  expect(source).toContain("if (newFreshnessSignals && delivered.accountIds.length) await sendDataFreshnessMobileDigest");
	});

	it("не сохраняет старую траекторию по реестру выручки вместо факта Эвотор", () => {
    expect(source).toContain('import { evaluateCurrentEvotorRevenuePlanMilestones } from "./monthlyRevenuePlan";');
    expect(source).not.toContain("plan_fact_revenue:");
    expect(source).not.toContain("evaluatePlanFactStoreSignals");
    expect(__operationalSignalTestUtils.freshnessSeverity(11, 10)).toBe("warning");
  });
});
