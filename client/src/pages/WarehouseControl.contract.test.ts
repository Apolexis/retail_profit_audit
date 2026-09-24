import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./WarehouseControl.tsx", import.meta.url), "utf8");
const printSettings = readFileSync(new URL("./PrintSettings.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../warehouse-control.css", import.meta.url), "utf8");
const printStyles = readFileSync(new URL("../print-settings.css", import.meta.url), "utf8");
const notifications = readFileSync(new URL("./Notifications.tsx", import.meta.url), "utf8");
const inventoryService = readFileSync(new URL("../../../server/inventoryRegistry.ts", import.meta.url), "utf8");

describe("warehouse and print settings contract", () => {
	it("treats a store as a warehouse with an assigned price type", () => {
    expect(page).toContain("Склады и виды цен");
    expect(page).toContain("setStorePriceType.useMutation");
    expect(page).toContain("Вид продажной цены");
	  expect(page).toContain("Товар не дублируется по магазинам");
	});

	  it("позволяет администратору вернуть скрытый склад в разрешенные рабочие списки", () => {
	    expect(page).toContain("setWarehouseVisibility.useMutation");
	    expect(page).toContain("Показать скрытые");
	    expect(page).toContain("Склад возвращен в рабочие списки");
	    expect(page).toContain("Скрыт из рабочих списков");
	    expect(page).toContain("Вернуть");
	    expect(styles).toContain(".warehouse-row-actions { display: flex; flex-wrap: wrap; gap: 7px;");
	    expect(styles).toContain(".warehouse-row-actions { grid-template-columns: minmax(0, 1fr); width: 100%; }");
	  });

		it("показывает только безопасный итог read-only связей Эвотор", () => {
		    expect(page).toContain("СВЯЗЬ С ЭВОТОР");
		    expect(page).toContain("передаются в Эвотор через audit-ируемую очередь с последующей сверкой");
		    expect(page).toContain("Статус связей с Эвотор");
		    expect(page).toContain("Показывается только безопасный итог read-only сверки");
		    expect(page).toContain("evotorTerminalUuid?: string | null");
		    expect(page).toContain("const evotorUidRows");
		    expect(page).toContain("const mappedByUid");
		    expect(page).toContain("warehouse-evotor-link-summary");
		    expect(page).toContain("Идентификаторы Cloud, адреса и ключи в интерфейс не выводятся");
		    expect(page).not.toContain('<code>{row.id}</code>');
		    expect(page).not.toContain("UID точек, полученные из Эвотор");
	    expect(page).toContain("safeEvotorStoreLabel");
	    expect(page).toContain("Cloud preview can append a street address");
	    expect(page).toContain("Эвотор читает каталог и чеки автоматически");
	    expect(page).toContain("позиция передаётся обратно после изменения товара или подтверждённого движения остатка");
    expect(page).not.toContain("syncEvotorDocumentPage.useMutation");
    expect(page).not.toContain("Загрузить документы");
	    expect(page).not.toContain("Обновить данные Эвотор");
		    expect(page).toContain("setWarehouseEvotorMapping.useMutation");
		    expect(page).toContain('searchable searchPlaceholder="Найти точку Эвотор"');
		    expect(inventoryService).toContain("evotorTerminalUuid: operationalStoreMappings.evotorTerminalUuid");
		    expect(inventoryService).not.toContain("evotorAddress: operationalStoreMappings.evotorAddress");
		    expect(styles).toContain(".warehouse-evotor-link-summary");
		    expect(styles).toContain("font-variant-numeric: tabular-nums");
	  });

	  it("registers the separate administrator-only print settings route", () => {
    expect(app).toContain('path="/warehouse-control"');
    expect(app).toContain('path="/print-settings"');
    expect(shell).toContain('["/warehouse-control", "27", "Склады", true]');
    expect(shell).toContain('["/print-settings", "31", "Настройки печати", true]');
    expect(styles).toContain('--warehouse-accent: var(--packet-accent);');
    expect(styles).toContain('.warehouse-table.data-table');
	  });

		  it("убирает push из складов и переносит audit-ируемую отправку в сигналы", () => {
		    expect(page).not.toContain("Сообщение в приложение на кассах");
		    expect(page).not.toContain("sendEvotorPush.useMutation");
		    expect(notifications).toContain("Сообщение в приложение на кассах");
		    expect(notifications).toContain("evotorPushSettings.useQuery");
		    expect(notifications).toContain("setEvotorPushApplication.useMutation");
		    expect(notifications).toContain("sendEvotorPush.useMutation");
		    expect(notifications).toContain("Все магазины (");
		    expect(notifications).toContain("все кассы (");
		    expect(notifications).toContain("Отправить всем кассам");
		    expect(notifications).toContain("Отправить во все кассы магазина");
		    expect(notifications).not.toContain("Отправить на выбранную кассу");
		  });

		  it("keeps request and revenue print configuration in one page without sharing their setting", () => {
	    expect(printSettings).toContain("Группы и категории для заявок");
	    expect(printSettings).toContain("ВИД ПЕЧАТИ ЗАЯВОК");
	    expect(printSettings).toContain("ВИД ПЕЧАТИ ВЫРУЧКИ");
	    expect(printSettings).toContain("Белый A4 и читаемая таблица");
	    expect(printSettings).toContain("trpc.revenueRegistry.printSettings.useQuery");
	    expect(printSettings).toContain("trpc.revenueRegistry.updatePrintSettings.useMutation");
	    expect(printSettings.match(/className=\"print-settings-inline-paper\"/g)).toHaveLength(2);
	    expect(printSettings.match(/Поля листа всегда белые\. При необходимости добавляется только нейтральная зебра внутри таблицы\./g)).toHaveLength(2);
	    expect(printSettings).not.toContain("четыре поля по 4 мм остаются белыми");
	    expect(printSettings).not.toContain("print-settings-revenue-paper");
	    expect(printSettings).not.toContain("Дополнительная настройка не требуется.");
	    expect(printSettings).toContain('className="print-settings-inline-paper"');
	    expect(printSettings).toContain("createPrintGroup.useMutation");
    expect(printSettings).toContain("setWarehousePrintGroup.useMutation");
    expect(printSettings).toContain("Новая группа печати");
    expect(printSettings).toContain("deletePrintGroup.useMutation");
    expect(printSettings).toContain("updatePrintCategoryGroup.useMutation");
    expect(printSettings).toContain("deletePrintCategoryGroup.useMutation");
	    expect(printSettings).toContain("Товары не изменятся, а вложенные связи будут отсоединены.");
		    expect(printSettings).toContain("requestCommentSlot");
		    expect(printSettings).toContain('searchable searchPlaceholder="Найти группу печати"');
		    expect(printSettings).toContain('searchable searchPlaceholder="Найти категорию"');
		    expect(printSettings).toContain('searchable searchPlaceholder="Найти вложенную группу"');
	  });

	  it("keeps hidden print groups recoverable without making them selectable or printable", () => {
	    expect(printSettings).toContain("const inactiveGroups");
	    expect(printSettings).toContain('aria-label="Скрытые группы печати"');
	    expect(printSettings).toContain("СКРЫТЫЕ ГРУППЫ");
	    expect(printSettings).toContain("Не участвуют в назначении и печати");
	    expect(printSettings).toContain('<Eye size={14}/>Показать');
	    expect(printSettings).toContain("activeGroups.map(group => <option");
	    expect(printStyles).toContain(".warehouse-print-group-recovery");
	  });

	  it("sets print mode and freshness on the category, not on a request", () => {
	    expect(printSettings).toContain('className="warehouse-category-print-mode"');
	    expect(printSettings).toContain("Макс. запас в магазине, дни");
	    expect(printSettings).toContain("maxStoreCoverDays");
	    expect(styles).toContain(".warehouse-category-print-mode { display: block");
	    expect(printStyles).toContain(".warehouse-category-print-mode { display: block");
	    expect(printStyles).toContain(".print-settings-card .card-title small { display: block");
	    expect(printStyles).not.toContain(".print-settings-revenue-paper");
	  });

	  it("оставляет склады таблицей до телефона и включает подписанные карточки только на узком экране", () => {
	    expect(page).toContain('className="data-table-wrap warehouse-table-wrap" data-drag-scroll="false"');
	    expect(page).toContain('data-label="Склад / магазин"');
    expect(page).toContain('data-label="Действие"');
    expect(styles).toContain(".warehouse-table tbody > tr:not(.warehouse-settings-row)");
    expect(styles).toContain("content: attr(data-label)");
    expect(styles).toContain("Settings rows stay inside the selected warehouse card");
    expect(styles).toContain(".warehouse-settings-grid :is(.app-select-trigger, input)");
	    expect(styles).toContain("@media (max-width: 760px) {\n  .packet .warehouse-table-wrap.data-table-wrap");
	    expect(styles).toContain(".warehouse-table.data-table { display: block; width: 100% !important; max-width: 100%; min-width: 0 !important; }");
    expect(styles).toContain(".warehouse-settings-row { display: block; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box;");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(styles).toContain(".warehouse-table tbody > tr:not(.warehouse-settings-row) > td { text-align: left !important; }");
	    expect(styles).toContain(".warehouse-table tbody > tr:not(.warehouse-settings-row) > td:last-child { justify-items: stretch; }");
	  });

	  it("вмещает desktop-таблицу управления магазинами без захвата мышью", () => {
	    expect(styles).toContain(".packet .warehouse-table-wrap.data-table-wrap { width: 100%; min-width: 0;");
	    expect(styles).toContain("overflow: visible; cursor: default;");
	    expect(styles).toContain(".packet .warehouse-table.data-table { width: 100%; min-width: 0; max-width: 100%; table-layout: fixed;");
	    expect(styles).toContain("@media (min-width: 761px) and (max-width: 1400px)");
	    expect(styles).toContain(".warehouse-row-actions { display: grid; grid-template-columns: minmax(0, 1fr); }");
	  });

	  it("keeps summary and editor surfaces inside the approved blue/coral hierarchy", () => {
	    expect(styles).toContain("--warehouse-card: #f7fbff;");
	    expect(styles).toContain("--warehouse-card: #16101a;");
	    expect(styles).not.toContain("background: var(--surface-2);");
	    expect(printStyles).toContain(".packet .print-settings-card");
	  });

	  it("держит состав категории свернутым до явного действия и синхронизирует только соседнюю карточку строки", () => {
	    expect(printSettings).toContain("const [expandedCategoryGroups, setExpandedCategoryGroups]");
	    expect(printSettings).toContain("const pairStart = Math.floor(index / 2) * 2");
	    expect(printSettings).toContain("const visibleNeighborIds = categoryCardsStacked ? [group.id]");
	    expect(printSettings).toContain('aria-controls={`print-category-members-${group.id}`}');
	    expect(printSettings).toContain('isExpanded ? "Скрыть состав" : `Состав: ${group.members.length}`');
	    expect(printSettings).toContain("{isExpanded && <div id={`print-category-members-${group.id}`}");
	    expect(printStyles).toContain(".warehouse-category-members-panel");
	    expect(printStyles).toContain(".print-settings-inline-paper");
	  });

		  it("gives standalone print settings the same resolved warehouse contours and control rhythm", () => {
	    expect(styles).toContain(".packet .print-settings-card {\n  --warehouse-card: var(--surface);");
	    expect(styles).toContain('html[data-audit-theme="light"] .packet .print-settings-card {');
	    expect(styles).toContain('html[data-audit-theme="dark"] .packet .print-settings-card {');
	    expect(styles).toContain("--warehouse-line: #c7e2ff;");
	    expect(styles).toContain("--warehouse-line: #3b2435;");
	    expect(printStyles).toContain(".print-settings-card :is(.warehouse-print-group-create .subtle-button");
		    expect(printStyles).toContain("min-height: 40px;");
		    expect(printStyles).toContain(".warehouse-print-group-chip:focus-visible");
		    expect(printStyles).toContain("@media (hover: hover) and (pointer: fine)");
			    expect(styles).toContain(".warehouse-category-member button:focus-visible");
			  });

  it("сбрасывает intrinsic ширину печатных форм на узком экране", () => {
    expect(printStyles).toContain("long operational controls cannot widen the whole packet on a phone");
    expect(printStyles).toContain(".print-settings-card > * { min-width: 0; max-width: 100%; box-sizing: border-box; }");
    expect(printStyles).toContain(".warehouse-print-group-create > *,");
    expect(printStyles).toContain(".warehouse-print-group-editor > * { width: 100%; min-width: 0; max-width: 100%; }");
  });

  it("не смешивает связь источников 1С с печатными или складскими настройками", () => {
    expect(page).not.toContain("onecWarehouseGroupMappings.useQuery");
    expect(page).not.toContain("setOnecWarehouseGroupMapping.useMutation");
    expect(printSettings).not.toContain("onecWarehouseGroupMappings.useQuery");
    expect(printSettings).not.toContain("setOnecWarehouseGroupMapping.useMutation");
  });
});
