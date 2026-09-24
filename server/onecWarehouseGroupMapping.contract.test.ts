import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/OnecImportRegistry.tsx", import.meta.url), "utf8");

describe("связь источников 1С с группами получателей рекомендаций", () => {
  it("хранит явный, а не подразумеваемый mapping БМ/СРС", () => {
    expect(schema).toContain('mysqlTable("operational_onec_warehouse_group_mappings"');
    expect(schema).toContain('unique("operational_onec_warehouse_group_uq").on(table.warehouseCode)');
    expect(service).toContain("const supportedOnecWarehouseCodes = new Set([\"BM\", \"SRS\"])");
    expect(service).toContain("Для связи доступны только склады 1С БМ и СРС.");
    expect(service).toContain("db.delete(operationalOnecWarehouseGroupMappings)");
  });

  it("ограничивает изменение административной ролью и показывает его в рабочем контексте импорта 1С", () => {
    expect(router).toContain("onecWarehouseGroupMappings: protectedProcedure.query");
    expect(router).toContain("setOnecWarehouseGroupMapping: protectedProcedure.input");
    expect(router).toContain('action: "operational_onec_warehouse_group.assign"');
    expect(page).toContain("НАСТРОЙКА РЕКОМЕНДАЦИЙ");
    expect(page).toContain("Источники БМ и СРС");
    expect(page).toContain("Это не настройка печати");
    expect(page).toContain("setOnecWarehouseGroup.mutate");
  });
});
