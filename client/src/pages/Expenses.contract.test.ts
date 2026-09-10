import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Expenses.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Расходы»", () => {
  it("дает выбрать несколько магазинов и расходных статей", () => {
    expect(page).toContain("useState(false)");
    expect(page).toContain("togglePickers");
    expect(page).toContain('aria-expanded={pickersOpen}');
    expect(page).toContain('pickersOpen ? "свернуть оба выбора" : "выбрать магазины и статьи"');
    expect(page).not.toContain("MAX_SELECTED_EXPENSES");
    expect(page).not.toContain("MAX_SELECTED_STORES");
    expect(page).toContain("Магазины расходного среза");
    expect(page).toContain("Статьи на графике");
  });

  it("строит совместную помесячную динамику и таблицу выбранных расходов", () => {
    expect(page).toContain("ДИНАМИКА РАСХОДОВ");
    expect(page).toContain("Расходы выбранных магазинов по месяцам");
    expect(page).toContain("selectedFields.map(field");
  });

  it("всегда показывает состав наличных расходов по статьям", () => {
    expect(page).toContain("СОСТАВ ТРАТ НАЛ");
    expect(page).toContain("cashTrend");
    expect(page).toContain("cashLedger");
    expect(page).not.toContain("НДФЛ 22% вынесен в контрольную карточку");
  });

  it("на телефоне выводит наличные статьи и полный расходный срез карточками", () => {
    expect(page).toContain('className="expense-mobile-ledger"');
    expect(page).toContain('className="packet-card expense-ledger-card"');
    expect(overrides).toContain('.packet .expense-mobile-ledger { display: none; }');
    expect(overrides).toContain('.packet .cash-breakdown-card > .data-table-wrap,');
    expect(overrides).toContain('.packet .expense-ledger-card > .data-table-wrap { display: none; }');
  });
});
