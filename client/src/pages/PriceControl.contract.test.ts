import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./PriceControl.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Прайс‑контроль»", () => {
  it("использует отдельный двухэтапный импорт и не задействует финансовый импорт", () => {
    expect(page).toContain('"/api/price-import/preview"');
    expect(page).toContain('"/api/price-import/commit"');
    expect(page).toContain("Сначала проверить, затем сохранить");
    expect(page).toContain("Старый импорт финансовых фактов не используется и не изменяется.");
    expect(page).toContain('accept=".xls,.xlsx,.pdf,.docx');
  });

  it("сохраняет приоритет точной связи поставщика с внутренним товаром", () => {
    expect(page).toContain("Точная связь «поставщик → наш товар» имеет приоритет");
    expect(page).toContain("Следующие прайсы этого поставщика будут сопоставляться автоматически.");
    expect(page).toContain("Внутренний товар создан");
    expect(page).toContain("internalCode");
  });

  it("позволяет переназначить или отменить подтвержденную автосвязь без удаления прайс‑листа", () => {
    expect(page).toContain("ПОДТВЕРЖДЕННЫЕ АВТОСВЯЗИ");
    expect(page).toContain("Переназначить");
    expect(page).toContain("Отменить автосвязь");
    expect(page).toContain("reassignAlias");
    expect(page).toContain("unlinkAlias");
  });

  it("показывает нормализованную цену, исходную фасовку и обоснованного победителя", () => {
    expect(page).toContain("ГДЕ ВЫГОДНЕЕ КУПИТЬ");
    expect(page).toContain("Нормализация");
    expect(page).toContain("ВЫГОДНЕЕ КУПИТЬ");
    expect(page).toContain("экономия");
    expect(page).toContain("ResponsiveContainer");
  });

  it("использует разные тематические акценты: iOS‑синий в светлой и коралловый в темной", () => {
    expect(styles).toContain('html[data-audit-theme="light"] .packet { --price-accent: #0a72d5');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet { --price-accent: #ff856d');
    expect(styles).toContain('html[data-audit-theme="light"] .packet .price-product-choice.active');
    expect(styles).toContain('html[data-audit-theme="dark"] .packet .price-product-choice.active');
  });
});
