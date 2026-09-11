import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const overrides=readFileSync(resolve(process.cwd(),"client/src/final-overrides.css"),"utf8");

describe("AccessAdmin dark theme contract",()=>{
  it("restores the first account card contour only outside the light theme",()=>{
    expect(overrides).toContain('html:not([data-audit-theme="light"]) .packet .account-list > .account-choice:first-child');
    expect(overrides).toContain("border-top: 1px solid rgba(255, 178, 162, .32)");
  });
});

describe("матрица доступа к импорту",()=>{
  it("содержит независимые уровни нет, загрузка и изменение",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Импорт Excel");
    expect(page).toContain(">Загрузка</button>");
    expect(page).toContain('importAccessLevel: "edit"');
    expect(overrides).toContain('.packet .access-import-row { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(190px, 300px) !important;');
    expect(overrides).toContain('.packet .access-import-row .access-switch { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; width: 100% !important;');
    expect(overrides).toContain('.packet .access-import-row { padding-bottom: 12px !important; margin-bottom: 4px !important; }');
  });

  it("дает отдельное право просмотра финансового блока предпросмотра импорта",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Сигналы и контроль импорта");
    expect(page).toContain("canViewImportControls");
    expect(page).toContain("Просмотр разрешен");
    expect(overrides).toContain(".packet .access-control-toggle.active");
    expect(overrides).toContain('.packet .access-import-control-row .access-control-toggle { width: 100% !important; justify-self: end !important; align-self: center !important; transform: none !important; margin-top: 8px !important; }');
    expect(overrides).toContain('.packet .access-import-control-row { margin-bottom: 4px !important; padding-bottom: 8px !important; }');
    expect(overrides).toContain('@media (max-width: 980px) {\n  .packet .access-import-row,\n  .packet .access-store-list > div { grid-template-columns: minmax(0, 1fr) !important; }');
  });

  it("дает администратору адресную push-рассылку с честным итогом доставки",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Push по выбранной аудитории");
    expect(page).toContain("adminBroadcast.useMutation");
    expect(page).toContain("добровольно включенной браузерной подпиской");
    expect(page).toContain("pushSubscriptionsAccepted");
    expect(page).toContain("Пользователю");
    expect(page).toContain("По роли");
    expect(page).toContain("broadcastAudience");
    expect(overrides).toContain('html[data-audit-theme="light"] .packet .admin-broadcast .stack-form textarea:focus');
  });

  it("размещает действие смены пароля отдельной строкой под заголовком безопасности",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain('className="admin-password-reset-title"');
    expect(overrides).toContain(".packet .admin-password-reset-title { display: block;");
    expect(overrides).toContain('.packet .admin-password-reset > div { display: grid; gap: 4px; }');
  });
});
