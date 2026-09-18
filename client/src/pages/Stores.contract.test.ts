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

});
