import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./StoreRequests.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../store-requests.css", import.meta.url), "utf8");
const printSettings = readFileSync(new URL("./PrintSettings.tsx", import.meta.url), "utf8");

describe("заявки магазинов: экран", () => {
  it("предлагает только точки, разрешенные текущему пользователю", () => {
    expect(page).toContain("inventoryRegistry.requestStores.useQuery");
    expect(page).toContain("const accessibleStores = stores.data ?? []");
    expect(page).not.toContain("trpc.audit.stores.useQuery");
  });

  it("использует общий справочник по раскрываемым категориям и не выводит себестоимость", () => {
    expect(page).toContain("requestProducts");
    expect(page).toContain("request-category-trigger");
    expect(page).toContain("Поиск товара");
    expect(page).toContain("request-product-row");
    expect(page).toContain("видно только администратору");
    expect(page).not.toContain("internalCostPrice");
    expect(page).not.toContain("evotorCostPrice");
  });

  it("меняет количество прямо в строке, дает ручную request-only строку и показывает расчеты", () => {
    expect(page).toContain("upsertRequestLine");
    expect(page).toContain("removeRequestLine");
    expect(page).toContain("changeProductQuantity");
    expect(page).toContain("request-quantity-stepper");
    expect(page).toContain("addRequestManualLine");
    expect(page).toContain("manualPrintCategoryGroupId");
    expect(page).toContain("Рекомендуем заказать");
    expect(page).toContain("средняя продажа за день + запас");
    expect(page).toContain("product.supplyStockState");
    expect(page).toContain("maxStoreCoverDays");
    expect(page).toContain("норма категории");
  });

  it("возвращает пользователя в уже открытый черновик и закрывает весь печатный запуск только уполномоченному персоналу", () => {
    expect(page).toContain('toast.success(result.created ? "Черновик заявки открыт" : "Открыт существующий черновик")');
    expect(page).toContain("requestPrintCandidates");
    expect(page).toContain("closeRequestsForPrint");
    expect(page).toContain("Распечатать и закрыть все");
    expect(page).not.toContain('>Закрыть заявку<');
    expect(page).toContain("const canPrintRequests = Boolean(isManager || isAdmin);");
  });

  it("печатает все активные группы без пользовательского выбора подборки", () => {
    expect(page).toContain("printRequests");
    expect(page).not.toContain("printCategoryGroupIds");
    expect(page).toContain("Все настроенные группы");
    expect(page).toContain("store-request-print-sheet");
    expect(page).toContain("ПЕЧАТЬ ЗАЯВОК");
    expect(page).toContain("const canPrintRequests = Boolean(isManager || isAdmin);");
    expect(page).toContain('{canPrintRequests && <section className="packet-card request-print-config">');
  });

  it("не возвращает общий комментарий и оставляет два комментария к категориям печати", () => {
    expect(page).not.toContain("Комментарий к заявке");
    expect(printSettings).toContain("requestCommentSlot");
    expect(printSettings).toContain("Комментарий 1");
    expect(printSettings).toContain("Комментарий 2");
    expect(printSettings).toContain("категория печати");
    expect(page).not.toContain("Комментарий к заявке");
    expect(page).not.toContain("Общее примечание к заказу");
  });
});

describe("заявки магазинов: адаптивность и печать", () => {
  it("не превращает desktop в телефонную раскладку раньше необходимого и перестраивает узкий экран", () => {
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain(".request-product-row { grid-template-columns: 1fr;");
    expect(styles).toContain(".request-open-form,");
    expect(styles).toContain("overflow: hidden");
  });

  it("использует A4 portrait с отдельными листами для сформированной подборки", () => {
    expect(styles).toContain("@page { size: A4 portrait; margin: 4mm; }");
    expect(styles).toContain(".store-request-print { display: block !important;");
    expect(styles).toContain("break-after: page");
  });

  it("сохраняет тематическую иерархию полей и контуров без двойного outline", () => {
    expect(styles).toContain("--request-accent: #0a84ff");
    expect(styles).toContain("--request-accent: #ff765f");
    expect(styles).toContain(".request-history-list > article:hover");
    expect(styles).toContain("border-color: var(--request-line)");
    expect(styles).toContain("box-shadow: 0 0 0 1px var(--request-accent-faint)");
    expect(styles).not.toContain("outline: 2px");
  });
});
