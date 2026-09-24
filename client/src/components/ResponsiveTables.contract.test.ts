import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../catalog-control.css", import.meta.url), "utf8");
const stock = readFileSync(new URL("../stock-control.css", import.meta.url), "utf8");
const warehouse = readFileSync(new URL("../warehouse-control.css", import.meta.url), "utf8");
const transfers = readFileSync(new URL("../stock-transfers.css", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");
const receipts = readFileSync(new URL("../shipment-receipts.css", import.meta.url), "utf8");
const onec = readFileSync(new URL("../onec-import.css", import.meta.url), "utf8");
const evotorReceipts = readFileSync(new URL("../evotor-receipts.css", import.meta.url), "utf8");

describe("адаптивные расчетные таблицы", () => {
  it("оставляет широкие таблицы внутри прокручиваемого контейнера на средней ширине", () => {
    expect(styles).toContain("@media (max-width: 1050px)");
    expect(styles).toContain(".packet .data-table-wrap { width: 100%; max-width: 100%; overflow-x: auto !important;");
    expect(styles).toContain(".packet .data-table-wrap .data-table { width: max-content; min-width: 100%; }");
  });

  it("не отменяет fixed desktop-layout операционных реестров общим auto-layout", () => {
    expect(styles).toContain(".packet .data-table:not(.catalog-table):not(.stock-table):not(.warehouse-table) { table-layout: auto; }");
    expect(styles).not.toContain(".packet .data-table { table-layout: auto; }");
    expect(catalog).toContain("@media (min-width: 1681px)");
    expect(catalog).toContain(".packet .catalog-table { width: 100%; min-width: 0; max-width: 100%; table-layout: fixed; }");
    expect(stock).toContain(".packet .stock-table { width: 100%; min-width: 0; max-width: 100%; table-layout: fixed; }");
    expect(warehouse).toContain(".packet .warehouse-table.data-table { width: 100%; min-width: 0; max-width: 100%; table-layout: fixed;");
  });

  it("не маскирует overflow wide-таблиц hidden-контейнером и сохраняет читаемый перенос", () => {
    expect(catalog).toContain(".packet .catalog-table-wrap.data-table-wrap { width: 100%; min-width: 0; max-width: 100%; overflow: visible; cursor: default; }");
    expect(stock).toContain(".packet .stock-table-wrap.data-table-wrap { width: 100%; min-width: 0; max-width: 100%; overflow: visible; cursor: default; }");
    expect(catalog).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(stock).toContain("white-space: normal; overflow-wrap: anywhere;");
    expect(warehouse).toContain("min-width: 0; border-color: var(--warehouse-line); white-space: normal; overflow-wrap: anywhere;");
  });

  it("даёт остальным рабочим реестрам тот же wide-контракт без drag-scroll", () => {
    expect(transfers).toContain("@media (min-width:1401px)");
    expect(transfers).toContain("width:100%;min-width:0;max-width:100%;table-layout:fixed");
    expect(inventory).toContain("@media (min-width: 1401px)");
    expect(inventory).toContain("width: 100%; min-width: 0; max-width: 100%; table-layout: fixed;");
    expect(receipts).toContain(".packet .receipt-table{width:100%;min-width:0;max-width:100%;table-layout:fixed}");
    expect(onec).toContain("@media (min-width:1401px)");
    expect(onec).toContain("width:100%;min-width:0;max-width:100%;table-layout:fixed");
    expect(evotorReceipts).toContain("@media (min-width:1401px)");
    expect(evotorReceipts).toContain("width:100%;min-width:0;max-width:100%;table-layout:fixed");
    for (const [name, css] of Object.entries({ transfers, inventory, receipts, onec, evotorReceipts })) {
      expect(css, name).toContain("overflow-wrap");
    }
  });
});
