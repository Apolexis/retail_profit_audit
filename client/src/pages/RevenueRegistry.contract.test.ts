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
    expect(page).toContain('label: "Коммунальные платежи нал"');
    expect(page).toContain('label: "Доставка нал"');
    expect(page).toContain('placeholder="Куда / зачем / за что"');
    expect(page).toContain('Нал + Б/Нал + все наличные расходы');
    expect(page).toContain('commentRequiredExpenseFields');
    expect(page).toContain('displayMoscowTimestamp');
  });

  it("использует общий календарь одной даты и утвержденную карточную форму", () => {
    expect(page).toContain('ExactDateControl value={registryDate}');
    expect(page).toContain('title="ДАТА РЕЕСТРА ВЫРУЧКИ"');
    expect(page).toContain('className="packet-card revenue-rule-disclosure"');
    expect(styles).toContain('.packet .revenue-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('@media (max-width: 760px)');
    expect(styles).toContain('.packet .revenue-input-grid,');
    expect(styles).toContain('.packet .revenue-amount { display: grid; align-content: start; gap: 8px; min-width: 0; min-height: 104px; padding: 15px; border: 1px solid var(--line);');
  });

  it("делает печать журналируемой, компактной таблицей, после выбора даты", () => {
    expect(page).toContain('trpc.revenueRegistry.print.useMutation()');
    expect(page).toContain('window.print()');
    expect(page).toContain('<Printer size={14}/>');
    expect(page.indexOf('className="revenue-filter-row"')).toBeLessThan(page.indexOf('className="revenue-register-actions"'));
    expect(page).toContain('className="revenue-print-summary"');
    expect(styles).toContain('.packet .revenue-print-summary { display: none; }');
    expect(styles).toContain('.packet .revenue-register-table tbody tr:nth-child(even) { background: #f1f1f1; }');
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

  it("собирает ежедневную передачу в раскрываемую форму с отдельными блоками оплат и расходов", () => {
    expect(page).toContain('className="packet-card revenue-entry-card"');
    expect(page).not.toContain('className="packet-card revenue-entry-card" open');
    expect(page).toContain('className="revenue-entry-summary"');
    expect(page).toContain('ОПЛАТЫ');
    expect(page).toContain('НАЛИЧНЫЕ РАСХОДЫ');
    expect(styles).toContain('.packet .revenue-entry-card:not([open]) .revenue-entry-summary');
    expect(styles).toContain('.packet .revenue-field-section');
  });

  it("повторяет палитру карточек «Сигналов» в обеих темах", () => {
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .revenue-entry-card');
    expect(styles).toContain('linear-gradient(145deg,#191019,#101216)');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .revenue-amount');
    expect(styles).toContain('border-color: #553345;');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .revenue-entry-card');
    expect(styles).toContain('background: #fff;');
  });
});
