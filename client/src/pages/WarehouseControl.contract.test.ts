import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./WarehouseControl.tsx", import.meta.url), "utf8");
const printSettings = readFileSync(new URL("./PrintSettings.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../warehouse-control.css", import.meta.url), "utf8");
const printStyles = readFileSync(new URL("../print-settings.css", import.meta.url), "utf8");

describe("warehouse and print settings contract", () => {
  it("treats a store as a warehouse with an assigned price type", () => {
    expect(page).toContain("Склады и виды цен");
    expect(page).toContain("setStorePriceType.useMutation");
    expect(page).toContain("Вид продажной цены");
    expect(page).toContain("Товар не дублируется по магазинам");
  });

  it("keeps Evotor read-only and omits addresses", () => {
    expect(page).toContain("READ‑ONLY ЭВОТОР");
    expect(page).toContain("Адреса и технические идентификаторы в интерфейсе не показываются");
    expect(page).toContain("safeEvotorStoreLabel");
    expect(page).toContain("Cloud preview can append a street address");
    expect(page).toContain("Запись в Эвотор исключена");
    expect(page).toContain("Синхронизация Эвотор выполняется автоматически и только на чтение.");
    expect(page).not.toContain("syncEvotorDocumentPage.useMutation");
    expect(page).not.toContain("Загрузить документы");
    expect(page).not.toContain("Обновить данные Эвотор");
    expect(page).toContain("setWarehouseEvotorMapping.useMutation");
  });

  it("registers the separate administrator-only print settings route", () => {
    expect(app).toContain('path="/warehouse-control"');
    expect(app).toContain('path="/print-settings"');
    expect(shell).toContain('["/warehouse-control", "27", "Склады", true]');
    expect(shell).toContain('["/print-settings", "31", "Настройки печати", true]');
    expect(styles).toContain('--warehouse-accent: var(--packet-accent);');
    expect(styles).toContain('.warehouse-table.data-table');
  });

	  it("keeps all request print configuration in one page", () => {
    expect(printSettings).toContain("Группы и категории для заявок");
    expect(printSettings).toContain("createPrintGroup.useMutation");
    expect(printSettings).toContain("setWarehousePrintGroup.useMutation");
    expect(printSettings).toContain("Новая группа печати");
    expect(printSettings).toContain("deletePrintGroup.useMutation");
    expect(printSettings).toContain("updatePrintCategoryGroup.useMutation");
    expect(printSettings).toContain("deletePrintCategoryGroup.useMutation");
    expect(printSettings).toContain("Товары не изменятся, а вложенные связи будут отсоединены.");
	    expect(printSettings).toContain("requestCommentSlot");
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
  });

  it("stacks warehouse data into labelled cards on narrow screens", () => {
    expect(page).toContain('data-label="Склад / магазин"');
    expect(page).toContain('data-label="Действие"');
    expect(styles).toContain(".warehouse-table tbody > tr:not(.warehouse-settings-row)");
    expect(styles).toContain("content: attr(data-label)");
    expect(styles).toContain("Settings rows stay inside the selected warehouse card");
    expect(styles).toContain(".warehouse-settings-grid :is(.app-select-trigger, input)");
    expect(styles).toContain(".warehouse-table.data-table { display: block; width: 100% !important; max-width: 100%; min-width: 0 !important; }");
    expect(styles).toContain(".warehouse-settings-row { display: block; width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box;");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr);");
  });

	  it("keeps summary and editor surfaces inside the approved blue/coral hierarchy", () => {
	    expect(styles).toContain("--warehouse-card: #f7fbff;");
	    expect(styles).toContain("--warehouse-card: #16101a;");
	    expect(styles).not.toContain("background: var(--surface-2);");
	    expect(printStyles).toContain(".packet .print-settings-card");
	  });

	  it("gives standalone print settings the same resolved warehouse contours and control rhythm", () => {
	    expect(styles).toContain(".packet .print-settings-card {\n  --warehouse-card: var(--surface);");
	    expect(styles).toContain('html[data-audit-theme="light"] .packet .print-settings-card {');
	    expect(styles).toContain('html[data-audit-theme="dark"] .packet .print-settings-card {');
	    expect(styles).toContain("--warehouse-line: #c7e2ff;");
	    expect(styles).toContain("--warehouse-line: #3b2435;");
	    expect(printStyles).toContain(".print-settings-card :is(.warehouse-print-group-create .subtle-button");
	    expect(printStyles).toContain("min-height: 40px;");
	  });
});
