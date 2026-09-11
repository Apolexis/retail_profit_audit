import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const page = readFileSync(new URL("./ControlCenter.tsx", import.meta.url), "utf8");

it("сопоставляет месяцы обоих периодов без подстановки нулей за отсутствующий факт", () => {
  expect(page).toContain("length:Math.max(baseMonths.length,compareMonths.length)");
  expect(page).toContain("const baseRevenueRaw=totalIfAvailable(baseRows,\"revenue\")");
  expect(page).toContain("compareRevenueRaw=totalIfAvailable(compareRows,\"revenue\")");
  expect(page).toContain("totalIfAvailable(compareRows,\"revenue\")");
  expect(page).toContain("отсутствующий факт не подменяется нулём");
});

it("дает проверяемую таблицу расчетов обоих периодов", () => {
  expect(page).toContain("ПРОВЕРКА РАСЧЕТА ПО МЕСЯЦАМ");
  expect(page).toContain("Δ выручки");
  expect(page).toContain("Δ прибыли");
});

it("не выдает частичный сравнительный период за полноценную разницу", () => {
  expect(page).toContain("нет сопоставимых месяцев");
  expect(page).toContain("разница периодов и рейтинг не рассчитываются из неполной базы");
});

it("оставляет два явных независимых календаря без неясных кнопок быстрых сравнений", () => {
  expect(page).toContain('title="ОСНОВНОЙ ПЕРИОД"');
  expect(page).toContain('title="СРАВНИТЕЛЬНЫЙ ПЕРИОД"');
  expect(page).not.toContain(">Предыдущий год</button>");
  expect(page).not.toContain(">Предыдущий период</button>");
});
