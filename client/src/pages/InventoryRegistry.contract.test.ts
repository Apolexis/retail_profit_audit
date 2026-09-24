import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./InventoryRegistry.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../inventory-registry.css", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
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
	  expect(page).toContain("Закрыть инвентаризацию…");
	  expect(page).toContain('create.mutate({ storeId: selectedStoreId, businessDate, note: "" })');
	  expect(page).not.toContain('{!active && <label className="inventory-note">');
	  expect(router).toContain('if (actor.role === "seller") throw new TRPCError');
	});

	it("не оставляет нижнюю команду закрытия: верхнее сохранение и отдельная защита исключают несохраненный close", () => {
		expect(page).toContain("const closeBlocked = !active?.lines.length || close.isPending || hasPendingDraftChanges || hasInvalidLineQuantity || isSavingLineChanges");
		expect(page).toContain('className="subtle-button subtle-danger inventory-close-trigger"');
		expect(page).toContain('disabled={closeBlocked}');
		expect(page).toContain("Сначала сохраните изменения пересчета.");
		expect(page).not.toContain('className="inventory-close-actions"><ConfirmDangerDialog');
		expect(css).toContain('.packet .inventory-close-trigger:disabled');
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

	it("не округляет молча фактическое количество с четвертым знаком", () => {
	  expect(page).toContain('Math.round(parsed * 1_000) === parsed * 1_000 ? parsed : null');
	  expect(page).toContain("Фактическое количество должно быть неотрицательным и содержать не более трех знаков после точки");
	  expect(page).toContain('countedQuantity: parsed');
	});

	it("позволяет руководителю архивировать только закрытый пересчет без удаления движений", () => {
	  expect(page).toContain("archiveClosed.useMutation");
	  expect(page).toContain("Удалить из истории");
	  expect(page).toContain("Закрытый пересчет будет архивирован");
	});

	it("дает руководителю заполнить черновик известными остатками и сортировать номером или товаром в заголовке", () => {
	  expect(page).toContain("fillFromAccounting");
	  expect(page).toContain("Добавить все позиции из учетных остатков");
	  expect(page).toContain("Добавить позиции из учетных остатков");
	  expect(page).toContain('const [lineSort, setLineSort]');
	  expect(page).toContain('inventory-sort-heading');
	  expect(page).toContain('onClick={() => setLineSort("code")}');
	  expect(page).toContain('onClick={() => setLineSort("product")}');
	  expect(page).not.toContain("По категориям");
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
    expect(page).toContain('aria-current={item.id === activeInventoryId ? "true" : undefined}');
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

	it("на phone отменяет legacy min-width таблицы и не создаёт горизонтальное таскание", () => {
	  expect(overrides).toContain("/* The inventory table turns into fact cards before the mobile sidebar leaves");
	  expect(overrides).toContain(".packet .inventory-lines.data-table,");
	  expect(overrides).toContain("display: grid !important; width: 100% !important; min-width: 0 !important;");
	  expect(overrides).toContain(".packet .inventory-lines.data-table > tbody > tr { grid-template-columns: repeat(2, minmax(0, 1fr)) !important;");
	});

	it("не смешивает каталог и себестоимость с ревизией", () => {
    expect(page).not.toContain("ЭВОТОР · READ-ONLY PREVIEW");
    expect(page).not.toContain("ВНУТРЕННЯЯ СЕБЕСТОИМОСТЬ");
    expect(page).not.toContain("confirmEvotorCatalog.mutate");
    expect(page).not.toContain("updateInternalCost");
  });

	it("дает редактировать факт прямо в каждой строке и сохранять изменения сверху", () => {
	  expect(page).toContain('className="packet-link inventory-save-lines"');
	  expect(page).toContain("saveDraftChanges");
    expect(page).toContain("lineQuantityDraft");
    expect(page).toContain('className="inventory-inline-quantity"');
    expect(page).toContain('aria-label={`Фактический остаток: ${line.canonicalName}`}');
    expect(page).toContain("inventory-revision-totals");
    expect(page).toContain("Разница:");
	    expect(page).toContain("Сохранено строк:");
	    expect(css).toContain(".packet .inventory-inline-quantity input");
	    expect(page).toContain('className="inventory-revision-totals-heading">ИТОГО');
	    expect(page).toContain("accountedPositions < total.positions");
	    expect(css).toContain(".packet .inventory-revision-totals-heading");
	  });

	  it("не дает создавать номенклатуру из пересчета", () => {
	    expect(page).not.toContain('href={`/catalog-control/new?return=${encodeURIComponent(`/inventory-control?store=${active.storeId}`)}`}');
	    expect(page).toContain("Добавить в ревизию");
	  });

		it("не выводит квадратный контур истории за пределы строки", () => {
		    expect(css).toContain("overflow: hidden; padding: 0 10px 0 0;");
		    expect(css).toContain(".inventory-history-list > article:focus-within { border-color: var(--inventory-accent); box-shadow: 0 0 0 2px var(--inventory-accent-faint); }");
		    expect(css).toContain("@media (hover: hover) and (pointer: fine) {\n  .packet .inventory-history-list > article:hover");
		    expect(css).toContain(".packet .inventory-history-select:hover { transform: none !important;");
			    expect(css).toContain(".inventory-draft-card > .card-title { flex-direction: column; align-items: stretch; }");
		    expect(css).toContain("background: transparent; color: var(--inventory-accent);");
		    expect(css).toContain("@media (max-width: 920px) {");
		    expect(css).toContain(".packet .inventory-history-select { grid-template-columns: minmax(0, 1fr) auto; gap: 3px 10px; }");
		  });

	it("на phone растягивает действия черновика по доступной ширине без переполнения", () => {
	  expect(css).toContain(".packet .inventory-draft-card > .card-title { display: grid; grid-template-columns: minmax(0, 1fr); justify-content: initial; }");
	  expect(css).toContain(".packet .inventory-table-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; justify-content: initial; align-self: stretch; }");
	  expect(css).toContain(".packet .inventory-table-actions .inventory-close-trigger { grid-column: 1 / -1; }");
	  expect(css).toContain(".packet .inventory-table-actions :is(.subtle-button, .inventory-save-lines) { width: 100%; flex: none; justify-content: center; }");
});

	it("сохраняет комментарий и строки одной верхней командой", () => {
	  expect(page).toContain("const saveDraftChanges");
	  expect(page).toContain("noteChanged");
	  expect(page).toContain('onClick={() => void saveDraftChanges()}');
	  expect(page).toContain("Сохранить пересчет");
	  expect(page).not.toContain("сохранится верхней кнопкой");
	  expect(page).not.toContain("Сохранить комментарий");
	});

		it("дает пересчету эталонный stepper без отдельного поискового поля", () => {
	  expect(page).toContain('className="inventory-quantity-stepper"');
	  expect(page).toContain("adjustNewQuantity(-1)");
	  expect(page).toContain("adjustDraftQuantity(line, 1)");
	  expect(page).toContain('aria-label={`Уменьшить фактический остаток: ${line.canonicalName}`}');
	  expect(css).toContain(".packet .inventory-quantity-stepper { display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px;");
	  expect(css).toContain(".packet .inventory-inline-quantity { display: grid; grid-template-columns: 32px minmax(0, 1fr) 32px;");
	  expect(page).toContain('searchPlaceholder="Название, № или категория"');
		});

		it("дает кнопкам количества тематичный hover только для указателя мыши", () => {
		  expect(overrides).toContain(".packet .request-quantity-stepper .subtle-button:hover");
		  expect(overrides).toContain("@media (hover: hover) and (pointer: fine)");
		});

});
