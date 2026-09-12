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
    expect(shell).toContain('className="packet-top" data-audit-theme={theme} style={{backgroundColor:theme==="dark"?"#0c0b12":"#ffffff",colorScheme:theme}}');
  });

  it("выводит контекст периода отдельными строками", () => {
    expect(shell).toContain('className="analysis-filter-copy"');
    expect(css).toContain(".packet .analysis-filter-copy { display:grid!important; grid-template-columns:minmax(0,1fr)!important;");
    expect(css).toContain(".packet .analysis-filter-copy > :is(span,strong,small) { display:block!important;");
  });

  it("дает установленному мобильному приложению компактные переходы без перекрытия контента", () => {
    expect(shell).toContain('className="mobile-quick-nav"');
    expect(shell).toContain('standalone?"packet pwa-standalone":"packet"');
    expect(shell).toContain('const isStandalonePwa=()=>');
    expect(shell).toContain('document.documentElement.dataset.pwaStandalone==="true"');
    expect(shell).toContain('window.addEventListener("pageshow",update)');
    expect(shell).toContain('aria-label="Назад"');
    expect(shell).not.toContain('aria-label="Домой"');
    expect(shell).toContain('aria-label="Вперёд"');
    expect(shell).toContain('aria-label="Обновить данные"');
    expect(shell).toContain("{standalone&&<nav className=\"mobile-quick-nav\"");
    expect(shell).toContain('className="mobile-quick-action mobile-quick-back"');
    expect(shell).toContain('className="mobile-quick-action mobile-quick-forward"');
    expect(shell).toContain('className="mobile-quick-action mobile-quick-refresh"');
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain(".packet.pwa-standalone .packet-main { padding-bottom: 112px; }");
    expect(css).toContain(".packet.pwa-standalone .scroll-top { bottom: calc(env(safe-area-inset-bottom, 0px) + 80px) !important; }");
    expect(css).not.toContain(".packet:has(.mobile-quick-nav) .packet-main");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-action");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-action:focus-visible");
    expect(css).toContain("min-height: 39px;");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-refresh { border-color: color-mix(in srgb, var(--blue) 48%, var(--line)); background: transparent; }");
    expect(css).toContain(".mobile-quick-refresh { border-color: #c9dceb !important; background: #ffffff !important;");
    expect(shell).not.toContain("clearActionFocus");
    expect(shell).not.toContain("data-pointer-action");
    expect(shell).toContain('onClick={()=>window.history.forward()}');
    expect(shell).toContain('const refreshApp=()=>{window.location.reload();};');
    expect(shell).toContain('onClick={refreshApp}');
    expect(css).not.toContain('.packet .mobile-quick-nav button[data-pointer-action="true"]');
    expect(shell).toContain('href={profileItem[0]} onClick={event=>event.currentTarget.blur()}');
    expect(shell).toContain("event.currentTarget.blur();setMenuOpen(value=>!value)");
    expect(shell).toContain("{showTop&&!menuOpen&&<button className=\"scroll-top\"");
    expect(css).toContain('body:has(.chart-expand-dialog[data-state="open"]) .packet .scroll-top');
    expect(css).toContain('body:has(.chart-expand-dialog[data-state="open"]) .packet .mobile-quick-nav');
    expect(css).toContain('.packet.pwa-standalone .mobile-quick-nav');
    expect(css).toContain('@media (hover: none), (pointer: coarse)');
  });

  it("не сжимает профиль при раскрытии категорий навигации", () => {
    expect(css).toContain('.packet .packet-nav-list { align-content: start !important; grid-auto-rows: max-content !important; }');
    expect(css).toContain('.packet .packet-profile-link { box-sizing: border-box !important; align-self: start !important; flex: 0 0 34px !important; width: calc(100% - 10px) !important; height: 34px !important;');
    expect(css).toContain('.packet .drawer-profile-link { box-sizing: border-box !important; align-self: start !important; flex: 0 0 39px !important; width: calc(100% - 10px) !important; height: 39px !important;');
    expect(css).toContain('flex: 0 0 40px !important;');
    expect(css).toContain('width: calc(100% - 10px) !important;');
    expect(shell).toContain('className="brand-mark-switch"');
    expect(shell).toContain('(["dark","light"] as const).map(markTheme');
    expect(shell).toContain('loading="eager" decoding="sync"');
  });
});
