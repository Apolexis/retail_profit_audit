import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const registry = fs.readFileSync(path.join(root, "server", "inventoryRegistry.ts"), "utf8");
const router = fs.readFileSync(path.join(root, "server", "routers", "inventoryRegistry.ts"), "utf8");

describe("архивный статус и выгрузка номенклатуры Эвотор", () => {
  it("не возвращает вручную архивированный товар в работу при следующем read-only импорте", () => {
    expect(registry).toContain("isActive: operationalCatalogProducts.isActive");
    expect(registry).toContain('isActive: existing?.metadataSource === "manual" ? existing.isActive : true');
    expect(registry).toContain("silently return an archived manual product to active work lists");
  });

	it("dispatch-ит создание, изменения и восстановление включенной номенклатуры", () => {
	  expect(router).toContain('reason: "catalog_create"');
	  expect(router).toContain('reason: "catalog_update"');
	  expect(router).toContain('reason: "catalog_enable"');
	  expect(router).toContain("queueAndDispatchOperationalEvotorBroadcast");
	  expect(router).toContain('delivery: "queued_and_dispatched" as const');
	});

	it("аудитирует отдельный флаг закупочной цены вместе с постановкой обновления карточки", () => {
	  expect(router).toContain("isEvotorCostExportEnabled: result.before.isEvotorCostExportEnabled");
	  expect(router).toContain("isEvotorCostExportEnabled: result.after.isEvotorCostExportEnabled");
	  expect(router).toContain("internalCostPrice: result.after.internalCostPrice");
	});

	it("разрешает безвозвратное удаление только архивной позиции без операционной истории", () => {
	  expect(registry).toContain("permanentlyDeleteUnusedOperationalCatalogProduct");
	  expect(registry).toContain("if (product.isActive) throw new Error");
	  expect(registry).toContain("operationalEvotorOutboundJobs");
	  expect(registry).toContain("operationalStockMovements");
	  expect(router).toContain("permanentlyDeleteCatalogProduct");
	  expect(router).toContain('action: "operational_catalog.permanent_delete"');
	});
});
