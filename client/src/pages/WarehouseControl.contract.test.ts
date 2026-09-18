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
    expect(page).toContain("Адреса и технические идентификаторы Эвотор здесь не выводятся");
    expect(page).toContain("Запись в Эвотор, изменение кассы и показ адреса исключены");
    expect(page).toContain("syncEvotorDocumentPage.useMutation");
    expect(page).toContain("Документы");
    expect(page).not.toContain("evotorStoreName");
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
    expect(page).toContain("Сохранить группу");
    expect(page).toContain("Скрыть группу");
  });
});
