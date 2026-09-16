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
    expect(shell).toContain('className={demoMode?"packet-demo-toggle is-active":"packet-demo-toggle"}');
    expect(shell).toContain('className={demoMode?"drawer-demo-toggle is-active":"drawer-demo-toggle"}');
    expect(shell).toContain('aria-pressed={demoMode}');
    expect(shell).not.toContain('toast(nextMode?"Демо‑режим включен":"Демо‑режим выключен"');
    expect(shell).not.toContain('demo-data-button');
    expect(css).toContain('.packet .packet-demo-toggle');
  });

  it("не допускает горизонтального переполнения шапки на ширине 360 px", () => {
    expect(css).toContain("@media (max-width: 390px)");
    expect(css).toContain(".packet .packet-top > div:first-child { min-width: 0; flex: 1 1 auto; }");
    expect(css).toContain(".packet .packet-actions { flex: 0 0 auto; gap: 5px; }");
    expect(css).toContain(".packet .packet-mobile.menu-button { width: 36px !important;");
    expect(shell).toContain('key={`packet-top-${theme}`} className="packet-top" data-audit-theme={theme} style={{backgroundColor:theme==="dark"?"#0c0b12":"#ffffff",colorScheme:theme}}');
  });

  it("размещает демо‑режим в нижней части навигации", () => {
    expect(shell).toContain("const toggleDemo=");
    expect(shell).not.toContain("В интерфейсе показаны демонстрационные данные текущего сеанса.");
    expect(shell).toContain('<div className="packet-period">');
    expect(shell.indexOf('className={demoMode?"packet-demo-toggle is-active":"packet-demo-toggle"}')).toBeLessThan(shell.indexOf('<div className="packet-period">'));
  });

  it("сохраняет ритм и рабочую ширину сегментов импортных прав", () => {
    expect(css).toContain(".packet .access-import-row + .access-import-row { margin-top: 16px; padding-top: 16px;");
    expect(css).toContain(".packet .access-import-control-row { margin-top: 16px; padding-top: 16px; }");
    expect(css).toContain("width: min(100%, 480px)");
    expect(css).toContain("@media (min-width: 721px) and (max-width: 900px)");
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
    expect(shell).toContain('aria-label="Обновить страницу"');
    expect(shell).toContain('key={`mobile-quick-nav-${fixedEpoch}`} className="mobile-quick-nav"');
    expect(shell).toContain('mobile-quick-action mobile-quick-back is-navigating');
    expect(shell).toContain('mobile-quick-action mobile-quick-forward is-navigating');
    expect(shell).toContain('mobile-quick-action mobile-quick-refresh is-refreshing');
    expect(shell).toContain('isRefreshing?"Обновляем":"Обновить"');
    expect(shell).toContain('className="mobile-quick-refresh-icon"');
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain(".packet.pwa-standalone .packet-main { padding-bottom: 112px; }");
    expect(css).toContain(".packet.pwa-standalone .scroll-top { bottom: calc(env(safe-area-inset-bottom, 0px) + 80px) !important; }");
    expect(css).not.toContain(".packet:has(.mobile-quick-nav) .packet-main");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-action");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-action:focus-visible");
    expect(css).toContain("min-height: 39px;");
    expect(css).toContain(".packet .mobile-quick-nav .mobile-quick-refresh { border-color: color-mix(in srgb, var(--blue) 48%, var(--line)); background: transparent; }");
    expect(css).toContain(".packet .mobile-quick-refresh.is-refreshing");
    expect(css).toContain(".packet .mobile-quick-refresh.is-refreshing .mobile-quick-refresh-icon");
    expect(css).toContain(".mobile-quick-refresh { border-color: #c9dceb !important; background: #ffffff !important;");
    expect(shell).not.toContain("clearActionFocus");
    expect(shell).not.toContain("data-pointer-action");
    expect(shell).toContain('const moveHistory=(direction:"back"|"forward")=>');
    expect(shell).toContain('const quickRouteHistoryRef=useRef<string[]>([])');
    expect(shell).toContain('const quickRouteStorageKey="audit-quick-route-history"');
    expect(shell).toContain('window.sessionStorage.setItem(quickRouteStorageKey');
    expect(shell).toContain('const knownCursor=paths.lastIndexOf(location);');
    expect(shell).toContain('paths.unshift("/");');
    expect(shell).toContain('quickRouteCursorRef.current=1;');
    expect(shell).not.toContain('window.history.length>1');
    expect(shell).not.toContain('window.history.back()');
    expect(shell).not.toContain('window.history.forward()');
    expect(shell).toContain('const refreshPage=async()=>{');
    expect(shell).toContain('setIsRefreshing(true);');
    expect(shell).toContain('await new Promise<void>(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>resolve())))');
    expect(shell).toContain('await new Promise<void>(resolve=>window.setTimeout(resolve,320));');
    expect(shell).toContain('onClick={refreshPage}');
    expect(css).toContain('.packet .mobile-quick-back.is-navigating svg');
    expect(css).toContain('.packet .mobile-quick-forward.is-navigating svg');
    expect(css).not.toContain('.packet .mobile-quick-nav button[data-pointer-action="true"]');
    expect(shell).toContain('href={profileItem[0]} onClick={event=>event.currentTarget.blur()}');
    expect(shell).toContain("event.currentTarget.blur();setMenuOpen(value=>!value)");
    expect(shell).toContain('key={`scroll-top-${fixedEpoch}`} className="scroll-top"');
    expect(shell).not.toContain("createPortal(");
    expect(css).toContain('body:has(.chart-expand-dialog[data-state="open"]) .packet .scroll-top');
    expect(css).toContain('body:has(.chart-expand-dialog[data-state="open"]) .packet .mobile-quick-nav');
    expect(css).toContain('.packet.pwa-standalone .mobile-quick-nav');
    expect(css).toContain('@media (hover: none), (pointer: coarse)');
    expect(css).toContain('.packet.pwa-standalone .mobile-quick-nav { top: auto !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px) !important; inset-block-start: auto !important;');
    expect(css).not.toContain("top: calc(100svh - env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("inset-block-end: calc(env(safe-area-inset-bottom, 0px) + 80px) !important");
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
