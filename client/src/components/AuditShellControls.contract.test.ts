import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./AuditShell.tsx", import.meta.url), "utf8");

describe("базовые управляющие элементы", () => {
  it("сохраняет увеличенный правый отступ кнопки «Наверх» на малом и широком экране", () => {
    expect(css).toContain("right: max(45px, calc(env(safe-area-inset-right, 0px) + 45px)) !important");
    expect(css).toContain("@media (min-width: 721px)");
    expect(css).toContain(".packet .scroll-top { right: 45px !important; }");
  });

  it("использует общую визуальную систему для темы и уведомлений без сдвига прав доступа", () => {
    expect(css).toContain(":is(.alert-link, .theme-button)");
    expect(css).toContain(".packet .access-switch button:not(.active):hover");
    expect(css).toContain("transform: none !important;");
    expect(home).toContain("home-portfolio-link");
  });

  it("не допускает горизонтального переполнения шапки на ширине 360 px", () => {
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain(".packet .packet-top > div:first-child { min-width: 0; flex: 1 1 auto; }");
    expect(css).toContain(".packet .packet-actions { flex: 0 0 auto; gap: 5px; }");
    expect(css).toContain(".packet .packet-mobile.menu-button { width: 36px !important;");
  });

  it("выводит контекст периода отдельными строками", () => {
    expect(shell).toContain('className="analysis-filter-copy"');
    expect(css).toContain(".packet .analysis-filter-copy { display:grid!important; grid-template-columns:minmax(0,1fr)!important;");
    expect(css).toContain(".packet .analysis-filter-copy > :is(span,strong,small) { display:block!important;");
  });
});
