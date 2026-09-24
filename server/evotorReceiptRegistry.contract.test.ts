import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const normalizer = readFileSync(new URL("./evotorCatalog.ts", import.meta.url), "utf8");

describe("read-only реестр чеков Эвотор", () => {
  it("сохраняет только безопасный номер чека и агрегат скидки", () => {
    expect(schema).toContain('receiptNumber: varchar("receiptNumber", { length: 64 })');
    expect(schema).toContain('discountAmount: decimal("discountAmount", { precision: 18, scale: 2 })');
    expect(schema).toContain('cashTenderedAmount: decimal("cashTenderedAmount", { precision: 18, scale: 2 })');
    expect(schema).toContain('cashChangeAmount: decimal("cashChangeAmount", { precision: 18, scale: 2 })');
    expect(normalizer).toContain("function receiptNumber");
    expect(normalizer).toContain("receipt_number");
    expect(normalizer).toContain("discount_amount");
    expect(normalizer).not.toContain("fiscalSign");
  });

  it("ограничивает список 30 документами, 2025 годом и скрытыми магазинами", () => {
    expect(service).toContain("listOperationalEvotorReceipts");
    expect(service).toContain("Math.min(Math.max(input.limit ?? 30, 1), 30)");
    expect(service).toContain("EVOTOR_DOCUMENT_RETENTION_START");
    expect(service).toContain('eq(stores.isHidden, false)');
    expect(service).toContain('inArray(operationalEvotorDocuments.documentType, ["SELL", "PAYBACK", "RETURN", "SELL_RETURN"])');
    expect(service).toContain("documentCount: sql<number>`count(*)`");
    expect(service).toContain(".groupBy(operationalEvotorDocuments.documentType, operationalEvotorDocuments.paymentCaptureStatus)");
  });

  it("добавляет точное сопоставление суммы без подмены отсутствующего total нулем", () => {
    expect(service).toContain("const exactAmount");
    expect(service).toContain("eq(operationalEvotorDocuments.total, exactAmount)");
    expect(service).toContain("total: row.total === null ? null : Number(row.total)");
    expect(service).toContain("total: document.total === null ? null : Number(document.total)");
  });

  it("ищет время в отображаемой зоне МСК и возвращает безопасную постраничную очередь", () => {
    expect(service).toContain("const moscowTimeSearch");
    expect(service).toContain("convert_tz");
    expect(service).toContain("const occurredAtMoscowTime");
    expect(service).toContain("limit(pageLimit + 1).offset(offset)");
    expect(service).toContain("page: { offset, limit: pageLimit, hasMore");
    expect(service).toContain("storeCoverage:");
    expect(router).toContain("offset: z.number().int().min(0).max(10_000).optional()");
  });

  it("не раскрывает внешний id, фискальные или терминальные поля в detail", () => {
    const detailStart = service.indexOf("export async function getOperationalEvotorReceiptDetail");
    const detailBody = service.slice(detailStart, detailStart + 4_000);
    expect(detailBody).not.toContain("evotorDocumentId:");
    expect(detailBody).not.toContain("terminal");
    expect(detailBody).not.toContain("fiscal");
    expect(detailBody).toContain("operationalEvotorDocumentPositions");
    expect(detailBody).toContain("cashTenderedAmount");
    expect(detailBody).toContain("cashChangeAmount");
  });

  it("гидратирует безопасные агрегаты только в current-day перекрытии", () => {
    expect(service).toContain('syncMode === "current_day"');
    expect(service).toContain("paymentHydrationDocuments");
    expect(service).toContain('existing.paymentCaptureStatus !== "complete"');
    expect(service).toContain("storedPaymentSummary");
  });

  it("допускает только ограниченное read-only уточнение ранее несверенных ID", () => {
    expect(service).toContain("reconcileOperationalEvotorPaymentFacts");
    expect(service).toContain('eq(operationalEvotorDocuments.paymentCaptureStatus, "unreconciled")');
    expect(service).toContain("getEvotorDocumentPreviewForOperationalStore");
    expect(service).toContain("Math.min(Math.max(input.limit ?? 100, 1), 100)");
    expect(normalizer).toContain("/stores/${encodedStoreId}/documents/${encodedDocumentId}");
    expect(router).toContain("reconcileEvotorPayments: protectedProcedure");
    expect(router).toContain('action: "evotor_payment.reconcile"');
    expect(router).toContain("Сверка оплат Эвотор доступна только администратору");
  });

  it("защищает список и состав ролью администратора", () => {
    expect(router).toContain("evotorReceipts");
    expect(router).toContain("evotorReceiptDetail");
    expect(router).toContain("Реестр чеков Эвотор доступен только администратору");
    expect(router).toContain("Состав чеков Эвотор доступен только администратору");
  });

  it("дает продавцу или руководителю только адресованный возврат, без открытия общего реестра", () => {
    expect(router).toContain("evotorReturnNotificationDetail");
    expect(router).toContain("hasNotificationEntityAccess(actor.id, \"operational_signal\", entityId)");
    expect(router).toContain("Нет текущего доступа к магазину этого возврата");
    expect(router).toContain('documentTypes: ["PAYBACK", "RETURN", "SELL_RETURN"]');
    expect(router).not.toContain("payments: detail.payments");
    expect(service).toContain("documentTypes?: Array<\"SELL\" | \"PAYBACK\" | \"RETURN\" | \"SELL_RETURN\">");
  });
});
