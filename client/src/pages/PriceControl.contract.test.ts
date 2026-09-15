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

  it("разделяет контур на самостоятельные маршруты без дублирующего внутреннего меню", () => {
    expect(page).toContain('label: "Сравнение"');
    expect(page).toContain('label: "Импорт прайсов"');
    expect(page).toContain('label: "Справочник"');
    expect(page).toContain('href: "/price-control/import"');
    expect(page).toContain('href: "/price-control/directory"');
    expect(page).not.toContain("PriceSectionNav");
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
    expect(styles).toContain(".packet .price-history-chart");
  });

  it("разделяет справочник на товары и категории с обязательным выбором существующей категории", () => {
    expect(page).toContain('directoryTab === "products"');
    expect(page).toContain('directoryTab === "categories"');
    expect(page).toContain("Единый список для выбора в товарах");
    expect(page).toContain("Выберите существующую категорию");
    expect(page).toContain("Выберите категорию");
    expect(page).toContain("newCategoryTargets[row.rowId]");
    expect(page).toContain("Скрыта из новых выборов");
    expect(page).toContain("Без скрытых");
    expect(page).toContain("Только скрытые");
  });

  it("дает поиск, счетчики скрытых, массовое назначение и быстрый переход из категории к товару", () => {
    expect(page).toContain("directoryProductSearch");
    expect(page).toContain("directoryCategorySearch");
    expect(page).toContain("hiddenProductsCount");
    expect(page).toContain("hiddenCategoriesCount");
    expect(page).toContain("bulkAssignCategory");
    expect(page).toContain("Назначить категорию");
    expect(page).toContain("Входит товаров:");
    expect(page).toContain("openProductEditor");
  });

  it("использует знакомую двухколоночную панель импорта и тематичные состояния полей", () => {
    expect(page).toContain("Перетащите прайс‑лист сюда");
    expect(page).toContain("Этапы импорта");
    expect(page).toContain("ТРЕБОВАНИЯ К ПРАЙСУ");
    expect(styles).toContain(".packet .price-import-workbench");
    expect(styles).toContain(".packet .price-file-drop");
    expect(styles).toContain(".packet .price-directory-tabs");
    expect(styles).toContain(".packet .price-directory :is(input, select, textarea):focus");
    expect(styles).toContain("color-scheme: dark");
    expect(styles).toContain("outline: none !important");
    expect(styles).toContain(".packet .price-summary-grid article:hover");
  });

  it("заменяет нативные селекты тематичными списками приложения", () => {
    expect(page).toContain("function PriceSelect");
    expect(page).toContain("<SelectTrigger");
    expect(page).toContain("price-select-content");
    expect(page).not.toContain("<select");
    expect(styles).toContain(".packet .price-select-trigger");
    expect(styles).toContain(".price-select-content");
  });

  it("позволяет назначить существующую категорию отдельным новым строкам либо выбранной группе до сохранения", () => {
    expect(page).toContain("previewCategoryTargets");
    expect(page).toContain("selectedPreviewRowIndexes");
    expect(page).toContain("Назначить отмеченным");
    expect(page).toContain("Оставить без категории");
    expect(page).toContain("categorySelections");
    expect(page).toContain("previewNewRowIndexes.has(index)");
    expect(styles).toContain(".packet .price-preview-categorization");
    expect(styles).toContain(".packet .price-preview-table > div.price-preview-new-row");
  });

  it("не блокирует импорт без распознанной шапки: поставщика можно выбрать или создать, дату — указать вручную", () => {
    expect(page).toContain("previewSupplierChoice");
    expect(page).toContain("Поставщик для сохранения");
    expect(page).toContain("Указать или создать нового");
    expect(page).toContain("Добавить в справочник");
    expect(page).toContain("Дата прайса");
    expect(page).toContain("Новый поставщик");
    expect(page).toContain("Удалить поставщика?");
    expect(page).toContain("Если у него есть сохраненные прайс‑листы или товарные связи");
    expect(styles).toContain(".packet .price-preview-supplier");
  });

  it("оформляет создание поставщика компактной формой с отдельными действиями", () => {
    expect(page).toContain("price-directory-new-action");
    expect(page).toContain("price-directory-editor-actions");
    expect(page).toContain("Доступен при выборе поставщика");
    expect(styles).toContain(".packet .price-directory-editor.supplier .price-directory-editor-actions");
  });

  it("не выводит лишнюю декоративную карточку уровня доступа", () => {
    expect(page).not.toContain("Контур доступа");
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

  it("закрепляет общий эталон полей и списков без двойной focus‑рамки", () => {
    expect(styles).toContain("/* Единый эталон полей и тематичных списков");
    expect(styles).toContain('body [data-slot="select-content"]');
    expect(styles).toContain(".packet .price-scope:hover");
    expect(styles).toContain(".packet .price-directory-tabs button:hover");
  });
});
