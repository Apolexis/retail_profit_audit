export const CATALOG_LANE_KINDS = [
  "evotor_catalog_current_1",
  "evotor_catalog_current_2",
  "evotor_catalog_current_3",
  "evotor_catalog_current_4",
] as const;

export type CatalogLaneKind = typeof CATALOG_LANE_KINDS[number];
export type CatalogCycleVerdict = "attempts_observed" | "coverage_inferred" | "inconclusive" | "failed";

type CatalogJobObservation = {
  kind: string;
  isActive: boolean;
  lastCompletedAt: Date | null;
  lastError: string | null;
};

type CatalogSnapshotObservation = {
  storeId: number;
  snapshotAt: Date | null;
};

type CatalogAttemptObservation = {
  laneKind: string;
  storeId: number;
  status: "running" | "completed" | "failed";
  completedAt: Date | null;
  failureMessage: string | null;
};

export type CatalogCycleAssessmentInput = {
  baselineCapturedAt: Date;
  baselineStoreIds: number[];
  observedStoreIds: number[];
  jobs: CatalogJobObservation[];
  snapshots: CatalogSnapshotObservation[];
  attempts?: CatalogAttemptObservation[];
  /** One active callback may execute all four logical lanes sequentially. */
  consolidatedCallback?: boolean;
};

const uniqueSorted = (values: number[]) => Array.from(new Set(values)).sort((left, right) => left - right);
const sameMembers = (left: number[], right: number[]) => left.length === right.length && left.every((value, index) => value === right[index]);
const isFreshAfter = (at: Date | null, baseline: Date) => Boolean(at && at.getTime() > baseline.getTime());

/**
 * This read-only assessment reports two evidence grades. Fresh snapshots infer
 * coverage, while immutable per-store lane attempts observe the app's specific
 * external-read attempt. Neither grade fabricates a Cloud success beyond the
 * stored response path.
 */
export function assessEvotorCatalogCycle(input: CatalogCycleAssessmentInput) {
  const baselineStoreIds = uniqueSorted(input.baselineStoreIds);
  const observedStoreIds = uniqueSorted(input.observedStoreIds);
  const laneMembers = CATALOG_LANE_KINDS.map((kind, laneIndex) => ({
    kind,
    storeIds: baselineStoreIds.filter((_, storeIndex) => storeIndex % CATALOG_LANE_KINDS.length === laneIndex),
  }));
  const mappingChanged = !sameMembers(baselineStoreIds, observedStoreIds);
  const jobsByKind = new Map(input.jobs.map(job => [job.kind, job]));
  const jobChecks = CATALOG_LANE_KINDS.map(kind => {
    const job = jobsByKind.get(kind);
    return {
      kind,
      active: Boolean(job?.isActive),
      completedAfterBaseline: isFreshAfter(job?.lastCompletedAt ?? null, input.baselineCapturedAt),
      error: job?.lastError ?? null,
    };
  });
  const snapshotsByStore = new Map(input.snapshots.map(snapshot => [snapshot.storeId, snapshot.snapshotAt]));
  const coverage = baselineStoreIds.map(storeId => ({
    storeId,
    snapshotAt: snapshotsByStore.get(storeId) ?? null,
    completedAfterBaseline: isFreshAfter(snapshotsByStore.get(storeId) ?? null, input.baselineCapturedAt),
  }));
  const primaryCatalogJob = jobChecks[0];
  const unexpectedActiveCallbacks = input.consolidatedCallback
    ? jobChecks.slice(1).filter(job => job.active || job.error)
    : [];
  const failedJobs = input.consolidatedCallback
    ? [primaryCatalogJob].filter((job): job is NonNullable<typeof job> => Boolean(job && (!job.active || job.error))).concat(unexpectedActiveCallbacks)
    : jobChecks.filter(job => !job.active || job.error);
  const missingCoverage = coverage.filter(store => !store.completedAfterBaseline).map(store => store.storeId);
  const allJobsCompleted = input.consolidatedCallback
    ? Boolean(primaryCatalogJob?.completedAfterBaseline)
    : jobChecks.every(job => job.completedAfterBaseline);
  const expectedLaneByStore = new Map(laneMembers.flatMap(lane => lane.storeIds.map(storeId => [storeId, lane.kind] as const)));
  const attempts = input.attempts ?? [];
  const attemptCoverage = baselineStoreIds.map(storeId => {
    const laneKind = expectedLaneByStore.get(storeId)!;
    const relevant = attempts.filter(attempt => attempt.storeId === storeId && attempt.laneKind === laneKind && isFreshAfter(attempt.completedAt, input.baselineCapturedAt));
    return {
      storeId,
      laneKind,
      completed: relevant.some(attempt => attempt.status === "completed"),
      failed: relevant.some(attempt => attempt.status === "failed"),
    };
  });
  const failedAttempts = attemptCoverage.filter(attempt => attempt.failed).map(attempt => attempt.storeId);
  const missingAttempts = attemptCoverage.filter(attempt => !attempt.completed).map(attempt => attempt.storeId);
  const verdict: CatalogCycleVerdict = mappingChanged || failedJobs.length || failedAttempts.length
    ? "failed"
    : allJobsCompleted && !missingAttempts.length && baselineStoreIds.length
      ? "attempts_observed"
      : allJobsCompleted && !missingCoverage.length && baselineStoreIds.length
        ? "coverage_inferred"
        : "inconclusive";
  return {
    verdict,
    limitation: "attempts_observed фиксирует завершённую попытку приложения по точке и lane; доказательство доставки данных Эвотор в его стороне всё равно подтверждается только response/read-back.",
    baselineCapturedAt: input.baselineCapturedAt.toISOString(),
    baselineStoreIds,
    observedStoreIds,
    mappingChanged,
    schedulerMode: input.consolidatedCallback ? "consolidated" : "independent",
    laneMembers,
    jobChecks,
    coverage,
    missingCoverage,
    attemptCoverage,
    missingAttempts,
    failedAttempts,
  };
}
