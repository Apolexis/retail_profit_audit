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

  it("делает печать журналируемой и выводит раздельные блоки со всеми строками", () => {
    expect(page).toContain('trpc.revenueRegistry.print.useMutation()');
    expect(page).toContain('window.print()');
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
