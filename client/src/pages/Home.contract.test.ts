import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Сводка»", () => {
  it("показывает вводный управленческий контур выше общего выбора периода", () => {
    expect(home).toContain("Прибыль, запас и риск — в одном управленческом контуре.");
    expect(home).toContain('className="empty-state live-empty home-empty-facts"');
    expect(shell).toContain('analysis-global-slice${kicker.startsWith("00")');
    expect(shell).toContain('ОБЩИЙ СРЕЗ');
    expect(shell).toContain('summary-period-filter');
    expect(styles).toContain('.packet .packet-main:has(> .cover) { display: flex; flex-direction: column; }');
    expect(styles).toContain('.packet .packet-main > .cover { order: -1; }');
    expect(styles).toContain('.packet .packet-main:has(> .cover) > .summary-period-filter { margin-top: 22px !important; }');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .cover > div:first-child > .packet-link:hover { transform: none !important; border-color: #0a84ff !important;');
  });

	  it("показывает структуру способов оплаты по фактическим наличным и безналичным данным", () => {
    expect(home).toContain('const cashShare = paymentBase ? scope.cashRevenue / paymentBase * 100 : 0;');
    expect(home).toContain('const cashlessShare = paymentBase ? scope.cashlessRevenue / paymentBase * 100 : 0;');
    expect(home).toContain('label="Доля наличной выручки"');
    expect(home).toContain('label="Доля безналичной выручки"');
    expect(home).toContain('СПОСОБЫ ОПЛАТЫ · ПО МЕСЯЦАМ');
    expect(home).toContain('chartTitle="Тренд способов оплаты"');
	    expect(styles).toContain('.packet .payment-trend-card');
	  });

	  it("раскладывает KPI устойчивыми парами и растягивает последний нечётный показатель", () => {
	    expect(styles).toContain('.packet .packet-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}');
	    expect(styles).toContain('.packet .packet-kpis > :last-child:nth-child(odd){grid-column:1/-1}');
	    expect(styles).toContain('@media (max-width:560px){.packet .packet-kpis{grid-template-columns:minmax(0,1fr)!important}}');
	  });

	  it("показывает расчетную наценку Коп./Мор./Общий по фактическим продажам и закупкам", () => {
    expect(home).toContain('const markupTrend = useMemo');
    expect(home).toContain('НАЦЕНКА · ПО МЕСЯЦАМ');
    expect(home).toContain('% наценки Коп.');
    expect(home).toContain('% наценки Мор.');
    expect(home).toContain('% наценки Общий');
    expect(home).toContain('расчет из фактических продаж и закупок');
  });

  it("показывает admin-only read-only факты Эвотор с честным охватом и без подмены неполных оплат", () => {
    expect(home).toContain('const mayReadEvotorFacts = me.data?.role === "admin" && !demoMode');
    expect(home).toContain("trpc.inventoryRegistry.evotorSalesAnalytics.useQuery");
    expect(home).toContain("evotorAnalyticsQueryOptions");
    expect(home).toContain("includeProducts: false");
    expect(home).toContain('aria-label="Read-only факты Эвотор"');
    expect(home).toContain("Выручка общая Эвотор");
    expect(home).toContain("Выручка нал Эвотор");
    expect(home).toContain("Выручка б/нал Эвотор");
    expect(home).toContain("Возвраты Эвотор");
    expect(home).toContain("evotorSummary.returnAmount");
    expect(home).toContain("возвратн. док.");
    expect(home).toContain("Чеки Эвотор");
    expect(home).toContain("Средний чек Эвотор");
    expect(home).toContain("чеки есть у");
    expect(home).toContain("const evotorPaymentNote = !evotorSummary?.checks");
    expect(home).toContain("сверенная часть:");
    expect(home).toContain("подтвержденную часть");
    expect(home).toContain("не ожидают фоновой проверки");
	    expect(home).toContain('const evotorMoney = (value: number | null | undefined) => formatMoneyWithKopecks(value);');
	    expect(home).toContain('value={evotorSummary.checks ? evotorMoney(evotorSummary.cashAmount) : "—"}');
	    expect(home).toContain('value={evotorSummary.checks ? evotorMoney(evotorSummary.cashlessAmount) : "—"}');
    expect(home).toContain("evotorFacts.data?.performance?.serviceMs");
    expect(home).toContain("агрегат ${evotorResponseMs ?? \"—\"} мс");
    expect(home).toContain("не заменяет выручку и P&amp;L из импортированной книги");
  });

  it("не блокирует read-only факты Эвотор требованием импортированной книги", () => {
    expect(home).toContain("const stores = trpc.audit.stores.useQuery");
    expect(home).toContain('!facts.available ? mayReadEvotorFacts');
    expect(home).toContain("Загруженные чеки доступны без книги Excel.");
    expect(home).toContain("Ни выручка из Excel, ни P&amp;L, ни расходы не подставляются.");
    expect(home).toContain("const evotorCard = mayReadEvotorFacts");
  });
});
