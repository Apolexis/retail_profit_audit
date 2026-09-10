import { useEffect, useMemo, useState } from "react";
import { Check, Eye, KeyRound, Megaphone, PenLine, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { PhoneInput } from "@/components/PhoneInput";
import { trpc } from "@/lib/trpc";
import { formatRussianPhone, normalizeRussianPhone } from "@/lib/phone";

type Level = "view" | "edit";
type ImportLevel = "none" | "upload" | "edit";

export default function AccessAdmin() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery();
  const accounts = trpc.localAuth.list.useQuery(undefined, { retry: false });
  const stores = trpc.audit.stores.useQuery(undefined, { retry: false });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [broadcastText, setBroadcastText] = useState("");
  const [role, setRole] = useState<"admin" | "analyst">("analyst");
  const [selectedAccountId, setSelectedAccountId] = useState<number>();
  const [draft, setDraft] = useState<Record<number, Level>>({});
  const access = trpc.localAuth.storeAccess.useQuery({ accountId: selectedAccountId ?? 0 }, { enabled: Boolean(selectedAccountId), retry: false });

  useEffect(() => {
    if (!selectedAccountId && accounts.data?.[0]) setSelectedAccountId(accounts.data[0].id);
  }, [accounts.data, selectedAccountId]);
  useEffect(() => {
    if (access.data) setDraft(Object.fromEntries(access.data.map(grant => [grant.storeId, grant.accessLevel])));
  }, [access.data]);

  const selected = accounts.data?.find(account => account.id === selectedAccountId);
  const create = trpc.localAuth.create.useMutation({
    onSuccess: result => {
      setPhone("");
      setPassword("");
      utils.localAuth.list.invalidate();
      setSelectedAccountId(result.id);
    },
  });
  const update = trpc.localAuth.update.useMutation({ onSuccess: () => utils.localAuth.list.invalidate() });
  const removeAccount = trpc.localAuth.delete.useMutation({
    onSuccess: () => {
      setSelectedAccountId(undefined);
      utils.localAuth.list.invalidate();
      utils.localAuth.storeAccess.invalidate();
      utils.localAuth.notifications.invalidate();
    },
  });
  const adminResetPassword = trpc.localAuth.adminResetPassword.useMutation({
    onSuccess: () => {
      setResetPassword("");
      utils.localAuth.list.invalidate();
      utils.audit.changes.invalidate();
      toast.success("Пароль успешно изменен", { description: "Все активные сессии этой учетной записи завершены." });
    },
  });
  const saveAccess = trpc.localAuth.replaceStoreAccess.useMutation({
    onSuccess: () => {
      utils.localAuth.storeAccess.invalidate();
      utils.localAuth.notifications.invalidate();
    },
  });
  const broadcast = trpc.localAuth.adminBroadcast.useMutation({
    onSuccess: result => {
      setBroadcastText("");
      utils.localAuth.notifications.invalidate();
      utils.localAuth.notificationSummary.invalidate();
      toast.success("Сообщение отправлено", { description: `В ленту: ${result.recipientAccounts}. Push принял сервис для устройств: ${result.pushSubscriptionsAccepted}.` });
    },
    onError: error => toast.error(error.message),
  });
  const grants = useMemo(() => Object.entries(draft).map(([storeId, accessLevel]) => ({ storeId: Number(storeId), accessLevel })), [draft]);

  if (me.data?.role !== "admin") return <AuditShell kicker="12 / ДОСТУП" title="Управление доступом"><section className="empty-state"><h2>Недостаточно прав</h2><p>Только администратор создает учетные записи и назначает доступ к магазинам.</p></section></AuditShell>;

  return <AuditShell kicker="12 / ДОСТУП" title="Пользователи и права">
    <section className="page-lede"><div><span>МАТРИЦА ДОСТУПА</span><h2>Роли и магазины</h2><p>Создайте учетную запись по номеру телефона, выберите ее в списке, затем настройте доступ к каждому магазину. Не назначенная точка не отображается в аналитике.</p></div></section>
    <section className="role-guide"><article><ShieldCheck size={20}/><div><strong>Администратор</strong><span>Полный доступ ко всем магазинам, импорту, базе, журналу, уведомлениям и настройке пользователей.</span></div></article><article><Eye size={20}/><div><strong>Аналитик · просмотр</strong><span>Видит только назначенный магазин, но не меняет факты.</span></div></article><article><PenLine size={20}/><div><strong>Аналитик · изменение</strong><span>Редактирует факты только назначенного магазина; действия попадают в журнал и сигналы.</span></div></article></section>
    <section className="packet-card admin-broadcast"><div><span className="card-eyebrow">ОБЩЕЕ СООБЩЕНИЕ</span><h3>Push всем пользователям</h3><p className="packet-note">Текст попадет в ленту активных учетных записей. Push‑уведомление получат только устройства с добровольно включенной браузерной подпиской; системные ограничения устройства не обходятся.</p></div><form className="stack-form" onSubmit={event=>{event.preventDefault();if(broadcastText.trim())broadcast.mutate({message:broadcastText.trim()});}}><label>Текст сообщения<textarea value={broadcastText} onChange={event=>setBroadcastText(event.target.value)} maxLength={360} placeholder="Например: завтра сверяем списания и остатки до 11:00." required/></label><div className="admin-broadcast-actions"><small>{broadcastText.trim().length}/360</small><button className="packet-link compact" disabled={!broadcastText.trim()||broadcast.isPending}><Megaphone size={15}/>{broadcast.isPending?"Отправляем…":"Отправить всем"}</button></div></form></section>
    <section className="manage-grid"><article className="packet-card"><span className="card-eyebrow">НОВАЯ УЧЕТНАЯ ЗАПИСЬ</span><form className="stack-form" onSubmit={event => { event.preventDefault(); create.mutate({ username: normalizeRussianPhone(phone), password, role }); }}><label>Номер телефона<PhoneInput value={phone} onValueChange={setPhone} required/></label><small className="form-hint">Можно начать ввод с 9, 7 или 8; удаление цифр работает обычными Backspace и Delete.</small><label>Первичный пароль<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={10} required/></label><label>Роль<select value={role} onChange={event => setRole(event.target.value as typeof role)}><option value="analyst">Аналитик</option><option value="admin">Администратор</option></select></label>{create.error && <p className="inline-error">{create.error.message === "Требуется локальный вход" ? "Ваша сессия администратора истекла. Войдите повторно." : create.error.message}</p>}<button className="packet-link" disabled={create.isPending}>Создать учетную запись</button></form></article><article className="packet-card"><span className="card-eyebrow">УЧЕТНЫЕ ЗАПИСИ</span><div className="account-list">{accounts.data?.map(account => <button type="button" key={account.id} className={account.id === selectedAccountId ? "account-choice selected" : "account-choice"} onClick={() => setSelectedAccountId(account.id)}><div><strong>{formatRussianPhone(account.username)}</strong><small>{account.role === "admin" ? "Администратор" : "Аналитик"} · {account.isActive ? "доступ включен" : "доступ отключен"}</small></div><span>{account.role === "admin" ? <ShieldCheck size={16}/> : <Check size={16}/>}</span></button>)}</div></article></section>
    <section className="packet-card access-matrix"><div className="card-title"><div><span>НАЗНАЧЕНИЯ МАГАЗИНОВ И ИМПОРТА</span><h3>{selected ? formatRussianPhone(selected.username) : "Выберите пользователя"}</h3></div>{selected?.role === "analyst" && <button className="packet-link compact" onClick={() => saveAccess.mutate({ accountId: selected.id, grants })} disabled={saveAccess.isPending}>Сохранить права магазинов</button>}</div>{selected?.role === "admin" ? <p className="packet-note">Администратор имеет полный доступ к сети и импорту без индивидуальных назначений.</p> : <><div className="access-import-row"><span><strong>Импорт Excel</strong><small>Загрузка — только новые даты · изменение — замена и удаление</small></span><div className="access-switch" aria-label="Право на импорт Excel"><button className={selected?.importAccessLevel === "none" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "none" as ImportLevel })}>Нет</button><button className={selected?.importAccessLevel === "upload" ? "active" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "upload" as ImportLevel })}>Загрузка</button><button className={selected?.importAccessLevel === "edit" ? "active edit" : ""} onClick={() => selected && update.mutate({ id: selected.id, importAccessLevel: "edit" as ImportLevel })}>Изменение</button></div></div><div className="access-store-list">{stores.data?.length ? stores.data.map(store => { const current = draft[store.id]; return <div key={store.id}><span><strong>{store.name}</strong><small>{store.isHidden ? "Скрыт в обычных выборках" : "Активный магазин"}</small></span><div className="access-switch" aria-label={`Право для ${store.name}`}><button className={!current ? "active" : ""} onClick={() => setDraft(value => { const next = { ...value }; delete next[store.id]; return next; })}>Нет</button><button className={current === "view" ? "active" : ""} onClick={() => setDraft(value => ({ ...value, [store.id]: "view" }))}>Просмотр</button><button className={current === "edit" ? "active edit" : ""} onClick={() => setDraft(value => ({ ...value, [store.id]: "edit" }))}>Изменение</button></div></div>; }) : <div className="empty-state"><h2>Магазинов пока нет</h2><p>После первого импорта Excel здесь появятся точки для назначения аналитику.</p></div>}</div></>}</section>
    <section className="packet-card"><span className="card-eyebrow">СТАТУС УЧЕТНОЙ ЗАПИСИ</span>{selected && <div className="status-row"><div><strong>{selected.isActive ? "Доступ включен" : "Доступ отключен"}</strong><p className="packet-note">Отключенная учетная запись не сможет войти. Последнего активного администратора система защищает от отключения и удаления.</p>{removeAccount.error && <p className="inline-error">{removeAccount.error.message}</p>}</div><div className="row-actions"><button className={selected.isActive ? "visibility active" : "visibility"} onClick={() => update.mutate({ id: selected.id, isActive: !selected.isActive })}><UserRoundX size={14}/>{selected.isActive ? "Отключить" : "Включить"}</button><ConfirmDangerDialog trigger={<button className="row-delete account-delete" disabled={removeAccount.isPending || selected.id === me.data?.id}><Trash2 size={14}/>Удалить</button>} title="Удалить учетную запись?" description={`Будет удалена учетная запись ${formatRussianPhone(selected.username)}, все ее активные сессии, персональные сигналы и доступы к магазинам. История действий сохранится в журнале. Удалить текущего пользователя и последнего активного администратора нельзя.`} confirmLabel="Удалить учетную запись" onConfirm={() => removeAccount.mutate({ id: selected.id })}/></div></div>}</section>
    {selected&&selected.id!==me.data?.id&&<section className="packet-card admin-password-reset"><div><span className="card-eyebrow">БЕЗОПАСНОСТЬ УЧЕТНОЙ ЗАПИСИ</span><strong>Сменить пароль пользователя</strong><p className="packet-note">Новый пароль не отображается и не сохраняется в журнале. После подтверждения все активные сессии этой учетной записи завершатся.</p></div><label>Новый пароль<input type="password" value={resetPassword} onChange={event=>setResetPassword(event.target.value)} minLength={10} autoComplete="new-password" placeholder="Не менее 10 символов"/></label>{adminResetPassword.error&&<p className="inline-error">{adminResetPassword.error.message}</p>}<ConfirmDangerDialog trigger={<button className="packet-link compact" disabled={resetPassword.length<10||adminResetPassword.isPending}><KeyRound size={15}/>Сменить пароль</button>} title="Сменить пароль учетной записи?" description={`Учетная запись ${formatRussianPhone(selected.username)} будет разлогинена на всех устройствах. Новый пароль не отображается и не записывается в журнал.`} confirmLabel="Сменить пароль и завершить сессии" onConfirm={()=>adminResetPassword.mutate({id:selected.id,nextPassword:resetPassword})}/></section>}
  </AuditShell>;
}
