import { and, desc, eq, inArray } from "drizzle-orm";
import {
  operationalEvotorDocumentSyncs,
  operationalEvotorProductLinks,
  operationalScheduledSyncJobs,
  operationalStoreMappings,
  stores,
} from "../drizzle/schema";
import { getDb } from "./db";
import { recordChange } from "./localAuth";
import {
  confirmOperationalCatalogFromEvotor,
  syncOperationalEvotorDocumentPage,
} from "./inventoryRegistry";
import { createHeartbeatJob } from "./_core/heartbeat";

export type OperationalEvotorScheduledKind = "evotor_catalog" | "evotor_documents";

const SYNC_JOBS: Record<OperationalEvotorScheduledKind, { name: string; cron: string; path: string; description: string }> = {
  // One mapped store per call. The platform's minimum supported interval is one
  // minute; a catalog callback is bounded to five pages and has been measured below
  // the two-minute callback limit. This maximizes freshness without fan-out bursts.
  evotor_catalog: {
    name: "operational-evotor-catalog-rotation",
    cron: "0 * * * * *",
    path: "/api/scheduled/operational-evotor-catalog",
    description: "Read-only обновление каталога и остатка одного закрепленного склада Эвотор по очереди каждую минуту.",
  },
  // Documents are cursor-paged one store at a time. The callback has a two-minute
  // execution limit; a measured page completes in seconds, so one minute is safe
  // while preserving strict sequential calls to the external API.
  evotor_documents: {
    name: "operational-evotor-documents-rolling",
    cron: "0 * * * * *",
    path: "/api/scheduled/operational-evotor-documents",
    description: "Read-only подгрузка следующей страницы чеков и товарных строк одного закрепленного склада Эвотор каждую минуту.",
  },
};

async function mappedActiveStoreIds(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const rows = await db
    .select({ storeId: stores.id })
    .from(stores)
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(stores.isHidden, false))
    .limit(200);
  return Array.from(new Set(rows.map(row => row.storeId)));
}

/** Select the least recently started mapped store, retaining a running cursor until it is complete. */
async function nextMappedStoreId(kind: OperationalEvotorScheduledKind): Promise<number | null> {
  const storeIds = await mappedActiveStoreIds();
  if (!storeIds.length) return null;
  if (kind === "evotor_catalog") {
    const db = await getDb();
    if (!db) throw new Error("База данных недоступна");
    const links = await db
      .select({ storeId: operationalEvotorProductLinks.storeId, updatedAt: operationalEvotorProductLinks.updatedAt })
      .from(operationalEvotorProductLinks)
      .where(inArray(operationalEvotorProductLinks.storeId, storeIds));
    const lastReadByStore = new Map<number, number>();
    for (const link of links) {
      lastReadByStore.set(link.storeId, Math.max(lastReadByStore.get(link.storeId) ?? 0, link.updatedAt.getTime()));
    }
    return [...storeIds].sort((left, right) => (lastReadByStore.get(left) ?? 0) - (lastReadByStore.get(right) ?? 0))[0] ?? null;
  }
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const syncs = await db
    .select({ storeId: operationalEvotorDocumentSyncs.storeId, startedAt: operationalEvotorDocumentSyncs.startedAt, status: operationalEvotorDocumentSyncs.status })
    .from(operationalEvotorDocumentSyncs)
    .where(inArray(operationalEvotorDocumentSyncs.storeId, storeIds))
    .orderBy(desc(operationalEvotorDocumentSyncs.startedAt))
    .limit(1_000);
  const running = syncs.find(sync => sync.status === "running" && storeIds.includes(sync.storeId));
  if (running) return running.storeId;
  const lastStartedByStore = new Map<number, number>();
  for (const sync of syncs) {
    if (!lastStartedByStore.has(sync.storeId)) lastStartedByStore.set(sync.storeId, sync.startedAt.getTime());
  }
  return [...storeIds].sort((left, right) => (lastStartedByStore.get(left) ?? 0) - (lastStartedByStore.get(right) ?? 0))[0] ?? null;
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
  for (const kind of Object.keys(SYNC_JOBS) as OperationalEvotorScheduledKind[]) {
    const definition = SYNC_JOBS[kind];
    const existing = await findJob(kind);
    if (existing?.scheduleCronTaskUid) {
      // The platform scheduler is persistent. Its registered one-minute cadence
      // is verified separately; restarting the HTTP process must not issue a
      // mutable remote update on every hot reload or deployment.
      continue;
    }
    const created = await createHeartbeatJob({
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

export async function runScheduledEvotorCatalog(taskUid: string) {
  const job = await assertExpectedCallback(taskUid, "evotor_catalog");
  await setJobState(job.id, { started: true, error: null });
  try {
    const storeId = await nextMappedStoreId("evotor_catalog");
    if (storeId === null) return { storeCount: 0, productCount: 0 };
    const result = await confirmOperationalCatalogFromEvotor({ storeId, actorId: null });
    await setJobState(job.id, { completed: true, error: null });
    await recordChange({
      action: "operational_evotor.catalog_scheduled_sync",
      entityType: "operational_sync",
      entityId: "evotor_catalog",
      afterState: { warehouseCount: 1, catalogRowsRead: result.imported, mode: "read_only" },
    });
    return { storeCount: 1, productCount: result.imported };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512);
    await setJobState(job.id, { error: message });
    throw error;
  }
}

export async function runScheduledEvotorDocuments(taskUid: string) {
  const job = await assertExpectedCallback(taskUid, "evotor_documents");
  await setJobState(job.id, { started: true, error: null });
  try {
    const storeId = await nextMappedStoreId("evotor_documents");
    if (storeId === null) return { storeCount: 0, documentsRead: 0, positionsRead: 0 };
    const result = await syncOperationalEvotorDocumentPage({ storeId, actorId: null });
    await setJobState(job.id, { completed: true, error: null });
    await recordChange({
      action: "operational_evotor.documents_scheduled_sync",
      entityType: "operational_sync",
      entityId: "evotor_documents",
      afterState: { warehouseCount: 1, documentsRead: result.readDocuments, positionsRead: result.readPositions, mode: "read_only" },
    });
    return { storeCount: 1, documentsRead: result.readDocuments, positionsRead: result.readPositions };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512);
    await setJobState(job.id, { error: message });
    throw error;
  }
}

export async function isExpectedOperationalEvotorCallback(taskUid: string, kind: OperationalEvotorScheduledKind) {
  const job = await findJob(kind);
  return Boolean(job?.isActive && job.scheduleCronTaskUid === taskUid);
}

export const operationalEvotorScheduleDefinitions = SYNC_JOBS;
