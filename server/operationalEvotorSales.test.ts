import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { __evotorSalesTestUtils, EVOTOR_DOCUMENT_RETENTION_START } from "./inventoryRegistry";

const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("./inventoryRegistry.ts", import.meta.url), "utf8");

describe("read-only показатели продаж Эвотор", () => {
	it("группирует документ по московскому календарю и часу дня", () => {
	  expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "hour")).toMatchObject({ key: "03", label: "03:00 МСК" });
    expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "day")).toMatchObject({ key: "2026-09-18", label: "18.09.2026" });
    expect(__evotorSalesTestUtils.evotorSalesInterval("2026-09-18T00:30:00.000Z", "week")).toMatchObject({ key: "2026-38", label: "Нед. 38 · 2026" });
    expect(__evotorSalesTestUtils.evotorMoscowBoundary("2026-09-01", "start")).toBe("2026-08-31T21:00:00.000+0000");
    expect(__evotorSalesTestUtils.evotorMoscowBoundary("2026-09-01", "end")).toBe("2026-09-01T20:59:59.999+0000");
  });

  it("доступен только администратору, принимает только календарный диапазон и не обращается к Эвотор", () => {
    expect(router).toContain("evotorSalesAnalytics");
    expect(router).toContain('actor.role !== "admin"');
    expect(router).toContain('granularity: z.enum(["month", "week", "day", "hour"])');
    expect(router).toContain('if (input.from > input.to)');
    expect(service).toContain("listOperationalEvotorSalesAnalytics");
    expect(service).toContain("operationalEvotorDocuments");
    expect(service).toContain("operationalEvotorDocumentPositions");
    expect(service).toContain("This does\n * not query Evotor");
  });

	  it("позволяет KPI и прогнозу не загружать товарные позиции", () => {
	    expect(router).toContain("includeProducts: z.boolean().optional()");
	    expect(service).toContain("input.includeProducts !== false");
	  });

	  it("кеширует только повторный read-only агрегат на короткий интервал", () => {
	    expect(router).toContain("const EVOTOR_SALES_ANALYTICS_CACHE_TTL_MS = 20_000");
	    expect(router).toContain("evotorSalesAnalyticsCacheKey");
	    expect(router).toContain("cachedOperationalEvotorSalesAnalytics(input)");
	    expect(router).toContain("actor.role !== \"admin\"");
	  });

	it("выдает read-only остатки Эвотор отдельно от денежных остатков и не смешивает единицы", () => {
	  expect(router).toContain("evotorStockSnapshot");
	  expect(router).toContain("Остатки Эвотор доступны только администратору.");
	  expect(service).toContain("getOperationalEvotorStockSnapshot");
		  expect(service).toContain("adding kilograms,\n * liters and pieces would produce a fictitious balance");
		  expect(service).toContain(".groupBy(operationalCatalogProducts.baseUnit)");
		  expect(service).toContain('row.unit === "fraction" || row.unit === "l" || row.unit === "piece"');
		  expect(service).toContain("including 1,000,000,\n  // is an actual physical balance");
		  expect(service).toContain("const quantityConditions = [...commonConditions, isNotNull(operationalEvotorProductLinks.evotorQuantitySnapshot)]");
		  expect(service).not.toContain('lt(operationalEvotorProductLinks.evotorQuantitySnapshot, "1000000")');
		});

		it("собирает недельную, дневную и месячную витрину в БД без передачи всех чеков в Node", () => {
		  expect(service).toContain('input.includeProducts === false && (input.granularity === "month" || input.granularity === "week" || input.granularity === "day")');
		  expect(service).toContain("DATE_ADD(STR_TO_DATE");
		  expect(service).toContain("const moscowPeriod = input.granularity === \"month\"");
		  expect(service).toContain("DATE_FORMAT(${moscowOccurredAt}, '%x-%v')");
		  expect(service).toContain("DATE_FORMAT(${moscowOccurredAt}, '%Y-%m-%d')");
		  expect(service).toContain(".groupBy(operationalEvotorDocuments.storeId, moscowPeriod)");
		  expect(service).toContain("900k+ rows reach Node");
		});

	it("собирает часовой профиль Эвотор в БД по МСК, а не рендерит тысячи дата-часов", () => {
	  expect(service).toContain('input.includeProducts === false && input.granularity === "hour"');
	  expect(service).toContain("const moscowHour =");
	  expect(service).toContain("':00 МСК'");
	  expect(service).toContain(".groupBy(operationalEvotorDocuments.storeId, moscowHour, moscowHourLabel)");
	});

	it("возвращает измеримый server-side отклик без записи технических данных", () => {
    expect(service).toContain("const startedAt = performance.now()");
    expect(service).toContain("serviceMs: Math.max(0, Math.round(performance.now() - startedAt))");
    expect(service).toContain("productsIncluded: input.includeProducts !== false");
    expect(service).toContain("performance: performanceSnapshot(documents.length, positions.length)");
  });

  it("не принимает в нормализованную витрину чеки до 2025 года", () => {
    expect(EVOTOR_DOCUMENT_RETENTION_START).toBe("2025-01-01");
    expect(service).toContain("filter(isRetainedEvotorDocument)");
    expect(service).toContain("businessDate >= EVOTOR_DOCUMENT_RETENTION_START");
    expect(service).toContain("input.from < EVOTOR_DOCUMENT_RETENTION_START");
  });

	  it("отбирает только чеки продажи, оплаты и временной ряд товаров по магазинам", () => {
    expect(service).toContain('eq(operationalEvotorDocuments.documentType, "SELL")');
    expect(service).toContain("cashAmount: operationalEvotorDocuments.cashAmount");
    expect(service).toContain("cashlessAmount: operationalEvotorDocuments.cashlessAmount");
    expect(service).toContain("paymentCaptureStatus: operationalEvotorDocuments.paymentCaptureStatus");
    expect(service).toContain("const paymentCapture = { complete: 0, unavailable: 0, unreconciled: 0, malformed: 0 }");
    expect(service).toContain("productTimelineMap");
    expect(service).toContain("productTimeline: Array.from(productTimelineMap.values())");
    expect(service).toContain("storeId: document.storeId");
    expect(service).toContain("storeName: document.storeName");
    expect(service).toContain("${document.intervalKey}\\u0000${document.storeId}\\u0000${key}");
    expect(service).toContain("productKey: key");
    expect(service).toContain("const quantitiesByUnit = new Map");
    expect(service).toContain("quantitiesByUnit: Array.from(quantitiesByUnit.values())");
    expect(service).toContain("const linkedUnitByStoreProduct = new Map");
    expect(service).toContain("const unit = position.unit ?? (position.evotorProductId ? linkedUnitByStoreProduct.get");
	    expect(service).toContain("paymentCapture,");
	    expect(service).toContain("paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashAmount}");
	    expect(service).toContain("paymentCaptureStatus} = 'complete' THEN COALESCE(${operationalEvotorDocuments.cashlessAmount}");
	    expect(service).toContain('if (document.paymentCaptureStatus === "complete")');
	    expect(service).not.toContain('summary: { checks, amount: Math.round(amount * 100) / 100, positions:');
	  });

	  it("агрегирует крупную товарную витрину в базе до передачи в браузер", () => {
	    expect(service).toContain("Product analytics can cover tens of thousands of document rows");
	    expect(service).toContain("const [documentRows, positionRows] = await Promise.all");
	    expect(service).toContain("lineCount: sql<number>`COUNT(*)`");
	    expect(service).toContain("performance: performanceSnapshot(checks, productLineCount)");
	  });

	  it("считает возвраты отдельным read-only агрегатом и не включает их в продажи", () => {
	    expect(service).toContain("const returnDocumentFilter = and(");
	    expect(service).toContain('inArray(operationalEvotorDocuments.documentType, ["PAYBACK", "RETURN", "SELL_RETURN"])');
	    expect(service).toContain("returnAmount: sql<string>`COALESCE(SUM(ABS(${operationalEvotorDocuments.total})), 0)`");
	    expect(service).toContain("returns, returnAmount");
	    expect(service).toContain('eq(operationalEvotorDocuments.documentType, "SELL")');
	  });
});
