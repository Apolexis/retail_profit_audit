import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const service = readFileSync(resolve(import.meta.dirname, "stockTransfers.ts"), "utf8");
const router = readFileSync(resolve(import.meta.dirname, "routers/inventoryRegistry.ts"), "utf8");
const schema = readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");

describe("перемещения остатков", () => {
	  it("хранит черновик отдельно от неизменяемого журнала движения", () => {
	    expect(schema).toContain('operational_stock_transfers');
	    expect(schema).toContain('transferNumber: int("transferNumber").notNull().unique()');
	    expect(schema).toContain('operational_stock_transfer_lines');
	    expect(schema).toContain('"draft", "posted"');
	    expect(schema).toContain('"transfer_out", "transfer_in"');
	  });

  it("проводит расход и приход одной транзакцией", () => {
    expect(service).toContain("return db.transaction(async tx => {");
    expect(service).toContain('kind: "transfer_out"');
    expect(service).toContain('kind: "transfer_in"');
    expect(router).toContain("pairedMovementCount");
  });

	  it("не разрешает одинаковые точки и перемещение сверх подтвержденного остатка", () => {
	    expect(service).toContain("Склад-отправитель и склад-получатель должны различаться");
	    expect(service).toContain("больше подтвержденного остатка");
	    expect(service).toContain("подтвержденного остатка на складе-отправителе");
	  });

	  it("выдает компактный последовательный номер документа отдельно от технического id", () => {
	    expect(service).toContain("nextOperationalStockTransferNumber");
	    expect(service).toContain("orderBy(desc(operationalStockTransfers.transferNumber))");
	    expect(service).toContain("transferNumber: await nextOperationalStockTransferNumber()");
	    expect(service).toContain("isTransferNumberConflict");
	    expect(service).toContain("for (let attempt = 0; attempt < 3");
	    expect(service).toContain("transferNumber: row.transferNumber");
	  });

	  it("оставляет рекомендации только read-only и на семидневной продаже", () => {
    expect(service).toContain("getOperationalStockTransferRecommendation");
    expect(service).toContain("weeklySold / 7");
    expect(service).toContain('eq(operationalEvotorDocuments.documentType, "SELL")');
  });

	  it("дает доступ лишь руководителю и администратору с доступом к обеим точкам", () => {
	    expect(router).toContain("stockTransferWithPermission");
    expect(router).toContain("Перемещения доступны руководителю или администратору");
    expect(router).toContain("detail.sourceStoreId");
	    expect(router).toContain("detail.destinationStoreId");
	  });

  it("фильтрует историю по включительному периоду до ограничения списка и сохраняет права обеих точек", () => {
    expect(router).toContain("from: dateInput.optional(), to: dateInput.optional()");
    expect(router).toContain("Начало периода не может быть позже конца.");
    expect(service).toContain("gte(operationalStockTransfers.businessDate, from)");
    expect(service).toContain("lte(operationalStockTransfers.businessDate, to)");
    expect(service).toContain("inArray(operationalStockTransfers.sourceStoreId, input.storeIds)");
    expect(service).toContain("inArray(operationalStockTransfers.destinationStoreId, input.storeIds)");
  });

	  it("разрешает удалить только draft с backend-проверкой прав и записью аудита", () => {
	    expect(service).toContain("deleteOperationalStockTransferDraft");
	    expect(service).toContain("Проведенное перемещение нельзя удалить.");
	    expect(router).toContain("deleteStockTransferDraft");
	    expect(router).toContain('action: "stock_transfer.draft.delete"');
	    expect(router).toContain('afterState: { deleted: true, lineCount: result.lines.length }');
	  });

  it("исправляет проведенное перемещение отдельным сторно без удаления исходного журнала", () => {
    expect(schema).toContain('reversalOfTransferId: int("reversalOfTransferId").unique()');
    expect(schema).toContain('"draft", "posted", "reversed"');
    expect(service).toContain("createOperationalStockTransferReversal");
    expect(service).toContain("Сторно перемещения №");
    expect(service).toContain('status: "reversed"');
    expect(router).toContain("createStockTransferReversal");
    expect(router).toContain('action: "stock_transfer.reversal.create"');
    expect(router).toContain('"stock_transfer.reversal.post"');
  });
});
