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
    expect(page).toContain('ariaLabel="Изменить дату сохраненного прайс-листа"');
    expect(page).not.toContain('type="date"');
  });

  it("показывает весь сохраненный импорт с номерами и явным изменением связи строки", () => {
    expect(page).toContain("price-saved-import-row");
    expect(page).toContain("price-saved-import-number");
    expect(page).toContain("Показано позиций:");
    expect(page).toContain("Связь с товаром");
    expect(page).toContain("Сохранить связь");
    expect(page).toContain("editingSavedImportRowId");
    expect(styles).toContain(".packet .price-saved-import-row");
  });

  it("объясняет точную связь названия поставщика с именем для сравнения", () => {
    expect(page).toContain("Выберите имя, под которым позиция будет показываться в");
    expect(page).toContain("Имя связи для сравнения");
    expect(page).toContain("Создать и связать");
    expect(page).toContain("internalCode");
  });

  it("позволяет изменить или убрать связь названия поставщика без удаления прайс‑листа", () => {
    expect(page).toContain("СВЯЗИ НАЗВАНИЙ ПОСТАВЩИКА");
    expect(page).toContain("Изменить связь");
    expect(page).toContain("Убрать");
    expect(page).toContain("reassignAlias");
    expect(page).toContain("unlinkAlias");
  });

  it("показывает нормализованную цену, исходную фасовку и обоснованного победителя", () => {
    expect(page).toContain("СРАВНЕНИЕ ПО ИМЕНИ СВЯЗИ");
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
    expect(page).toContain("Москва и СПБ не");
    expect(page).toContain("Фильтры применяются сразу ко всему сравнению");
    expect(page).toContain('className="price-toolbar-note"');
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
    expect(page).toContain("Товары в категории ·");
    expect(page).toContain("openProductEditor");
  });

  it("выносит связи названий поставщиков в отдельную вкладку с поиском и порционной выдачей", () => {
    expect(page).toContain('type DirectoryTab = "products" | "categories" | "suppliers" | "links"');
    expect(page).toContain('directoryTab === "links"');
    expect(page).toContain("Связи");
    expect(page).toContain("directoryLinkSearch");
    expect(page).toContain("visibleAliasGroups");
    expect(page).toContain("visibleUnmappedRows");
    expect(page).toContain("Поиск по имени связи, поставщику или названию");
    expect(page).toContain("Показать еще");
  });

  it("раскрывает товары категории и характеристики только по действию, с компактными кнопками показа и редактирования", () => {
    expect(page).toContain('<details className="price-category-members">');
    expect(page).toContain("characteristicGroups");
    expect(page).toContain('<details key={group.kind} className="price-characteristics-group">');
    expect(page).toContain('item.isActive ? "Скрыть" : "Показать"');
    expect(styles).toContain(".packet .price-characteristics-group");
    expect(styles).toContain(".packet .price-characteristic-action");
  });

  it("явно предлагает исправить только пропущенные варианты, распознанные в уже сохраненных названиях", () => {
    expect(page).toContain("repairRecognizedVariants");
    expect(page).toContain("Добавить варианты");
    expect(page).toContain("Обновлено товаров:");
  });

  it("дает добавить составы мест из сохраненных прайсов в повторно используемый справочник", () => {
    expect(page).toContain("refreshPlaceContents");
    expect(page).toContain("repairablePlaceContents");
    expect(page).toContain("Добавить состав мест");
  });

  it("не выводит весь справочник сразу и сохраняет единый выбор с preview", () => {
    expect(page).toContain("directoryProductLimit");
    expect(page).toContain("visibleDirectoryProducts");
    expect(page).toContain("Показать еще");
    expect(page).toContain("price-directory-selection-marker");
    expect(page).toContain('className="price-preview-check"');
    expect(page).toContain("bulkSetProductActive");
    expect(page).toContain("bulkSetOfferMarket");
    expect(styles).toContain(".packet .price-directory-selection-marker");
  });

  it("фильтрует сравнение по выбранному варианту, фасовке или составу места", () => {
    expect(page).toContain("characteristicFilter");
    expect(page).toContain("Все характеристики");
    expect(page).toContain("matchesCharacteristic");
  });

  it("собирает названия поставщиков под одним именем связи и раскрывает их по действию", () => {
    expect(page).toContain("const aliasGroups = useMemo");
    expect(page).toContain("Одна связь — одно общее имя товара");
    expect(page).toContain("price-alias-group-members");
    expect(page).toContain("Имя связи · {group.aliases.length}");
    expect(styles).toContain(".packet .price-alias-group-members > summary");
  });

  it("дает добавить ручную цену прямо у выбранного имени связи", () => {
    expect(page).toContain("comparisonManualOffer");
    expect(page).toContain('aria-label="Добавить цену в историю выбранного имени связи"');
    expect(page).toContain("Добавить цену");
    expect(page).toContain("ДОБАВИТЬ ЦЕНУ В ИСТОРИЮ");
    expect(page).toContain("createManualOffer.mutate");
    expect(styles).toContain(".packet .price-comparison-manual-offer");
  });

  it("показывает полный контекст конкретного предложения в tooltip истории", () => {
    expect(page).toContain("function PriceOfferTooltipDetails");
    expect(page).toContain("function PriceHistoryTooltip");
    expect(page).toContain("Исходная строка");
    expect(page).toContain("Состав места");
    expect(page).toContain('content={<PriceHistoryTooltip />}');
    expect(styles).toContain(".packet .price-offer-tooltip");
  });

  it("нормализует десятичную запятую во всех редактируемых ценах сразу при вводе", () => {
    expect(page).toContain('import { normalizeDecimalInputText } from "@/lib/utils"');
    expect(page).toContain("data-decimal-input");
    expect(page).toContain('normalizeDecimalInputText(event.target.value).replace(/[^0-9.]/g, "")');
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
    expect(styles).toContain(".packet .price-import-workbench > :is(.price-upload, .price-import-guide) { background: var(--card); border-color: var(--price-border) !important; }");
    expect(styles).toContain(".packet .price-file-drop { background: radial-gradient(circle at 50% 0");
  });

  it("заменяет нативные селекты тематичными немодальными списками приложения", () => {
    expect(page).toContain("function PriceSelect");
    expect(page).toContain("<FreeScrollSelect");
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

  it("дает назначить город отмеченным строкам и до сохранения добавить или убрать отдельный вариант цены", () => {
    expect(page).toContain("previewBulkMarket");
    expect(page).toContain("assignPreviewMarketToSelected");
    expect(page).toContain("Город для отмеченных");
    expect(page).toContain("Назначить город");
    expect(page).toContain("previewAddedPriceOptions");
    expect(page).toContain("previewRemovedPriceOptions");
    expect(page).toContain("Добавить цену");
    expect(page).toContain("Удалить вариант цены");
    expect(page).toContain("priceAdditions");
    expect(page).toContain("priceRemovals");
    expect(styles).toContain(".packet .price-preview-price-edit > .price-preview-price-remove");
  });

  it("показывает порядковый номер новой позиции непосредственно под галочкой выбора", () => {
    expect(page).toContain('className="price-preview-selection-marker"');
    expect(page).toContain("№ {position + 1}");
    expect(styles).toContain(".packet .price-preview-selection-marker { display: grid; grid-column: 1; grid-row: 1;");
    expect(styles).toContain(".packet .price-preview-row-number");
  });

  it("пересчитывает предупреждение о цене после ручной правки и использует нейтральный светлый акцент", () => {
    expect(page).toContain("const unresolvedPreviewPriceCount = useMemo");
    expect(page).toContain("unresolvedPreviewPriceCount > 0");
    expect(styles).toContain('html[data-audit-theme="light"] .packet .inline-error { border-color: #b9d5eb; background: #edf7ff; color: #075dbb; }');
  });

  it("на широкой версии отдает свободное место названию и держит исключение отдельным верхним действием", () => {
    expect(styles).toContain("grid-template-columns: 28px minmax(0, 1.62fr) minmax(0, .88fr) 36px");
    expect(styles).toContain(".price-preview-table { inline-size: 100%; max-inline-size: 100%; box-sizing: border-box; }");
    expect(styles).toContain(".price-preview-new-row .price-preview-prices { grid-column: 3; grid-row: 1; min-width: 0; }");
    expect(styles).toContain(".price-preview-new-row .price-preview-remove { position: static; grid-column: 4; grid-row: 1; align-self: start; justify-self: end; }");
    expect(styles).toContain(".packet .price-preview-offer-metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".packet .price-preview-prices > div > small { position: static;");
    expect(styles).toContain(".packet .price-preview-price-edit { grid-template-columns: minmax(0, .9fr) minmax(0, 1fr); }");
  });

  it("дает до сохранения исправить имя и явно выбрать имя связи поставщика", () => {
    expect(page).toContain("previewNameEdits");
    expect(page).toContain("previewProductLinks");
    expect(page).toContain("Название в этом прайсе");
    expect(page).toContain("Имя связи для сравнения");
    expect(page).toContain("Укажите существующий товар, только если это та же позиция.");
    expect(page).toContain("Связано:");
    expect(page).toContain("productLinks:");
    expect(page).toContain("rowEdits,");
  });

  it("держит сохраненное предложение компактным и раскрывает изменение только по действию", () => {
    expect(page).toContain("editingOfferId");
    expect(page).toContain('className="price-offer-edit-action"');
    expect(page).toContain("Изменение предложения");
    expect(page).toContain("Сохранить изменения");
    expect(styles).toContain(".packet .price-offer-edit-panel");
  });

  it("не выводит мобильную таблицу и график за границы выбранной области", () => {
    expect(page).toContain('width={54}');
    expect(page).toContain('interval="preserveStartEnd"');
    expect(page).toContain('className="price-offer-normalized"');
    expect(styles).toContain("@media (max-width: 620px)");
    expect(styles).toContain(".packet .price-offer-table { overflow: hidden; }");
    expect(styles).toContain(".packet .price-history-chart { min-width: 0; overflow: hidden;");
    expect(styles).toContain(".packet .price-offer-table::before { margin: 0; padding: 12px 14px 10px; }");
    expect(styles).toContain(".packet .packet-link.compact.price-add-history-action");
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

  it("не обращается к ключу цены до его инициализации после загрузки preview", () => {
    expect(page.indexOf("const previewPriceKey")).toBeLessThan(page.indexOf("const unresolvedPreviewPriceCount"));
    expect(page.indexOf("const previewAddedPriceKey")).toBeLessThan(page.indexOf("const unresolvedPreviewPriceCount"));
  });

  it("ведет производителя и состав места через управляемый справочник, сохраняя распознанное значение до явного редактирования", () => {
    expect(page).toContain('const offerCharacteristicOptions = (kind: "manufacturer" | "place_contents", currentValue: string | null | undefined) =>');
    expect(page).toContain('selectableCharacteristics(kind).map(item => ({ value: item.value, label: item.value }))');
    expect(page).toContain('offerCharacteristicOptions("manufacturer", currentDraft.manufacturer)');
    expect(page).toContain('offerCharacteristicOptions("place_contents", currentDraft.placeContents)');
    expect(page).toContain('offerCharacteristicOptions("manufacturer", productDraft.manualOffer.manufacturer)');
    expect(page).toContain('offerCharacteristicOptions("place_contents", productDraft.manualOffer.placeContents)');
    expect(page).toContain('kind: "variant" | "size" | "place_contents" | "manufacturer"');
    expect(page).not.toContain("manufacturerCharacteristicId");
  });

  it("на touch-устройствах показывает одну позицию preview, не блокируя быструю навигацию во время анимации", () => {
    expect(page).toContain("price-preview-mobile-pager");
    expect(page).toContain("Позиция {currentMobilePreviewPosition + 1}");
    expect(page).toContain("is-mobile-current");
    expect(page).toContain("const moveMobilePreview = (direction: -1 | 1)");
    expect(page).toContain("(from + direction + total) % total");
    expect(page).toContain("setMobilePreviewPosition(to);");
    expect(page).not.toContain("disabled={Boolean(mobilePreviewTransition)}");
    expect(page).toContain("onPointerDown={startPreviewSwipe}");
    expect(page).toContain("onPointerMove={updatePreviewSwipe}");
    expect(page).toContain("onPointerUp={finishPreviewSwipe}");
    expect(page).toContain("Math.abs(horizontalDistance) < 44");
    expect(page).toContain("mobilePreviewSwipeOffset");
    expect(page).toContain("mobilePreviewTransition");
    expect(page).toContain("is-mobile-carousel-outgoing");
    expect(page).toContain("is-mobile-carousel-incoming");
    expect(page).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(page).toContain("price-preview-swipe-hint");
    expect(page).toContain("price-preview-swipe-hint-left");
    expect(page).toContain("Свайпните влево или вправо");
    expect(page).toContain("price-preview-swipe-hint\", \"seen\"");
    expect(page).toContain("<Check size={12} />");
    expect(styles).toContain(".packet .price-preview-mobile-pager { display: none; }");
    expect(styles).toContain(".packet .price-preview-table > div.is-mobile-current { display: grid; }");
    expect(styles).toContain(".packet .price-preview-table > div.is-mobile-current.is-mobile-swipe-dragging");
    expect(styles).toContain("@keyframes price-preview-enter-from-right");
    expect(styles).toContain("@keyframes price-preview-exit-to-left");
    expect(styles).toContain('grid-template-areas: "carousel"; row-gap: 0; padding: 0; isolation: isolate;');
    expect(styles).toContain("translateX(100%)");
    expect(styles).toContain("translateX(-100%)");
    expect(styles).toContain("row-gap: 2px; background: var(--price-surface);");
    expect(styles).toContain("@media (hover: none) and (pointer: coarse) and (max-width: 1120px)");
    expect(styles).toContain("border: 0 !important; box-shadow: none !important;");
    expect(styles).toContain(".packet .price-preview-check:has(input:checked)");
  });

  it("отдает названию позиции приоритетную ширину и не обрезает нижние поля карточки на телефоне", () => {
    expect(page).toContain("<textarea");
    expect(page).toContain("expandedPreviewNameRows");
    expect(page).toContain('className="price-preview-name-expand"');
    expect(page).toContain('"Развернуть поле названия"');
    expect(page).toContain('"Свернуть поле названия"');
    expect(page).toContain("<Maximize2 size={15}");
    expect(page).toContain("<Minimize2 size={15}");
    expect(styles).toContain(".packet .price-preview-name-edit :is(input, textarea) { min-width: 0; padding-inline: 7px; font-size: 12px;");
    expect(styles).toContain(".packet .price-preview-name-edit textarea { resize: vertical;");
    expect(styles).toContain(".packet .price-preview-name-edit > label { display: grid;");
    expect(page).toContain('className="price-preview-name-field"');
    expect(styles).toContain(".packet .price-preview-name-field { position: relative; min-width: 0; }");
    expect(styles).toContain(".packet .price-preview-name-expand { position: absolute; z-index: 1; top: 8px; right: 7px; display: none;");
    expect(styles).toContain("border: 0; border-radius: 0; background: transparent;");
    expect(styles).toContain("@media (hover: none), (pointer: coarse) {");
    expect(styles).toContain(".packet .price-preview-name-expand { display: inline-grid; }");
    expect(styles).toContain(".packet .price-preview-name-edit.is-expanded textarea { min-height: 96px;");
    expect(styles).toContain("@media (max-width: 420px)");
    expect(styles).toContain("@media (max-width: 560px) { .packet .price-preview-table { overflow: clip; touch-action: pan-y; } }");
  });

  it("не ограничивает широкий preview тремя строками и перестраивает связь с категорией без наложений", () => {
    expect(styles).toContain(".packet .price-preview-table { max-height: none; overflow: visible; row-gap: 2px; background: var(--price-surface); }");
    expect(styles).toContain("@media (min-width: 761px)");
    expect(styles).toContain(".price-preview-new-row .price-preview-product-link { grid-column: 2; grid-row: 2;");
    expect(styles).toContain(".price-preview-new-row .price-preview-category-select { grid-column: 3; grid-row: 2;");
  });

  it("сохраняет сетку цены и уменьшает подписи селекторов по ширине их области", () => {
    expect(styles).toContain(".packet .price-preview-price-edit { container-type: inline-size; }");
    expect(styles).toContain("grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr) !important;");
    expect(styles).toContain(".packet .price-preview-price-edit .price-preview-market-select { font-size: clamp(9px, 3.3cqi, 11px); letter-spacing: -.03em; }");
    expect(styles).toContain('[data-slot="select-value"] { min-width: 0; overflow: hidden; text-overflow: clip; white-space: nowrap; }');
  });

  it("на малой средней ширине выводит цену отдельной строкой и не возвращает кнопку исключения вниз", () => {
    expect(styles).toContain("@media (min-width: 761px) and (max-width: 1120px)");
    expect(styles).toContain("grid-template-columns: 28px minmax(0, 1fr) 36px; grid-template-rows: auto auto auto auto;");
    expect(styles).toContain(".price-preview-new-row .price-preview-remove { position: static; grid-column: 3; grid-row: 1; align-self: start; justify-self: end; }");
    expect(styles).toContain(".price-preview-new-row .price-preview-prices { grid-column: 2; grid-row: 2; min-width: 0; }");
    expect(styles).toContain(".price-import-workbench.is-preview-ready .price-preview-price-edit { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }");
  });

  it("использует тематичный выбор даты прайса вместо системного поля даты", () => {
    expect(page).toContain('import { ExactDateControl } from "@/components/DateRangeControl";');
    expect(page).toContain('<ExactDateControl');
    expect(page).toContain('title="ДАТА ПРАЙСА"');
    expect(page).toContain('value={sourceDate}');
    expect(styles).toContain(".packet .price-import-workbench.is-preview-ready .price-preview-date { align-self: start;");
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

  it("дает создать ручное предложение с ценой прямо при создании или изменении товара", () => {
    expect(page).toContain("const createManualOffer = trpc.priceControl.createManualOffer.useMutation");
    expect(page).toContain("РУЧНОЕ ПРЕДЛОЖЕНИЕ");
    expect(page).toContain("Добавить цену поставщика");
    expect(page).toContain("Поставщик, дата и цена обязательны");
    expect(page).toContain("ДАТА ПРЕДЛОЖЕНИЯ");
    expect(page).toContain("sourceDate: manualOffer.sourceDate");
    expect(page).toContain("productId: savedProductId");
    expect(page).toContain("supplierId: Number(manualOffer.supplierId)");
    expect(styles).toContain(".packet .price-manual-offer-editor");
    expect(styles).toContain(".packet .price-manual-offer-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));");
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
