import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(import.meta.dirname, "StockTransfers.tsx"), "utf8");
const styles = readFileSync(resolve(import.meta.dirname, "../stock-transfers.css"), "utf8");
const app = readFileSync(resolve(import.meta.dirname, "../App.tsx"), "utf8");
const shell = readFileSync(resolve(import.meta.dirname, "../components/AuditShell.tsx"), "utf8");

describe("страница перемещений", () => {
  it("выводит отдельные отправитель и получатель, а не меняет остаток сразу", () => {
    expect(page).toContain("Склад-отправитель");
    expect(page).toContain("Склад-получатель");
    expect(page).toContain("Черновик не меняет остатки");
    expect(page).toContain("Провести перемещение");
  });

	it("показывает рекомендацию на продажах за 7 дней и остатки обеих сторон", () => {
	  expect(page).toContain("Рекомендация по перемещению");
	  expect(page).toContain("продажам за 7 дней");
	  expect(page).toContain("Учетный остаток отправителя");
	  expect(page).toContain("Учетный остаток получателя");
	});

		  it("дает осмысленный сброс нового выбора и тематичный stepper для количества", () => {
		    expect(page).toContain("const cancelNewTransfer");
		    expect(page).toContain("const closeTransferDraft");
		    expect(page).toContain("<ArrowLeft size={15}/>Отмена");
		    expect(page).not.toContain("Сбросить выбор");
	    expect(page).toContain('className="subtle-button transfer-cancel-draft" onClick={closeTransferDraft}');
	  expect(page).toContain("<ExactDateControl value={businessDate}");
	  expect(page).toContain('ariaLabel="Выбрать дату перемещения"');
	  expect(page).not.toContain('type="date"');
	  expect(page).toContain("transfer-quantity-stepper");
		    expect(page).toContain("Уменьшить количество");
		    expect(page).toContain("Увеличить количество");
		    expect(page).toContain("const adjustQuantity");
		    expect(page).toContain("const quantityStep = selectedProduct?.baseUnit === \"piece\" ? 1 : 0.5");
		    expect(page).toContain("const snapTransferQuantity = (raw: string, step: number)");
		    expect(page).toContain("onBlur={() => setQuantity(current => snapTransferQuantity(current, quantityStep))}");
		    expect(page).toContain("Шаг {quantityStep}{selectedUnit}");
	  expect(styles).toContain(".transfer-form-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))");
		  expect(styles).toContain(".transfer-quantity-stepper{display:grid;grid-template-columns:40px minmax(0,1fr) 40px");
	    expect(styles).toContain(".transfer-date-control .date-range-control{width:100%;min-height:40px}");
	  });

		  it("дает подтверждаемое удаление draft прямо в истории", () => {
		    expect(page).toContain('"transfer-history-entry is-selected" : "transfer-history-entry"');
		    expect(page).toContain('item.status === "draft" && <ConfirmDangerDialog');
		    expect(page).toContain('className="subtle-button subtle-danger transfer-history-delete"');
		    expect(page).toContain('onConfirm={() => removeDraft.mutate({ transferId: item.id })}');
		    expect(styles).toContain(".transfer-history-entry{display:grid;grid-template-columns:minmax(0,1fr) auto");
		    expect(styles).toContain(".transfer-history-delete{display:inline-flex;align-items:center;gap:6px;margin:0;padding-inline:10px;white-space:nowrap}");
		  });

		  it("показывает номер документа, а не технический id черновика", () => {
		    expect(page).toContain('type TransferDetail = { id: number; transferNumber: number;');
		    expect(page).toContain('№ {item.transferNumber}');
		    expect(page).toContain('<b>{transferStatusLabel(item.status, itemIsReversalDraft)}</b>');
		    expect(page).not.toContain('№ {item.id}');
		    expect(page).toContain('№ ${active.transferNumber}');
		  });

	it("до проведения показывает доступный остаток и объясняет ручное добавление позиции", () => {
		  expect(page).toContain("ДОСТУПНО У ОТПРАВИТЕЛЯ");
		  expect(page).toContain("Прогноз остатков после проведения");
		  expect(page).toContain("ОТПРАВИТЕЛЬ · БЫЛО → СТАНЕТ");
		  expect(page).toContain("ПОЛУЧАТЕЛЬ · БЫЛО → СТАНЕТ");
	  expect(page).toContain("Позиция не добавляется автоматически");
	  expect(page).toContain("Черновик не меняет остатки");
		  expect(page).toContain("const hasUnconfirmedSource");
		  expect(page).not.toContain("Маркер «остаток не ограничен» Эвотор не считается количеством.");
		  expect(page).toContain("disabled={!active.lines.length || busy || hasUnconfirmedSource}");
	  expect(styles).toContain(".transfer-stock-snapshot");
	  expect(styles).toContain(".transfer-post-blocked");
	});

	it("имеет responsive fallback без page-level overflow", () => {
	  expect(styles).toContain(".transfer-form{display:grid");
	  expect(styles).toContain("@media (max-width:620px)");
	  expect(styles).toContain(".transfer-table-wrap{overflow:visible}");
	  expect(styles).toContain("@media (hover:hover) and (pointer:fine)");
	  expect(styles).toContain(".transfer-form-actions{grid-column:auto}");
	});

	  it("доступна руководителю и администратору, но не продавцу", () => {
    expect(app).toContain('"/stock-transfers"');
    expect(shell).toContain('"transfer"');
    expect(shell).toContain('isAdmin||isManager');
	  });

		  it("создает и ясно маркирует обратный черновик, не меняя проведенный документ", () => {
	    expect(page).toContain("const transferStatusLabel");
	    expect(page).toContain("createStockTransferReversal.useMutation");
	    expect(page).toContain("Создан обратный черновик сторно");
	    expect(page).toContain("<RotateCcw size={15}/>Подготовить обратное сторно");
	    expect(page).toContain("Это обратный черновик к проведенному перемещению");
	    expect(page).toContain("Удалится только непроведенное обратное сторно");
	    expect(page).toContain("Исходное проведенное перемещение не отменится");
    expect(page).toContain('className="subtle-button transfer-cancel-draft" onClick={closeTransferDraft}');
    expect(styles).toContain(".transfer-status.is-reversed");
		    expect(styles).toContain(".transfer-reversal");
		  });

		  it("оформляет историю перемещений как историю инвентаризаций с маршрутом, МСК и статусом", () => {
		    expect(page).toContain("const transferHistoryMoment");
		    expect(page).toContain("formatMoscowDateTime(item.postedAt)");
		    expect(page).toContain("const [historyRange, setHistoryRange]");
		    expect(page).toContain('title="ПЕРИОД ИСТОРИИ ПЕРЕМЕЩЕНИЙ"');
		    expect(page).toContain("stockTransfers.useQuery(historyInput");
		    expect(page).toContain('aria-current={item.id === transferId ? "true" : undefined}');
		    expect(styles).toContain("/* History deliberately follows the inventory history pattern");
		    expect(styles).toContain(".transfer-history-item{display:grid;grid-template-columns:minmax(130px,.62fr) minmax(190px,1.2fr) minmax(250px,1fr) auto");
		    expect(styles).toContain("@media (max-width:980px)");
		    expect(styles).toContain(".packet .transfer-history-item:focus-visible{border-color:transparent!important");
		  });

		  it("перестраивает строки перемещения в подписанные карточки до ширины рабочей области sidebar", () => {
		    expect(styles).toContain("@media (max-width:1400px){");
		    expect(styles).toContain(".packet .transfer-table-wrap.data-table-wrap{overflow:visible!important");
		    expect(styles).toContain(".packet .transfer-table tbody td::before{content:attr(data-label)");
		    expect(styles).toContain(".packet .transfer-table tfoot tr{display:grid");
		  });
});
