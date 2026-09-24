import { describe, expect, it } from "vitest";
import { positionLabel, russianCountNoun } from "./russianPlural";

describe("русское склонение количеств", () => {
  it("склоняет позицию для нуля, единицы, малых чисел, подростковых окончаний и 21", () => {
    expect([0, 1, 2, 4, 5, 11, 14, 21]).toEqual([0, 1, 2, 4, 5, 11, 14, 21]);
    expect([0, 1, 2, 4, 5, 11, 14, 21].map(positionLabel)).toEqual([
      "0 позиций", "1 позиция", "2 позиции", "4 позиции", "5 позиций", "11 позиций", "14 позиций", "21 позиция",
    ]);
  });

  it("работает с другими формами", () => {
    expect(russianCountNoun(22, ["чек", "чека", "чеков"])).toBe("чека");
  });
});
