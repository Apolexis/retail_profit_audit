import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { __onecImportTestUtils } from "./onecImport";

const service = readFileSync(resolve(import.meta.dirname, "onecImport.ts"), "utf8");
const router = readFileSync(resolve(import.meta.dirname, "routers/inventoryRegistry.ts"), "utf8");
const schema = readFileSync(resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
const registryPage = readFileSync(resolve(import.meta.dirname, "../client/src/pages/OnecImportRegistry.tsx"), "utf8");
const serverRoot = resolve(import.meta.dirname);
const stockMovementWriterFiles = (readdirSync(serverRoot, { recursive: true }) as string[])
  .filter(file => file.endsWith(".ts") && !file.endsWith(".test.ts"))
  .filter(file => readFileSync(resolve(serverRoot, file), "utf8").includes(".insert(operationalStockMovements).values"))
  .sort();

describe("изолированный реестр 1С", () => {
  it("принимает только два основных склада и московский часовой пояс", () => {
    expect(__onecImportTestUtils.warehouseCode(" bm ")).toBe("BM");
    expect(__onecImportTestUtils.onecWarehouseCodes.has("BM")).toBe(true);
    expect(__onecImportTestUtils.onecWarehouseCodes.has("SRS")).toBe(true);
    expect(__onecImportTestUtils.onecWarehouseCodes.has("STORE_1")).toBe(false);
  });

  it("требует полный snapshot для остатков и delta для накладных и закупочных цен", () => {
    const base = { schema_version: "1.0", source_system: "onec", batch_id: "batch-1", generated_at: "2026-09-20T00:00:00+03:00", business_timezone: "Europe/Moscow" as const, records: [{}] };
    expect(() => __onecImportTestUtils.assertBasePackage({ ...base, entity: "inventory_snapshots", mode: "delta" })).toThrow("полным срезом");
    expect(() => __onecImportTestUtils.assertBasePackage({ ...base, entity: "store_shipments", mode: "snapshot" })).toThrow("изменениями");
    expect(() => __onecImportTestUtils.assertBasePackage({ ...base, entity: "purchase_costs", mode: "snapshot" })).toThrow("изменениями");
  });

  it("принимает отдельный реестр закупочных цен, но не принимает УПД или маркировку", () => {
    expect(service).toContain('entity: "inventory_snapshots" | "store_shipments" | "purchase_costs"');
    expect(service).toContain("operationalOnecPurchaseCosts");
    expect(service).toContain("applyOnecPurchaseCostToCatalog");
    expect(service).toContain("never picks BM over SRS");
    expect(router).toContain("onecPurchaseCosts: protectedProcedure");
    expect(router).toContain("applyOnecPurchaseCost: protectedProcedure");
    expect(router).toContain("isEvotorCostExportEnabled");
    expect(service).not.toContain("УПД");
    expect(service).not.toContain("marking");
    expect(registryPage).toContain('purchase_costs: "Закупочные цены"');
    expect(registryPage).toContain("ЗАКУПОЧНЫЕ ЦЕНЫ 1С");
    expect(registryPage).toContain("Отдельный реестр до явного применения");
    expect(registryPage).not.toContain("УПД");
    expect(registryPage).not.toContain("маркировк");
  });

  it("принимает только явно переданный ISO-срок партии и не подменяет отсутствие сроком", () => {
    expect(__onecImportTestUtils.normalizedExpirationDate("2026-10-03", "срок")).toBe("2026-10-03");
    expect(__onecImportTestUtils.normalizedExpirationDate(null, "срок")).toBeNull();
    expect(() => __onecImportTestUtils.normalizedExpirationDate("03.10.2026", "срок")).toThrow("ГГГГ-ММ-ДД");
    expect(__onecImportTestUtils.daysUntilExpiration("2026-09-20", "2026-09-20")).toBe(0);
    expect(__onecImportTestUtils.daysUntilExpiration("2026-09-19", "2026-09-20")).toBe(-1);
    expect(__onecImportTestUtils.subtractCalendarDays("2026-09-20", 13)).toBe("2026-09-07");
    expect(service).toContain("listOperationalExpiryFindings");
    expect(service).toContain("latest full BM/SRS snapshot only");
    expect(router).toContain("expiration_date: dateInput.nullable().optional()");
    expect(schema).toContain('expirationDate: varchar("expirationDate", { length: 10 })');
  });

  it("не вызывает внешние системы и отделяет приём пакета от проведения приёмки", () => {
    expect(service).toContain("operationalOnecWarehouseSnapshots");
    expect(service).toContain("operationalOnecStoreShipments");
    expect(service).toContain("applyConfirmedShipmentReceipt");
    expect(service).toContain("confirmed_shipment_receipt_movement");
    expect(service).not.toContain("fetch(");
    expect(service).not.toContain("axios");
  });

  it("не применяет закупочную цену автоматически и сохраняет ее в истории товара", () => {
    expect(service).toContain("applyOnecPurchaseCostToCatalog");
    expect(service).toContain("appliedToCatalogAt");
    expect(service).toContain("Единица закупочной цены 1С не совпадает");
    expect(router).toContain("Применять закупочную цену 1С может только администратор.");
    expect(router).toContain('action: "operational_onec.purchase_cost.apply"');
    expect(router).toContain('reason: "catalog_update"');
  });

  it("создаёт движения магазинов только из учётных операций, перемещений или подтверждённой приёмки", () => {
    expect(stockMovementWriterFiles).toEqual(["inventoryRegistry.ts", "onecImport.ts", "stockTransfers.ts"]);
    expect(schema).toContain('mysqlEnum("kind", ["first_count", "inventory_adjustment", "manual_adjustment", "transfer_out", "transfer_in", "shipment_receipt"])');
    expect(schema).not.toContain('"onec_import"');
    expect(service).toContain("Latest mapped 1С snapshot by BM/SRS, deliberately separate from shop accounting balances.");
    expect(service).toContain('kind: "shipment_receipt" as const');
    expect(service).toContain("shipmentReceiptLineId: line.shipmentLineId");
  });

  it("оставляет несопоставленные строки в карантине и использует явное сопоставление", () => {
    expect(service).toContain('mappingState: productId ? "mapped" as const : "quarantined" as const');
    expect(service).toContain("resolveOnecQuarantineProduct");
    expect(service).toContain("resolveOnecShipmentDestination");
    expect(router).toContain("source id not logged");
  });

  it("защищает прием пакетов и сопоставление ролью администратора", () => {
    expect(router).toContain("importOnecPackage: protectedProcedure");
    expect(router).toContain("Принимать пакет 1С может только администратор.");
    expect(router).toContain("resolveOnecQuarantineProduct: protectedProcedure");
    expect(router).toContain("recordChange({ actorId: actor.id, action: \"operational_onec.import\"");
  });
});
