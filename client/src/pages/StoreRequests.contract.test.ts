import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./StoreRequests.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../store-requests.css", import.meta.url), "utf8");

describe("заявки магазинов: экран", () => {
  it("предлагает только точки, разрешенные текущему пользователю", () => {
    expect(page).toContain("inventoryRegistry.requestStores.useQuery");
    expect(page).toContain("const accessibleStores = stores.data ?? []");
    expect(page).not.toContain("trpc.audit.stores.useQuery");
  });

  it("использует общий справочник по раскрываемым категориям и не выводит себестоимость", () => {
    expect(page).toContain("requestProducts");
    expect(page).toContain("request-category-trigger");
    expect(page).toContain("Поиск товара");
    expect(page).toContain("request-product-row");
    expect(page).toContain("видно только администратору");
    expect(page).not.toContain("internalCostPrice");
    expect(page).not.toContain("evotorCostPrice");
  });

	it("меняет количество прямо в строке и закрывает только непустой черновик", () => {
    expect(page).toContain("upsertRequestLine");
    expect(page).toContain("removeRequestLine");
    expect(page).toContain("changeProductQuantity");
    expect(page).toContain("request-quantity-stepper");
    expect(page).toContain("addRequestManualLine");
    expect(page).toContain("!active.lines.length");
		expect(page).toContain("Готово к печати");
		expect(page).toContain("function orderSignal");
		expect(page).toContain("остаток: {stockLabel[product.stockState]}");
  });

  it("предусматривает админскую печать закрытых заявок по группам", () => {
    expect(page).toContain("printRequests");
    expect(page).toContain("printCategoryGroupIds");
    expect(page).toContain("store-request-print-sheet");
    expect(page).toContain("ПЕЧАТЬ ЗАКРЫТЫХ ЗАЯВОК");
  });
});

describe("заявки магазинов: адаптивность и печать", () => {
  it("компактно перестраивает категории и строки на средней ширине", () => {
    expect(styles).toContain("@media (max-width: 1024px)");
    expect(styles).toContain(".request-lines tbody tr");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("overflow: visible");
    expect(styles).toContain(".request-product-row{grid-template-columns:1fr;");
  });

  it("использует A4 portrait с отдельными листами для сформированной подборки", () => {
    expect(styles).toContain("@page { size: A4 portrait; margin: 12mm; }");
    expect(styles).toContain(".store-request-print { display: block !important;");
    expect(styles).toContain("break-after: page");
  });

	it("сохраняет тематическую иерархию полей и контуров", () => {
    expect(styles).toContain("--request-accent: #0a84ff");
    expect(styles).toContain("--request-accent: #ff765f");
		expect(styles).toContain(".request-history-list > article:hover");
		expect(styles).toContain("border-color:var(--request-line)");
		expect(styles).toContain("Reuse the Rhythm outline button");
	});
});
