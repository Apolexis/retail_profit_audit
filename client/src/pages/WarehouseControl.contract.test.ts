import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./WarehouseControl.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../warehouse-control.css", import.meta.url), "utf8");

describe("warehouse control contract", () => {
  it("treats a store as a warehouse with an assigned price type", () => {
    expect(page).toContain("Склады и виды цен");
    expect(page).toContain("setStorePriceType.useMutation");
    expect(page).toContain("Вид продажной цены");
    expect(page).toContain("Товар не дублируется по магазинам");
  });

	it("keeps Evotor read-only and omits addresses", () => {
	  expect(page).toContain("READ‑ONLY ЭВОТОР");
	  expect(page).toContain("Адреса и технические идентификаторы в интерфейсе не показываются");
	  expect(page).toContain("Запись в Эвотор исключена");
	  expect(page).toContain("Автоматическая read-only синхронизация");
	  expect(page).toContain("каждые 15 минут");
	  expect(page).toContain("каждые 10 минут");
	  expect(page).not.toContain("syncEvotorDocumentPage.useMutation");
	  expect(page).not.toContain("Загрузить документы");
	  expect(page).not.toContain("Обновить данные Эвотор");
	  expect(page).toContain("setWarehouseEvotorMapping.useMutation");
  });

  it("registers the administrator-only operational route and themed table", () => {
    expect(app).toContain('path="/warehouse-control"');
    expect(shell).toContain('["/warehouse-control", "27", "Склады", true]');
    expect(styles).toContain('--warehouse-accent: var(--packet-accent);');
    expect(styles).toContain('only the shared theme tokens decide surfaces and contours');
    expect(styles).toContain('.warehouse-table.data-table');
  });

	it("allows a warehouse to join an editable print group", () => {
	  expect(page).toContain("createPrintGroup.useMutation");
	  expect(page).toContain("setWarehousePrintGroup.useMutation");
	  expect(page).toContain("Новая группа печати");
	  expect(page).toContain("Группа печати сохранена");
	  expect(page).toContain("<EyeOff size={14}/>Скрыть");
	  expect(page).toContain("deletePrintGroup.useMutation");
	  expect(page).toContain("Склады будут отсоединены только от этой группы");
	});

	it("allows print categories to be renamed and deleted without changing goods", () => {
    expect(page).toContain("updatePrintCategoryGroup.useMutation");
    expect(page).toContain("deletePrintCategoryGroup.useMutation");
    expect(page).toContain("Категория печати сохранена");
	  expect(page).toContain("Товары не изменятся, а вложенные связи будут отсоединены.");
	});

	it("stacks warehouse data into labelled cards on narrow screens", () => {
		expect(page).toContain('data-label="Склад / магазин"');
		expect(page).toContain('data-label="Действие"');
		expect(styles).toContain(".warehouse-table tbody > tr:not(.warehouse-settings-row)");
		expect(styles).toContain("content: attr(data-label)");
	});

	it("keeps summary, open settings and print categories within the approved blue/coral hierarchy", () => {
		expect(styles).toContain(".warehouse-category-print-card {");
		expect(styles).toContain("background: var(--warehouse-panel);");
		expect(styles).toContain("border-top: 1px solid var(--warehouse-line);");
		expect(styles).toContain("--warehouse-card: #f7fbff;");
		expect(styles).toContain("--warehouse-card: #16101a;");
		expect(styles).not.toContain("background: var(--surface-2);");
	});
});
