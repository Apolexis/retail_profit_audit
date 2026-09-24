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

  it("дает прайс‑контролю отдельный уровень доступа без изменения права финансового импорта",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Прайс‑контроль");
    expect(page).toContain("priceAccessLevel");
    expect(page).toContain('className="access-switch access-switch-four"');
    expect(overrides).toContain('.packet .access-import-row .access-switch.access-switch-four');
  });

  it("сохраняет индивидуальные пояснения строк прав и не заменяет их общим текстом",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain("Разрешает загрузку новой книги");
    expect(page).toContain("Отдельный контур поставщиков");
    expect(page).toContain("Показывает суммы наличных");
    expect(overrides).toContain(".packet .access-import-row > span > small::after {\n  content: none !important;");
    expect(overrides).toContain("grid-template-columns: minmax(0, 1fr) minmax(268px, 336px) !important;");
  });

  it("дает администратору адресную push-рассылку с честным итогом доставки",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/Notifications.tsx"),"utf8");
    expect(page).toContain("Рассылка в ленту сигналов");
    expect(page).toContain("adminBroadcast.useMutation");
    expect(page).toContain("добровольно включенной браузерной подпиской");
    expect(page).toContain("pushSubscriptionsAccepted");
    expect(page).toContain("Пользователю");
    expect(page).toContain("По роли");
    expect(page).toContain("broadcastAudience");
    expect(readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8")).not.toContain("adminBroadcast.useMutation");
    expect(overrides).toContain('html[data-audit-theme="light"] .packet .admin-broadcast .stack-form textarea:focus');
  });

	  it("размещает действие смены пароля в раскрываемой безопасной секции",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    expect(page).toContain('className="admin-password-reset-title"');
	    expect(page).toContain('<details className="admin-password-reset">');
	    expect(page).toContain('className="admin-password-reset-body"');
	    expect(page).toContain('type="button" className="subtle-button access-security-action"');
    expect(page).toContain('Осталось символов: {10 - resetPassword.length}');
    expect(page).toContain('toast.error("Пароль не изменен"');
    expect(page).toContain('"Откроется подтверждение смены пароля"');
    expect(overrides).toContain(".packet .admin-password-reset-title { display: block;");
    expect(overrides).toContain('.packet .admin-password-reset > div { display: grid; gap: 4px; }');
  });

  it("ведет верхние и нижние права импорта по одной адаптивной ширине",()=>{
    expect(overrides).toContain('.packet .access-store-list > div .access-switch { width: 100% !important; min-width: 190px !important; max-width: 300px !important; justify-self: end !important; }');
    expect(overrides).toContain('.packet .access-store-list > div .access-switch { min-width: 0 !important; max-width: none !important; width: 100% !important; justify-self: stretch !important; }');
    expect(overrides).toContain('.packet .access-store-list > div { grid-template-columns: minmax(0, 1fr) minmax(190px, 300px) !important; align-items: center !important; gap: 12px 16px !important; }');
  });

	  it("явно выравнивает названия назначенных магазинов слева на компактных ширинах",()=>{
	    expect(overrides).toContain('.packet .access-store-list > div > span { display: grid !important; justify-self: start !important;');
	    expect(overrides).toContain('text-align: left !important;');
	    expect(overrides).toContain('overflow-wrap: anywhere !important;');
	  });

  it("создает продавца по логину магазина и не требует для него ключ доступа",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain('role === "seller" ? <label>Логин магазина');
    expect(page).toContain('role === "seller" ? phone.trim() : normalizeRussianPhone(phone)');
    expect(page).toContain('minLength={role === "seller" ? undefined : 10}');
    expect(page).toContain('ключ доступа для магазина отключен');
  });

  it("дает администратору заменить и явно показать серверный ключ Эвотор",()=>{
    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    const router=readFileSync(resolve(process.cwd(),"server/routers/localAuth.ts"),"utf8");
    expect(page).toContain("Серверный ключ Cloud API V2");
    expect(page).toContain("Заменить ключ");
    expect(page).toContain("раскрывается по явной кнопке, как пароль");
    expect(page).toContain("Показать ключ");
    expect(page).toContain("Скрыть ключ");
    expect(page).toContain("revealEvotorCredential");
    expect(router).toContain("replaceEvotorCredential");
    expect(router).toContain("revealEvotorCredential: adminProcedure.mutation");
  });

	  it("объединяет аналитика в одну роль и дает администратору сменить роль выбранной записи",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
    expect(page).toContain('<strong>Аналитик</strong>');
    expect(page).toContain('выбирает «Просмотр» или «Изменение»');
    expect(page).not.toContain('Аналитик · просмотр');
    expect(page).not.toContain('Аналитик · изменение');
    expect(page).toContain('СТАТУС И РОЛЬ УЧЕТНОЙ ЗАПИСИ');
    expect(page).toContain('Сменить роль');
    expect(page).toContain('role: selectedRole');
	    expect(overrides).toContain('.packet .account-role-change');
	  });

	  it("раскладывает четыре роли ровной сеткой две на две до мобильного breakpoint",()=>{
	    const theme=readFileSync(resolve(process.cwd(),"client/src/theme-refresh.css"),"utf8");
	    expect(theme).toContain('.role-guide{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));');
	    expect(theme).toContain('@media(max-width:900px){.role-guide{grid-template-columns:1fr}');
	  });

	  it("ставит выбор учетной записи перед деталями и разделяет статус, роль и опасные действия",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    expect(page).toContain('const selectedAccountStatus = selected ?');
	    expect(page).toContain('const adminPasswordResetPanel = selected && selected.id !== me.data?.id ?');
	    expect(page).toContain('const evotorCredentialPanel = <details className="access-evotor-credential"');
	    expect(page).toContain('<section className="manage-grid access-account-layout"><article className="packet-card access-account-picker">');
    expect(page).toContain('<article className="packet-card access-account-details">{selectedAccountStatus}{selectedIdentityPanel}{adminPasswordResetPanel}{evotorCredentialPanel}{evotorWebhookCredentialPanel}</article>');
	    expect(page).toContain('<section className="packet-card access-create-card"><span className="card-eyebrow">НОВАЯ УЧЕТНАЯ ЗАПИСЬ</span>');
	    expect(page.indexOf('access-account-picker')).toBeLessThan(page.indexOf('access-account-details'));
	    expect(page).toContain('className="access-status-sections"');
	    expect(page).toContain('access-status-section access-status-access');
	    expect(page).toContain('access-status-section account-role-change');
	    expect(page).toContain('access-status-section access-status-actions');
	    expect(page).not.toContain('<section className="packet-card access-evotor-credential"');
	    expect(page).not.toContain('{selected && selected.id !== me.data?.id && <section className="packet-card admin-password-reset">');
	    expect(overrides).toContain('.packet .access-account-layout {');
	    expect(overrides).toContain('border-top: 1px solid var(--line) !important;');
	    expect(overrides).toContain('.packet .access-status-sections {');
	    expect(overrides).toContain('.packet .access-status-section {');
	    expect(overrides).toContain('.packet .access-security-action {');
	    expect(overrides).toContain('html[data-audit-theme="light"] .packet .subtle-button.access-security-action');
	    expect(overrides).toContain('html[data-audit-theme="dark"] .packet .subtle-button.access-security-action');
	  });

	  it("хранит имя и фамилию отдельно от логина и показывает их в списке",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    const schema=readFileSync(resolve(process.cwd(),"drizzle/schema.ts"),"utf8");
	    const router=readFileSync(resolve(process.cwd(),"server/routers/localAuth.ts"),"utf8");
	    const history=readFileSync(resolve(process.cwd(),"client/src/pages/ChangeLog.tsx"),"utf8");
	    expect(schema).toContain('firstName: varchar("firstName", { length: 64 })');
	    expect(schema).toContain('lastName: varchar("lastName", { length: 64 })');
	    expect(router).toContain('firstName: accountName');
	    expect(router).toContain('lastName: accountName');
	    expect(page).toContain('ВИЗУАЛЬНАЯ ИДЕНТИФИКАЦИЯ');
	    expect(page).toContain('className="access-create-name-fields"');
	    expect(page).toContain('account.displayName !== formatLocalAccountLogin(account.username)');
	    expect(history).toContain('const actorLogin=change.actorPhone?formatLocalAccountLogin(change.actorPhone):null');
	    expect(overrides).toContain('.packet .access-create-name-fields { display: grid;');
	    expect(overrides).toContain('.packet :is(.access-identity-editor, .admin-password-reset, .access-evotor-credential) > summary');
	    expect(overrides).toContain('.packet .manage-grid > .access-create-card { align-self: start; }');
	    expect(overrides).toContain('@media (max-width: 1400px) {\n  .packet .access-selected-status .status-row');
	  });

	  it("сохраняет выбор магазина сразу через существующую журналируемую мутацию",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    expect(page).toContain("const setStoreGrant = (storeId: number, accessLevel?: Level)");
    expect(page).toContain("const accessSaveQueue = useRef<Promise<void>>(Promise.resolve())");
    expect(page).toContain("saveAccess.mutateAsync({ accountId, grants: grantsSnapshot })");
    expect(page).toContain("older request can never overwrite a newer selection");
    expect(page).toContain("Выбор сохраняется сразу");
	    expect(page).not.toContain(">Сохранить права магазинов</button>");
	  });

	  it("даёт администратору единую защищённую настройку токена webhook",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    const router=readFileSync(resolve(process.cwd(),"server/routers/localAuth.ts"),"utf8");
	    expect(page).toContain("evotorWebhookCredentialStatus");
	    expect(page).toContain("Токен приложения для V2 чеков");
	    expect(page).toContain("/api/integrations/evotor/v2/receipts");
	    expect(page).toContain("/api/v1/user/create");
	    expect(page).toContain("/api/v1/user/verify");
	    expect(page).toContain("/api/v1/user/token");
	    expect(page).toContain("/api/v1/inventories/stores/");
	    expect(page).toContain("APK для webhook не требуется; APK нужен только для получения push на кассе.");
	    expect(page).toContain("Показать токен");
	    expect(router).toContain("replaceEvotorWebhookCredential");
    expect(router).toContain("revealEvotorWebhookCredential: adminProcedure.mutation");
  });

	  it("разделяет application token и V1 пользовательский токен",()=>{
	    const page=readFileSync(resolve(process.cwd(),"client/src/pages/AccessAdmin.tsx"),"utf8");
	    const router=readFileSync(resolve(process.cwd(),"server/routers/localAuth.ts"),"utf8");
	    expect(page).toContain("отдельный user token из create/verify");
	    expect(page).not.toContain("evotorTerminalDocumentsCredentialStatus");
	    expect(router).not.toContain("replaceEvotorTerminalDocumentsCredential");
    expect(router).toContain("replaceEvotorWebhookCredential");
  });
});
