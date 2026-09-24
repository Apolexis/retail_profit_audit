import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./RevenueRegistry.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers/revenueRegistry.ts", import.meta.url), "utf8");
const revenueService = readFileSync(new URL("../../../server/revenueRegistry.ts", import.meta.url), "utf8");
const accessRouter = readFileSync(new URL("../../../server/routers/localAuth.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../revenue-registry.css", import.meta.url), "utf8");
const finalOverrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

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
	  expect(page).toContain('formatMoneyRubles');
	  expect(page).not.toContain('value.toFixed(2).replace');
	});

  it("использует общий календарь одной даты и компактную карточную форму", () => {
    expect(page).toContain('ExactDateControl value={registryDate}');
    expect(page).toContain('title="ДАТА РЕЕСТРА ВЫРУЧКИ"');
    expect(page).toContain('className="packet-card revenue-rule-disclosure"');
    expect(styles).toContain('.packet .revenue-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('@media (max-width: 980px)');
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
	  expect(styles).toContain('@media (max-width: 1400px)');
	  expect(styles).toContain('.packet .data-table-wrap.revenue-register-table-wrap { overflow: visible !important; cursor: default !important;');
	  expect(page).toContain('className="revenue-total-cell numeric-column"');
		  expect(styles).toContain('.packet .revenue-register-table tfoot .revenue-total-cell');
		  expect(styles).toContain('.packet .revenue-register-table tfoot .revenue-total-cell { display: block; grid-column: 1 / -1;');
		  expect(styles).toContain('.packet .revenue-register-table tbody td.revenue-comment-cell { overflow-wrap: anywhere; }');
		});

  it("раскрывает редактор при изменении записи из реестра", () => {
    expect(page).toContain('entryCardRef.current?.setAttribute("open", "");');
    expect(page).toContain('onClick={() => fillEdit(record)}');
  });

  it("сохраняет измененную дату административной записи как часть новой версии", () => {
    expect(page).toContain('correct.mutate({ recordId: editing.id, businessDate, correctionReason, entry })');
    expect(router).toContain('recordId: z.number().int().positive(), businessDate, correctionReason');
    expect(router).toContain('businessDate: input.businessDate, correctionReason: input.correctionReason');
    expect(revenueService).toContain('businessDate: input.businessDate, currentVersion: nextVersion');
    expect(revenueService).toContain('За новую дату по выбранному магазину уже передана запись «Выручки»');
  });

  it("обновляет факты Ритма после создания, исправления или удаления передачи", () => {
    expect(page).toContain('utils.audit.dashboard.invalidate()');
    expect(page).toContain('utils.audit.dashboardAvailability.invalidate()');
    expect(page).toContain('Нал, Б/Нал и общая выручка появились в «Ритме» для этой точки и даты.');
  });

	  it("показывает комментарии расходов прямо в рабочем реестре", () => {
	    expect(page).toContain('const hasExpenseComments = screenPrintComments.length > 0;');
	    expect(page).toContain('formatRecordComments');
    expect(page).toContain('Комментарии расходов');
    expect(page).toContain('className="revenue-comment-cell"');
  });

	  it("печатает серверную проекцию с отдельной зеброй только внутри таблицы", () => {
	    expect(page).toContain('trpc.revenueRegistry.print.useMutation()');
	    expect(page).toContain('window.print()');
    expect(page).toContain('<Printer size={14}/>');
    expect(page.indexOf('className="revenue-filter-row"')).toBeLessThan(page.indexOf('className="revenue-register-actions"'));
	    expect(page).toContain('id="revenue-print-root"');
	    expect(page).toContain('createPortal(');
	    expect(page).toContain('className="revenue-print-table"');
	    expect(page).toContain('const openRevenuePrint = () =>');
	    expect(page).toContain('document.body.dataset.printTarget = "revenue"');
	    expect(page).toContain('const [printProjection, setPrintProjection]');
	    expect(page).toContain('if (!result.records.length)');
	    expect(page).toContain('records: result.records as RevenueRecord[]');
	    expect(page).toContain('data-zebra-mode={printProjection.zebraMode}');
	    expect(page).toContain('querySelectorAll(".revenue-print-table tbody tr")');
	    expect(page).toContain('if (!sheet || !rowCount)');
	    expect(page).toContain('portal is intentionally display:none on screen until print media applies');
	    expect(page).toContain('Печать недоступна: для выбранной даты и магазина нет действующих строк реестра.');
	    expect(page).toContain('— {field.label}:');
	    expect(styles).toContain('/* Print uses a separate sheet, never the interactive/sortable registry table. */');
	    expect(styles).toContain('body[data-print-target="revenue"] > :not(#revenue-print-root) { display: none !important; }');
	    expect(styles).not.toContain('body > :not(#revenue-print-root) { display: none !important; }');
	    expect(styles).toContain('@page { size: A4 portrait; margin: 4mm; background: #fff; }');
    expect(styles).toContain('html, body, #root, html::before, html::after, body::before, body::after { background: #fff !important; color: #000 !important; }');
    expect(styles).toContain('background: #fff !important; color: #000; box-shadow: none;');
    expect(styles).toContain('thead th:nth-child(3) { white-space: nowrap; }');
	    expect(styles).toContain(':is(thead, tbody, tfoot) :is(th, td):last-child { background: #fff !important;');
    expect(styles).toContain('font-size: var(--revenue-print-body-size, 9pt);');
    expect(styles).toContain('font-weight: var(--revenue-print-heading-weight, 700);');
	    expect(styles).toContain('#revenue-print-root[data-zebra-mode="rows"] .revenue-print-table thead th');
	    expect(styles).toContain('#revenue-print-root[data-zebra-mode="columns"] .revenue-print-table thead th:nth-child(even)');
	    expect(styles).toContain('background: #ccc !important;');
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

		  it("не оставляет hover-подсветку финансовых полей и строк на touch-устройствах", () => {
		    expect(styles).toContain(".revenue-amount:focus-within { border-color: var(--revenue-quiet-line); background: var(--revenue-accent-faint); box-shadow: none; }");
		    expect(styles).toContain(".revenue-entry-card :is(input, textarea, .app-select-trigger[data-slot=\"select-trigger\"]):focus-visible { border-color: var(--revenue-accent) !important; outline: none !important; box-shadow: none !important; }");
	    expect(styles).toContain("@media (hover: hover) and (pointer: fine) {\n  .packet .revenue-amount:hover");
	    expect(styles).toContain(".revenue-register-table.data-table tbody tr:focus-within td");
	    expect(styles).toContain('html[data-audit-theme="light"] .packet :is(.revenue-entry-card, .revenue-rule-disclosure):hover');
	    expect(styles).toContain('html[data-audit-theme="dark"] .packet :is(.revenue-entry-card, .revenue-rule-disclosure):hover');
	    expect(finalOverrides).toContain('@media (hover: hover) and (pointer: fine) {\n  html[data-audit-theme="light"] .packet :is(.revenue-registry');
	  });

	  it("сохраняет карточный реестр на границе 760px без max-content overflow", () => {
	    expect(styles).toContain(".packet .revenue-admin-register .revenue-register-table.data-table { min-width: 0; }");
	    expect(styles).not.toContain("@media (max-width: 760px) {\n  .packet .revenue-admin-register .revenue-register-table.data-table { min-width: max-content; }");
	  });

	  it("не выводит в реестре логин или телефон автора передачи", () => {
    expect(page).not.toContain('{record.createdByName}</small>');
  });

	  it("дает печать финансового реестра административному персоналу по назначенным точкам", () => {
    expect(router).toContain('print: protectedProcedure');
    expect(router).toContain('const isRevenueAdministrativeRole = (role: string) => role === "admin" || role === "analyst" || role === "manager";');
    expect(router).toContain('if (!isRevenueAdministrativeRole(actor.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Печать реестра доступна только административному персоналу" });');
    expect(router).toContain('const storeIds = await getAccessibleStoreIds(ctx.user?.openId);');
    expect(page).toContain('const isAdministrative = isAdmin || me.data?.role === "analyst" || isManager;');
    expect(page).toContain('const permittedRevenueStores = isAdmin ? (stores.data ?? []).filter(store => !store.isHidden) : (revenueStores.data ?? []);');
    expect(revenueService).toContain('eq(stores.isHidden, false)');
    expect(page).toContain('const canSubmitRevenue = isSeller || isAdmin;');
    expect(page).toContain('{canSubmitRevenue && <section className="revenue-layout">');
    expect(page).toContain('{isSeller && <section className="packet-card revenue-own-history">');
    expect(page).toContain('Только печать');
    expect(page).toContain('{isAdministrative && <section className="packet-card revenue-admin-register">');
	    expect(page).toContain('className="revenue-register-actions"');
	  });

	  it("хранит вид печати выручки отдельно от заявок и не журналирует пустую печать", () => {
	    expect(router).toContain('printSettings: protectedProcedure');
	    expect(router).toContain('updatePrintSettings: protectedProcedure');
	    expect(router).toContain('Настройки печати выручки доступны только администратору');
	    expect(router).toContain('operational_revenue_print_settings.update');
		  expect(router).toContain('const printTypography = { headingFontSize: printSettings.headingFontSize');
		  expect(router).toContain('if (!records.length) return { recordCount: 0, records, zebraMode: printSettings.zebraMode, ...printTypography };');
		  expect(router).toContain('return { recordCount: records.length, records, zebraMode: printSettings.zebraMode, ...printTypography };');
	    expect(revenueService).toContain('operationalRevenuePrintSettings');
	    expect(revenueService).toContain('getOperationalRevenuePrintSettings');
	    expect(revenueService).toContain('updateOperationalRevenuePrintSettings');
	  });

	  it("дает печатному действию достаточную ширину и сильный тематичный contour", () => {
	    expect(styles).toContain('.packet .revenue-register-actions .subtle-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 210px; min-height: 38px;');
	    expect(styles).toContain('@media (max-width: 980px)');
	    expect(styles).toContain('box-shadow: 0 0 0 2px rgba(10, 132, 255, .18);');
	    expect(styles).toContain('box-shadow: 0 0 0 2px rgba(255, 118, 95, .2);');
	  });

  it("не размещает факты Эвотор в операционном реестре выручки", () => {
    expect(page).not.toContain("trpc.revenueRegistry.reconciliation.useQuery");
    expect(page).not.toContain("СВЕРКА С ЧЕКАМИ ЭВОТОР");
    expect(page).not.toContain("revenue-reconciliation");
    expect(revenueService).not.toMatch(/(?:POST|PUT|PATCH|DELETE)\s+https?:\/\/[^\n]*evotor/i);
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
