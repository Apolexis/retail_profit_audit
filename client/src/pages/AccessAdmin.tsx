import { ThemedSelect } from "@/components/ui/themed-select";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, KeyRound, PencilLine, ReceiptText, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { PhoneInput } from "@/components/PhoneInput";
import { PasswordInput } from "@/components/PasswordInput";
import { trpc } from "@/lib/trpc";
import { normalizeRussianPhone } from "@/lib/phone";
import { formatLocalAccountLogin } from "@/lib/accountLogin";

type Level = "view" | "edit";
type ImportLevel = "none" | "upload" | "edit";
type PriceLevel = "none" | "view" | "upload" | "edit";
type AccountRole = "admin" | "analyst" | "seller" | "manager";
const roleLabel = (role: AccountRole) => role === "admin" ? "Администратор" : role === "seller" ? "Продавец" : role === "manager" ? "Руководитель" : "Аналитик";

export default function AccessAdmin() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery();
  const accounts = trpc.localAuth.list.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("analyst");
  const [selectedAccountId, setSelectedAccountId] = useState<number>();
  const [selectedRole, setSelectedRole] = useState<AccountRole>("analyst");
  const [selectedFirstName, setSelectedFirstName] = useState("");
  const [selectedLastName, setSelectedLastName] = useState("");
  const [draft, setDraft] = useState<Record<number, Level>>({});
  const [evotorToken, setEvotorToken] = useState("");
  const [evotorTokenRevealed, setEvotorTokenRevealed] = useState(false);
  const [evotorWebhookToken, setEvotorWebhookToken] = useState("");
  const [evotorWebhookTokenRevealed, setEvotorWebhookTokenRevealed] = useState(false);
  const accessSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const access = trpc.localAuth.storeAccess.useQuery({ accountId: selectedAccountId ?? 0 }, { enabled: Boolean(selectedAccountId), retry: false });
  const evotorCredential = trpc.localAuth.evotorCredentialStatus.useQuery(undefined, { retry: false, staleTime: 0 });
  const evotorWebhookCredential = trpc.localAuth.evotorWebhookCredentialStatus.useQuery(undefined, { retry: false, staleTime: 0 });

  useEffect(() => {
    if (!selectedAccountId && accounts.data?.[0]) setSelectedAccountId(accounts.data[0].id);
  }, [accounts.data, selectedAccountId]);
  useEffect(() => {
    if (access.data) setDraft(Object.fromEntries(access.data.map(grant => [grant.storeId, grant.accessLevel])));
  }, [access.data]);

  const selected = accounts.data?.find(account => account.id === selectedAccountId);
  const selectedIsSeller = selected?.role === "seller";
  useEffect(() => {
    if (selected) setSelectedRole(selected.role as AccountRole);
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    setSelectedFirstName(selected.firstName ?? "");
    setSelectedLastName(selected.lastName ?? "");
  }, [selected?.id, selected?.firstName, selected?.lastName]);
  const create = trpc.localAuth.create.useMutation({ onSuccess: result => { setPhone(""); setPassword(""); setFirstName(""); setLastName(""); utils.localAuth.list.invalidate(); setSelectedAccountId(result.id); } });
  const update = trpc.localAuth.update.useMutation({ onSuccess: () => { utils.localAuth.list.invalidate(); utils.localAuth.storeAccess.invalidate(); }, onError: error => toast.error("Настройки доступа не изменены", { description: error.message }) });
  const removeAccount = trpc.localAuth.delete.useMutation({ onSuccess: () => { setSelectedAccountId(undefined); utils.localAuth.list.invalidate(); utils.localAuth.storeAccess.invalidate(); utils.localAuth.notifications.invalidate(); } });
  const adminResetPassword = trpc.localAuth.adminResetPassword.useMutation({ onSuccess: () => { setResetPassword(""); utils.localAuth.list.invalidate(); utils.audit.changes.invalidate(); toast.success("Пароль успешно изменен", { description: "Все активные сессии этой учетной записи завершены." }); }, onError: error => toast.error("Пароль не изменен", { description: error.message }) });
  const saveAccess = trpc.localAuth.replaceStoreAccess.useMutation({ onSuccess: () => { utils.localAuth.storeAccess.invalidate(); utils.localAuth.notifications.invalidate(); } });
  const replaceEvotorCredential = trpc.localAuth.replaceEvotorCredential.useMutation({
    onSuccess: () => { setEvotorToken(""); setEvotorTokenRevealed(false); utils.localAuth.evotorCredentialStatus.invalidate(); utils.audit.changes.invalidate(); toast.success("Ключ Эвотор заменен", { description: "Следующие read-only обращения будут использовать новый ключ." }); },
    onError: error => toast.error("Ключ Эвотор не заменен", { description: error.message }),
  });
  const revealEvotorCredential = trpc.localAuth.revealEvotorCredential.useMutation({
    onSuccess: ({ token }) => { setEvotorToken(token); setEvotorTokenRevealed(true); },
    onError: error => toast.error("Ключ Эвотор не показан", { description: error.message }),
  });
  const replaceEvotorWebhookCredential = trpc.localAuth.replaceEvotorWebhookCredential.useMutation({
    onSuccess: () => { setEvotorWebhookToken(""); setEvotorWebhookTokenRevealed(false); utils.localAuth.evotorWebhookCredentialStatus.invalidate(); utils.audit.changes.invalidate(); toast.success("Токен webhook Эвотор сохранен", { description: "V2 webhook чеков может авторизоваться на сервере." }); },
    onError: error => toast.error("Токен webhook Эвотор не сохранен", { description: error.message }),
  });
  const revealEvotorWebhookCredential = trpc.localAuth.revealEvotorWebhookCredential.useMutation({
    onSuccess: ({ token }) => { setEvotorWebhookToken(token); setEvotorWebhookTokenRevealed(true); },
    onError: error => toast.error("Токен webhook Эвотор не показан", { description: error.message }),
  });
  const grants = useMemo(() => Object.entries(draft).map(([storeId, accessLevel]) => ({ storeId: Number(storeId), accessLevel })), [draft]);
  const setStoreGrant = (storeId: number, accessLevel?: Level) => {
    if (!selected) return;
    const next = { ...draft };
    if (accessLevel) next[storeId] = accessLevel;
    else delete next[storeId];
    setDraft(next);
    const accountId = selected.id;
    const grantsSnapshot = Object.entries(next).map(([id, level]) => ({ storeId: Number(id), accessLevel: level }));
    // The router replaces the complete grant set and writes one audit event. Queue
    // rapid selections so an older request can never overwrite a newer selection.
    accessSaveQueue.current = accessSaveQueue.current
      .catch(() => undefined)
      .then(async () => { await saveAccess.mutateAsync({ accountId, grants: grantsSnapshot }); })
      .catch(async error => {
        await utils.localAuth.storeAccess.invalidate({ accountId });
        toast.error("Назначение магазина не сохранено", { description: error instanceof Error ? error.message : "Повторите выбор" });
      });
  };

  const evotorCredentialPanel = <details className="access-evotor-credential" aria-label="Серверный ключ Эвотор">
    <summary><div><span className="card-eyebrow">ДОСТУП ЭВОТОР</span><strong>Серверный ключ Cloud API V2</strong></div><span className="access-disclosure-status">{evotorCredential.data?.configured ? "Ключ настроен" : "Ключ не настроен"}</span></summary>
    <div className="access-evotor-credential-body"><p className="packet-note">Ключ доступен только администратору: он раскрывается по явной кнопке, как пароль, и не записывается в журнал изменений.</p><div className="access-evotor-status"><strong>{evotorCredential.data?.configured ? "Ключ настроен" : "Ключ не настроен"}</strong><small>{evotorCredential.data?.source === "managed" ? "Управляемый ключ" : evotorCredential.data?.source === "environment" ? "Серверная конфигурация" : "Требуется ключ Cloud API V2"}</small></div><div className="access-evotor-actions">
      <label>{evotorTokenRevealed ? "Ключ Эвотор" : "Новый ключ Эвотор"}<PasswordInput value={evotorToken} onChange={event => { setEvotorToken(event.target.value); setEvotorTokenRevealed(false); }} autoComplete="new-password" placeholder="Оставьте пустым, чтобы не менять" /></label>
      <button type="button" className="subtle-button access-security-action" disabled={revealEvotorCredential.isPending} onClick={() => { if (evotorTokenRevealed) { setEvotorToken(""); setEvotorTokenRevealed(false); } else revealEvotorCredential.mutate(); }}><Eye size={15}/>{evotorTokenRevealed ? "Скрыть ключ" : revealEvotorCredential.isPending ? "Показываем…" : "Показать ключ"}</button>
      <button type="button" className="subtle-button access-security-action" disabled={evotorToken.trim().length < 16 || replaceEvotorCredential.isPending} onClick={() => replaceEvotorCredential.mutate({ token: evotorToken })}><KeyRound size={15}/>{replaceEvotorCredential.isPending ? "Сохраняем…" : "Заменить ключ"}</button>
    </div></div>
  </details>;
  const evotorWebhookCredentialPanel = <details className="access-evotor-credential" aria-label="Токен webhook Эвотор">
    <summary><div><span className="card-eyebrow">WEBHOOK ЭВОТОР</span><strong>Токен приложения для V2 чеков</strong></div><span className="access-disclosure-status">{evotorWebhookCredential.data?.configured ? "Токен настроен" : "Токен не настроен"}</span></summary>
    <div className="access-evotor-credential-body"><p className="packet-note">Токен приложения авторизует V2 чеки <code>/api/integrations/evotor/v2/receipts</code> и V1 URL в разделе «Интеграция»: <code>/api/v1/user/create</code>, <code>/api/v1/user/verify</code>, <code>/api/v1/user/token</code>. Сайт хранит Cloud user token только зашифрованно; отдельный user token из create/verify принимается у V1 «Документы с терминала» <code>/api/v1/inventories/stores/&#123;storeUuid&#125;/documents</code>. Ничего дополнительно копировать в сайт не нужно.</p><div className="access-evotor-status"><strong>{evotorWebhookCredential.data?.configured ? "Токен настроен" : "Токен не настроен"}</strong><small>APK для webhook не требуется; APK нужен только для получения push на кассе.</small></div><div className="access-evotor-actions">
      <label>{evotorWebhookTokenRevealed ? "Токен webhook Эвотор" : "Новый токен webhook Эвотор"}<PasswordInput value={evotorWebhookToken} onChange={event => { setEvotorWebhookToken(event.target.value); setEvotorWebhookTokenRevealed(false); }} autoComplete="new-password" placeholder="Оставьте пустым, чтобы не менять" /></label>
      <button type="button" className="subtle-button access-security-action" disabled={revealEvotorWebhookCredential.isPending} onClick={() => { if (evotorWebhookTokenRevealed) { setEvotorWebhookToken(""); setEvotorWebhookTokenRevealed(false); } else revealEvotorWebhookCredential.mutate(); }}><Eye size={15}/>{evotorWebhookTokenRevealed ? "Скрыть токен" : revealEvotorWebhookCredential.isPending ? "Показываем…" : "Показать токен"}</button>
      <button type="button" className="subtle-button access-security-action" disabled={evotorWebhookToken.trim().length < 16 || replaceEvotorWebhookCredential.isPending} onClick={() => replaceEvotorWebhookCredential.mutate({ token: evotorWebhookToken })}><KeyRound size={15}/>{replaceEvotorWebhookCredential.isPending ? "Сохраняем…" : "Сохранить токен"}</button>
    </div></div>
  </details>;

  const adminPasswordResetPanel = selected && selected.id !== me.data?.id ? <details className="admin-password-reset"><summary><div><span className="card-eyebrow">БЕЗОПАСНОСТЬ</span><strong className="admin-password-reset-title">Сменить пароль пользователя</strong></div></summary><div className="admin-password-reset-body"><p className="packet-note">Новый пароль не отображается и не сохраняется в журнале. После подтверждения все активные сессии этой учетной записи завершатся.</p><label>Новый пароль<PasswordInput value={resetPassword} onChange={event => setResetPassword(event.target.value)} minLength={10} autoComplete="new-password" placeholder="Не менее 10 символов"/></label>{resetPassword.length > 0 && resetPassword.length < 10 && <small className="form-hint">Осталось символов: {10 - resetPassword.length}</small>}{adminResetPassword.error && <p className="inline-error">{adminResetPassword.error.message}</p>}<ConfirmDangerDialog trigger={<button type="button" className="subtle-button access-security-action" disabled={resetPassword.length < 10 || adminResetPassword.isPending} title={resetPassword.length < 10 ? "Введите не менее 10 символов" : "Откроется подтверждение смены пароля"}><KeyRound size={15}/>{adminResetPassword.isPending ? "Меняем пароль…" : "Сменить пароль"}</button>} title="Сменить пароль учетной записи?" description={`Учетная запись ${formatLocalAccountLogin(selected.username)} будет разлогинена на всех устройствах. Новый пароль не отображается и не записывается в журнал.`} confirmLabel="Сменить пароль и завершить сессии" onConfirm={() => adminResetPassword.mutate({ id: selected.id, nextPassword: resetPassword })}/></div></details> : null;

  const selectedIdentityPanel = selected && selected.role !== "seller" ? <details className="access-identity-editor"><summary><div><span className="card-eyebrow">ВИЗУАЛЬНАЯ ИДЕНТИФИКАЦИЯ</span><strong>{selected.displayName}</strong></div><PencilLine size={15}/></summary><div><p className="packet-note">Имя и фамилия показываются рядом с номером телефона в доступах и журнале. Сам номер остается логином и не изменяется.</p><label>Имя<input value={selectedFirstName} onChange={event => setSelectedFirstName(event.target.value)} maxLength={64} autoComplete="given-name" placeholder="Например, Алексей"/></label><label>Фамилия<input value={selectedLastName} onChange={event => setSelectedLastName(event.target.value)} maxLength={64} autoComplete="family-name" placeholder="Например, Иванов"/></label><button type="button" className="subtle-button" disabled={update.isPending || (selectedFirstName.trim() === (selected.firstName ?? "") && selectedLastName.trim() === (selected.lastName ?? ""))} onClick={() => update.mutate({ id: selected.id, firstName: selectedFirstName, lastName: selectedLastName })}>{update.isPending ? "Сохраняем…" : "Сохранить имя"}</button></div></details> : null;
  const selectedAccountStatus = selected ? <section className="access-selected-status" aria-label="Статус и роль учетной записи"><span className="card-eyebrow">СТАТУС И РОЛЬ УЧЕТНОЙ ЗАПИСИ</span><div className="access-selected-login"><strong>{formatLocalAccountLogin(selected.username)}</strong>{selected.displayName !== formatLocalAccountLogin(selected.username) && <span>{selected.displayName}</span>}</div><div className="access-status-sections"><section className="access-status-section access-status-access"><strong>{selected.isActive ? "Доступ включен" : "Доступ отключен"}</strong><p className="packet-note">Отключенная учетная запись не сможет войти. Последнего активного администратора система защищает от отключения и удаления.</p>{removeAccount.error && <p className="inline-error">{removeAccount.error.message}</p>}</section><section className="access-status-section account-role-change"><label>Роль<ThemedSelect value={selectedRole} onChange={event => setSelectedRole(event.target.value as AccountRole)}><option value="seller">Продавец</option><option value="manager">Руководитель</option><option value="analyst">Аналитик</option><option value="admin">Администратор</option></ThemedSelect></label><button type="button" className="subtle-button" disabled={selectedRole === selected.role || update.isPending} onClick={() => update.mutate({ id: selected.id, role: selectedRole })}>{update.isPending ? "Меняем роль…" : "Сменить роль"}</button><small>Смена фиксируется в общем журнале. Для продавца затем назначьте ровно одну точку.</small></section><section className="access-status-section access-status-actions"><strong>Управление доступом</strong><div className="row-actions"><button type="button" className={selected.isActive ? "visibility active" : "visibility"} onClick={() => update.mutate({ id: selected.id, isActive: !selected.isActive })}><UserRoundX size={14}/>{selected.isActive ? "Отключить" : "Включить"}</button><ConfirmDangerDialog trigger={<button className="row-delete account-delete" disabled={removeAccount.isPending || selected.id === me.data?.id}><Trash2 size={14}/>Удалить</button>} title="Удалить учетную запись?" description={`Будет удалена учетная запись ${formatLocalAccountLogin(selected.username)}, все ее активные сессии, персональные сигналы и доступы к магазинам. История действий сохранится в журнале. Удалить текущего пользователя и последнего активного администратора нельзя.`} confirmLabel="Удалить учетную запись" onConfirm={() => removeAccount.mutate({ id: selected.id })}/></div></section></div></section> : null;

  if (me.data?.role !== "admin") return <AuditShell kicker="12 / ДОСТУП" title="Управление доступом"><section className="empty-state"><h2>Недостаточно прав</h2><p>Только администратор создает учетные записи и назначает доступ к магазинам.</p></section></AuditShell>;

  return <AuditShell kicker="12 / ДОСТУП" title="Пользователи и права">
    <section className="page-lede"><div><span>МАТРИЦА ДОСТУПА</span><h2>Роли и магазины</h2><p>Для администратора, аналитика и руководителя используйте номер телефона; для продавца — логин магазина. Затем назначьте точку: продавцу доступна ровно одна операционная точка.</p></div></section>
    <section className="role-guide"><article><ShieldCheck size={20}/><div><strong>Администратор</strong><span>Полный доступ ко всем магазинам, импорту, базе, журналу, уведомлениям и настройке пользователей.</span></div></article><article><Eye size={20}/><div><strong>Аналитик</strong><span>Для каждой назначенной точки администратор выбирает «Просмотр» или «Изменение». Изменения фактов попадают в общий журнал и сигналы.</span></div></article><article><ReceiptText size={20}/><div><strong>Продавец</strong><span>Ведет «Выручку» и черновик «Инвентаризации» только своей точки. Финансовая аналитика, Excel и прайс‑контроль недоступны.</span></div></article><article><ReceiptText size={20}/><div><strong>Руководитель</strong><span>Работает с операционными модулями назначенных точек; финансовая аналитика, Excel и прайс‑контроль недоступны.</span></div></article></section>
    <section className="manage-grid access-account-layout"><article className="packet-card access-account-picker"><span className="card-eyebrow">УЧЕТНЫЕ ЗАПИСИ</span><h3>Сначала выберите пользователя</h3><p className="packet-note">После выбора справа откроются его статус, роль и безопасные действия.</p><div className="account-list">{accounts.data?.map(account => <button type="button" key={account.id} className={account.id === selectedAccountId ? "account-choice selected" : "account-choice"} onClick={() => setSelectedAccountId(account.id)}><div><strong>{formatLocalAccountLogin(account.username)}{account.displayName !== formatLocalAccountLogin(account.username) && <em>{account.displayName}</em>}</strong><small>{roleLabel(account.role as AccountRole)} · {account.isActive ? "доступ включен" : "доступ отключен"}</small></div><span>{account.role === "admin" ? <ShieldCheck size={16}/> : <Check size={16}/>}</span></button>)}</div></article><article className="packet-card access-account-details">{selectedAccountStatus}{selectedIdentityPanel}{adminPasswordResetPanel}{evotorCredentialPanel}{evotorWebhookCredentialPanel}</article></section>
    <section className="packet-card access-create-card"><span className="card-eyebrow">НОВАЯ УЧЕТНАЯ ЗАПИСЬ</span><form className="stack-form" onSubmit={event => { event.preventDefault(); create.mutate({ username: role === "seller" ? phone.trim() : normalizeRussianPhone(phone), password, role, firstName: role === "seller" ? undefined : firstName, lastName: role === "seller" ? undefined : lastName }); }}>{role === "seller" ? <label>Логин магазина<input type="text" value={phone} onChange={event => setPhone(event.target.value)} placeholder="Логин магазина" maxLength={64} required/></label> : <><label>Номер телефона<PhoneInput value={phone} onValueChange={setPhone} required/></label><small className="form-hint">Можно начать ввод с 9, 7 или 8; удаление цифр работает обычными Backspace и Delete.</small><div className="access-create-name-fields"><label>Имя<input value={firstName} onChange={event => setFirstName(event.target.value)} maxLength={64} autoComplete="given-name" placeholder="Например, Алексей"/></label><label>Фамилия<input value={lastName} onChange={event => setLastName(event.target.value)} maxLength={64} autoComplete="family-name" placeholder="Например, Иванов"/></label></div></>}<label>Первичный пароль<PasswordInput value={password} onChange={event => setPassword(event.target.value)} minLength={role === "seller" ? undefined : 10} autoComplete="new-password" required/></label><label>Роль<ThemedSelect value={role} onChange={event => { setRole(event.target.value as typeof role); setPhone(""); setFirstName(""); setLastName(""); }}><option value="seller">Продавец</option><option value="manager">Руководитель</option><option value="analyst">Аналитик</option><option value="admin">Администратор</option></ThemedSelect></label>{role === "seller" && <small className="form-hint">Продавец входит только по логину и паролю; ключ доступа для магазина отключен.</small>}{create.error && <p className="inline-error">{create.error.message === "Требуется локальный вход" ? "Ваша сессия администратора истекла. Войдите повторно." : create.error.message}</p>}<button className="packet-link" disabled={create.isPending}>Создать учетную запись</button></form></section>
    <section className="packet-card access-matrix"><div className="card-title"><div><span>НАЗНАЧЕНИЯ МАГАЗИНОВ И ИМПОРТА</span><h3>{selected ? formatLocalAccountLogin(selected.username) : "Выберите пользователя"}</h3></div><small>{saveAccess.isPending ? "Сохраняем назначение…" : "Выбор сохраняется сразу"}</small></div>{selected?.role === "admin" ? <p className="packet-note">Администратор имеет полный доступ к сети, финансовому импорту и прайс‑контролю без индивидуальных назначений.</p> : <>{selected?.role === "seller" ? <p className="packet-note access-seller-boundary">Продавцу назначается только одна операционная точка. Импорт Excel, финансовая аналитика, сигналы, прайс‑контроль и ключ доступа закрыты и не могут быть включены этой ролью.</p> : selected?.role === "manager" ? <p className="packet-note access-seller-boundary">Руководитель работает только в операционном контуре назначенных точек. Финансовая аналитика, Excel, сигналы и прайс‑контроль закрыты и не могут быть включены этой ролью.</p> : <>
<div className="access-import-row"><span><strong>Импорт Excel</strong><small>Разрешает загрузку новой книги, а режим «Изменение» — также замену и удаление ее данных.</small></span><div className="access-switch" aria-label="Право на импорт Excel"><button type="button" className={selected?.importAccessLevel === "none" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "none" as ImportLevel })}>Нет</button><button type="button" className={selected?.importAccessLevel === "upload" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "upload" as ImportLevel })}>Загрузка</button><button type="button" className={selected?.importAccessLevel === "edit" ? "active edit" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "edit" as ImportLevel })}>Изменение</button></div></div><div className="access-import-row"><span><strong>Прайс‑контроль</strong><small>Отдельный контур поставщиков: просмотр сравнений, загрузка прайсов или редактирование товарных соответствий.</small></span><div className="access-switch access-switch-four" aria-label="Право на прайс-контроль"><button type="button" className={selected?.priceAccessLevel === "none" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, priceAccessLevel: "none" as PriceLevel })}>Нет</button><button type="button" className={selected?.priceAccessLevel === "view" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, priceAccessLevel: "view" as PriceLevel })}>Просмотр</button><button type="button" className={selected?.priceAccessLevel === "upload" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, priceAccessLevel: "upload" as PriceLevel })}>Загрузка</button><button type="button" className={selected?.priceAccessLevel === "edit" ? "active edit" : ""} onClick={() => selected && update.mutate({ id: selected.id, priceAccessLevel: "edit" as PriceLevel })}>Изменение</button></div></div><div className="access-import-row access-import-control-row"><span><strong>Сигналы и контроль импорта</strong><small>Показывает суммы наличных, НДФЛ и пороговые события только в предпросмотре до записи.</small></span><button type="button" className={selected?.canViewImportControls ? "access-control-toggle active" : "access-control-toggle"} aria-pressed={Boolean(selected?.canViewImportControls)} onClick={() => selected && update.mutate({ id: selected.id, canViewImportControls: !selected.canViewImportControls })}>{selected?.canViewImportControls ? "Просмотр разрешен" : "Не показывать"}</button></div></>}<div className="access-store-list">{stores.data?.length ? stores.data.map(store => { const current = draft[store.id]; return <div key={store.id}><span><strong>{store.name}</strong><small>{store.isHidden ? "Скрыт в обычных выборках" : "Активный магазин"}</small></span><div className="access-switch" aria-label={`Право для ${store.name}`}>{!selectedIsSeller && <button type="button" className={!current ? "active" : ""} onClick={() => setStoreGrant(store.id)}>Нет</button>}<button type="button" className={current === "view" ? "active" : ""} onClick={() => setStoreGrant(store.id, "view")}>Просмотр</button>{!selectedIsSeller && <button type="button" className={current === "edit" ? "active edit" : ""} onClick={() => setStoreGrant(store.id, "edit")}>Изменение</button>}</div></div>; }) : <div className="empty-state"><h2>Магазинов пока нет</h2><p>После первого импорта Excel здесь появятся точки для назначения аналитику.</p></div>}</div></>}</section>
  </AuditShell>;
}
