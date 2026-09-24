import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");

describe("полный итог операционных остатков", () => {
  it("считает стоимость по полному фильтру до постраничной нарезки", () => {
    expect(service).toContain("const projectedRows = filtered.map(product => {");
    expect(service).toContain("const totalStockValue = Math.round(projectedRows.reduce");
    expect(service).toContain("valuedPositions");
    expect(service).toContain('const sort = input.sort ?? "code"');
    expect(service).toContain("const sortedRows = [...projectedRows].sort");
    expect(service).toContain("items: sortedRows.slice(offset, offset + limit)");
    expect(service).toContain("An unknown accounting value is never presented as the \"largest\" value.");
  });

	  it("сохраняет доступ к итогам внутри существующего защищенного read-only запроса", () => {
	    expect(router).toContain("stock: protectedProcedure");
    expect(router).toContain("return listOperationalStock({ ...input, storeIds");
	    expect(router).toContain('sort: z.enum(["code", "store", "product", "quantity", "value"]).optional()');
	  });

	  it("находит остаток по нескольким словам названия и по коду без изменения read-only среза", () => {
	    expect(service).toContain("const queryTokens = normalizedText(input.query ?? \"\")");
	    expect(service).toContain("return queryTokens.every(token => haystack.includes(token));");
	  });
});
