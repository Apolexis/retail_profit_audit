import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const registry = readFileSync(resolve(import.meta.dirname, "inventoryRegistry.ts"), "utf8");
const router = readFileSync(resolve(import.meta.dirname, "routers/inventoryRegistry.ts"), "utf8");

describe("видимость операционного склада", () => {
  it("изменяется только явной admin-only мутацией с журналированием", () => {
    expect(registry).toContain("export async function setOperationalWarehouseVisibility");
    expect(registry).toContain("await db.update(stores).set({ isHidden: input.isHidden })");
    expect(router).toContain("setWarehouseVisibility:");
    expect(router).toContain("Менять видимость склада может только администратор.");
    expect(router).toContain('action: "operational_warehouse.visibility"');
    expect(router).toContain("виден в рабочих списках");
  });
});
