import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./design-system.css", import.meta.url), "utf8");
const portfolio = readFileSync(new URL("./pages/Portfolio.tsx", import.meta.url), "utf8");
const lightScreens = ["Home.tsx", "ControlCenter.tsx", "OperationalCadence.tsx", "Portfolio.tsx", "ManageData.tsx", "AccessAdmin.tsx", "Notifications.tsx", "WeeklyReports.tsx"];

describe("контрастная светлая тема", () => {
  it("использует нейтральные поверхности и читаемые сигнальные цвета", () => {
    expect(styles).toContain("--rose:#d70036");
    expect(styles).toContain("--yellow:#875500");
    expect(styles).toContain("background:#ffffff!important");
    expect(styles).toContain(".packet .theme-button{background:#f4f7fb!important");
  });

  it("переопределяет темные плашки и подписи интерактивных графиков", () => {
    expect(styles).toContain(".packet .tiny-tooltip{background:#ffffff!important");
    expect(styles).toContain(".packet .series-toggle,html[data-audit-theme=\"light\"] .packet .chart-series-control .series-toggle{background:#ffffff!important");
    expect(styles).toContain(".packet .card-title small,html[data-audit-theme=\"light\"] .packet .median-badge{background:#f3f7fd!important");
  });

  it("сохраняет контраст Sonner-уведомлений в обеих темах", () => {
    expect(styles).toContain("[data-sonner-toaster] [data-sonner-toast]{background:#171018!important;color:#f8edf2!important");
    expect(styles).toContain('html[data-audit-theme="light"] [data-sonner-toaster] [data-sonner-toast]{background:#ffffff!important;color:#152033!important');
    expect(styles).toContain("[data-sonner-toast] [data-button]{background:#ff765f!important");
  });

  it("передает в scatter-графики Портфеля светлую палитру, а не темные константы", () => {
    expect(portfolio).toContain('grid: "#d8e0ea"');
    expect(portfolio).toContain("stroke={palette.grid}");
    expect(portfolio).toContain("fill={palette.label}");
  });

  it("применяет общую оболочку с нейтральными light-токенами на всех ключевых экранах", () => {
    lightScreens.forEach(file => {
      const page = readFileSync(new URL(`./pages/${file}`, import.meta.url), "utf8");
      expect(page).toContain("AuditShell");
    });
    expect(styles).toContain('html[data-audit-theme="light"] .packet{--bg:#f3f5f9');
    expect(styles).toContain(".packet .watch-card{background:#f8faff!important");
  });

  it("покрывает page-specific элементы восьми экранов светлым контрастным оформлением", () => {
    const checks: Array<[string, string, "style" | "page"]> = [
      ["Home.tsx", ".packet .theme-button{background:#f4f7fb!important", "style"],
      ["ControlCenter.tsx", ".packet .comparison-periods { background:#fff", "style"],
      ["OperationalCadence.tsx", ".packet .inline-table .inline-row{min-height:48px", "style"],
      ["Portfolio.tsx", "grid: \"#d8e0ea\"", "page"],
      ["ManageData.tsx", ".packet .store-rename-save{height:40px!important", "style"],
      ["AccessAdmin.tsx", ".packet .account-choice.selected{background:#eaf3ff!important", "style"],
      ["Notifications.tsx", ".packet .notification-actions{display:flex", "style"],
      ["WeeklyReports.tsx", ".packet input[type=\"time\"] { background:#fff!important", "style"],
    ];
    checks.forEach(([file, selector, source]) => {
      const page = readFileSync(new URL(`./pages/${file}`, import.meta.url), "utf8");
      expect(page).toContain("AuditShell");
      expect(source === "style" ? styles : page, `Контракт светлой темы: ${file}`).toContain(selector);
    });
  });
});
