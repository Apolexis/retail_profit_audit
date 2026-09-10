import { describe, expect, it } from "vitest";
import { compareTableValues, numericTableValue, sortReadableRows } from "./tableSorting";

describe("сортировка управленческих таблиц", () => {
  it("распознает отображаемые деньги, проценты и отрицательные значения", () => {
    expect(numericTableValue("+1,25 млн ₽")).toBe(1_250_000);
    expect(numericTableValue("−42,8 тыс. ₽")).toBe(-42_800);
    expect(numericTableValue("12,5%")).toBe(12.5);
    expect(numericTableValue("нет данных")).toBeNull();
  });

  it("сортирует числа и текст предсказуемо, сохраняя порядок равных строк", () => {
    expect(sortReadableRows(["10 тыс. ₽", "−2 тыс. ₽", "3 тыс. ₽"], value => value, "asc")).toEqual(["−2 тыс. ₽", "3 тыс. ₽", "10 тыс. ₽"]);
    expect(sortReadableRows(["900 тыс. ₽", "1,2 млн ₽"], value => value, "desc")).toEqual(["1,2 млн ₽", "900 тыс. ₽"]);
    expect(sortReadableRows(["База", "Альфа", "Альфа"], value => value, "asc")).toEqual(["Альфа", "Альфа", "База"]);
    expect(compareTableValues("10", "2", "desc")).toBeLessThan(0);
  });
});
