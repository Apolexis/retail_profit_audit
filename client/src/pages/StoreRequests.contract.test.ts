import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./StoreRequests.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../store-requests.css", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const printSettings = readFileSync(new URL("./PrintSettings.tsx", import.meta.url), "utf8");
const printSettingsStyles = readFileSync(new URL("../print-settings.css", import.meta.url), "utf8");

describe("заявки магазинов: экран", () => {
	  it("предлагает только точки, разрешенные текущему пользователю", () => {
	    expect(page).toContain("inventoryRegistry.requestStores.useQuery");
	    expect(page).toContain("const accessibleStores = stores.data ?? []");
	    expect(page).toContain('searchable searchPlaceholder="Найти магазин" value={storeId}');
	    expect(page).not.toContain("trpc.audit.stores.useQuery");
	  });

	  it("использует общий справочник по раскрываемым категориям и не выводит себестоимость", () => {
    expect(page).toContain("requestProducts");
    expect(page).toContain("request-category-trigger");
    expect(page).toContain("Поиск товара");
    expect(page).toContain('const [expandedCategory, setExpandedCategory] = useState<string | null>(null);');
    expect(page).toContain('const toggleCategory = (category: string) => setExpandedCategory(current => current === category ? null : category);');
    expect(page).toContain('const isOpen = expandedCategory === category;');
    expect(page).not.toContain("expandedCategories");
    expect(page).not.toContain('<span>{products.length} позиций</span>');
	    expect(page).toContain("request-product-row");
	    expect(page).toContain("видно только администратору");
    expect(page).not.toContain("internalCostPrice");
	    expect(page).not.toContain("evotorCostPrice");
	    expect(page).toContain("const requestSearchTokens");
		    expect(page).toContain('placeholder="Название, код или не полное имя"');
	    expect(page).toContain("normalizedQueryTokens.every(token => haystack.includes(token))");
	  });

  it("оформляет раскрытие категории компактным тематичным control", () => {
    expect(page).toContain('className="request-category-trigger"');
    expect(page).toContain('aria-expanded={isOpen}');
    expect(page).toContain("<ChevronDown size={17}/>");
    expect(styles).toContain(".packet .request-category-trigger { display: grid; grid-template-columns: minmax(0, 1fr) auto 18px;");
    expect(styles).toContain('.packet .request-category-trigger:focus-visible { outline: none;');
    expect(styles).toContain('.packet .request-category-trigger[aria-expanded="true"] svg { transform: rotate(180deg); }');
  });

	  it("меняет количество прямо в строке и показывает расчеты без создания товара из заявки", () => {
	    expect(page).toContain("saveRequestDraft");
	    expect(page).toContain("draftProductLines");
	    expect(page).toContain("changeProductQuantity");
    expect(page).toContain("request-quantity-stepper");
    expect(page).not.toContain("addRequestManualLine");
    expect(page).not.toContain("Не нашли товар? Добавить строку");
    expect(page).toContain("Рекомендуем заказать");
    expect(page).toContain("средняя продажа за день + запас");
    expect(page).toContain("product.supplyStockState");
    expect(page).toContain("maxStoreCoverDays");
    expect(page).toContain("норма категории");
  });

	  it("возвращает пользователя в уже открытую заявку и закрывает весь печатный запуск только уполномоченному персоналу", () => {
	    expect(page).toContain('toast.success(result.created ? "Заявка открыта" : "Открыта сохранённая заявка")');
	    expect(page).toContain('"ОТКРЫТАЯ ЗАЯВКА"');
	    expect(page).toContain('"Открыта"');
		    expect(page).toContain("К списку заявок");
		    expect(page).not.toContain('<X size={14}/>К списку заявок');
	    expect(page).not.toContain("request-history-open");
	    expect(page).toContain("requestPrintCandidates");
    expect(page).toContain("closeRequestsForPrint");
	    expect(page).toContain("Распечатать и закрыть");
	    expect(page).not.toContain('>Закрыть заявку<');
	    expect(page).toContain("const canPrintRequests = Boolean(isManager || isAdmin);");
	    expect(page).toContain("deleteClosedRequest");
	    expect(page).toContain("Удалить закрытую заявку?");
	    expect(page).toContain("hideClosedRequest");
	    expect(page).toContain("Скрыть закрытую заявку?");
	    expect(page).toContain("скрыта из истории и печати");
	    expect(page).toContain('item.status === "closed" && canPrintRequests');
		    expect(page).toContain('aria-current={item.id === activeRequestId ? "true" : undefined}');
		    expect(page).not.toContain('className="request-history-command"');
		    expect(page).not.toContain('Pencil size={14}');
		    expect(page).not.toContain('>Открыть<');
		    expect(page).toContain('const isRequestOpening = Boolean(activeRequestId && requestDetail.isLoading);');
		    expect(page).toContain('className="packet-card request-open-loader"');
		    expect(page).toContain('Загружаем открытую заявку…');
		    expect(page).toContain('requestDraftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })');
		    expect(page).toContain('className="packet-card request-draft-card" ref={requestDraftRef} tabIndex={-1}');
		    expect(styles).toContain('.packet .request-open-loader { display: flex; align-items: center; gap: 12px; min-height: 92px;');
		    expect(page).not.toContain('"Открыть (просмотр)"');
		    expect(page).not.toContain('"Изменить черновик"');
		    expect(page).toContain("Сохраненная подборка доступна только для просмотра");
	  });

  it("печатает все активные группы без пользовательского выбора подборки", () => {
    expect(page).toContain("printRequests");
    expect(page).not.toContain("printCategoryGroupIds");
    expect(page).toContain("Все доступные магазины");
    expect(page).toContain("store-request-print-sheet");
    expect(page).toContain('id="request-print-root"');
    expect(page).toContain("createPortal(");
    expect(page).toContain("document.body");
    expect(page).toContain("ПЕЧАТЬ ЗАЯВОК");
    expect(page).toContain("const canPrintRequests = Boolean(isManager || isAdmin);");
    expect(page).toContain('className="request-history-print"');
    expect(page).not.toContain("request-print-config");
    expect(page).toContain("isAllStoresScope && printRange.from === printRange.to && (printCandidates.data?.count ?? 0) > 0");
  });

	it("объединяет выбор точки, даты и открытие в один рабочий блок и печатает период с итогами", () => {
			expect(page).toContain('className="packet-card request-create-card"');
			expect(page).toContain('data-scope={isAllStoresScope ? "all" : "store"}');
			expect(page).toContain('{!isAllStoresScope && <button className="subtle-button request-open-action"');
			expect(page).toContain('aria-label="Выбрать магазин для заявок"');
		expect(page).toContain('title="ДАТА ЗАЯВКИ"');
		expect(page).toContain('className="request-open-hint"');
		expect(page).not.toContain("request-creation-heading");
		expect(page).not.toContain("request-scope-control");
			expect(styles).toContain(".packet .request-open-form { grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr) minmax(158px, .46fr); }");
			expect(styles).toContain('.packet .request-open-form[data-scope="all"] { grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr); }');
			expect(styles).toContain(".packet .request-open-action { width: 100%; justify-content: center; }");
			expect(page).toContain('title="ПЕРИОД ПЕЧАТИ ЗАЯВОК"');
			expect(page).toContain("printRequests.mutate({ from: printRange.from, to: printRange.to");
		    expect(page).toContain("data-zebra-mode={printProjection.zebraMode}");
		    expect(page).toContain("const requestPrintMatrix");
		    expect(page).toContain('className="store-request-print-matrix"');
		    expect(page).toContain("sheet.stores.map(store => <th key={store.storeId}>{store.storeName}</th>)");
		    expect(page).toContain("Итого позиций");
		    expect(page).not.toContain('matrixRows.length} товаров');
		    expect(styles).toContain(".store-request-print-sheet.is-matrix");
		    expect(page).toContain("store-request-print-stock");
		    expect(page).toContain("Остаток:");
	    expect(page).toContain("Сигнал: не заказывать; норма");
		    expect(page).toContain("<b>{comment.storeName}:</b>");
		  });

	  it("не возвращает общий комментарий и оставляет два комментария к категориям печати", () => {
	    expect(page).not.toContain("Комментарий к заявке");
	    expect(printSettings).toContain("requestCommentSlot");
    expect(printSettings).toContain("Комментарий к Мороженной продукции");
    expect(printSettings).toContain("Комментарий к Копченой продукции");
    expect(printSettings).toContain("категория печати");
    expect(page).not.toContain("Комментарий к заявке");
	    expect(page).not.toContain("Общее примечание к заказу");
	  });

	  it("настраивает шрифт, зебру и факты печати заявок без наложения controls", () => {
	    expect(printSettings).toContain("Белый A4 и читаемая таблица");
	    expect(printSettings).toContain('aria-label="Шрифты печати заявки"');
	    expect(printSettings).toContain('aria-label="Шрифты печати выручки"');
		    expect(printSettings).toContain("Данные под товаром");
		    expect(printSettings).toContain("showSalesCover");
		    expect(printSettings).toContain("recommendationFontSize");
		    expect(printSettings).toContain("recommendationTone");
		    expect(page).toContain('"--request-print-fact-size"');
		    expect(printSettingsStyles).toContain(".packet .print-settings-inline-paper .request-print-recommendations { grid-column: 1 / -1;");
	  });

	  it("раскрывает только соседнюю карточку той же строки, без связи с вложенностью", () => {
	    expect(printSettings).toContain("const [expandedCategoryGroups, setExpandedCategoryGroups]");
	    expect(printSettings).toContain("const pairStart = Math.floor(index / 2) * 2");
	    expect(printSettings).toContain("const visibleNeighborIds = categoryCardsStacked ? [group.id]");
	    expect(printSettings).toContain("Object.fromEntries(visibleNeighborIds.map(id => [id, next]))");
	    expect(printSettings).not.toContain("connectedPrintCategoryGroupIds");
	  });

  it("сохраняет количество и оба комментария одним действием открытой заявки", () => {
    expect(page).toContain("const saveDraft = () =>");
    expect(page).toContain("saveRequestDraft.mutate");
	    expect(page).toContain('<Save size={14}/>');
	    expect(page).toContain("Сохранить заявку");
	    expect(page).toContain("Открытая заявка сохранена");
	    expect(page).toContain("НЕ СОХРАНЕНО");
	    expect(page).not.toContain("upsertRequestComment.mutateAsync");
	    expect(page).not.toContain("removeLine.mutate");
    expect(page).not.toContain("persistProductQuantity");
  });

  it("дает руководителю и администратору перенести дату открытой заявки тем же атомарным сохранением", () => {
    expect(page).toContain('active.status === "draft" && !isSeller && <label className="request-edit-date">');
    expect(page).toContain('title="ИЗМЕНИТЬ ДАТУ ЗАЯВКИ"');
    expect(page).toContain('businessDate,\n      lines: draftProductLines');
    expect(page).toContain('if (active.businessDate !== businessDate) return true;');
  });

    it("показывает фактический остаток, удаляет комментарий при сохранении и сбрасывает admin-селектор при возврате", () => {
	      expect(page).toContain("storeQuantity: number | null");
	      expect(page).toContain("Фактический остаток магазина:");
	      expect(page).toContain("Не рекомендуется заказывать:");
	      expect(page).toContain("Остаток:");
	      expect(page).toContain("<b>{comment.storeName}:</b>");
	      expect(page).toContain("Удалить комментарий");
      expect(page).toContain("const returnToRequestHistory = () =>");
      expect(page).toContain("if (!isSeller) setStoreId(\"\");");
      expect(page).toContain("onClick={returnToRequestHistory}");
      expect(styles).toContain(".packet .request-comment-editor { display: flex; align-items: end; gap: 9px; }");
      expect(styles).toContain(".store-request-print-stock { display: block;");
    });
});

describe("заявки магазинов: адаптивность и печать", () => {
  it("не превращает desktop в телефонную раскладку раньше необходимого и перестраивает узкий экран", () => {
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain(".request-product-row { grid-template-columns: 1fr;");
	    expect(styles).toContain(".request-open-form,");
	    expect(styles).toContain("overflow: hidden");
	    expect(styles).toContain("@media (min-width: 761px) and (max-width: 920px) {");
	    expect(styles).toContain(".packet .request-history-select { grid-template-columns: minmax(0, 1fr) auto; gap: 3px 10px; }");
		    expect(styles).toContain(".packet .request-draft-card > .request-actions { justify-content: center; }");
		    expect(styles).toContain(".packet .request-cancel-draft { grid-column: 1 / -1; width: 100%; min-width: 0; }");
			expect(styles).toContain(".packet .request-create-card .request-open-form { width: min(100%, 820px); margin-inline: auto; }");
			expect(styles).toContain(".packet .request-create-card .request-open-action { align-self: end; }");
				expect(styles).not.toContain(".packet .request-history-command");
		    expect(styles).toContain(".packet .request-history-select > :is(span, strong, small, b) { grid-column: 1; grid-row: auto; justify-self: start; }");
		    expect(styles).toContain('@media (max-width: 560px)');
		    expect(styles).toContain('.packet .request-create-card .request-open-form[data-scope="all"]');
		    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) !important;');
		  });

		  it("использует A4 portrait и отдельный print-портал без интерфейсных кнопок", () => {
		    expect(styles).toContain("@page { size: A4 portrait; margin: 4mm; background: #fff; }");
		    expect(styles).toContain("html[data-audit-theme], html[data-audit-theme] body { background: #fff !important; color: #000 !important; }");
		    expect(styles).toContain('body[data-print-target="requests"] > :not(#request-print-root) { display: none !important; }');
		    expect(styles).toContain('body[data-print-target="requests"] > #request-print-root { display: block !important;');
		    expect(styles).not.toContain("body:has(.store-request-print)");
		    expect(styles).toContain("#request-print-root .store-request-print-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed;");
		    expect(styles).toContain("#request-print-root .store-request-print-sheet :is(thead, tbody, tfoot) :is(th, td) { background: #fff !important; color: #000 !important; }");
			    expect(styles).toContain("#request-print-root .store-request-print-sheet th:nth-child(2), #request-print-root .store-request-print-sheet td:nth-child(2) { width: 15mm; text-align: center; white-space: nowrap; }");
		    expect(styles).toContain("break-after: page");
		    expect(styles).toContain("#request-print-root .store-request-print-sheet:last-child { break-after: auto; page-break-after: auto; }");
	    expect(styles).toContain('#request-print-root[data-zebra-mode="rows"] .store-request-print-sheet thead th,');
	    expect(styles).toContain('#request-print-root[data-zebra-mode="rows"] .store-request-print-sheet tfoot.is-striped-total :is(th, td)');
    expect(styles).toContain('#request-print-root[data-zebra-mode="columns"] .store-request-print-sheet :is(thead th:nth-child(even), tbody td:nth-child(even), tfoot th:nth-child(even), tfoot td:nth-child(even))');
			    expect(styles).toContain('background: #ccc !important;');
			  });

		  it("передает сохраненные размеры и начертания в лист заявки", () => {
		    expect(printSettings).toContain("requestTypographyControls");
		    expect(printSettings).toContain("Шрифты печати заявки");
		    expect(printSettings).toContain("headingFontSize");
		    expect(printSettings).toContain("totalBold");
		    expect(page).toContain('"--request-print-heading-size"');
		    expect(page).toContain('"--request-print-total-weight"');
		    expect(styles).toContain("var(--request-print-heading-size, 10pt)");
		    expect(styles).toContain("var(--request-print-body-size, 9pt)");
		    expect(styles).toContain("var(--request-print-total-size, 9pt)");
		  });

		  it("уплотняет лист и не печатает внутренний номер товара", () => {
		    expect(page).not.toContain('`№ ${row.catalogNumber} · `');
		    expect(styles).toContain(".store-request-print-sheet > header { display: flex;");
		    expect(styles).toContain("padding: .75mm 1.1mm");
		    expect(styles).toContain("margin: 0 0 2mm");
		  });

		  it("центрирует широкий плюс, поле количества и минус под описанием позиции", () => {
		    expect(styles).toContain(".request-quantity-stepper { display: grid; grid-template-columns: 40px minmax(148px, 1fr) 40px; column-gap: 10px; align-items: stretch; justify-self: center; width: min(100%, 268px);");
		    expect(styles).toContain(".request-quantity-stepper label { position: relative; min-width: 148px; }");
		    expect(styles).toContain(".request-quantity-stepper { grid-template-columns: 40px minmax(148px, 1fr) 40px; justify-self: center; width: min(100%, 280px); }");
		    expect(styles).toContain("--request-stepper-surface: #f4f9ff;");
		    expect(styles).toContain("--request-stepper-surface: #17111b;");
		    expect(styles).toContain(".request-quantity-stepper :is(input, .subtle-button):hover { border-color: var(--request-accent) !important; background: var(--request-stepper-surface) !important; box-shadow: 0 0 0 1px var(--request-accent-faint) !important; }");
		    expect(styles).toContain(".request-quantity-stepper :is(input, .subtle-button) { border-color: var(--request-line) !important; background: var(--request-stepper-surface) !important; box-shadow: none !important; }");
		    expect(styles).toContain(".request-quantity-stepper :is(input, .subtle-button):focus-visible { border-color: var(--request-accent) !important; background: var(--request-stepper-surface) !important; box-shadow: 0 0 0 1px var(--request-accent-faint) !important; outline: none; }");
		    expect(overrides).toContain('html[data-audit-theme="light"] .packet .request-quantity-stepper :is(input, .subtle-button:not(.subtle-danger)) { background: #f4f9ff !important; border-color: #c7e2ff !important; box-shadow: none !important; }');
		    expect(overrides).toContain('html[data-audit-theme="dark"] .packet .request-quantity-stepper :is(input, .subtle-button:not(.subtle-danger)) { background: #17111b !important; border-color: #3b2435 !important; box-shadow: none !important; }');
		  });

		  it("не раскрывает категории автоматически при поиске и проверяет непустой DOM-портал до печати", () => {
		    expect(page).not.toContain("previousQueryRef");
		    expect(page).not.toContain("setExpandedCategories(new Set(groupedProducts.map");
		    expect(page).toContain('const sheet = document.getElementById("request-print-root")');
		    expect(page).toContain('const printableRows = sheet?.querySelectorAll(".store-request-print-sheet tbody tr").length ?? 0;');
		    expect(page).toContain("The portal is committed outside the interactive application shell before");
		    expect(page).toContain("if (!sheet || !printableRows)");
		    expect(page).not.toContain("sheet.getClientRects().length");
		    expect(page).not.toContain("document.querySelector<HTMLElement>(\".store-request-print-sheet\")");
		    expect(page).toContain("}, [printProjection]);");
		    expect(page).toContain('document.body.dataset.printTarget = "requests"');
		    expect(page).toContain('window.addEventListener("afterprint", clearPrintTarget)');
			    expect(styles).toContain(".packet .request-search-row { display: flex; align-items: end; gap: 12px; padding: 3px 0;");
				expect(styles).not.toContain(".packet .request-history-command");
			expect(styles).toContain(".packet .request-history-delete:hover { transform: translateY(-50%) !important; }");
			expect(overrides).toContain('html[data-audit-theme="dark"] .packet button.request-history-delete:not(:disabled):hover');
			expect(overrides).toContain("transform: translateY(-50%) !important;");
		  });

		  it("сохраняет тематическую иерархию полей и контуров без двойного outline", () => {
    expect(styles).toContain("--request-accent: #0a84ff");
    expect(styles).toContain("--request-accent: #ff765f");
	    expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
	    expect(styles).toContain(".request-history-list > article:focus-within");
		    expect(styles).toContain(".request-search-row, .request-comments) :is(input, textarea, select):hover { border-color: var(--request-accent);");
	    expect(styles).toContain("box-shadow: 0 0 0 1px var(--request-accent-faint)");
	    expect(styles).toContain(".request-print-actions .subtle-button):focus-visible");
	    expect(styles).not.toContain("outline: 2px");
  });
});
