import { describe, expect, it } from "vitest";
import {
  REVENUE_COMMENT_REQUIRED_EXPENSE_FIELDS,
  REVENUE_AMOUNT_FIELDS,
  calculateOperationalRevenueTotal,
  emptyRevenueAmounts,
  isRevenueExpenseCommentRequired,
  validateRevenueEntry,
} from "./revenueRegistry";

describe("операционный реестр Выручка", () => {
  it("считает итог только из согласованных двенадцати полей", () => {
    const amounts = emptyRevenueAmounts();
    amounts.cash = 5_000;
    amounts.cashless = 10_000;
    amounts.deliveryCash = 750;
    expect(REVENUE_AMOUNT_FIELDS).toHaveLength(12);
    expect(calculateOperationalRevenueTotal(amounts)).toBe(15_750);
  });

  it("сохраняет комментарии только к ненулевым расходам", () => {
    const amounts = emptyRevenueAmounts();
    amounts.cashExpenses = 200;
    const entry = validateRevenueEntry({ ...amounts, expenseComments: { cashExpenses: "  Мелкие  расходы   на  рынке ", deliveryCash: "Черновик" } });
    expect(entry.expenseComments).toEqual({ cashExpenses: "Мелкие расходы на рынке" });
  });

  it("не требует и не создает поля комментария для зарплаты, премии, отпуска и коммунальных платежей", () => {
    const amounts = emptyRevenueAmounts();
    amounts.salaryCash = 5_000;
    amounts.bonusCash = 2_000;
    amounts.vacationCash = 1_500;
    amounts.utilitiesCash = 800;
    expect(validateRevenueEntry({ ...amounts, expenseComments: {} }).expenseComments).toEqual({});
    expect(REVENUE_COMMENT_REQUIRED_EXPENSE_FIELDS).not.toEqual(expect.arrayContaining(["salaryCash", "bonusCash", "vacationCash", "utilitiesCash"]));
    expect(isRevenueExpenseCommentRequired("salaryCash")).toBe(false);
    expect(isRevenueExpenseCommentRequired("utilitiesCash")).toBe(false);
  });

  it("не принимает расход без пояснения, отрицательные суммы и третью дробную часть", () => {
    const noComment = emptyRevenueAmounts();
    noComment.cleaningCash = 300;
    expect(() => validateRevenueEntry({ ...noComment, expenseComments: {} })).toThrow("Уборка нал");

    const negative = emptyRevenueAmounts();
    negative.cash = -1;
    expect(() => validateRevenueEntry({ ...negative, expenseComments: {} })).toThrow("неотрицательную");

    const fraction = emptyRevenueAmounts();
    fraction.cash = 1.111;
    expect(() => validateRevenueEntry({ ...fraction, expenseComments: {} })).toThrow("не более двух");
  });
});
