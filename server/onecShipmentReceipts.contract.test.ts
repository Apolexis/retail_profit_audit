import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const onec = readFileSync(new URL("./onecImport.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/ShipmentReceipts.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/src/shipment-receipts.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("приёмка накладных 1С", () => {
  it("сохраняет фактические строки отдельно от исходной накладной", () => {
    expect(schema).toContain("operationalOnecShipmentReceipts");
    expect(schema).toContain("operationalOnecShipmentReceiptLines");
    expect(onec).toContain("reportOnecShipmentReceipt");
    expect(onec).toContain("validateCountedQuantity(line.actualQuantity)");
    expect(onec).toContain("Передайте фактическое количество по каждой строке накладной");
  });

  it("передаёт расхождение руководителю или администратору и проводит только подтвержденный факт", () => {
    expect(router).toContain("Расхождение приёмки подтверждает только руководитель или администратор");
    expect(router).toContain("confirmOnecShipmentReceipt");
    expect(onec).toContain("applyConfirmedShipmentReceipt");
    expect(onec).toContain('kind: "shipment_receipt" as const');
    expect(onec).toContain("confirmed_shipment_receipt_movement");
    expect(schema).toContain('unique("operational_stock_movement_receipt_line_uq")');
    expect(page).toContain("Подтверждённая приёмка сразу учитывается во временном остатке");
    expect(page).toContain("Поздний снимок Эвотор заменит этот временный расчёт без двойного учёта");
  });

  it("даёт магазину маршрут приёмки без раскрытия исходных ключей 1С", () => {
    expect(app).toContain('path="/shipment-receipts"');
    expect(app).toContain('"/shipment-receipts"');
    expect(onec).toContain("source IDs and warehouse references stay server-side");
    expect(page).not.toContain("source_record_id");
    expect(page).not.toContain("destinationReference");
  });

  it("выравнивает пустые карточки очереди и выбранной накладной на desktop", () => {
    expect(css).toContain(".receipt-layout{align-items:stretch}");
    expect(css).toContain(".receipt-queue,.packet .receipt-detail{display:flex;flex-direction:column}");
    expect(css).toContain(".receipt-queue>.empty-state,.packet .receipt-detail>.empty-state{flex:1}");
  });
});
