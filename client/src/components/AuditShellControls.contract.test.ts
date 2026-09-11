import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./AuditShell.tsx", import.meta.url), "utf8");

describe("базовые управляющие элементы", () => {
  it("сохраняет увеличенный правый отступ кнопки «Наверх» на малом и широком экране", () => {
    expect(css).toContain("right: max(45px, calc(env(safe-area-inset-right, 0px) + 45px)) !important");
    expect(css).toContain("@media (min-width: 721px)");
    expect(css).toContain(".packet .scroll-top { left: auto !important; right: 45px !important; }");
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

  it("дает установленному мобильному приложению компактные переходы без перекрытия контента", () => {
    expect(shell).toContain('className="mobile-quick-nav"');
    expect(shell).toContain('aria-label="Назад"');
    expect(shell).not.toContain('aria-label="Домой"');
    expect(shell).toContain('aria-label="Вперёд"');
    expect(shell).toContain('aria-label="Обновить данные"');
    expect(shell).toContain("{standalone&&<nav className=\"mobile-quick-nav\"");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(shell).toContain('const clearActionFocus=(target:HTMLElement)=>{target.dataset.pointerAction="true";');
    expect(shell).toContain("clearActionFocus(event.currentTarget);window.history.forward()");
    expect(css).toContain(".packet .mobile-quick-nav button:focus:not(:focus-visible) { outline: none !important; box-shadow: none !important; }");
    expect(css).toContain('.packet .mobile-quick-nav button[data-pointer-action="true"]:focus { outline: none !important; box-shadow: none !important; }');
    expect(shell).toContain('event.currentTarget.dataset.pointerAction="true";event.currentTarget.blur();window.location.reload()');
    expect(shell).toContain('href={profileItem[0]} onClick={event=>event.currentTarget.blur()}');
    expect(shell).toContain("event.currentTarget.blur();setMenuOpen(value=>!value)");
    expect(shell).toContain("{showTop&&!menuOpen&&<button className=\"scroll-top\"");
    expect(css).toContain('body:has(.chart-expand-dialog[data-state="open"]) .packet .scroll-top');
  });
});
