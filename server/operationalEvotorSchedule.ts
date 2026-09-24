import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import {
  operationalEvotorCatalogLaneAttempts,
  operationalEvotorDocumentSyncs,
  operationalScheduledSyncJobs,
  operationalStoreMappings,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { recordChange } from "./localAuth";
import { dispatchOperationalEvotorOutbound } from "./evotorOutbound";
import {
  confirmOperationalCatalogFromEvotor,
  failOperationalEvotorDocumentSync,
  syncOperationalEvotorDocumentPage,
} from "./inventoryRegistry";
import { createHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob } from "./_core/heartbeat";
import { evaluateCurrentDayEvotorFreshnessAndReturnSignals, evaluateCurrentDayEvotorReturnSignals, evaluateOperationalStoreSignals } from "./operationalSignals";

/** Four bounded, independent lanes keep every platform callback below its timeout. */
const CURRENT_DAY_WORKER_COUNT = 4;
const CATALOG_WORKER_COUNT = 4;
const CATALOG_CALLBACK_MIN_INTERVAL_MS = 55_000;
const CATALOG_CALLBACK_STALE_LEASE_MS = 180_000;
const CATALOG_LANE_BATCH_SIZE = 4;
const CATALOG_LANE_OUTBOUND_BATCH_SIZE = 3;
const CATALOG_JOB_KINDS = ["evotor_catalog_current_1", "evotor_catalog_current_2", "evotor_catalog_current_3", "evotor_catalog_current_4"] as const;
const ACTIVE_CATALOG_JOB_KINDS = CATALOG_JOB_KINDS;
const CURRENT_DAY_JOB_KINDS = ["evotor_documents_current_1", "evotor_documents_current_2", "evotor_documents_current_3", "evotor_documents_current_4", "evotor_documents_current_5", "evotor_documents_current_6", "evotor_documents_current_7", "evotor_documents_current_8", "evotor_documents_current_9", "evotor_documents_current_10", "evotor_documents_current_11", "evotor_documents_current_12", "evotor_documents_current_13", "evotor_documents_current_14", "evotor_documents_current_15", "evotor_documents_current_16", "evotor_documents_current_17", "evotor_documents_current_18", "evotor_documents_current_19", "evotor_documents_current_20", "evotor_documents_current_21", "evotor_documents_current_22", "evotor_documents_current_23", "evotor_documents_current_24", "evotor_documents_current_25", "evotor_documents_current_26", "evotor_documents_current_27", "evotor_documents_current_28", "evotor_documents_current_29", "evotor_documents_current_30", "evotor_documents_current_31", "evotor_documents_current_32"] as const;
/** The remaining named platform tasks are retained only to be paused safely on startup. */
const ACTIVE_CURRENT_DAY_JOB_KINDS = ["evotor_documents_current_1", "evotor_documents_current_2", "evotor_documents_current_3", "evotor_documents_current_4"] as const;
type CurrentDayJobKind = typeof CURRENT_DAY_JOB_KINDS[number];
type ActiveCurrentDayJobKind = typeof ACTIVE_CURRENT_DAY_JOB_KINDS[number];
type CatalogJobKind = typeof CATALOG_JOB_KINDS[number];
type ActiveCatalogJobKind = typeof ACTIVE_CATALOG_JOB_KINDS[number];
export type OperationalEvotorScheduledKind = "evotor_catalog" | "evotor_documents" | CatalogJobKind | CurrentDayJobKind;
type ActiveOperationalEvotorScheduledKind = "evotor_documents" | ActiveCatalogJobKind | ActiveCurrentDayJobKind;
type OperationalEvotorDocumentMode = "historical" | "current_day";

const CURRENT_DAY_SYNC_JOBS = Object.fromEntries(CURRENT_DAY_JOB_KINDS.map((kind, index) => [kind, {
  name: `operational-evotor-documents-current-${index + 1}`,
  cron: "0 * * * * *",
  path: `/api/scheduled/operational-evotor-documents-current-${index + 1}`,
  description: "Read-only постоянное обновление текущего дня: последовательная группа закрепленных точек, по одной API-странице на точку каждую минуту.",
}])) as Record<CurrentDayJobKind, { name: string; cron: string; path: string; description: string }>;

const ACTIVE_CURRENT_DAY_SYNC_JOBS = Object.fromEntries(ACTIVE_CURRENT_DAY_JOB_KINDS.map(kind => [kind, CURRENT_DAY_SYNC_JOBS[kind]])) as Record<ActiveCurrentDayJobKind, { name: string; cron: string; path: string; description: string }>;

const CATALOG_SYNC_JOBS = Object.fromEntries(CATALOG_JOB_KINDS.map((kind, index) => [kind, {
  name: `operational-evotor-catalog-current-${index + 1}`,
  // Heartbeat guarantees a minimum interval of one minute. All four jobs can
  // safely start in the same minute because each owns a separate DB lease and
  // reads a bounded sequential batch; a seconds-offset cron is irregular.
  cron: "0 * * * * *",
  path: `/api/scheduled/operational-evotor-catalog-current-${index + 1}`,
  description: "Read-only постоянное обновление каталога и физического остатка: четыре независимые minute-lane, ограниченный последовательный batch без ожидания других групп.",
}])) as Record<CatalogJobKind, { name: string; cron: string; path: string; description: string }>;

const ACTIVE_CATALOG_SYNC_JOBS = Object.fromEntries(ACTIVE_CATALOG_JOB_KINDS.map(kind => [kind, CATALOG_SYNC_JOBS[kind]])) as Record<ActiveCatalogJobKind, { name: string; cron: string; path: string; description: string }>;

/** Keep operator-visible task status Russian and never surface a runtime/library error verbatim. */
function scheduledErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message.trim() : "";
  return /[А-Яа-яЁё]/.test(message) ? message.slice(0, 512) : fallback;
}

/** Platform heartbeat updates can transiently reset an HTTP/2 stream. */
async function updateHeartbeatJobWithRetry(taskUid: string, input: Parameters<typeof updateHeartbeatJob>[1], attempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await updateHeartbeatJob(taskUid, input, "");
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

const SYNC_JOBS: Record<ActiveOperationalEvotorScheduledKind, { name: string; cron: string; path: string; description: string }> = {
  // Documents are cursor-paged one store at a time. The callback has a two-minute
  // execution limit; a measured page completes in seconds, so one minute is safe
  // while preserving strict sequential calls to the external API.
  evotor_documents: {
    name: "operational-evotor-documents-archive",
    cron: "0 * * * * *",
    path: "/api/scheduled/operational-evotor-documents",
    description: "Read-only однократная подгрузка следующей архивной страницы чеков и товарных строк одного закрепленного склада Эвотор каждую минуту.",
  },
  ...ACTIVE_CATALOG_SYNC_JOBS,
  ...ACTIVE_CURRENT_DAY_SYNC_JOBS,
};

async function mappedActiveStoreIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const rows = await db
    .select({ storeId: stores.id })
    .from(stores)
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(stores.isHidden, false))
    .orderBy(stores.id)
    .limit(200);
  return Array.from(new Set(rows.map(row => row.storeId)));
}

/**
 * Select one store inside a deterministic catalog lane. A confirmed-reset
 * snapshot can correctly retain its original timestamp while sales are applied
 * as separate deltas, so snapshot time must never drive catalog rotation.
 * Instead, rotate by each lane's completed-at time. A failed lane attempt has
 * priority so one transient V2 failure is retried before the next full round.
 */
async function nextCatalogStoreId(shard: number, excludedStoreIds: ReadonlySet<number> = new Set()): Promise<number | null> {
  const storeIds = await mappedActiveStoreIds();
  if (!storeIds.length) return null;
  const laneStoreIds = storeIds.filter((storeId, index) => index % CATALOG_WORKER_COUNT === shard && !excludedStoreIds.has(storeId));
  if (!laneStoreIds.length) return null;
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const laneKind = CATALOG_JOB_KINDS[shard];
  const attempts = await db
    .select({
      storeId: operationalEvotorCatalogLaneAttempts.storeId,
      status: operationalEvotorCatalogLaneAttempts.status,
      startedAt: operationalEvotorCatalogLaneAttempts.startedAt,
      completedAt: operationalEvotorCatalogLaneAttempts.completedAt,
    })
    .from(operationalEvotorCatalogLaneAttempts)
    .where(and(
      eq(operationalEvotorCatalogLaneAttempts.laneKind, laneKind),
      inArray(operationalEvotorCatalogLaneAttempts.storeId, laneStoreIds),
    ))
    .orderBy(desc(operationalEvotorCatalogLaneAttempts.startedAt))
    .limit(1_000);
  const latestAttemptByStore = new Map<number, typeof attempts[number]>();
  for (const attempt of attempts) {
    if (!latestAttemptByStore.has(attempt.storeId)) latestAttemptByStore.set(attempt.storeId, attempt);
  }
  const failedStoreIds = laneStoreIds.filter(storeId => latestAttemptByStore.get(storeId)?.status === "failed");
  if (failedStoreIds.length) {
    return failedStoreIds.sort((left, right) => {
      const leftAt = latestAttemptByStore.get(left)?.completedAt?.getTime() ?? 0;
      const rightAt = latestAttemptByStore.get(right)?.completedAt?.getTime() ?? 0;
      return leftAt - rightAt || left - right;
    })[0] ?? null;
  }
  return [...laneStoreIds].sort((left, right) => {
    const leftAt = latestAttemptByStore.get(left)?.completedAt?.getTime() ?? 0;
    const rightAt = latestAttemptByStore.get(right)?.completedAt?.getTime() ?? 0;
    return leftAt - rightAt || left - right;
  })[0] ?? null;
}

/** Select an unfinished archival store, retaining a running cursor until its terminal state. */
async function nextMappedStoreId(): Promise<number | null> {
  const storeIds = await mappedActiveStoreIds();
  if (!storeIds.length) return null;
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const syncs = await db
    .select({ storeId: operationalEvotorDocumentSyncs.storeId, startedAt: operationalEvotorDocumentSyncs.startedAt, status: operationalEvotorDocumentSyncs.status, syncMode: operationalEvotorDocumentSyncs.syncMode })
    .from(operationalEvotorDocumentSyncs)
    .where(inArray(operationalEvotorDocumentSyncs.storeId, storeIds))
    .orderBy(desc(operationalEvotorDocumentSyncs.startedAt))
    .limit(1_000);
  const latestArchiveByStore = new Map<number, { storeId: number; startedAt: Date; status: "running" | "completed" | "failed"; syncMode: "historical" | "current_day" }>();
  for (const sync of syncs) {
    if (sync.syncMode === "historical" && !latestArchiveByStore.has(sync.storeId)) latestArchiveByStore.set(sync.storeId, sync);
  }
  const running = Array.from(latestArchiveByStore.values()).find(sync => sync.status === "running" && storeIds.includes(sync.storeId));
  if (running) return running.storeId;
  // The archive cycle is terminal once every mapped point has completed or
  // failed. A failed terminal attempt remains observable instead of silently
  // starting a fresh cursor that would overwrite the error evidence.
  const unstarted = storeIds.filter(storeId => !latestArchiveByStore.has(storeId));
  return unstarted[0] ?? null;
}

/** Each current-day heartbeat owns a deterministic, sequential lane and never touches the archive. */
async function nextCurrentDayDocumentTargets(shard: number): Promise<Array<{ storeId: number; mode: OperationalEvotorDocumentMode }>> {
  const storeIds = await mappedActiveStoreIds();
  if (!storeIds.length) return [];
  return storeIds
    .filter((_, index) => index % CURRENT_DAY_WORKER_COUNT === shard)
    .map(storeId => ({ storeId, mode: "current_day" as const }));
}

async function findJob(kind: OperationalEvotorScheduledKind) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [job] = await db
    .select()
    .from(operationalScheduledSyncJobs)
    .where(eq(operationalScheduledSyncJobs.kind, kind))
    .limit(1);
  return job ?? null;
}

/**
 * Creates platform-owned recurring callbacks exactly once. The empty session is
 * intentionally supported by the heartbeat SDK and resolves to the project owner.
 */
export async function ensureOperationalEvotorSchedules(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // A platform task may have been created before a local enum migration added
  // its DB row. Recover its task UID by stable name rather than attempting a
  // duplicate remote create on every restart.
  const platformJobs = await listHeartbeatJobs("", { page: 1, pageSize: 200 });
  const platformJobByName = new Map(platformJobs.jobs.map(job => [job.name, job]));
  // The original single catalog rotation needed 33 minutes for 33 stores. Keep
  // its history but replace it with four deterministic read-only lanes.
  const legacyCatalog = platformJobByName.get("operational-evotor-catalog-rotation");
  if (legacyCatalog?.isEnable) await updateHeartbeatJobWithRetry(legacyCatalog.taskUid, { enable: false });
  const legacyCatalogRow = await findJob("evotor_catalog");
  if (legacyCatalogRow?.scheduleCronTaskUid) {
    await updateHeartbeatJobWithRetry(legacyCatalogRow.scheduleCronTaskUid, { enable: false });
  }
  if (legacyCatalogRow?.isActive) {
    await db.update(operationalScheduledSyncJobs)
      .set({ isActive: false, lastError: null })
      .where(eq(operationalScheduledSyncJobs.id, legacyCatalogRow.id));
  }
  // The previous 32-worker design ran every callback as a separate minute task.
  // The scheduler executed those tasks as a delayed burst in production, so keep
  // four lanes and pause the legacy tasks without deleting their audit trail.
  for (const legacyKind of CURRENT_DAY_JOB_KINDS.slice(CURRENT_DAY_WORKER_COUNT)) {
    const legacy = platformJobByName.get(CURRENT_DAY_SYNC_JOBS[legacyKind].name);
    if (legacy?.isEnable) await updateHeartbeatJobWithRetry(legacy.taskUid, { enable: false });
    const existing = await findJob(legacyKind);
    if (existing?.isActive) {
      await db.update(operationalScheduledSyncJobs)
        .set({ isActive: false, lastError: null })
      .where(eq(operationalScheduledSyncJobs.id, existing.id));
    }
  }
  for (const kind of Object.keys(SYNC_JOBS) as ActiveOperationalEvotorScheduledKind[]) {
    const definition = SYNC_JOBS[kind];
    const existing = await findJob(kind);
    try {
      if (existing?.scheduleCronTaskUid) {
        const platformJob = platformJobByName.get(definition.name);
        const scheduleChanged = platformJob?.cronExpression !== definition.cron || platformJob?.callbackPath !== definition.path || platformJob?.description !== definition.description;
        if (!existing.isActive || scheduleChanged) {
          await updateHeartbeatJobWithRetry(existing.scheduleCronTaskUid, {
            ...(scheduleChanged ? { cron: definition.cron, path: definition.path, method: "POST", payload: {}, description: definition.description } : {}),
            enable: true,
          });
          await db.update(operationalScheduledSyncJobs).set({ isActive: true, lastError: null }).where(eq(operationalScheduledSyncJobs.id, existing.id));
        }
        continue;
      }
      const recovered = platformJobByName.get(definition.name);
      const created = recovered
        ? (await updateHeartbeatJobWithRetry(recovered.taskUid, { cron: definition.cron, path: definition.path, method: "POST", payload: {}, description: definition.description, enable: true }), { taskUid: recovered.taskUid })
        : await createHeartbeatJob({
          ...definition,
          method: "POST",
          payload: {},
        }, "");
      if (existing) {
        await db.update(operationalScheduledSyncJobs)
          .set({ scheduleCronTaskUid: created.taskUid, isActive: true, lastError: null })
          .where(eq(operationalScheduledSyncJobs.id, existing.id));
      } else {
        await db.insert(operationalScheduledSyncJobs).values({
          kind,
          scheduleCronTaskUid: created.taskUid,
          isActive: true,
        });
      }
    } catch (error) {
      const message = scheduledErrorMessage(error, "Не удалось обновить расписание Эвотор.");
      if (existing) await db.update(operationalScheduledSyncJobs).set({ lastError: message }).where(eq(operationalScheduledSyncJobs.id, existing.id));
      console.error("[operational-evotor-schedule]", message);
    }
  }
}

async function assertExpectedCallback(taskUid: string, kind: OperationalEvotorScheduledKind) {
  const job = await findJob(kind);
  if (!job?.isActive || job.scheduleCronTaskUid !== taskUid) {
    throw new Error("Неактивная или нераспознанная задача синхронизации.");
  }
  return job;
}

async function setJobState(id: number, patch: { started?: boolean; completed?: boolean; error?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(operationalScheduledSyncJobs).set({
    ...(patch.started ? { lastStartedAt: new Date() } : {}),
    ...(patch.completed ? { lastCompletedAt: new Date() } : {}),
    ...(patch.error !== undefined ? { lastError: patch.error } : {}),
  }).where(eq(operationalScheduledSyncJobs.id, id));
}

async function startCatalogLaneAttempt(laneKind: CatalogJobKind, storeId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [attempt] = await db.insert(operationalEvotorCatalogLaneAttempts).values({ laneKind, storeId }).$returningId();
  return attempt.id;
}

async function finishCatalogLaneAttempt(input: { id: number; status: "completed" | "failed"; productsRead?: number; failureMessage?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(operationalEvotorCatalogLaneAttempts).set({
    status: input.status,
    ...(input.productsRead === undefined ? {} : { productsRead: input.productsRead }),
    failureMessage: input.failureMessage ?? null,
    completedAt: new Date(),
  }).where(eq(operationalEvotorCatalogLaneAttempts.id, input.id));
}

/** Atomically admits one callback for this specific lane while it owns its lease. */
async function claimCatalogCallbackLease(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const now = new Date();
  const cadenceAt = new Date(now.getTime() - CATALOG_CALLBACK_MIN_INTERVAL_MS);
  const staleAt = new Date(now.getTime() - CATALOG_CALLBACK_STALE_LEASE_MS);
  const [result] = await db.update(operationalScheduledSyncJobs).set({ lastStartedAt: now, lastError: null }).where(and(
    eq(operationalScheduledSyncJobs.id, jobId),
    or(
      isNull(operationalScheduledSyncJobs.lastStartedAt),
      and(
        isNotNull(operationalScheduledSyncJobs.lastCompletedAt),
        sql`${operationalScheduledSyncJobs.lastCompletedAt} >= ${operationalScheduledSyncJobs.lastStartedAt}`,
        lt(operationalScheduledSyncJobs.lastStartedAt, cadenceAt),
      ),
      lt(operationalScheduledSyncJobs.lastStartedAt, staleAt),
    ),
  ));
  return result.affectedRows === 1;
}

export async function runScheduledEvotorCatalog(taskUid: string, kind: CatalogJobKind) {
  const job = await assertExpectedCallback(taskUid, kind);
  if (!(await claimCatalogCallbackLease(job.id))) return { storeCount: 0, productCount: 0, skippedByLease: true };
  await setJobState(job.id, { started: true, error: null });
  try {
    // Heartbeat may delay minute triggers. Each lane therefore reads a bounded
    // sequential batch, never a concurrent V2 fan-out. Every store retains its
    // own immutable terminal result, and one source failure does not stop peers.
    const outbound = kind === CATALOG_JOB_KINDS[0] && !job.isOutboundPaused
      // One large metadata repair must never monopolize the two-minute catalog
      // callback. User-triggered durable dispatch remains immediate elsewhere;
      // the background lane advances exactly one mapped store at a time.
      ? await dispatchOperationalEvotorOutbound({ storeLimit: 1 })
      : { attempted: 0, submitted: 0, sent: 0, skipped: 0, failed: 0, bulk: { checked: 0, succeeded: 0, failed: 0, pending: 0 }, paused: Boolean(job.isOutboundPaused) };
    const laneIndex = CATALOG_JOB_KINDS.indexOf(kind);
    const batchSize = kind === CATALOG_JOB_KINDS[0] && !job.isOutboundPaused
      ? CATALOG_LANE_OUTBOUND_BATCH_SIZE
      : CATALOG_LANE_BATCH_SIZE;
    const attemptedStoreIds = new Set<number>();
    let storeCount = 0;
    let failedStoreCount = 0;
    let productCount = 0;
    let firstFailure: string | null = null;
    for (let index = 0; index < batchSize; index += 1) {
      const storeId = await nextCatalogStoreId(laneIndex, attemptedStoreIds);
      if (storeId === null) break;
      attemptedStoreIds.add(storeId);
      const catalogAttemptId = await startCatalogLaneAttempt(kind, storeId);
      try {
        const result = await confirmOperationalCatalogFromEvotor({ storeId, actorId: null });
        await finishCatalogLaneAttempt({ id: catalogAttemptId, status: "completed", productsRead: result.imported });
        storeCount += 1;
        productCount += result.imported;
      } catch (error) {
        const message = scheduledErrorMessage(error, "Не удалось обновить каталог Эвотор.");
        await finishCatalogLaneAttempt({ id: catalogAttemptId, status: "failed", failureMessage: message });
        failedStoreCount += 1;
        firstFailure ??= message;
      }
    }
    await setJobState(job.id, { completed: true, error: firstFailure });
    await recordChange({
      action: "operational_evotor.catalog_scheduled_sync",
      entityType: "operational_sync",
      entityId: kind,
      afterState: { warehouseCount: storeCount, failedStoreCount, catalogRowsRead: productCount, lanes: [kind], outbound, mode: "catalog read-only; bounded sequential lane batch" },
    });
    // Individual failures remain immutable attempts; the platform never retries
    // the entire batch and therefore never duplicates its successful reads.
    return { storeCount, failedStoreCount, productCount, outbound };
  } catch (error) {
    const message = scheduledErrorMessage(error, "Не удалось обновить каталог Эвотор.");
    await setJobState(job.id, { error: message });
    throw error;
  }
}

export async function runScheduledEvotorDocuments(taskUid: string, kind: OperationalEvotorScheduledKind = "evotor_documents") {
  const job = await assertExpectedCallback(taskUid, kind);
  await setJobState(job.id, { started: true, error: null });
  let targets: Array<{ storeId: number; mode: OperationalEvotorDocumentMode }> = [];
  try {
    const currentIndex = ACTIVE_CURRENT_DAY_JOB_KINDS.indexOf(kind as ActiveCurrentDayJobKind);
    if (currentIndex >= 0) {
      targets = await nextCurrentDayDocumentTargets(currentIndex);
    } else {
      const storeId = await nextMappedStoreId();
      targets = storeId === null ? [] : [{ storeId, mode: "historical" }];
    }
    const evaluateSignalsAfterIntake = () => kind === "evotor_documents"
      ? evaluateOperationalStoreSignals()
      : kind === ACTIVE_CURRENT_DAY_JOB_KINDS[0]
        ? evaluateCurrentDayEvotorFreshnessAndReturnSignals()
        : evaluateCurrentDayEvotorReturnSignals();
    if (!targets.length) {
      const signals = await evaluateSignalsAfterIntake();
      await setJobState(job.id, { completed: true, error: null });
      return { storeCount: 0, documentsRead: 0, positionsRead: 0, signals };
    }
    let documentsRead = 0;
    let positionsRead = 0;
    let paymentHeadersHydrated = 0;
    let rateLimit: { limit: number | null; remaining: number | null; reset: string | null } | null = null;
    const failedStores: number[] = [];
    // The stores inside a lane are deliberately read one after another. A failure
    // for one point is recorded on that point and cannot make the platform retry
    // the whole lane while its other stores wait.
    for (const target of targets) {
      try {
        const result = await syncOperationalEvotorDocumentPage({ storeId: target.storeId, actorId: null, mode: target.mode });
        documentsRead += result.readDocuments;
        positionsRead += result.readPositions;
        paymentHeadersHydrated += result.hydratedPaymentDocuments;
        rateLimit = result.rateLimit;
      } catch (error) {
        const message = scheduledErrorMessage(error, target.mode === "current_day" ? "Не удалось обновить текущие документы Эвотор." : "Не удалось загрузить архивные документы Эвотор.");
        await failOperationalEvotorDocumentSync({ storeId: target.storeId, mode: target.mode, failureMessage: message });
        failedStores.push(target.storeId);
      }
    }
    // A fresh PAYBACK/RETURN can arrive through any current-day lane. The first
    // live lane owns one narrow DB-only freshness-and-return sweep, but only
    // after its bounded intake. Therefore alerts never delay documents, while
    // freshness remains independent from a potentially stalled archive cursor.
    // Heavy late-day coverage, request, plan-fact and revenue controls stay in
    // the archival sweep, preserving the live lane's bounded execution budget.
    const signals = await evaluateSignalsAfterIntake();
    const laneError = failedStores.length
      ? `Не удалось обновить ${failedStores.length} ${failedStores.length === 1 ? "точку" : "точки"} Эвотор; остальные точки последовательного потока обработаны.`
      : null;
    await setJobState(job.id, { completed: true, error: laneError });
    await recordChange({
      action: "operational_evotor.documents_scheduled_sync",
      entityType: "operational_sync",
      entityId: kind,
      afterState: { warehouseCount: targets.length, documentsRead, positionsRead, paymentHeadersHydrated, failedStoreCount: failedStores.length, rateLimit, importWindow: targets[0]?.mode ?? "historical", signals, mode: "read_only" },
    });
    return { storeCount: targets.length - failedStores.length, failedStoreCount: failedStores.length, documentsRead, positionsRead, signals };
  } catch (error) {
    const message = scheduledErrorMessage(error, targets[0]?.mode === "current_day" ? "Не удалось обновить текущие документы Эвотор." : "Не удалось загрузить архивные документы Эвотор.");
    for (const target of targets) await failOperationalEvotorDocumentSync({ storeId: target.storeId, mode: target.mode, failureMessage: message });
    await setJobState(job.id, { error: message });
    throw error;
  }
}

export async function isExpectedOperationalEvotorCallback(taskUid: string, kind: OperationalEvotorScheduledKind) {
  const job = await findJob(kind);
  return Boolean(job?.isActive && job.scheduleCronTaskUid === taskUid);
}

export const operationalEvotorScheduleDefinitions = SYNC_JOBS;
