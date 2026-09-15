import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./PriceControl.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Прайс‑контроль»", () => {
  it("использует отдельный двухэтапный импорт и не задействует финансовый импорт", () => {
    expect(page).toContain('"/api/price-import/preview"');
    expect(page).toContain('"/api/price-import/commit"');
    expect(page).toContain("Сначала проверить, затем сохранить");
    expect(page).toContain("Это отдельный импорт коммерческих предложений. Он не использует");
    expect(page).toContain("и не изменяет старую страницу импорта финансовых фактов.");
    expect(page).toContain('accept=".xls,.xlsx,.pdf,.docx');
  });

  it("разделяет контур на сравнение, импорт прайсов и справочник", () => {
    expect(page).toContain('label: "Сравнение"');
    expect(page).toContain('label: "Импорт прайсов"');
    expect(page).toContain('label: "Справочник"');
    expect(page).toContain('href: "/price-control/import"');
    expect(page).toContain('href: "/price-control/directory"');
    expect(page).toContain("Финансовая «База» и ее показатели остаются отдельными");
  });

  it("сохраняет работу с ранее импортированными файлами", () => {
    expect(page).toContain("Предпросмотр, скачивание и удаление");
    expect(page).toContain("downloadImport");
    expect(page).toContain("Удалить сохраненный прайс‑лист?");
    expect(page).toContain("ПРЕДПРОСМОТР СОХРАНЕННОГО ПРАЙСА");
  });

  it("сохраняет приоритет точной связи поставщика с внутренним товаром", () => {
    expect(page).toContain("Точная связь «поставщик → наш товар» имеет приоритет");
    expect(page).toContain("Следующие прайсы этого поставщика будут сопоставляться автоматически.");
    expect(page).toContain("Внутренний товар создан");
    expect(page).toContain("internalCode");
  });

  it("позволяет переназначить или отменить подтвержденную автосвязь без удаления прайс‑листа", () => {
    expect(page).toContain("ПОДТВЕРЖДЕННЫЕ АВТОСВЯЗИ");
    expect(page).toContain("Переназначить");
    expect(page).toContain("Отменить автосвязь");
    expect(page).toContain("reassignAlias");
    expect(page).toContain("unlinkAlias");
  });

  it("показывает нормализованную цену, исходную фасовку и обоснованного победителя", () => {
    expect(page).toContain("ГДЕ ВЫГОДНЕЕ КУПИТЬ");
    expect(page).toContain("Нормализация");
    expect(page).toContain("ВЫГОДНЕЕ КУПИТЬ");
    expect(page).toContain("экономия");
    expect(page).toContain("ResponsiveContainer");
  });

  it("добавляет категории, независимые фильтры, редактирование и историю цен", () => {
    expect(page).toContain("Категория");
    expect(page).toContain("Все поставщики");
    expect(page).toContain("Фильтры применяются одновременно");
    expect(page).toContain("Данные не меняются.");
    expect(page).toContain("ИСТОРИЯ ЦЕН");
    expect(page).toContain("updateProduct");
    expect(page).toContain("updateSupplier");
    expect(page).toContain("updateOffer");
    expect(styles).toContain(".packet .price-section-nav");
    expect(styles).toContain(".packet .price-history-chart");
  });

  it("показывает изменение цены относительно предыдущего предложения", () => {
    expect(page).toContain("PriceChangeBadge");
    expect(page).toContain("Подорожало");
    expect(page).toContain("Подешевело");
    expect(page).toContain("Новая цена");
    expect(page).toContain("Нормализация и изменение");
    expect(styles).toContain("--price-change-up");
    expect(styles).toContain("--price-change-down");
  });

  it("использует разные тематические акценты: iOS‑синий в светлой и коралловый в темной", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet { --price-accent: #0a72d5');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet { --price-accent: #ff856d');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .price-product-choice.active');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .price-product-choice.active');
  });
});
