import { useEffect, useState } from "react";
import { Fingerprint, LockKeyhole, Moon, Sun } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { PhoneInput } from "@/components/PhoneInput";
import { trpc } from "@/lib/trpc";
import { normalizeRussianPhone } from "@/lib/phone";
import { authErrorText } from "@/lib/authError";
import { passkeyErrorText } from "@/lib/passkeyError";
import { useAudit } from "@/contexts/AuditContext";

export default function Login({ accessError }: { accessError?: unknown }) {
  const { theme, toggleTheme } = useAudit();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passkeySupported, setPasskeySupported] = useState(false);
  const utils = trpc.useUtils();
  const login = trpc.localAuth.login.useMutation({
    onSuccess: result => {
      sessionStorage.removeItem(`audit-critical-signals-${result.id}`);
      utils.localAuth.me.invalidate();
    },
  });
  const beginPasskey = trpc.localAuth.beginPasskeyLogin.useMutation();
  const finishPasskey = trpc.localAuth.finishPasskeyLogin.useMutation({
    onSuccess: result => {
      sessionStorage.removeItem(`audit-critical-signals-${result.id}`);
      utils.localAuth.me.invalidate();
    },
  });

  useEffect(() => setPasskeySupported(browserSupportsWebAuthn()), []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    login.mutate({ username: normalizeRussianPhone(phone), password });
  };

  const fastLogin = async () => {
    const hasPhone = Boolean(phone.replace(/\D/g, ""));
    const normalized = hasPhone ? normalizeRussianPhone(phone) : "";
    if (normalized && normalized.length !== 11) {
      toast.error("Введите полный номер телефона", { description: "Для быстрого входа нужен тот же номер, на который был зарегистрирован passkey." });
      return;
    }
    const phonePayload = normalized.length === 11 ? { phone: normalized } : {};
    try {
      const { options } = await beginPasskey.mutateAsync(phonePayload);
      const response = await startAuthentication({ optionsJSON: options });
      await finishPasskey.mutateAsync({ ...phonePayload, response });
      toast.success("Вход подтвержден", { description: "Быстрый вход выполнен успешно." });
    } catch (error) {
      toast.error(passkeyErrorText(error));
    }
  };

  const passkeyBusy = beginPasskey.isPending || finishPasskey.isPending;
  return (
    <main className="login-gate">
      <section className="login-panel">
        <button type="button" className="login-theme-toggle" onClick={toggleTheme} aria-label={theme === "dark" ? "Включить светлую тему" : "Включить темную тему"} title={theme === "dark" ? "Светлая тема" : "Темная тема"}>{theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}</button>
        <div className="login-mark">
          <img src="/manus-storage/rybny_analytics_app_icon_909727b4.png" alt="Аналитика «Рыбный»" />
          <span>Аналитика «Рыбный»</span>
        </div>
        <h1>Вход в управленческий контур</h1>
        <p>Введите номер телефона и пароль. Доступ к показателям сети предоставляется только для назначенных магазинов и действий вашей роли.</p>
        <form onSubmit={submit}>
          <label>Номер телефона<PhoneInput value={phone} onValueChange={setPhone} required /></label>
          <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          {(accessError || login.error) && <div className="login-error">{authErrorText(accessError ?? login.error)}</div>}
          <button className="login-submit" disabled={login.isPending}><LockKeyhole size={16} />{login.isPending ? "Проверяем доступ…" : "Войти"}</button>
          {passkeySupported && <button type="button" className="login-passkey" onClick={fastLogin} disabled={passkeyBusy}><Fingerprint size={17} />{passkeyBusy ? "Подтвердите на устройстве…" : "Войти с ключом доступа"}</button>}
        </form>
        <small>{passkeySupported ? "Можно ввести номер, чтобы выбрать ключ, или нажать кнопку без номера. Устройство предложит Face ID, Touch ID, ключ Google, Windows Hello или PIN — в зависимости от устройства." : "Можно начать ввод с 9, 7 или 8 — система приведет номер к виду +7 (900) 000-00-00. Скобки и дефисы не блокируют удаление цифр."}</small>
      </section>
    </main>
  );
}
