import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { operationalEvotorScheduleDefinitions } from "./operationalEvotorSchedule";
import { __operationalEvotorSyncTestUtils } from "./inventoryRegistry";
import { __operationalSignalTestUtils } from "./operationalSignals";

const registry = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const scheduler = readFileSync(new URL("./operationalEvotorSchedule.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("./evotorCatalog.ts", import.meta.url), "utf8");
const signals = readFileSync(new URL("./operationalSignals.ts", import.meta.url), "utf8");

	describe("планировщик read-only синхронизации Эвотор", () => {
		  it("отделяет постоянный current-day обмен от одноразового архива", () => {
		    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_1).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-catalog-current-1" });
		    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_2).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-catalog-current-2" });
		    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_3).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-catalog-current-3" });
		    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_4).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-catalog-current-4" });
	    expect(operationalEvotorScheduleDefinitions.evotor_documents).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-documents" });
    expect(operationalEvotorScheduleDefinitions.evotor_documents_current_1).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-documents-current-1" });
    expect(operationalEvotorScheduleDefinitions.evotor_documents_current_4).toMatchObject({ cron: "0 * * * * *", path: "/api/scheduled/operational-evotor-documents-current-4" });
    expect("evotor_documents_current_32" in operationalEvotorScheduleDefinitions).toBe(false);
	    expect("evotor_catalog" in operationalEvotorScheduleDefinitions).toBe(false);
	    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_1.description).toContain("физического остатка");
    expect(operationalEvotorScheduleDefinitions.evotor_documents.description).toContain("архивной страницы");
    expect(operationalEvotorScheduleDefinitions.evotor_documents_current_1.description).toContain("постоянное обновление текущего дня");
  });

	  it("оставляет внешние вызовы только внутри защищенных scheduled маршрутов", () => {
	    expect(operationalEvotorScheduleDefinitions.evotor_catalog_current_1.path).toMatch(/^\/api\/scheduled\//);
	    expect(operationalEvotorScheduleDefinitions.evotor_documents.path).toMatch(/^\/api\/scheduled\//);
	    expect(operationalEvotorScheduleDefinitions.evotor_documents_current_1.path).toMatch(/^\/api\/scheduled\//);
	  });

		  it("делит каталог на четыре независимых bounded callback", () => {
		    expect(scheduler).toContain("const CATALOG_WORKER_COUNT = 4");
		    expect(scheduler).toContain("const CATALOG_LANE_BATCH_SIZE = 4");
		    expect(scheduler).toContain("const CATALOG_LANE_OUTBOUND_BATCH_SIZE = 3");
		    expect(scheduler).toContain("const CATALOG_JOB_KINDS");
		    expect(scheduler).toContain("const ACTIVE_CATALOG_JOB_KINDS = CATALOG_JOB_KINDS");
		    expect(scheduler).toContain("async function nextCatalogStoreId(shard: number, excludedStoreIds");
		    expect(scheduler).toContain("index % CATALOG_WORKER_COUNT === shard");
		    expect(scheduler).toContain("snapshot time must never drive catalog rotation");
		    expect(scheduler).toContain("latestAttemptByStore");
		    expect(scheduler).toContain("const failedStoreIds");
		    expect(scheduler).toContain('status === \"failed\"');
		    expect(scheduler).not.toContain("operationalEvotorProductLinks.evotorQuantityUpdatedAt");
		    expect(scheduler).toContain("const laneIndex = CATALOG_JOB_KINDS.indexOf(kind)");
		    expect(scheduler).toContain("bounded sequential batch");
		    expect(scheduler).toContain("const attemptedStoreIds = new Set<number>()");
		    expect(scheduler).toContain("for (let index = 0; index < batchSize; index += 1)");
		    expect(scheduler).toContain("the platform never retries");
		    expect(scheduler).toContain("const CATALOG_CALLBACK_MIN_INTERVAL_MS = 55_000");
		    expect(scheduler).toContain("async function claimCatalogCallbackLease(jobId: number)");
		    expect(scheduler).toContain("skippedByLease: true");
    expect(scheduler).toContain("operational-evotor-catalog-current-${index + 1}");
    expect(scheduler).toContain("operationalEvotorCatalogLaneAttempts");
		    expect(scheduler).toContain("startCatalogLaneAttempt(kind, storeId)");
		    expect(scheduler).toContain('finishCatalogLaneAttempt({ id: catalogAttemptId, status: "completed"');
		    expect(scheduler).toContain('finishCatalogLaneAttempt({ id: catalogAttemptId, status: "failed"');
		    expect(scheduler).toContain("the platform never retries");
		    expect(scheduler).toContain("return { storeCount, failedStoreCount, productCount, outbound };");
		  });

		  it("сохраняет страницу документов пакетно и не переписывает бизнес-факты сохраненных чеков", () => {
	    expect(registry).toContain("const uniqueDocuments = Array.from(new Map(page.documents");
	    expect(registry).toContain("const existingByExternalId = uniqueDocuments.length");
	    expect(registry).toContain("for (let start = 0; start < newDocuments.length; start += 20)");
	    expect(registry).toContain("await db.insert(operationalEvotorDocuments).values(batch.map");
	    expect(registry).toContain("await db.insert(operationalEvotorDocumentPositions).values(positions)");
		    expect(registry).toContain("paymentCaptureStatus: payment.captureStatus");
	    expect(scheduler).toContain("paymentHeadersHydrated += result.hydratedPaymentDocuments");
		    expect(registry).toContain("inserts a previously unseen external document ID only");
		    expect(registry).toContain("paymentHydrationDocuments");
		    expect(registry).toContain("await db.update(operationalEvotorDocuments).set(storedPaymentSummary");
		    expect(registry).toContain("await forEachBoundedBatch(preview.products, 12");
	  });

	  it("сохраняет отдельные cursor-цепочки для постоянного current-day и одноразового архива 2025+", () => {
    expect(registry).toContain('mode?: "historical" | "current_day"');
		    expect(registry).toContain('syncMode === "current_day" ? businessDate : EVOTOR_DOCUMENT_RETENTION_START');
		    expect(registry).toContain('syncMode === "current_day" && activeSync && activeSync.requestedTo !== businessDate');
		    expect(registry).toContain("currentDayEvotorWindowStart(input.storeId, businessDate)");
		    expect(registry).toContain("EVOTOR_CURRENT_DAY_OVERLAP_MINUTES = 120");
		    expect(registry).toContain("currentDayEvotorWindowStartFromWatermarks");
		    expect(registry).toContain("highWatermark - EVOTOR_CURRENT_DAY_OVERLAP_MS");
		    expect(registry).toContain("Current-day polling is a short idempotent overlap");
	    expect(registry).toContain("sourceCreatedAt: operationalEvotorDocuments.sourceCreatedAt");
	    expect(registry).toContain("sourceCreatedAt: document.createdAt");
	    expect(registry).toContain('until: sync.cursor ? undefined : syncMode === "current_day" ? new Date()');
    expect(registry).toContain("sync.requestedTo ?? moscowBusinessDate()");
		    expect(scheduler).toContain("async function nextCurrentDayDocumentTargets");
		    expect(scheduler).toContain("index % CURRENT_DAY_WORKER_COUNT === shard");
		    expect(scheduler).toContain("for (const target of targets)");
	    expect(scheduler).toContain('mode: "current_day"');
	    expect(scheduler).toContain('importWindow: targets[0]?.mode');
	    expect(scheduler).toContain("CURRENT_DAY_JOB_KINDS");
	    expect(scheduler).toContain("Each current-day heartbeat owns a deterministic, sequential lane");
	    expect(scheduler).toContain("index % CURRENT_DAY_WORKER_COUNT === shard");
	    expect(scheduler).toContain("pause the legacy tasks without deleting their audit trail");
	  });

		  it("не выдает close_date за source-watermark и перекрывает только последние два часа current-day", () => {
		    const completedOnly = __operationalEvotorSyncTestUtils.currentDayEvotorWindowStartFromWatermarks({
		      businessDate: "2026-09-20",
		      lastCompletedAt: "2026-09-20T13:01:00.000+0300",
		    });
		    expect(completedOnly.toISOString()).toBe("2026-09-20T08:01:00.000Z");
	    const source = __operationalEvotorSyncTestUtils.currentDayEvotorWindowStartFromWatermarks({
	      businessDate: "2026-09-20",
	      sourceCreatedAt: "2026-09-20T00:04:00.000+0300",
	    });
	    expect(source.toISOString()).toBe("2026-09-19T21:00:00.000Z");
	    const sourceWinsOverLocalReadTime = __operationalEvotorSyncTestUtils.currentDayEvotorWindowStartFromWatermarks({
	      businessDate: "2026-09-20",
	      sourceCreatedAt: "2026-09-20T10:00:00.000+0300",
	      lastCompletedAt: "2026-09-20T15:00:00.000+0300",
	    });
	    expect(sourceWinsOverLocalReadTime.toISOString()).toBe("2026-09-20T05:00:00.000Z");
	    expect(registry).toContain("`close_date` remains intentionally excluded");
	    expect(registry).toContain("always wins over the later local callback time");
	    expect(registry).toContain("External IDs make overlap rows");
	    expect(registry).not.toContain("latestAt + 1");
	  });

	  it("дает Ритму только безопасный агрегированный статус current-day обхода", () => {
	    expect(registry).toContain("export async function getOperationalEvotorSyncStatus()");
	    expect(registry).toContain("function summarizeOperationalEvotorSyncCycle");
	    expect(registry).toContain('type EvotorSyncTerminalState = "pending" | "running" | "completed" | "failed"');
	    expect(registry).toContain("OPERATIONAL_EVOTOR_CURRENT_DAY_WORKERS = 4");
		    expect(registry).toContain("OPERATIONAL_EVOTOR_CURRENT_DAY_SLA_MINUTES = 2");
		    expect(registry).toContain('const completed = !page.nextCursor;');
		    expect(registry).toContain('cursor: page.nextCursor');
		    expect(registry).toContain("a high-volume point must");
	    expect(registry).toContain("inserts a previously unseen external document ID only");
		    expect(registry).toContain("hydratedPaymentDocuments += 1");
		    expect(registry).toContain("syncMode === \"current_day\"");
		    expect(registry).toContain("pageSlaMinutes: 1");
	    expect(registry).toContain("terminalDurationMinutes");
	    expect(registry).toContain("retentionStart: EVOTOR_DOCUMENT_RETENTION_START");
	  });

	  it("восстанавливает UID уже существующей platform-задачи по стабильному имени", () => {
	    expect(scheduler).toContain('listHeartbeatJobs("", { page: 1, pageSize: 200 })');
	    expect(scheduler).toContain("const platformJobByName = new Map(platformJobs.jobs.map(job => [job.name, job]));");
	    expect(scheduler).toContain("const recovered = platformJobByName.get(definition.name);");
		    expect(scheduler).toContain("const scheduleChanged = platformJob?.cronExpression !== definition.cron || platformJob?.callbackPath !== definition.path || platformJob?.description !== definition.description;");
	    expect(scheduler).toContain("...(scheduleChanged ? { cron: definition.cron, path: definition.path, method: \"POST\", payload: {}, description: definition.description } : {})");
	    expect(scheduler).toContain("async function updateHeartbeatJobWithRetry");
	    expect(scheduler).toContain("attempt * 250");
	    expect(scheduler).toContain('const message = scheduledErrorMessage(error, "Не удалось обновить расписание Эвотор.");');
	    expect(scheduler).toContain('if (existing) await db.update(operationalScheduledSyncJobs).set({ lastError: message })');
	  });

		  it("сохраняет terminal ошибку страницы и не перезапускает завершенный архив без новой точки", () => {
	    expect(registry).toContain("export async function failOperationalEvotorDocumentSync");
	    expect(scheduler).toContain("await failOperationalEvotorDocumentSync");
	    expect(scheduler).toContain("The archive cycle is terminal once every mapped point has completed or");
	    expect(scheduler).toContain("const unstarted = storeIds.filter(storeId => !latestArchiveByStore.has(storeId));");
	    expect(scheduler).toContain("await setJobState(job.id, { completed: true, error: null });");
	  });

	  it("агрегирует terminal completed, failed, running и pending без подмены предыдущей попыткой", () => {
	    const at = (minute: number) => new Date(`2026-09-20T00:${String(minute).padStart(2, "0")}:00.000Z`);
	    const completed = __operationalEvotorSyncTestUtils.summarizeOperationalEvotorSyncCycle([1, 2], [
	      { storeId: 1, status: "completed", startedAt: at(1), completedAt: at(3) },
	      { storeId: 2, status: "completed", startedAt: at(2), completedAt: at(4) },
	    ]);
	    expect(completed).toMatchObject({ terminalState: "completed", completedStores: 2, terminalDurationMinutes: 3 });
	    const failed = __operationalEvotorSyncTestUtils.summarizeOperationalEvotorSyncCycle([1], [
	      { storeId: 1, status: "failed", startedAt: at(1), completedAt: at(3) },
	    ]);
	    expect(failed).toMatchObject({ terminalState: "failed", failedStores: 1, terminalDurationMinutes: 2 });
		    const running = __operationalEvotorSyncTestUtils.summarizeOperationalEvotorSyncCycle([1, 2], [
		      { storeId: 1, status: "completed", startedAt: at(1), completedAt: at(2) },
		      { storeId: 2, status: "running", startedAt: at(3), completedAt: null },
		    ]);
		    expect(running).toMatchObject({ terminalState: "running", runningStores: 1, terminalDurationMinutes: null });
		    const refreshed = __operationalEvotorSyncTestUtils.summarizeOperationalEvotorSyncCycle([1, 2], [
		      { storeId: 1, status: "completed", startedAt: at(1), completedAt: at(2) },
		      { storeId: 2, status: "completed", startedAt: at(2), completedAt: at(3) },
		      { storeId: 1, status: "completed", startedAt: at(10), completedAt: at(11) },
		      { storeId: 2, status: "completed", startedAt: at(10), completedAt: at(12) },
		    ]);
		    expect(refreshed).toMatchObject({ terminalState: "completed", firstStartedAt: at(10), terminalDurationMinutes: 2 });
		    expect(__operationalEvotorSyncTestUtils.summarizeOperationalEvotorSyncCycle([1], [])).toMatchObject({ terminalState: "pending", startedStores: 0 });
		  });

  it("фиксирует только числовые сведения о квоте без реквизитов запроса", () => {
    expect(client).toContain('numberHeader("X-RateLimit-Limit")');
    expect(client).toContain('numberHeader("X-RateLimit-Remaining")');
    expect(scheduler).toContain("rateLimit = result.rateLimit");
    expect(scheduler).toContain("rateLimit, importWindow: targets[0]?.mode");
    expect(client).not.toContain("Authorization: token");
  });

  it("проверяет операционные дедлайны идемпотентно внутри уже существующего минутного callback", () => {
    expect(scheduler).toContain("evaluateOperationalStoreSignals()");
    expect(signals).toContain("request_missing:");
    expect(signals).toContain("revenue_missing:");
    expect(signals).toContain("20 * 60 + 5");
    expect(signals).toContain("21 * 60 + 5");
    expect(signals).toContain("eq(stores.isHidden, false)");
    expect(signals).toContain("entityType: \"operational_signal\"");
    expect(signals).toContain("createOperationalSignalNotifications");
    expect(signals).not.toContain("createStoreEventNotifications");
    expect(signals).toContain("resolveOperationalSignalNotifications");
    expect(signals).toContain("request_missing:${storeId}:${businessDate}");
    expect(signals).toContain("revenue_missing:${storeId}:${businessDate}");
    expect(signals).not.toContain("plan_fact_revenue:");
    expect(signals).toContain("evaluateCurrentEvotorRevenuePlanMilestones");
  });

	  it("проверяет возвраты из каждой current-day lane и не привязывает freshness к архивному cursor", () => {
	    expect(scheduler).toContain("evaluateCurrentDayEvotorFreshnessAndReturnSignals");
	    expect(scheduler).toContain('kind === "evotor_documents"');
	    expect(scheduler).toContain('kind === ACTIVE_CURRENT_DAY_JOB_KINDS[0]');
	    expect(scheduler).toContain("after its bounded intake");
	    expect(scheduler).toContain("preserving the live lane's bounded execution budget");
	    expect(scheduler).toContain(": evaluateCurrentDayEvotorReturnSignals();");
	    expect(scheduler.indexOf("syncOperationalEvotorDocumentPage")).toBeLessThan(scheduler.lastIndexOf("const signals = await evaluateSignalsAfterIntake();"));
	    expect(scheduler).not.toContain('kind === "evotor_documents" ? await evaluateOperationalStoreSignals() : null');
	  });

  it("контролирует избыточное покрытие только по подтвержденному остатку и продажам за семь дней", () => {
    expect(registry).toContain("export async function listOperationalExcessStockCoverage");
    expect(registry).toContain("Evotor quantity snapshot plus immutable movements");
    expect(registry).toContain("subtractMoscowBusinessDays(businessDate, 6)");
    expect(registry).toContain('eq(operationalEvotorDocuments.documentType, "SELL")');
    expect(registry).toContain("maxStoreCoverDays ?? 2");
    expect(signals).toContain("overstock_cover:${store.id}:${businessDate}");
    expect(signals).toContain("createStockCoverSignalNotifications");
    expect(signals).toContain("resolveOperationalSignalNotifications([key])");
  });

  it("дает отдельные сигналы свежести чеков и снимка остатка, не принимая тихую продажу за сбой", () => {
    expect(__operationalSignalTestUtils.freshnessSeverity(10, 10)).toBeNull();
    expect(__operationalSignalTestUtils.freshnessSeverity(11, 10)).toBe("warning");
    expect(__operationalSignalTestUtils.freshnessSeverity(21, 10)).toBe("critical");
    expect(__operationalSignalTestUtils.freshnessSeverity(null, 10)).toBe("critical");
    expect(signals).toContain("evotor_receipt_freshness:");
    expect(signals).toContain("evotor_stock_freshness:");
    expect(signals).toContain("RECEIPT_FRESHNESS_MINUTES = 10");
    expect(signals).toContain("STOCK_SNAPSHOT_FRESHNESS_MINUTES = 20");
    expect(signals).toContain("Продажи не оцениваются как нулевые");
    expect(signals).toContain("createDataFreshnessSignalNotifications");
    expect(signals).toContain("eq(operationalEvotorDocumentSyncs.syncMode, \"current_day\")");
  });

  it("выполняет контроль явно переданных 1С-сроков один раз в день без замены неизвестного срока", () => {
    expect(signals).toContain("listOperationalExpiryFindings");
    expect(signals).toContain("minutes === 9 * 60 + 5");
    expect(signals).toContain("lookbackDays: 14, alertDays: 7");
    expect(signals).toContain("createExpirySignalNotifications");
    expect(signals).toContain("createWarehouseExpirySignalNotifications");
    expect(signals).toContain("expiry_shipment:");
    expect(signals).toContain("expiry_warehouse:");
  });
});
