import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./Inventory.tsx", import.meta.url), "utf8");

describe("страница «Остатки»", () => {
  it("разделяет уровень запаса, товарный поток и потери", () => {
    expect(page).toContain("Уровень запаса");
    expect(page).toContain("Товарный поток");
    expect(page).toContain("Потери запаса");
    expect(page).toContain("Количественные остатки в книге не ведутся");
  });

  it("добавляет закупки, продажи и оба вида списаний к выбору показателей", () => {
    expect(page).toContain("purchases");
    expect(page).toContain("salesSmoked");
    expect(page).toContain("salesFrozen");
    expect(page).toContain("writeoffsTotal");
    expect(page).toContain("lossesTotal");
  });

  it("сводит длинный остаточный профиль к ключевым метрикам и аналитическому выводу", () => {
    expect(page).toContain("inventory-profile-card");
    expect(page).toContain("inventory-profile-grid");
    expect(page).toContain("profileInsight");
    expect(page).toContain("Покрытие выше медианы");
    expect(page).toContain("Потери запаса составляют");
  });
});
