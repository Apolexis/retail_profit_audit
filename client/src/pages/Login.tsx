import { useEffect, useState } from "react";
import { Fingerprint, LockKeyhole } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import { PhoneInput } from "@/components/PhoneInput";
import { trpc } from "@/lib/trpc";
import { normalizeRussianPhone } from "@/lib/phone";

export function passkeyErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("notallowederror") || normalized.includes("not allowed") || normalized.includes("timed out") || normalized.includes("aborterror") || normalized.includes("aborted")) {
    return "Подтверждение Face ID отменено или не выполнено. Попробуйте еще раз.";
  }
  if (normalized.includes("not supported") || normalized.includes("not implemented") || normalized.includes("notsupportederror")) {
    return "На этом устройстве быстрый вход не поддерживается. Используйте телефон и пароль.";
  }
  if (normalized.includes("rp id") || normalized.includes("origin") || normalized.includes("securityerror")) {
    return "Быстрый вход доступен только по тому же защищенному адресу, на котором он был включен. Откройте приложение по основному адресу и повторите попытку.";
  }
  if (normalized.includes("invalidstateerror") || normalized.includes("constraint")) {
    return "Этот ключ быстрого входа недоступен на устройстве. Войдите по телефону и паролю, затем включите быстрый вход заново в профиле.";
  }
  if (normalized.includes("network") || normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Не удалось связаться с приложением. Проверьте соединение и повторите попытку.";
  }
  return "Не удалось подтвердить быстрый вход. Используйте телефон и пароль, затем при необходимости включите быстрый вход заново в профиле.";
}

export default function Login() {
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
    const normalized = normalizeRussianPhone(phone);
    if (normalized.length !== 11) {
      toast.error("Введите полный номер телефона", { description: "Для быстрого входа нужен тот же номер, на который был зарегистрирован passkey." });
      return;
    }
    try {
      const { options } = await beginPasskey.mutateAsync({ phone: normalized });
      const response = await startAuthentication({ optionsJSON: options });
      await finishPasskey.mutateAsync({ phone: normalized, response });
      toast.success("Вход подтвержден", { description: "Быстрый вход выполнен успешно." });
    } catch (error) {
      toast.error(passkeyErrorText(error));
    }
  };

  const passkeyBusy = beginPasskey.isPending || finishPasskey.isPending;
  return (
    <main className="login-gate">
      <section className="login-panel">
        <div className="login-mark">
          <img src="/manus-storage/rybny_analytics_app_icon_909727b4.png" alt="Аналитика «Рыбный»" />
          <span>Аналитика «Рыбный»</span>
        </div>
        <h1>Вход в управленческий контур</h1>
        <p>Введите номер телефона и пароль. Доступ к показателям сети предоставляется только для назначенных магазинов и действий вашей роли.</p>
        <form onSubmit={submit}>
          <label>Номер телефона<PhoneInput value={phone} onValueChange={setPhone} required /></label>
          <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          {login.error && <div className="login-error">{login.error.message === "Требуется локальный вход" ? "Сессия истекла. Введите номер телефона и пароль повторно." : login.error.message}</div>}
          <button className="login-submit" disabled={login.isPending}><LockKeyhole size={16} />{login.isPending ? "Проверяем доступ…" : "Войти"}</button>
          {passkeySupported && <button type="button" className="login-passkey" onClick={fastLogin} disabled={passkeyBusy}><Fingerprint size={17} />{passkeyBusy ? "Подтвердите на устройстве…" : "Войти по Face ID / биометрии"}</button>}
        </form>
        <small>{passkeySupported ? "Введите номер, затем подтвердите Face ID, биометрию или PIN. Если быстрый вход для номера еще не включен, система подскажет это после нажатия." : "Можно начать ввод с 9, 7 или 8 — система приведет номер к виду +7 (900) 000-00-00. Скобки и дефисы не блокируют удаление цифр."}</small>
      </section>
    </main>
  );
}
