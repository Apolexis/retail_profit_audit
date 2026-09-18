import { and, eq } from "drizzle-orm";
import {
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
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";

export type OperationalEvotorScheduledKind = "evotor_catalog" | "evotor_documents";

const SYNC_JOBS: Record<OperationalEvotorScheduledKind, { name: string; cron: string; path: string; description: string }> = {
  // 04:15 Moscow is 01:15 UTC during permanent UTC+3. One full catalog read per day
  // avoids needless polling while still keeping quantities/categories current for morning work.
  evotor_catalog: {
    name: "operational-evotor-catalog-nightly",
    cron: "0 15 1 * * *",
    path: "/api/scheduled/operational-evotor-catalog",
    description: "Ежедневное read-only обновление каталогов и остатков закрепленных складов Эвотор.",
  },
  // Documents are cursor-paged once per mapped store. 15 minutes is deliberately
  // conservative: it keeps 35 stores far below the service's account-level rate limit.
  evotor_documents: {
    name: "operational-evotor-documents-quarter-hour",
    cron: "0 */15 * * * *",
    path: "/api/scheduled/operational-evotor-documents",
    description: "Read-only подгрузка следующей страницы чеков и товарных строк Эвотор каждые 15 минут.",
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
  return rows.map(row => row.storeId);
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
      await updateHeartbeatJob(existing.scheduleCronTaskUid, {
        cron: definition.cron,
        path: definition.path,
        method: "POST",
        description: definition.description,
        enable: existing.isActive,
      }, "");
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
    const storeIds = await mappedActiveStoreIds();
    let productCount = 0;
    for (const storeId of storeIds) {
      const result = await confirmOperationalCatalogFromEvotor({ storeId, actorId: null });
      productCount += result.imported;
      // Serial bounded requests minimize rate-limit pressure across the shared account.
      await new Promise(resolve => setTimeout(resolve, 175));
    }
    await setJobState(job.id, { completed: true, error: null });
    await recordChange({
      action: "operational_evotor.catalog_scheduled_sync",
      entityType: "operational_sync",
      entityId: "evotor_catalog",
      afterState: { activeWarehouses: storeIds.length, catalogRowsRead: productCount, mode: "read_only" },
    });
    return { storeCount: storeIds.length, productCount };
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
    const storeIds = await mappedActiveStoreIds();
    let documentsRead = 0;
    let positionsRead = 0;
    for (const storeId of storeIds) {
      const result = await syncOperationalEvotorDocumentPage({ storeId, actorId: null });
      documentsRead += result.readDocuments;
      positionsRead += result.readPositions;
      await new Promise(resolve => setTimeout(resolve, 175));
    }
    await setJobState(job.id, { completed: true, error: null });
    await recordChange({
      action: "operational_evotor.documents_scheduled_sync",
      entityType: "operational_sync",
      entityId: "evotor_documents",
      afterState: { activeWarehouses: storeIds.length, documentsRead, positionsRead, mode: "read_only" },
    });
    return { storeCount: storeIds.length, documentsRead, positionsRead };
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
