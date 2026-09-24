import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");

describe("заявки магазинов: серверный контракт", () => {
  it("отдает селектор склада только в пределах назначенного доступа", () => {
    expect(router).toContain("requestStores: protectedProcedure.query");
    expect(router).toContain("listOperationalStoreRequestStores({ storeIds })");
    expect(service).toContain("listOperationalStoreRequestStores");
    expect(service).toContain("eq(stores.isHidden, false)");
  });

  it("скрывает неактивные и невидимые товары от магазина, оставляя администратору контроль", () => {
    expect(service).toContain("eq(operationalCatalogProducts.isVisibleInRequests, true)");
    expect(service).toContain("input.includeHidden ? undefined");
    expect(service).toContain("!product.isVisibleInRequests && !input.allowHidden");
    expect(router).toContain("includeHidden: actor.role === \"admin\"");
  });

  it("не меняет закрытую заявку и хранит снимок строки", () => {
    expect(service).toContain("Закрытую заявку нельзя изменять");
    expect(service).toContain("catalogNumber: product.catalogNumber");
    expect(service).toContain("productName: product.canonicalName");
    expect(service).toContain("catalogCategoryId: product.catalogCategoryId");
    expect(service).toContain("categoryName: product.managedCategoryName ?? product.evotorCategoryName");
    expect(service).toContain("status: \"closed\"");
  });

	it("сохраняет редактируемые строки и два комментария открытой заявки одной транзакцией", () => {
	  expect(service).toContain("export async function saveOperationalStoreRequestDraft");
	  expect(service).toContain("return db.transaction(async tx => {");
	  expect(service).toContain("Передайте оба комментария открытой заявки.");
    expect(service).toContain("retainedManualLines");
    expect(router).toContain("saveRequestDraft: protectedProcedure");
    expect(router).toContain('action: "store_request.draft.save"');
	  expect(router).toContain('saveMode: "single-transaction"');
	});

  it("переносит дату только у открытой заявки, оставляя продавцу дату неизменной", () => {
    expect(service).toContain("businessDate?: string;");
    expect(service).toContain("const businessDate = input.businessDate === undefined ? request.businessDate : validateInventoryDate(input.businessDate);");
    expect(service).toContain("set({ businessDate, updatedAt: new Date() })");
    expect(router).toContain("businessDate: dateInput.optional()");
    expect(router).toContain("Продавец не может переносить дату открытой заявки.");
    expect(router).toContain("businessDate: result.after.businessDate");
  });

	it("не проводит заявки, их строки или закрытие в движения остатка", () => {
	  const requestOperations = [
	    "createOperationalStoreRequest",
	    "upsertOperationalStoreRequestLine",
	    "saveOperationalStoreRequestDraft",
	    "closeOperationalStoreRequest",
	    "closeOperationalStoreRequestsForPrint",
	    "deleteOperationalStoreRequestDraft",
	    "deleteOperationalStoreRequest",
	  ].map(name => {
	    const start = service.indexOf(`export async function ${name}`);
	    const end = service.indexOf("\nexport ", start + 1);
	    return service.slice(start, end === -1 ? undefined : end);
	  }).join("\n");
	  expect(requestOperations).not.toContain("operationalStockMovements");
	  expect(requestOperations).not.toContain("shipmentReceiptLineId");
	  expect(requestOperations).not.toContain("postOperationalStockTransfer");
	});

  it("строит печать из сохраненных и закрытых заявок, исключая скрытые магазины", () => {
    expect(service).toContain('inArray(operationalStoreRequests.status, ["draft", "closed"])');
    expect(service).toContain("eq(stores.isHidden, false)");
    expect(service).toContain("categoryReferencesByGroup");
    expect(service).toContain("storeIds?: number[] | null");
    expect(service).toContain("const fallbackStoreGroup = { id: \"fallback-store-group\", name: \"Без группы магазинов\" }");
    expect(service).toContain("const fallbackCategoryGroup = { id: \"fallback-category-group\", name: \"Не распределено\"");
	  expect(service).toContain("const categoriesForLine");
	  expect(service).toContain("const matchedGroups = categoryGroups.filter");
    expect(service).toContain("stockIndicator: { supplyGroupName:");
    expect(service).toContain("maxStoreCoverDays: categoryGroup.maxStoreCoverDays");
    expect(service).toContain("getOperationalStoreRequestPrintProjection(input: { from: string;");
    expect(service).toContain("gte(operationalStoreRequests.businessDate, from)");
    expect(service).toContain("lte(operationalStoreRequests.businessDate, to)");
    expect(service).toContain("const visibleStoreById = new Map(visibleStores.map(store => [store.id, store]))");
    expect(service).toContain("if (Number(line.requestedQuantity) <= 0) continue;");
    expect(service).toContain("const printableLines = sheets.flatMap(sheet => sheet.stores.flatMap(store => store.lines));");
    expect(service).toContain("const printableRequestCount = new Set(printableLines.map(line => line.requestNumber)).size;");
    expect(service).toContain("printableLineCount: printableLines.length");
    expect(router).toContain("printRequests: protectedProcedure.input(z.object({ from: dateInput, to: dateInput");
    expect(router).toContain("Дата начала печати не может быть позже даты окончания.");
  });

  it("не оставляет audit печати при нулевой фактической подборке", () => {
    expect(router).toContain("if (!projection.printableLineCount) return projection;");
    expect(router).toContain("printableRequestCount: projection.printableRequestCount");
    expect(router).toContain("printableLineCount: projection.printableLineCount");
  });

	it("не создаёт лист только из пустого комментария и печатает вложенную категорию отдельным листом", () => {
    expect(service).toContain("if (!comment.text.trim().length) continue;");
    expect(service).toContain("if (store.lines.length) store.comments.push");
	  expect(service).toContain("return matchedGroups.length ? matchedGroups : [fallbackCategoryGroup]");
	  expect(service).toContain("for (const categoryGroup of categoriesForLine(line))");
  });

  it("разрешает печать только административному персоналу и в пределах его магазинов", () => {
    expect(router).toContain('actor.role !== "admin" && actor.role !== "manager"');
    expect(router).toContain('const storeIds = actor.role === "admin" ? null : await getAccessibleStoreIds(ctx.user.openId)');
    expect(router).toContain('getOperationalStoreRequestPrintProjection({ ...input, storeIds })');
    expect(router).toContain("Группы печати доступны только руководителю или администратору.");
  });

  it("закрывает перед печатью все непустые черновики видимых точек выбранного дня", () => {
    expect(service).toContain("closeOperationalStoreRequestsForPrint");
    expect(service).toContain("countOperationalStoreRequestPrintCandidates");
    expect(service).toContain('eq(operationalStoreRequests.status, "draft")');
    expect(service).toContain("eq(stores.isHidden, false)");
    expect(router).toContain("closeRequestsForPrint: protectedProcedure");
    expect(router).toContain("requestPrintCandidates: protectedProcedure");
    expect(router).toContain('action: "store_request.close_for_print"');
  });

  it("дает руководителю или администратору удалить закрытую заявку с ее строками и комментариями", () => {
    expect(service).toContain("export async function deleteOperationalStoreRequest(requestId: number)");
    expect(service).toContain("tx.delete(operationalStoreRequestComments)");
    expect(service).toContain("tx.delete(operationalStoreRequestLines)");
    expect(router).toContain("deleteRequest: protectedProcedure");
    expect(router).toContain('actor.role !== "admin" && actor.role !== "manager"');
    expect(router).toContain('action: "store_request.delete"');
  });

  it("скрывает закрытую заявку без удаления снимка и исключает ее из истории и печати", () => {
    expect(service).toContain("export async function setOperationalStoreRequestHidden");
    expect(service).toContain("Скрыть можно только закрытую заявку.");
    expect(service).toContain("eq(operationalStoreRequests.isHidden, false)");
    expect(router).toContain("setRequestHidden: protectedProcedure");
    expect(router).toContain('action: "store_request.visibility.set"');
    expect(router).toContain("hidden requests are excluded from default history and print projections");
  });

  it("фиксирует каждую постоянную операцию существующим audit", () => {
    for (const action of ["store_request.create", "store_request.draft.save", "store_request.line.upsert", "store_request.line.remove", "store_request.close", "store_request.close_for_print", "store_request.draft.delete", "store_request.delete", "store_request.visibility.set", "store_request.print"]) {
      expect(router).toContain(action);
    }
    expect(router).toContain("recordChange");
  });

  it("не содержит внешней записи в Эвотор", () => {
    expect(service).not.toMatch(/(?:POST|PUT|PATCH|DELETE)\s+https?:\/\/[^\n]*evotor/i);
  });

  it("соблюдает настраиваемую норму свежего запаса по категории", () => {
    expect(service).toContain("maxStoreCoverDays");
    expect(service).toContain("operationalOnecWarehouseGroupMappings");
    expect(service).toContain("supplySourceLabel: supplyPrintGroupId && supplyQuantity !== null ? \"остаток 1С по последнему срезу\" : null");
    expect(service).toContain("storeQuantity: quantity ?? null");
    expect(service).toContain("requestFactsByStoreProduct");
    expect(service).toContain("recommendedQuantity: product.recommendedQuantity");
    expect(service).toContain("Норму запаса задайте целым числом от 1 до 14 дней.");
    expect(router).toContain("maxStoreCoverDays: z.number().int().min(1).max(14)");
  });
});
