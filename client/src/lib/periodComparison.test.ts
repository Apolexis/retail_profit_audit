import { describe, expect, it } from "vitest";
import { previousComparableRange, previousSeriesKey, reverseComparableRows } from "./periodComparison";

describe("сопоставление аналогичного периода", () => {
  it("выбирает непосредственно предшествующий диапазон той же длины", () => {
    expect(previousComparableRange({ from: "2026-09-01", to: "2026-09-07" })).toEqual({ from: "2026-08-25", to: "2026-08-31" });
    expect(previousComparableRange({ from: "2026-03-01", to: "2026-03-01" })).toEqual({ from: "2026-02-28", to: "2026-02-28" });
  });

  it("выравнивает предыдущий ряд в обратном направлении без перестановки активного периода", () => {
    const active = [{ day: "01" }, { day: "02" }, { day: "03" }];
    const previous = [{ day: "29" }, { day: "30" }, { day: "31" }];
    expect(reverseComparableRows(active, previous)).toEqual([
      { active: { day: "01" }, previous: { day: "31" } },
      { active: { day: "02" }, previous: { day: "30" } },
      { active: { day: "03" }, previous: { day: "29" } },
    ]);
    expect(previousSeriesKey("netProfit")).toBe("previous:netProfit");
  });
});
