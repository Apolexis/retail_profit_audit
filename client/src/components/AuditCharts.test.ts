import { describe, expect, it } from "vitest";
import { formatK, sortTooltipPayload } from "./AuditCharts";

describe("форматирование денежных показателей", () => {
  it("не скрывает малые ненулевые суммы округлением до нуля", () => {
    expect(formatK(0.4)).toBe("0,4 тыс. ₽");
    expect(formatK(65.2)).toBe("65,2 тыс. ₽");
  });
  it("показывает крупные значения в миллионах", () => {
    expect(formatK(1540)).toBe("1,5 млн ₽");
  });
  it("сортирует значения тултипа по убыванию, включая отрицательные", () => {
    expect(sortTooltipPayload([{ name: "C", value: -5 }, { name: "A", value: 120 }, { name: "B", value: 40 }]).map(item => item.name)).toEqual(["A", "B", "C"]);
  });
});
