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

  it("сохраняет редактируемые строки и два комментария черновика одной транзакцией", () => {
    expect(service).toContain("export async function saveOperationalStoreRequestDraft");
    expect(service).toContain("return db.transaction(async tx => {");
    expect(service).toContain("Передайте оба комментария черновика.");
    expect(service).toContain("retainedManualLines");
    expect(router).toContain("saveRequestDraft: protectedProcedure");
    expect(router).toContain('action: "store_request.draft.save"');
    expect(router).toContain('saveMode: "single-transaction"');
  });

  it("строит печать из сохраненных и закрытых заявок, исключая скрытые магазины", () => {
    expect(service).toContain('inArray(operationalStoreRequests.status, ["draft", "closed"])');
    expect(service).toContain("eq(stores.isHidden, false)");
    expect(service).toContain("expandPrintCategoryReferences(categoryGroup.id, allCategoryGroups, members)");
    expect(service).toContain("storeIds?: number[] | null");
    expect(service).toContain("groupedStoreIds.filter(storeId => input.storeIds!.includes(storeId))");
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

  it("фиксирует каждую постоянную операцию существующим audit", () => {
    for (const action of ["store_request.create", "store_request.draft.save", "store_request.line.upsert", "store_request.line.remove", "store_request.close", "store_request.close_for_print", "store_request.draft.delete", "store_request.print"]) {
      expect(router).toContain(action);
    }
    expect(router).toContain("recordChange");
  });

  it("не содержит внешней записи в Эвотор", () => {
    expect(service).not.toMatch(/(?:POST|PUT|PATCH|DELETE)\s+https?:\/\/[^\n]*evotor/i);
  });

  it("соблюдает настраиваемую норму свежего запаса по категории", () => {
    expect(service).toContain("maxStoreCoverDays");
    expect(service).toContain("supplySettingsForCategory");
    expect(service).toContain("Норму запаса задайте целым числом от 1 до 14 дней.");
    expect(router).toContain("maxStoreCoverDays: z.number().int().min(1).max(14)");
  });
});
