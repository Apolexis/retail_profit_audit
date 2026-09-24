import { describe, expect, it } from "vitest";
import { assessEvotorCatalogCycle } from "./evotorCatalogCycleAudit";

const baseline = new Date("2026-09-22T12:00:00.000Z");
const storeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const completeJobs = [1, 2, 3, 4].map(index => ({
  kind: `evotor_catalog_current_${index}`,
  isActive: true,
  lastCompletedAt: new Date("2026-09-22T12:01:00.000Z"),
  lastError: null,
}));
const completeSnapshots = storeIds.map(storeId => ({ storeId, snapshotAt: new Date("2026-09-22T12:02:00.000Z") }));

describe("read-only аудит полного цикла catalog lanes Эвотор", () => {
  it("раскладывает baseline по четырем детерминированным lanes и даёт только осторожный coverage verdict", () => {
    const result = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds,
      jobs: completeJobs,
      snapshots: completeSnapshots,
    });
    expect(result.verdict).toBe("coverage_inferred");
    expect(result.laneMembers.map(lane => lane.storeIds.length)).toEqual([3, 2, 2, 2]);
    expect(result.missingCoverage).toEqual([]);
    expect(result.limitation).toContain("attempts_observed");
  });

  it("повышает evidence grade только при completed attempt точного lane и магазина", () => {
    const laneByStore = new Map(storeIds.map((storeId, index) => [storeId, `evotor_catalog_current_${index % 4 + 1}`]));
    const result = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds,
      jobs: completeJobs,
      snapshots: completeSnapshots,
      attempts: storeIds.map(storeId => ({
        laneKind: laneByStore.get(storeId)!,
        storeId,
        status: "completed" as const,
        completedAt: new Date("2026-09-22T12:03:00.000Z"),
        failureMessage: null,
      })),
    });
    expect(result.verdict).toBe("attempts_observed");
    expect(result.missingAttempts).toEqual([]);
  });

  it("в объединённом callback требует только активную первую platform-задачу, но сохраняет четыре logical lane", () => {
    const laneByStore = new Map(storeIds.map((storeId, index) => [storeId, `evotor_catalog_current_${index % 4 + 1}`]));
    const result = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds,
      consolidatedCallback: true,
      jobs: completeJobs.map(job => job.kind.endsWith("_1") ? job : { ...job, isActive: false, lastCompletedAt: null }),
      snapshots: completeSnapshots,
      attempts: storeIds.map(storeId => ({ laneKind: laneByStore.get(storeId)!, storeId, status: "completed" as const, completedAt: new Date("2026-09-22T12:03:00.000Z"), failureMessage: null })),
    });
    expect(result.schedulerMode).toBe("consolidated");
    expect(result.verdict).toBe("attempts_observed");
  });

  it("не называет цикл полным при старом снимке, изменившемся mapping или ошибке lane", () => {
    const stale = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds,
      jobs: completeJobs,
      snapshots: [...completeSnapshots.slice(0, 8), { storeId: 9, snapshotAt: baseline }],
    });
    expect(stale.verdict).toBe("inconclusive");
    expect(stale.missingCoverage).toEqual([9]);

    const changed = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds.slice(0, 8),
      jobs: completeJobs,
      snapshots: completeSnapshots,
    });
    expect(changed.verdict).toBe("failed");
    expect(changed.mappingChanged).toBe(true);

    const failedLane = assessEvotorCatalogCycle({
      baselineCapturedAt: baseline,
      baselineStoreIds: storeIds,
      observedStoreIds: storeIds,
      jobs: completeJobs.map(job => job.kind.endsWith("_4") ? { ...job, lastError: "Сбой" } : job),
      snapshots: completeSnapshots,
    });
    expect(failedLane.verdict).toBe("failed");
  });
});
