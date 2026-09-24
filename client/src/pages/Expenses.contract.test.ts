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

  it("строит совместную динамику и таблицу выбранных расходов на выбранной детализации", () => {
    expect(page).toContain("ДИНАМИКА РАСХОДОВ");
    expect(page).toContain('aria-label="Детализация расходов"');
    expect(page).toContain('type DetailLevel = "days" | "weeks" | "months";');
    expect(page).toContain('level === "days" ? "Дни" : level === "weeks" ? "Недели" : "Месяцы"');
    expect(page).toContain("const storeComparisonTrend");
    expect(page).toContain("const trendLines = storeComparisonTrend");
    expect(page).toContain("каждый магазин отдельно");
    expect(page).toContain("const [showStoreSeries, setShowStoreSeries] = useState(false);");
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain('active={showStoreSeries}');
    expect(page).toContain("!showStoreSeries || seriesStores.length < 2 || selectedFields.length !== 1");
  });

  it("всегда показывает состав наличных расходов по статьям", () => {
    expect(page).toContain("СОСТАВ ТРАТ НАЛ");
    expect(page).toContain("cashTrend");
    expect(page).toContain("cashLedger");
    expect(page).toContain("const cashLedgerTotal");
    expect(page).toContain('className="table-total"');
    expect(page).not.toContain("НДФЛ 22% вынесен в контрольную карточку");
  });

  it("дает таблицам динамики и полному P&L проверяемые итоги", () => {
    expect(page).toContain("const trendTableTotals");
    expect(page).toContain("const ledgerTotal");
    expect(page).toContain("Итого");
    expect(page).toContain("<tfoot>");
    expect(overrides).toContain(".packet .data-table tfoot .table-total");
  });

  it("на телефоне выводит наличные статьи и полный расходный срез карточками", () => {
    expect(page).toContain('className="expense-mobile-ledger"');
    expect(page).toContain('className="packet-card expense-ledger-card"');
    expect(overrides).toContain('.packet .expense-mobile-ledger { display: none; }');
    expect(overrides).toContain('.packet .cash-breakdown-card > .data-table-wrap,');
    expect(overrides).toContain('.packet .expense-ledger-card > .data-table-wrap { display: none; }');
  });

  it("добавляет локальный поиск в обе таблицы под графиками", () => {
    expect(page).toContain('const [trendTableQuery, setTrendTableQuery] = useState("")');
    expect(page).toContain('const [cashTableQuery, setCashTableQuery] = useState("")');
    expect(page).toContain("const trendTableRows = trendData.filter");
    expect(page).toContain("const filteredCashLedger = cashLedger.filter");
    expect(page).toContain('ariaLabel="Поиск в таблице расходов под графиком"');
    expect(page).toContain('ariaLabel="Поиск в таблице наличных расходов"');
    expect(page).toContain("trendTableRows.map");
    expect(page).toContain("filteredCashLedger.map");
  });
});
