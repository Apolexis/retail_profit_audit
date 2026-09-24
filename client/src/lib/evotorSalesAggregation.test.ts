import { describe, expect, it } from "vitest";
import { buildSelectedProductStoreTimeline, buildSelectedProductTimeline, type ProductTimelineRow } from "./evotorSalesAggregation";

const rows: ProductTimelineRow[] = [
  { key: "2026-09-01", label: "1 сентября", storeId: 1, storeName: "А1", productKey: "trout", productName: "Форель", unit: "fraction", amount: 1_250, quantity: 2 },
  { key: "2026-09-01", label: "1 сентября", storeId: 2, storeName: "А2", productKey: "trout", productName: "Форель", unit: "fraction", amount: 250, quantity: 3 },
  { key: "2026-09-01", label: "1 сентября", storeId: 1, storeName: "А1", productKey: "salmon", productName: "Семга", unit: "fraction", amount: 700, quantity: 1 },
  { key: "2026-09-02", label: "2 сентября", storeId: 2, storeName: "А2", productKey: "trout", productName: "Форель", unit: "fraction", amount: 500, quantity: 1 },
];

describe("агрегация проданных товаров Эвотор", () => {
  it("складывает одну товарную серию по всем выбранным магазинам, а не оставляет последнюю точку", () => {
    const timeline = buildSelectedProductTimeline(rows, [{ key: "trout" }], "quantity");

    expect(timeline).toEqual([
      { month: "1 сентября", sort: "2026-09-01", trout: 5 },
      { month: "2 сентября", sort: "2026-09-02", trout: 1 },
    ]);
  });

  it("суммирует денежную серию до масштабирования и заполняет нули для выбранных товаров", () => {
    const timeline = buildSelectedProductTimeline(rows, [{ key: "trout" }, { key: "salmon" }], "amount");

    expect(timeline).toEqual([
      { month: "1 сентября", sort: "2026-09-01", trout: 1.5, salmon: 0.7 },
      { month: "2 сентября", sort: "2026-09-02", trout: 0.5, salmon: 0 },
    ]);
  });

  it("сохраняет отдельные ряды магазинов для выбранного товара", () => {
    const timeline = buildSelectedProductStoreTimeline(rows, { key: "trout" }, [{ id: 1, name: "А1" }, { id: 2, name: "А2" }], "quantity");

    expect(timeline).toEqual([
      { month: "1 сентября", sort: "2026-09-01", А1: 2, А2: 3 },
      { month: "2 сентября", sort: "2026-09-02", А1: 0, А2: 1 },
    ]);
  });
});
