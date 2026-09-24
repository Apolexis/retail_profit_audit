import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./EvotorReceipts.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../evotor-receipts.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("реестр чеков Эвотор", () => {
  it("регистрирует отдельный admin-only экран в аналитике", () => {
    expect(app).toContain('path="/evotor-sales/receipts" component={EvotorReceipts}');
    expect(shell).toContain('["/evotor-sales/receipts", "34", "Чеки Эвотор", true]');
    expect(shell).toContain('recommendations["34"]');
  });

  it("начинается с текущего московского дня, хранит границу 2025 и загружает чеки страницами по 30", () => {
    expect(page).toContain('const EVOTOR_ANALYTICS_START = "2025-01-01"');
    expect(page).toContain("const defaultReceiptRange");
    expect(page).toContain('limit: 30');
    expect(page).toContain("const [pageOffset, setPageOffset]");
    expect(page).toContain("offset: pageOffset");
    expect(page).toContain("Показать еще");
    expect(page).toContain("Номер · МСК-время · сумма");
    expect(page).toContain("staleTime: 45_000");
    expect(page).toContain("refetchInterval: 60_000");
  });

	  it("ищет по явной команде, а состав открывает с доступным переходом", () => {
    expect(page).toContain("const [searchDraft, setSearchDraft]");
    expect(page).toContain("const [appliedSearch, setAppliedSearch]");
    expect(page).toContain('setAppliedSearch(searchDraft)');
	  expect(page).toContain('placeholder="Номер, магазин, МСК-время или сумма"');
	  expect(page).toContain('Поиск чека по номеру, магазину, московскому времени или сумме');
	    expect(page).toContain('className="receipt-search-clear"');
	    expect(page).toContain('scrollIntoView({ block: "start", behavior: "smooth" })');
		  expect(page).toContain('detailHeadingRef.current?.focus({ preventScroll: true })');
		  });

	  it("дает в том же периодном блоке выбор всех или одного магазина и заметно закрывает состав", () => {
	    expect(page).toContain("setSelectedStores");
	    expect(page).toContain('aria-label="Выбрать магазин для реестра чеков"');
	    expect(page).toContain("Все магазины");
	    expect(page).toContain('className="subtle-button receipt-detail-close"');
	    expect(page).toContain("Закрыть состав");
	    expect(css).toContain(".packet .evotor-receipt-period { grid-template-columns: minmax(240px, 1fr) minmax(310px, auto) minmax(238px, 300px);");
	  });

	  it("по ссылке уведомления показывает только точный возврат, без запуска общего реестра", () => {
    expect(page).toContain("const isReturnNotificationView");
    expect(page).toContain("evotorReturnNotificationDetail.useQuery");
    expect(page).toContain("УВЕДОМЛЕНИЕ О ВОЗВРАТЕ");
    expect(page).toContain("Общий реестр чеков, оплаты и финансовые итоги не раскрываются");
    expect(page).toContain("Показаны только сохранённые позиции и итог конкретного возврата");
    expect(page).toContain("enabled: !demoMode && !isReturnNotificationView");
  });

	it("не округляет состав чеков до рублей или сотых и не подменяет неизвестное нулем", () => {
    expect(page).toContain("const moneyText = (value: number | null | undefined)");
    expect(page).toContain("const quantityText = (value: number | null, unit: string | null)");
    expect(page).toContain("formatQuantityWithUnit(value, normalizeEvotorQuantityUnit(unit))");
    expect(page).toContain("Неполная сумма");
    expect(page).not.toContain("position.resultSum ?? 0");
  });

  it("показывает состав чека без технических и фискальных идентификаторов", () => {
    expect(page).toContain("СОСТАВ ЧЕКА");
    expect(page).toContain("Состав показан только по уже нормализованным товарным строкам");
    expect(page).not.toContain("evotorDocumentId");
    expect(page).not.toContain("fiscal");
    expect(page).toContain("normalizeEvotorQuantityUnit(unit)");
  });

	it("не смешивает демо с реальной витриной и сохраняет touch-адаптацию", () => {
	  expect(page).toContain("enabled: !demoMode");
	  expect(page).toContain("Чеки Эвотор отключены в демо‑режиме");
	  expect(css).toContain("@media (hover:hover) and (pointer:fine)");
	  expect(css).toContain("@media (max-width:860px)");
	  expect(css).toContain("@media print");
	});

		it("на phone отделяет карточки чеков, выравнивает все значения влево и растягивает загрузку", () => {
		  expect(css).toContain(".packet .evotor-receipt-table tbody{gap:12px}");
		  expect(css).toContain("border:1px solid color-mix(in srgb,var(--packet-accent) 44%,var(--packet-line)) !important");
		  expect(css).toContain("border-radius:12px");
		  expect(css).toContain("box-shadow:0 2px 0 color-mix(in srgb,var(--packet-accent) 16%,transparent)");
		  expect(css).toContain('html[data-audit-theme="light"] .packet :is(.evotor-receipt-table, .evotor-receipt-detail-table) tbody tr');
		  expect(css).toContain("border-color:#76b7f3 !important");
		  expect(css).toContain("box-shadow:0 2px 0 rgba(10,132,255,.17) !important");
		  expect(css).toContain('html[data-audit-theme="dark"] .packet :is(.evotor-receipt-table, .evotor-receipt-detail-table) tbody tr');
		  expect(css).toContain("border-color:#6b3848 !important");
		  expect(css).toContain("box-shadow:0 2px 0 rgba(255,118,95,.18) !important");
	  expect(css).toContain('body .packet .evotor-receipt-register .evotor-receipt-table td[data-label="Время"],');
	  expect(css).toContain('body .packet .evotor-receipt-register .evotor-receipt-table td[data-label="Сумма"]{text-align:left !important}');
	  expect(css).toContain('body .packet .evotor-receipt-detail .evotor-receipt-detail-table td[data-label="Количество"],');
	  expect(css).toContain('body .packet .evotor-receipt-detail .evotor-receipt-detail-table td[data-label="Сумма строки"]{text-align:left !important}');
	  expect(css).toContain(".packet .evotor-receipt-more{display:grid;grid-template-columns:minmax(0,1fr);justify-items:stretch;width:100%;gap:6px}");
	  expect(css).toContain(".packet .evotor-receipt-more .subtle-button{width:100%;justify-content:center}");
	});

		it("показывает единый компактный статус и покрытие по магазинам без технических данных", () => {
		  expect(page).toContain("evotorSyncStatus.useQuery");
		  expect(page).toContain("СИНХРОНИЗАЦИЯ И ПОКРЫТИЕ ЧЕКОВ");
		  expect(page).toContain('className="packet-card evotor-receipt-sync"');
		  expect(page).not.toContain('className="packet-card evotor-receipt-sync" open');
		  expect(page).toContain("единственный технический статус чеков Эвотор");
		  expect(page).toContain("не является бизнес-сигналом");
		  expect(page).toContain("const latestStoredReceiptAt");
		  expect(page).toContain("const syncHeadline");
		  expect(page).toContain("currentDaySync.completedStores");
		  expect(page).toContain("storeCoverage");
		  expect(page).toContain("const compactMoscowDateTime");
		  expect(page).toContain("Последний документ");
		  expect(page).toContain("Текущий день:");
		  expect(page).toContain("Архив 2025+ не перечитывается");
		  expect(page).toContain('className="evotor-sync-summary-grid"');
		  expect(page).toContain('className="evotor-sync-coverage"');
		  expect(page).not.toContain("У каждой видимой точки есть отдельный минутный поток");
		  expect(page).not.toContain("terminalUuid");
		  expect(css).toContain(".packet .evotor-receipt-sync[open]>summary::after");
		  expect(css).toContain(".packet .evotor-sync-trust");
		  expect(css).toContain(".packet .evotor-sync-summary-grid");
		  expect(css).not.toContain(".packet .evotor-sync-kpis");
		});

		it("объединяет поиск и очистку в тематичный компактный control", () => {
		  expect(css).toContain(".packet .evotor-receipt-search{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto");
		  expect(css).toContain(".packet .receipt-search-clear{display:grid;place-items:center;width:30px;height:30px");
		  expect(css).toContain('html[data-audit-theme="light"] .packet .evotor-receipt-search{border-color:#c7e2ff;background:#f4f9ff');
		  expect(css).toContain('html[data-audit-theme="dark"] .packet .evotor-receipt-search{border-color:#3b2435;background:#17111b');
		  expect(css).not.toContain(".packet .evotor-receipt-search .subtle-button{margin-left:24px}");
		});

		it("поясняет, что сверка оплат означает равенство состава оплат итогу чека", () => {
		  expect(page).toContain("Оплаты сверены с итогом");
		  expect(page).toContain("состав оплат = итогу");
		  expect(page).toContain("Оплаты переданы и сверены по сумме чека.");
		});

		it("показывает только безопасные агрегаты внесённых наличных и сдачи", () => {
		  expect(page).toContain("cashTenderedAmount");
		  expect(page).toContain("cashChangeAmount");
		  expect(page).toContain("Внесено наличными:");
		  expect(page).toContain("сдача:");
		  expect(page).not.toContain("paymentSystemId");
		  expect(page).not.toContain("cardNumber");
		});

		it("даёт администратору только ограниченную сверку сохранённых несверенных оплат", () => {
		  expect(page).toContain("reconcileEvotorPayments.useMutation");
		  expect(page).toContain("Повторно читаются только уже сохранённые несверенные чеки по их ID");
		  expect(page).toContain("Архив не обходится, запись в Эвотор не выполняется");
		  expect(page).toContain("Уточнить оплаты");
		  expect(page).toContain("evotorSalesAnalytics.invalidate");
		  expect(css).toContain(".packet .evotor-payment-repair{display:flex");
		  expect(css).toContain("@media (max-width:560px)");
		});

		it("сокращает покрытие до полезных МСК-фактов и не обрезает длинные значения", () => {
		  expect(page).toContain("${store.documentsInPeriod} чек.");
		  expect(page).toContain("Нет загруженных документов");
		  expect(page).not.toContain("чек. в выбранном периоде");
		  expect(css).toContain(".packet .evotor-store-coverage article{grid-template-columns:minmax(0,1fr) auto");
		  expect(css).toContain("overflow-wrap:anywhere");
		  expect(css).toContain(".packet .evotor-store-coverage article{gap:3px 6px;padding:9px 10px}");
		});
});
