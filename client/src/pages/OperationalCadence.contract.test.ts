import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./OperationalCadence.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Ритм»", () => {
  it("дает выбрать несколько показателей и сохраняет хотя бы один", () => {
    expect(page).toContain("Показатели для сравнения");
    expect(page).toContain("без лимита; минимум один");
    expect(page).toContain("current.length === 1 ? current");
    expect(page).toContain("selectedMetrics.map(metric");
  });

  it("встраивает read-only факты чеков Эвотор в ту же группу выручки", () => {
    expect(page).toContain('evotorAmount: { label: "Выручка общая Эвотор"');
    expect(page).toContain('evotorCash: { label: "Выручка нал Эвотор"');
    expect(page).toContain('evotorCashless: { label: "Выручка б/нал Эвотор"');
    expect(page).toContain('evotorChecks: { label: "Чеки Эвотор"');
    expect(page).toContain('evotorAverage: { label: "Средний чек Эвотор"');
    expect(page).toContain("current.cashAmount += Number(row.cashAmount ?? 0)");
    expect(page).toContain("current.cashlessAmount += Number(row.cashlessAmount ?? 0)");
  });

  it("добавляет компактную детализацию по месяцам, неделям и дням", () => {
    expect(page).toContain('aria-label="Детализация ритма"');
    expect(page).toContain('"Дни" : level === "week" ? "Недели" : "Месяцы"');
    expect(page).toContain("cadence.monthly");
  });

  it("дает выбрать магазины без лимита и показывает полную таблицу под графиком", () => {
    expect(page).toContain("Магазины для суммарного среза");
    expect(page).toContain("ДАННЫЕ ПОД ГРАФИКОМ");
    expect(page).toContain("каждый магазин отдельно");
    expect(page).toContain("const [showStoreSeries, setShowStoreSeries] = useState(false);");
    expect(page).toContain("!showStoreSeries || seriesStores.length < 2 || selectedMetrics.length !== 1");
    expect(page).toContain("StoreSeriesModeToggle");
    expect(page).toContain('active={showStoreSeries}');
    expect(page).toContain("const chartTableTotals");
    expect(page).toContain('<tfoot><tr className="table-total"><th scope="row">Итого</th>');
  });

  it("выделяет наличные расходы и НДФЛ 22% в понятную группу", () => {
    expect(page).toContain("Наличные расходы и налоги");
    expect(page).toContain('expenses: { label: "Общие расходы"');
    expect(page).toContain('{ label: "Итоговые расходы", keys: ["expenses", "cashExpenses", "cashlessExpenses"] }');
    expect(page).toContain('{ label: "Наличные расходы и налоги", keys: ["cashTaxes", "household"');
    expect(page).toContain("cash-control-group");
    expect(page).not.toContain("нал + НДФЛ 22%");
    expect(page).toContain("cadence-group-label");
  });

  it("показывает состав всех исходных расходных статей при выборе показателя «Расходы»", () => {
    expect(page).toContain("expenseBreakdownMetrics");
    expect(page).toContain('selectedMetrics.includes("expenses")');
    expect(page).toContain("СОСТАВ РАСХОДОВ");
    expect(page).toContain("без двойного учета агрегатов");
    expect(page).toContain('className="expense-breakdown-note"');
    expect(page).toContain("const expenseBreakdownLedger");
    expect(page).toContain("const expenseBreakdownTotal");
    expect(page).toContain("Исходная статья");
    expect(styles).toContain(".packet .expense-breakdown-card .expense-breakdown-note {");
    expect(styles).toContain("text-wrap: pretty;");
    expect(styles).toContain("background: transparent !important;");
  });

  it("показывает общие безналичные траты и их исходный состав", () => {
    expect(page).toContain('cashlessExpenses: { label: "Общие траты б/нал"');
    expect(page).toContain("cashlessBreakdownMetrics");
    expect(page).toContain('selectedMetrics.includes("cashlessExpenses")');
    expect(page).toContain("СОСТАВ ТРАТ Б/НАЛ");
  });

  it("использует согласованные краткие подписи без изменения кодов расходных статей", () => {
    expect(page).toContain('driverCashless: { label: "Водитель б/нал"');
    expect(page).toContain('utilitiesCashless: { label: "Коммуналка б/нал"');
    expect(page).toContain('bankFee: { label: "% банку"');
    expect(page).toContain('salaryCashless: { label: "Зарплата б/нал"');
    expect(page).toContain('payrollTax: { label: "Налоги зарплатные"');
    expect(page).toContain('vacationCashless: { label: "Отпускные б/нал"');
    expect(page).toContain('vacationTax: { label: "Налоги на отпускные"');
  });

  it("разделяет безналичные расходы и ФОТ на две плоские группы без потери выбора статей", () => {
    expect(page).toContain('{ label: "Безналичные", keys: ["cashlessOperatingCosts", "driverCashless", "utilitiesCashless", "rent", "bankFee", "grossProfitTax"] }');
    expect(page).toContain('{ label: "ФОТ и налоги", keys: ["salaryCashless", "payrollTax", "vacationCashless", "vacationTax", "salaryCash", "vacationCash"] }');
    expect(page).not.toContain('label: "Безналичные, ФОТ и налоги"');
  });

  it("использует для группы наличных расходов обычный цвет заголовков в обеих темах", () => {
    expect(styles).toContain(".packet .cadence-group-label > span { color: var(--faint);");
    expect(styles).not.toContain(".cash-control-group .cadence-group-label > span { color:");
  });

  it("показывает последние интервалы карточками с отдельными значениями", () => {
    expect(page).toContain("cadence-interval-card");
    expect(page).toContain("cadence-interval-values");
  });

  it("не добавляет пустые нулевые интервалы в график, таблицу и последние карточки", () => {
    expect(page).toContain("const visibleSource = mergedSource.filter(point => selectedMetrics.some(metric => point[metric] !== 0));");
    expect(page).toContain("const data = visibleSource.map(point");
    expect(page).toContain("const perStoreData = useMemo");
    expect(page).toContain("const intervalRows = [...visibleSource].slice(-8).reverse();");
    expect(page).toContain("chartLines.map(line => <th");
  });
});
