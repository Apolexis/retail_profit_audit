import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./RevenueRegistry.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers/revenueRegistry.ts", import.meta.url), "utf8");
const accessRouter = readFileSync(new URL("../../../server/routers/localAuth.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../revenue-registry.css", import.meta.url), "utf8");

describe("контракт страницы Выручка", () => {
  it("показывает все согласованные поля, пояснения расходов и живой итог", () => {
    expect(page).toContain('label: "Нал"');
    expect(page).toContain('label: "Б/Нал"');
    expect(page).toContain('label: "Расходы нал"');
    expect(page).toContain('label: "Ком. плат. нал"');
    expect(page).toContain('label: "Доставка нал"');
    expect(page).toContain('placeholder="Куда / зачем / за что"');
    expect(page).toContain('Нал + Б/Нал + все наличные расходы');
    expect(page).toContain('commentRequiredExpenseFields');
    expect(page).toContain('displayMoscowTimestamp');
  });

  it("использует общий календарь одной даты и компактную карточную форму", () => {
    expect(page).toContain('ExactDateControl value={registryDate}');
    expect(page).toContain('title="ДАТА РЕЕСТРА ВЫРУЧКИ"');
    expect(page).toContain('className="packet-card revenue-rule-disclosure"');
    expect(styles).toContain('.packet .revenue-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.packet .revenue-input-grid,');
    expect(styles).toContain('.packet .revenue-amount { display: grid; align-content: start; gap: 8px; min-width: 0; min-height: 104px; padding: 15px; border: 1px solid var(--revenue-quiet-line);');
  });

  it("закрывает ежедневную передачу по умолчанию и снова после успешного создания", () => {
    expect(page).toContain('const entryCardRef = useRef<HTMLDetailsElement>(null);');
    expect(page).toContain('entryCardRef.current?.removeAttribute("open")');
    expect(page).toContain('className="packet-card revenue-entry-card" ref={entryCardRef}');
    expect(page).not.toContain('className="packet-card revenue-entry-card" open');
    expect(page).toContain('className="revenue-entry-summary"');
    expect(page).toContain('ОПЛАТЫ');
    expect(page).toContain('НАЛИЧНЫЕ РАСХОДЫ');
    expect(styles).toContain('.packet .revenue-entry-card:not([open]) .revenue-entry-summary');
  });

  it("показывает заполненные расходы в таблице Ритма, а не скрывает их в раскрытии", () => {
    expect(page).toContain('const visibleExpenseFields = fields.filter');
    expect(page).toContain('visibleExpenseFields.map(field => <th className="numeric-column"');
    expect(page).toContain('visibleExpenseFields.map(field => <td className="numeric-column"');
    expect(page).toContain('className="data-table-wrap revenue-register-table-wrap"');
    expect(page).toContain('onPointerDown={beginRegisterDrag}');
    expect(page).toContain('className="table-total"');
    expect(page).not.toContain('className="revenue-details"');
    expect(styles).toContain('.packet .data-table-wrap.revenue-register-table-wrap { overflow-x: auto; overflow-y: hidden; cursor: grab; touch-action: pan-y;');
    expect(styles).toContain('.packet .revenue-register-table.data-table tbody tr:nth-child(even) td { background: var(--revenue-table-zebra); }');
  });

  it("раскрывает редактор при изменении записи из реестра", () => {
    expect(page).toContain('entryCardRef.current?.setAttribute("open", "");');
    expect(page).toContain('onClick={() => fillEdit(record)}');
  });

  it("показывает комментарии расходов прямо в рабочем реестре", () => {
    expect(page).toContain('const hasExpenseComments = printComments.length > 0;');
    expect(page).toContain('formatRecordComments');
    expect(page).toContain('Комментарии расходов');
    expect(page).toContain('className="revenue-comment-cell"');
  });

  it("печатает отдельный черно-белый лист с датой, zebra-таблицей, итогом и комментариями", () => {
    expect(page).toContain('trpc.revenueRegistry.print.useMutation()');
    expect(page).toContain('window.print()');
    expect(page).toContain('<Printer size={14}/>');
    expect(page.indexOf('className="revenue-filter-row"')).toBeLessThan(page.indexOf('className="revenue-register-actions"'));
    expect(page).toContain('id="revenue-print-root"');
    expect(page).toContain('createPortal(');
    expect(page).toContain('className="revenue-print-table"');
    expect(page).toContain('— {field.label}:');
    expect(styles).toContain('/* Print uses a separate sheet, never the interactive/sortable registry table. */');
    expect(styles).toContain('body > :not(#revenue-print-root) { display: none !important; }');
    expect(styles).toContain('@page { size: A4 portrait; margin: 7mm; }');
    expect(styles).toContain('html, body { background: #fff !important; color: #000 !important; }');
    expect(styles).toContain('background: #fff !important; color: #000; box-shadow: none;');
    expect(styles).toContain('thead th:nth-child(3) { white-space: nowrap; }');
	    expect(styles).toContain(':is(thead, tbody, tfoot) :is(th, td):last-child { background: #fff !important;');
    expect(styles).toContain('font-family: Arial, sans-serif; font-size: 9pt;');
    expect(styles).toContain('font-family: "Arial Black", Arial, sans-serif;');
	    expect(styles).not.toContain(':is(thead, tbody, tfoot) :is(th, td):nth-child(even) { background: #f0f0f0 !important; }');
    expect(styles).toContain('thead th { background: #fff !important;');
    expect(styles).not.toContain('tfoot :is(th, td) { background: #d8d8d8 !important; }');
  });

  it("отделяет синий light-контур от сдержанной темной поверхности", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet {');
    expect(styles).toContain('--revenue-accent: #0a84ff;');
    expect(styles).toContain('--revenue-panel: #edf6ff;');
    expect(styles).toContain('--revenue-table-zebra: #f6faff;');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet {');
    expect(styles).toContain('--revenue-panel: #0e0a11;');
    expect(styles).toContain('--revenue-table-zebra: #1b121c;');
    expect(styles).not.toContain('#d64146');
    expect(styles).not.toContain('#d55b63');
    expect(styles).toContain('--revenue-accent: #ff765f;');
	  expect(styles).toContain('.revenue-amount { background: #f8fcff !important; border-color: #b9d9f5 !important; }');
	  expect(styles).toContain('.revenue-amount input { background: #fff !important; border-color: #9dcbed !important; }');
	  expect(styles).toContain('.revenue-amount { background: #19131d !important; border-color: #3b2435 !important; }');
  });

  it("не выводит в реестре логин или телефон автора передачи", () => {
    expect(page).not.toContain('{record.createdByName}</small>');
  });

  it("делает удаление администратора обратимым, с причиной и общим журналом", () => {
    expect(page).toContain('trpc.revenueRegistry.remove.useMutation({');
    expect(page).toContain('Причина удаления');
    expect(page).toContain('Удалить из реестра');
    expect(page).toContain('<Trash2 size={14}/>Удалить');
    expect(router).toContain('operational_revenue.remove');
    expect(router).toContain('created.wasRecreated ? "operational_revenue.recreate"');
    expect(router).toContain('businessDate: input.from ?? input.to ?? null');
  });

  it("ограничивает продавца одной точкой, пятью собственными записями и исключает финансовые права", () => {
    expect(router).toContain('requireSellerStore');
    expect(router).toContain('const storeIds = actor.role === "seller" ? [await requireSellerStore');
    expect(router).toContain('limit: actor.role === "seller" ? 5 : 50');
    expect(router).toContain('Продавец может передавать выручку только за свою точку');
    expect(accessRouter).toContain('targetBefore.role === "seller" && (input.grants.length !== 1');
    expect(accessRouter).toContain('операционным доступом «Просмотр»');
  });

  it("не открывает реестр до обязательной смены первичного пароля магазина", () => {
    expect(router).toContain('if (account.mustChangePassword) throw new TRPCError');
    expect(router).toContain('Сначала измените первичный пароль в профиле');
  });
});
