import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./RevenueRegistry.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../server/routers/revenueRegistry.ts", import.meta.url), "utf8");
const accessRouter = readFileSync(new URL("../../../server/routers/localAuth.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../revenue-registry.css", import.meta.url), "utf8");

describe("контракт страницы Выручка", () => {
  it("показывает все согласованные поля, комментарии расходов и живой итог", () => {
    expect(page).toContain('label: "Нал"');
    expect(page).toContain('label: "Б/Нал"');
    expect(page).toContain('label: "Расходы нал"');
    expect(page).toContain('label: "Ком. плат. нал"');
    expect(page).toContain('label: "Доставка нал"');
    expect(page).toContain('placeholder="Куда / зачем / за что"');
    expect(page).toContain('Нал + Б/Нал + все наличные расходы');
    expect(page).toContain('displayMoscowTimestamp');
  });

  it("использует общий календарь периода и утвержденную карточную форму", () => {
    expect(page).toContain('DateRangeControl value={adminRange}');
    expect(page).toContain('title="ПЕРИОД РЕЕСТРА ВЫРУЧКИ"');
    expect(page).toContain('className="packet-card revenue-rule-disclosure"');
    expect(styles).toContain('.packet .revenue-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.packet .revenue-input-grid,');
    expect(styles).toContain('.packet .revenue-amount { display: grid; align-content: start; gap: 8px; min-width: 0; min-height: 104px; padding: 15px; border: 1px solid var(--line);');
  });

  it("делает печать журналируемой и выводит раздельные блоки со всеми строками", () => {
    expect(page).toContain('trpc.revenueRegistry.print.useMutation()');
    expect(page).toContain('window.print()');
    expect(page).toContain('<Printer size={14}/>');
    expect(page.indexOf('className="revenue-filter-row"')).toBeLessThan(page.indexOf('className="revenue-register-actions"'));
    expect(page).toContain('className="revenue-print-details"');
    expect(styles).toContain('.packet .revenue-print-details { display: none; }');
    expect(styles).toContain('.packet .revenue-print-details { display: grid;');
  });

  it("ограничивает продавца одной точкой, пятью собственными записями и исключает финансовые права", () => {
    expect(router).toContain('requireSellerStore');
    expect(router).toContain('const storeIds = actor.role === "seller" ? [await requireSellerStore');
    expect(router).toContain('limit: actor.role === "seller" ? 5 : 50');
    expect(router).toContain('Продавец может передавать выручку только за свою точку');
    expect(accessRouter).toContain('targetBefore.role === "seller" && (input.grants.length !== 1');
    expect(accessRouter).toContain('операционным доступом «Просмотр»');
  });
});
