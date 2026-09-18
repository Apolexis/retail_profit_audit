import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/Stores.tsx"), "utf8");

describe("профиль магазина", () => {
  it("сохраняет полный финансовый разбор", () => {
    expect(page).toContain("Одна точка — весь P&amp;L, товар, остаток и расходы.");
    expect(page).toContain("ВСЕ РАСХОДЫ");
    expect(page).toContain("expenseDefinitions");
  });

  it("показывает read-only факты Эвотор отдельно от финансового P&L", () => {
    expect(page).toContain("evotorSalesAnalytics.useQuery");
    expect(page).toContain("ЧЕКИ ЭВОТОР · READ-ONLY");
    expect(page).toContain("не пересчитывает финансовый P&amp;L");
    expect(page).toContain('href=\"/evotor-sales/metrics\"');
    expect(page).toContain('href=\"/evotor-sales/products\"');
    expect(page).toContain("<BarChart3 size={15} /> Показатели Эвотор");
    expect(page).toContain("<ShoppingBasket size={15} /> Проданные товары");
  });
});
