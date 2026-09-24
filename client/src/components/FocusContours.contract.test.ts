import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const requests = readFileSync(new URL("../store-requests.css", import.meta.url), "utf8");
const warehouse = readFileSync(new URL("../warehouse-control.css", import.meta.url), "utf8");
const revenue = readFileSync(new URL("../revenue-registry.css", import.meta.url), "utf8");
const stock = readFileSync(new URL("../stock-control.css", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");
const access = readFileSync(new URL("../access.css", import.meta.url), "utf8");

describe("единый фокус полей", () => {
  it("оставляет у общего поиска в раскрывающемся селекте только цвет границы", () => {
    expect(overrides).toContain(".free-scroll-select-search input:focus-visible { border-color: var(--app-select-accent); outline: none; box-shadow: none; }");
    expect(overrides).toContain(".price-select-content .free-scroll-select-search input:focus-visible { border-color: var(--price-menu-accent); outline: none; box-shadow: none; }");
  });

  it("не рисует второй контур у полей заявок, печати, инвентаризации и остатков", () => {
    expect(requests).toContain(".packet .request-quantity-stepper input:focus-visible { border-color: var(--request-accent); outline: none; box-shadow: none; }");
    expect(warehouse).toContain(".warehouse-print-group-create input:focus-visible { outline: none; border-color: var(--warehouse-accent); box-shadow: none; }");
    expect(inventory).toContain(".inventory-line-create .free-scroll-select-trigger:focus-visible { border-color: var(--inventory-accent); box-shadow: none; outline: none; }");
    expect(stock).toContain(".stock-search input:focus-visible { border-color: var(--stock-accent); outline: none; box-shadow: none; }");
  });

  it("не сочетает outline с границей у полей выручки и не подсвечивает всю карточку при вводе", () => {
    expect(revenue).toContain(".revenue-entry-card :is(input, textarea, .app-select-trigger[data-slot=\"select-trigger\"]):focus-visible { border-color: var(--revenue-accent) !important; outline: none !important; box-shadow: none !important; }");
    expect(revenue).toContain(".revenue-amount:focus-within { border-color: var(--revenue-quiet-line); background: var(--revenue-accent-faint); box-shadow: none; }");
  });

  it("сохраняет один border-focus у входа и кастомного переключателя в обеих темах", () => {
    expect(access).toContain(".login-panel input:focus,.stack-form input:focus,.stack-form select:focus,.stack-form textarea:focus{border-color:#d74e78;box-shadow:none}");
    expect(access).toContain(".login-panel .login-store-mode input:focus-visible + .login-store-mode-switch { border-color: #ff765f; outline: none; box-shadow: none; }");
    expect(access).toContain("html[data-audit-theme=\"light\"] .login-panel .login-store-mode input:focus-visible + .login-store-mode-switch { border-color: #0a84ff; outline: none; box-shadow: none; }");
  });
});
