import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DecimalInputNormalizerBootstrap.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("единая нормализация дробного ввода", () => {
  it("подключена на уровне приложения и слушает все decimal/number inputs", () => {
    expect(app).toContain('import { DecimalInputNormalizerBootstrap } from "@/components/DecimalInputNormalizerBootstrap";');
    expect(app).toContain("<DecimalInputNormalizerBootstrap />");
    expect(source).toContain('element.inputMode === "decimal" || element.type === "number" || element.dataset.decimalInput === "true"');
    expect(source).toContain('document.addEventListener("input", normalize, true)');
    expect(source).toContain('document.addEventListener("change", normalize, true)');
  });

  it("заменяет запятую на точку до реакции конкретного поля и сохраняет каретку", () => {
    expect(source).toContain("normalizeDecimalInputText(input.value)");
    expect(source).toContain("normalizeDecimalInputText(prefix).length");
    expect(source).toContain("input.setSelectionRange(nextStart, nextEnd)");
  });
});
