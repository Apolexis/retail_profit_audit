import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./InventoryRegistry.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers/inventoryRegistry.ts", import.meta.url), "utf8");

describe("интерфейс операционной инвентаризации", () => {
  it("не переиспользует старую финансовую страницу остатков", () => {
    expect(page).toContain("Инвентаризация магазина");
    expect(page).toContain("Номенклатура, остатки и себестоимость ведутся на отдельных страницах");
    expect(page).toContain("trpc.inventoryRegistry");
    expect(page).not.toContain("trpc.audit.metrics");
  });

  it("берет товар только из рабочего справочника и не создает вымышленные строки", () => {
    expect(page).toContain("Выберите товар из внутреннего справочника");
    expect(page).toContain("добавьте товар, которого нет в черновике");
    expect(page).toContain("ноль означает реально пустую позицию");
  });

  it("дает продавцу создать черновик, но не закрыть пересчет", () => {
    expect(page).toContain("Вы можете подготовить пересчет");
    expect(page).toContain("Закрыть и создать корректировки может назначенный руководитель или администратор");
    expect(page).toContain("Проверить и закрыть");
    expect(router).toContain('if (actor.role === "seller") throw new TRPCError');
  });

  it("переносит удаление черновика в историю и сохраняет общий аудит", () => {
    expect(page).toContain("trpc.inventoryRegistry.deleteDraft");
    expect(page).toContain('item.status === "draft" && <ConfirmDangerDialog');
    expect(page).toContain("Удалить черновик");
    expect(page).toContain("Учетные остатки не изменятся");
    expect(page).toContain('className="inventory-history-select"');
    expect(page).toContain('<article className={item.id === activeInventoryId ? "selected" : ""}');
    expect(router).toContain('action: "inventory.draft.delete"');
    expect(router).toContain('afterState: { deleted: true }');
  });

  it("называет сброс открытого пересчета отменой и ставит иконку слева", () => {
    expect(page).toContain('<X size={14}/>Отмена');
    expect(page).not.toContain('onClick={startNewInventory}>Новый пересчет');
    expect(page).toContain('<Save size={14}/>');
    expect(page).toContain('<Plus size={16}/>');
    expect(page).toContain('<Trash2 size={14}/>{deleteDraft.isPending ? "Удаляем…" : "Удалить"}');
  });

  it("разделяет учетный остаток, физический факт и расхождение", () => {
    expect(page).toContain("Учетный остаток и факт — разные значения");
    expect(page).toContain("Учетный остаток");
    expect(page).toContain("Расхождение");
    expect(page).toContain("accountingQuantity");
    expect(css).toContain('.packet .inventory-accounting-readout');
    expect(page).toContain('className="inventory-quantity-input"');
    expect(page).toContain('{selectedProduct ? catalogUnitLabel[selectedProduct.baseUnit] : "Ед."}');
    expect(css).toContain('.packet .inventory-quantity-input small { position: absolute; right: 10px;');
  });

  it("дает руководителю заполнить черновик известными остатками и упорядочить строки по категориям", () => {
    expect(page).toContain("fillFromAccounting");
    expect(page).toContain("Заполнить учетными остатками");
    expect(page).toContain("По категориям");
    expect(page).toContain("sortedLines");
    expect(router).toContain("fillFromAccounting:");
    expect(router).toContain('action: "inventory.lines.fill_from_accounting"');
  });

	it("переносит поиск товара в селект, а интерактивная история не содержит вложенных кнопок", () => {
	    expect(page).toContain("FreeScrollSelect");
	    expect(page).toContain('searchPlaceholder="Название, № или категория"');
	    expect(page).not.toContain('label>Поиск товара');
    expect(css).toContain('.packet .inventory-history-list > article { display: grid;');
    expect(css).toContain('.packet .inventory-history-select { display: grid;');
    expect(page).not.toContain('<button type="button" className={item.id === activeInventoryId');
  });

  it("использует для таблицы пересчета тот же drag-scroll контейнер, что и Ритм", () => {
    expect(page).toContain('className="data-table-wrap inventory-lines-wrap"');
    expect(css).toContain('.packet .inventory-lines-wrap { overflow-x: auto; cursor: grab;');
  });

  it("использует синие поверхности в light и нейтральные в dark без заливки coral", () => {
    expect(css).toContain('html[data-audit-theme="light"] .packet {');
    expect(css).toContain('--inventory-accent: #0a84ff;');
    expect(css).toContain('--inventory-panel: #edf6ff;');
    expect(css).toContain('html[data-audit-theme="dark"] .packet {');
    expect(css).toContain('--inventory-card: #16101a;');
    expect(css).toContain('--inventory-panel: #0e0a11;');
    expect(css).toContain('coral is an outline, never a table fill');
    expect(css).not.toContain('#533043');
    expect(css).not.toContain('#a85b72');
    expect(css).not.toContain('#121824');
  });

	it("использует общий календарь и одно-колоночную мобильную форму", () => {
    expect(page).toContain("ExactDateControl");
    expect(page).not.toContain('type="date"');
    expect(css).toContain("@media (max-width: 760px)");
	  expect(css).toContain(".packet .inventory-line-create { grid-template-columns: 1fr; }");
	});

	it("сворачивает строки пересчета в подписанные карточки на узком экране", () => {
	  expect(page).toContain('data-label="Фактически"');
	  expect(page).toContain('data-label="Расхождение"');
	  expect(css).toContain(".inventory-lines tbody tr:nth-child(even) { display: grid");
	  expect(css).toContain("content: attr(data-label)");
	  expect(css).toContain("@media (max-width: 1400px)");
	  expect(css).toContain(".inventory-lines-wrap.data-table-wrap { overflow: visible !important; cursor: default !important;");
	});

	it("не смешивает каталог и себестоимость с ревизией", () => {
    expect(page).not.toContain("ЭВОТОР · READ-ONLY PREVIEW");
    expect(page).not.toContain("ВНУТРЕННЯЯ СЕБЕСТОИМОСТЬ");
    expect(page).not.toContain("confirmEvotorCatalog.mutate");
    expect(page).not.toContain("updateInternalCost");
  });

  it("дает редактировать факт прямо в каждой строке и сохранять изменения сверху", () => {
    expect(page).toContain('className="packet-link inventory-save-lines"');
    expect(page).toContain("saveLineChanges");
    expect(page).toContain("lineQuantityDraft");
    expect(page).toContain('className="inventory-inline-quantity"');
    expect(page).toContain('aria-label={`Фактический остаток: ${line.canonicalName}`}');
    expect(page).toContain("inventory-revision-totals");
    expect(page).toContain("Разница:");
    expect(page).toContain("Сохранено строк:");
    expect(css).toContain(".packet .inventory-inline-quantity input");
  });

  it("дает перейти в общий справочник, если товара нет в пересчете", () => {
    expect(page).toContain("Нет товара");
    expect(page).toContain('href={`/catalog-control/new?return=${encodeURIComponent(`/inventory-control?store=${active.storeId}`)}`}');
    expect(page).toContain("Добавить в ревизию");
  });

	  it("не выводит квадратный контур истории за пределы строки", () => {
	    expect(css).toContain("overflow: hidden; padding: 0 10px 0 0;");
	    expect(css).toContain(".inventory-history-list > article:focus-within { border-color: var(--inventory-accent); box-shadow: 0 0 0 2px var(--inventory-accent-faint); }");
	    expect(css).toContain("@media (hover: hover) and (pointer: fine) {\n  .packet .inventory-history-list > article:hover");
	    expect(css).toContain(".inventory-draft-card > .card-title { flex-direction: column; align-items: stretch; }");
	    expect(css).toContain("background: transparent; color: var(--inventory-accent);");
	  });

});
