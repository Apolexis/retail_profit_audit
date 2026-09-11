import { describe, expect, it } from "vitest";
import { shouldFitPdfSummaryOnOnePage } from "./WeeklyReports";

describe("верстка PDF регулярного отчета",()=>{
  it("умещает короткую сводку до 12% выше рабочей высоты на одну страницу",()=>{
    expect(shouldFitPdfSummaryOnOnePage(279,277)).toBe(true);
    expect(shouldFitPdfSummaryOnOnePage(310,277)).toBe(true);
    expect(shouldFitPdfSummaryOnOnePage(311,277)).toBe(false);
  });
});
