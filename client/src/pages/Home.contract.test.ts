import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Сводка»", () => {
  it("показывает вводный управленческий контур выше общего выбора периода", () => {
    expect(home).toContain("Прибыль, запас и риск — в одном управленческом контуре.");
    expect(home).toContain('className="empty-state live-empty home-empty-facts"');
    expect(shell).toContain('analysis-filter${kicker.startsWith("00")');
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

  it("показывает расчетную наценку Коп./Мор./Общий по фактическим продажам и закупкам", () => {
    expect(home).toContain('const markupTrend = useMemo');
    expect(home).toContain('НАЦЕНКА · ПО МЕСЯЦАМ');
    expect(home).toContain('% наценки Коп.');
    expect(home).toContain('% наценки Мор.');
    expect(home).toContain('% наценки Общий');
    expect(home).toContain('расчет из фактических продаж и закупок');
  });
});
