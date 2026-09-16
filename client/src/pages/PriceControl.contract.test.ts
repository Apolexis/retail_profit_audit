import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./PriceControl.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Прайс‑контроль»", () => {
  it("использует отдельный двухэтапный импорт и не задействует финансовый импорт", () => {
    expect(page).toContain('"/api/price-import/preview"');
    expect(page).toContain('"/api/price-import/commit"');
    expect(page).toContain("Выберите файл — проверим автоматически");
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
    expect(page).toContain("Город предложения");
    expect(page).toContain("offerMarketFilter");
    expect(page).toContain("предложения Москвы и СПБ не сравниваются между собой");
    expect(page).toContain("Фильтры применяются одновременно");
    expect(page).toContain("предложения Москвы и СПБ не сравниваются между собой");
    expect(page).toContain("ИСТОРИЯ ЦЕН");
    expect(page).toContain("updateProduct");
    expect(page).toContain("updateSupplier");
    expect(page).toContain("updateOffer");
    expect(styles).toContain(".packet .price-history-chart");
  });

  it("делает активность поставщика явным кликабельным действием с немедленным сохранением", () => {
    expect(page).toContain("setSupplierActive");
    expect(page).toContain("toggleSupplierDraftActive");
    expect(page).toContain('aria-pressed={supplierDraft.isActive}');
    expect(page).toContain('supplierDraft.isActive ? "Включен" : "Скрыт"');
    expect(styles).toContain(".packet .price-active-toggle.is-active");
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
    expect(page).toContain('className={preview ? "price-import-workbench is-preview-ready" : "price-import-workbench"}');
    expect(page).toContain('{!preview && <aside className="packet-card price-import-guide">');
    expect(styles).toContain(".packet .price-import-workbench.is-preview-ready");
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

  it("автоматически запускает проверку и безопасно отменяет устаревший preview при выборе другого файла", () => {
    expect(page).toContain("void inspectFile(selected)");
    expect(page).toContain("const inspectFile = async (selectedFile: File)");
    expect(page).toContain("previewRequestToken.current");
    expect(page).toContain("Проверяем прайс‑лист…");
    expect(page).not.toContain("Проверить прайс");
  });

  it("дает создать категорию только явно и применить ее к выбранным новым строкам", () => {
    expect(page).toContain("previewNewCategoryName");
    expect(page).toContain("createPreviewCategory");
    expect(page).toContain("Создать и назначить");
    expect(page).toContain("Выбрано для действия:");
    expect(page).toContain("Выбрать все новые");
  });

  it("сохраняет ручные правки всех ценовых режимов и исключения строк вместе с файлом", () => {
    expect(page).toContain("previewPriceEdits");
    expect(page).toContain("priceOptions.map((option, optionIndex)");
    expect(page).toContain("packPriceImportCommitBody");
    expect(page).toContain("excludedPreviewRowIndexes");
    expect(page).toContain("Исключить выбранные");
    expect(page).toContain("Исключено из этого импорта:");
    expect(page).toContain("price-preview-remove");
    expect(styles).toContain(".packet .price-preview-table > div.price-preview-row.is-selected");
  });

  it("пересчитывает предупреждение о цене после ручной правки и использует нейтральный светлый акцент", () => {
    expect(page).toContain("const unresolvedPreviewPriceCount = useMemo");
    expect(page).toContain("unresolvedPreviewPriceCount > 0");
    expect(styles).toContain('html[data-audit-theme="light"] .packet .inline-error { border-color: #b9d5eb; background: #edf7ff; color: #075dbb; }');
  });

  it("на широкой версии отдает свободное место названию и не накладывает цену с метаданными", () => {
    expect(styles).toContain("grid-template-columns: 28px minmax(360px, 1.62fr) minmax(310px, .88fr) 36px");
    expect(styles).toContain(".price-preview-new-row .price-preview-prices { grid-column: 3; grid-row: 1 / span 2;");
    expect(styles).toContain(".packet .price-preview-offer-metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".packet .price-preview-prices > div > small { position: static;");
    expect(styles).toContain(".packet .price-preview-basis-select[data-slot=\"select-trigger\"] { min-width: 132px !important; }");
  });

  it("дает до сохранения исправить имя и явно выбрать внутренний товар для связи поставщика", () => {
    expect(page).toContain("previewNameEdits");
    expect(page).toContain("previewProductLinks");
    expect(page).toContain("Название в этом прайсе");
    expect(page).toContain("Связать с внутренним товаром");
    expect(page).toContain("productLinks:");
    expect(page).toContain("rowEdits,");
  });

  it("дает уточнить оплату, город и метаданные предложения вместе с ручной ценой", () => {
    expect(page).toContain("price-preview-mode-select");
    expect(page).toContain("Условие цены");
    expect(page).toContain("priceMode: draft.priceMode");
    expect(page).toContain("draft?.priceMode ?? canonicalPriceMode(offer.priceMode)");
    expect(page).toContain("draft?.market ?? marketFromPriceMode(offer.market, offer.priceMode)");
    expect(page).toContain("draft?.manufacturer ?? offer.manufacturer ?? \"\"");
    expect(page).toContain("draft?.placeContents ?? offer.placeContents ?? \"\"");
    expect(page).toContain("Дата изготовления");
    expect(page).toContain("Годен до:");
    expect(page).toContain("shelfLifeOptions.map");
    expect(page).toContain("calculateExpiryDate");
  });

  it("на телефоне показывает одну позицию preview с навигацией и использует компактную отмеченную галочку", () => {
    expect(page).toContain("price-preview-mobile-pager");
    expect(page).toContain("Позиция {currentMobilePreviewPosition + 1}");
    expect(page).toContain("is-mobile-current");
    expect(page).toContain("const moveMobilePreview = (direction: -1 | 1)");
    expect(page).toContain("(current + direction + total) % total");
    expect(page).toContain("onPointerDown={startPreviewSwipe}");
    expect(page).toContain("onPointerUp={finishPreviewSwipe}");
    expect(page).toContain("Math.abs(horizontalDistance) < 44");
    expect(page).toContain("<Check size={12} />");
    expect(styles).toContain(".packet .price-preview-mobile-pager { display: none; }");
    expect(styles).toContain(".packet .price-preview-table > div.is-mobile-current { display: grid; }");
    expect(styles).toContain(".packet .price-preview-check:has(input:checked)");
  });

  it("отдает названию позиции приоритетную ширину и не обрезает нижние поля карточки на телефоне", () => {
    expect(page).toContain("<textarea");
    expect(styles).toContain(".packet .price-preview-name-edit :is(input, textarea) { min-width: 0; padding-inline: 7px; font-size: 12px;");
    expect(styles).toContain(".packet .price-preview-name-edit textarea { resize: vertical;");
    expect(styles).toContain("@media (max-width: 420px)");
    expect(styles).toContain("@media (max-width: 560px) { .packet .price-preview-table { overflow: clip; touch-action: pan-y; } }");
  });

  it("не ограничивает широкий preview тремя строками и перестраивает связь с категорией без наложений", () => {
    expect(styles).toContain(".packet .price-preview-table { max-height: none; overflow: visible; }");
    expect(styles).toContain("@media (min-width: 761px) and (max-width: 1200px)");
    expect(styles).toContain(".price-preview-new-row .price-preview-product-link { grid-column: 2; grid-row: 2;");
    expect(styles).toContain(".price-preview-new-row .price-preview-category-select { grid-column: 3; grid-row: 2;");
  });

  it("использует тематичный выбор даты прайса вместо системного поля даты", () => {
    expect(page).toContain('import { ExactDateControl } from "@/components/DateRangeControl";');
    expect(page).toContain('<ExactDateControl');
    expect(page).toContain('title="ДАТА ПРАЙСА"');
    expect(page).toContain('value={sourceDate}');
  });

  it("делает скрытие товара явным состоянием формы, а не только кнопкой списка", () => {
    expect(page).toContain("Скрыт из фильтров");
    expect(page).toContain("История цен и связи сохраняются в обоих состояниях");
    expect(page).toContain("isActive: productDraft.isActive");
  });

  it("дает выбирать постоянные характеристику, фасовку и состав места из управляемого справочника", () => {
    expect(page).toContain("Характеристика товара");
    expect(page).toContain("Фасовка / вес");
    expect(page).toContain("variantCharacteristicId: productDraft.variantCharacteristicId ? Number(productDraft.variantCharacteristicId) : null");
    expect(page).toContain("sizeCharacteristicId: productDraft.sizeCharacteristicId ? Number(productDraft.sizeCharacteristicId) : null");
    expect(page).toContain("placeContentsCharacteristicId: productDraft.placeContentsCharacteristicId ? Number(productDraft.placeContentsCharacteristicId) : null");
    expect(page).toContain('selectableCharacteristics("variant")');
    expect(page).toContain('selectableCharacteristics("size")');
    expect(page).toContain('selectableCharacteristics("place_contents")');
    expect(page).toContain("Состав места");
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
    expect(page).toContain('{previewSupplierChoice === "__manual" && (');
  });

  it("оформляет создание поставщика компактной формой с отдельными действиями", () => {
    expect(page).toContain("price-directory-new-action");
    expect(page).toContain("price-directory-editor-actions");
    expect(page).toContain("Доступен при выборе поставщика");
    expect(styles).toContain(".packet .price-directory-editor.supplier .price-directory-editor-actions");
  });

  it("показывает скрытие в списках и переводит к каждому открытому редактору", () => {
    expect(page).toContain("const openCategoryEditor");
    expect(page).toContain("const openSupplierEditor");
    expect(page).toContain("categoryEditorRef.current?.scrollIntoView");
    expect(page).toContain("supplierEditorRef.current?.scrollIntoView");
    expect(page).toContain("setSupplierActive.mutate({");
    expect(page).toContain('{supplier.isActive ? "Скрыть" : "Показать"}');
    expect(page).toContain('{product.isActive ? "Скрыть" : "Показать"}');
    expect(page).toContain('{category.isActive ? "Скрыть" : "Показать"}');
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
