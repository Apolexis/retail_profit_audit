import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./ManageData.tsx", import.meta.url), "utf8");

describe("страница «База»", () => {
  it("разделяет добавление новой строки и редактирование существующей", () => {
    expect(page).toContain('"НОВЫЙ ПОКАЗАТЕЛЬ"');
    expect(page).toContain('"РЕДАКТИРОВАНИЕ ПОКАЗАТЕЛЯ"');
    expect(page).toContain('"Добавить новый показатель"');
    expect(page).toContain("Вернуться к добавлению");
    expect(page).toContain('"Отменить смену типа" : "Изменить тип"');
    expect(page).toContain('"Подтвердить тип"');
    expect(page).toContain('changingMetricType ? "Отменить смену типа" : "Изменить тип"');
    expect(page).toContain("setChangingMetricType(value => !value)");
    expect(page).not.toContain("selectMetric(existing.metricCode");
  });

  it("не дает неявно создать дубликат и направляет к кнопке изменения строки", () => {
    expect(page).toContain("existingNewMetric");
    expect(page).toContain("Для изменения суммы откройте его кнопкой «Изменить» в таблице");
    expect(page).toContain("disabled={!storeId || update.isPending || !entryDate || Boolean(existingNewMetric)}");
  });

  it("удерживает действия смены типа на общей высоте без лишнего нижнего отступа", () => {
    const css = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
    expect(css).toContain(".metric-type-actions > button { display: inline-flex; align-items: center; justify-content: center; height: 40px");
    expect(css).toContain(".metric-rename-action { align-self: end; min-height: 40px; height: 40px; margin: 0 !important; }");
    expect(css).not.toContain(".metric-rename-action { align-self: end; min-height: 40px; margin-bottom: 29px; }");
  });

  it("дает списку видимости магазинов сортировку по названию и статусу", () => {
    expect(page).toContain('const [storeListSort, setStoreListSort]');
    expect(page).toContain("const sortedStoreList = useMemo");
    expect(page).toContain("По названию А—Я");
    expect(page).toContain("Сначала в анализе");
    expect(page).toContain("Сначала скрытые");
    expect(page).toContain("{sortedStoreList.map(item");
  });
});
