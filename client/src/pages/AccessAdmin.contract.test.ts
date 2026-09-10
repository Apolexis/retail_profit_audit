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
    expect(overrides).toContain('.packet .access-import-row .access-switch button { width: auto !important; min-width: 0 !important; height: 29px !important;');
    expect(overrides).toContain('min-height: 29px !important');
    expect(overrides).toContain('padding: 7px 9px !important; border-radius: 6px !important; flex: 0 1 auto !important');
    expect(overrides).toContain('.packet .access-import-row { padding-bottom: 12px !important; margin-bottom: 4px !important; }');
  });

  it("дает администратору форму общей push-рассылки с честным итогом доставки",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Push всем пользователям");
    expect(page).toContain("adminBroadcast.useMutation");
    expect(page).toContain("добровольно включенной браузерной подпиской");
    expect(page).toContain("pushSubscriptionsAccepted");
  });

  it("размещает действие смены пароля отдельной строкой под заголовком безопасности",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain('className="admin-password-reset-title"');
    expect(overrides).toContain(".packet .admin-password-reset-title { display: block;");
    expect(overrides).toContain('.packet .admin-password-reset > div { display: grid; gap: 4px; }');
  });
});
