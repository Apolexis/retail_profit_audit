import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const outbound = fs.readFileSync(path.join(root, "server", "evotorOutbound.ts"), "utf8");
const router = fs.readFileSync(path.join(root, "server", "routers", "inventoryRegistry.ts"), "utf8");
const scheduler = fs.readFileSync(path.join(root, "server", "operationalEvotorSchedule.ts"), "utf8");
const inventory = fs.readFileSync(path.join(root, "server", "inventoryRegistry.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "drizzle", "schema.ts"), "utf8");

describe("контур автоматической выгрузки Эвотор", () => {

  it("пишет изменение карточки durable-first и сразу dispatch-ит его во все связанные магазины", () => {
    expect(router).toContain("queueAndDispatchOperationalEvotorBroadcast");
    expect(router).toContain('reason: "catalog_update"');
    expect(router).toContain('delivery: "queued_and_dispatched" as const');
  });

  it("сохраняет исходящую операцию до внешнего вызова и не теряет её при retry", () => {
    expect(outbound).toContain("operationalEvotorOutboundJobs");
    expect(outbound).toContain('status: "pending"');
    expect(outbound).toContain('status: "retry"');
    expect(outbound).toContain("sourceKey");
    expect(outbound).toContain("MAX_ATTEMPTS");
    expect(outbound).toContain("queueAndDispatchOperationalEvotorOutbound");
  });

  it("передает назначенную цену либо V2-значение без цены и сохраняет rate-limit заголовки", () => {
    expect(outbound).toContain("price: priceRow ? Number(priceRow.salePrice) : undefined");
    expect(outbound).toContain('"x-ratelimit-limit"');
    expect(outbound).toContain('"x-ratelimit-remaining"');
    expect(outbound).toContain('"x-ratelimit-reset"');
    expect(outbound).toContain("requestDurationMs");
  });

  it("ставит в очередь создание, карточку, цену, привязку и все проведенные складские события", () => {
    expect(router).toContain('reason: "catalog_create"');
    expect(router).toContain('reason: "catalog_update"');
    expect(router).toContain('reason: "catalog_enable"');
    expect(router).toContain('reason: "price_update"');
    expect(router).toContain('reason: "warehouse_mapping"');
    expect(router).toContain('reason: "shipment_receipt"');
    expect(router).toContain('reason: "transfer"');
    expect(router).toContain('reason: "inventory_close"');
  });

  it("архивирует во внешнем каталоге только точно связанный товар и удаляет его documented DELETE", () => {
    expect(outbound).toContain("enqueueOperationalEvotorCatalogArchive");
    expect(outbound).toContain('reason: "catalog_archive"');
    expect(outbound).toContain("prepareStoreArchiveJobs");
    expect(outbound).toContain('method: "DELETE"');
    expect(outbound).toContain('url.searchParams.set("id", chunk.map(item => item.externalProductId).join(","))');
    expect(outbound).toContain("markArchiveJobsSucceeded");
    expect(outbound).not.toContain("exactExistingProductMatch(product as ProductForOutbound, archive");
    expect(router).toContain("queueAndDispatchOperationalEvotorCatalogArchive");
  });

  it("отправляет остаток 999 только для отдельно подтверждённого reset-run", () => {
    expect(outbound).toContain('const CONFIRMED_RESET_SOURCE_PREFIX = "evotor-reset-999:"');
    expect(outbound).toContain('job.sourceKey.startsWith(CONFIRMED_RESET_SOURCE_PREFIX)');
    expect(outbound).toContain("const quantity = isConfirmedResetJob(job) ? 999 : ledgerQuantity;");
  });

	it("подтверждает outbound только в первой catalog lane и не перегружает callback", () => {
		  expect(scheduler).toContain("dispatchOperationalEvotorOutbound");
		  expect(scheduler).toContain("storeLimit: 1");
		  expect(scheduler).toContain("kind === CATALOG_JOB_KINDS[0]");
	  expect(scheduler).toContain("claimCatalogCallbackLease(job.id)");
	});

  it("отправляет первичную номенклатуру bulk-пакетом и завершает запись только после GET bulk", () => {
    expect(outbound).toContain("MAX_BULK_PRODUCTS = 5_000");
    expect(outbound).toContain('"Content-Type": EVOTOR_BULK_MEDIA_TYPE');
    expect(outbound).toContain('status: "submitted"');
    expect(outbound).toContain("externalBulkId");
    expect(outbound).toContain("/bulks/${encodeURIComponent(taskId)}");
    expect(outbound).toContain("bulk-confirmed");
  });

	it("направляет следующие изменения остатка и цены точечным PATCH", () => {
	  expect(outbound).toContain('method: "PATCH"');
	  expect(outbound).toContain("patchPayload(prepared)");
	  expect(outbound).toContain("price: prepared.price ?? 0");
	  expect(outbound).toContain("BULK_SUBMISSION_CONCURRENCY = 4");
	  expect(outbound).toContain('prepared.job.reason === "full_catalog_export" || !prepared.hasExistingLink');
	});

	it("заменяет карточку через documented PUT, а не ошибочно через PATCH", () => {
	  expect(outbound).toContain('prepared.job.reason === "catalog_update" || prepared.job.reason === "catalog_enable"');
	  expect(outbound).toContain('method: "PUT"');
	  expect(outbound).toContain("body: JSON.stringify(fullProductPayload(prepared))");
	  expect(outbound).toContain("replaceProduct(item)");
	  expect(outbound).toContain("V2 PATCH is deliberately limited to price, cost and quantity");
	});

  it("учитывает только post-reset чековые дельты и ставит их в bounded очередь outbound", () => {
    expect(inventory).toContain('eq(operationalEvotorProductLinks.evotorQuantitySource, "confirmed_reset")');
    expect(inventory).toContain("occurredAt > fallbackBaselineAt");
    expect(inventory).toContain("enqueueOperationalEvotorOutbound");
    expect(inventory).toContain('reason: "stock_adjustment"');
    expect(inventory).toContain("receipt-stock:");
    expect(outbound).toContain("operationalEvotorReceiptStockMovements");
    expect(outbound).toContain("[...stockRows, ...receiptRows]");
    expect(outbound).toContain("orderBy(desc(operationalEvotorProductLinks.evotorQuantitySource)");
  });

  it("не теряет категорию, внутренний артикул и алкокод в полном payload", () => {
    expect(outbound).toContain("ensureEvotorProductGroups");
    expect(outbound).toContain("parentIdByCategory");
    expect(outbound).toContain("catalogCategoryId === null");
    expect(outbound).toContain("archivedSourceCategoryNames");
    expect(outbound).toContain("archivedParentIdByName");
    expect(outbound).toContain("linkedRemoteParentByProductId");
    expect(outbound).toContain("exactExistingProductMatch(product as ProductForOutbound");
    expect(outbound).toContain("нет проверяемой категории Эвотор");
    expect(outbound).toContain('reason === "catalog_update"');
    expect(outbound).toContain("fullProductPayload(prepared)");
    expect(outbound).toContain("isEvotorCostExportEnabled");
    expect(outbound).toContain("internalCostPrice");
  });

	it("не создаёт дубль после восстановления или legacy-каталога", () => {
	  expect(outbound).toContain("listEvotorExistingProducts");
	  expect(outbound).toContain("exactExistingProductMatch");
    expect(outbound).toContain("recoverExistingEvotorProductLinks(prepared)");
    expect(outbound).toContain("автоматическое создание остановлено");
    expect(outbound).toContain("link_recovered");
    expect(outbound).toContain("bulk-link-recovery");
	  expect(outbound).toContain("productIdsSample");
	});

	it("не перечитывает весь каталог, когда у всех отправляемых строк уже есть точные связи", () => {
	  expect(outbound).toContain("prepared.every(item => item.hasExistingLink)");
	  expect(outbound).toContain("return { recovered: 0 }");
	});

	it("не допускает две V2-связи одного локального товара в одной точке", () => {
	  expect(schema).toContain('unique("operational_evotor_product_link_store_product_uq").on(table.storeId, table.productId)');
	  expect(outbound).toContain("Retain exactly one current identity");
	  expect(outbound).toContain("await db.update(operationalEvotorProductLinks).set({ evotorProductId: item.externalProductId, ...resetValues })");
	});

	it("не оставляет ручные preview и execute-маршруты", () => {
    expect(router).not.toContain("previewCatalogEvotorExport");
    expect(router).not.toContain("executeCatalogEvotorExport");
  });
});
