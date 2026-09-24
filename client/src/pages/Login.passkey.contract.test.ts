import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const login = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const accessStyles = readFileSync(new URL("../access.css", import.meta.url), "utf8");

describe("универсальный вход с ключом доступа", () => {
  it("не называет вход только Face ID и перечисляет доступные способы устройства", () => {
    expect(login).toContain('"Войти с ключом доступа"');
    expect(login).toContain("Face ID, Touch ID, ключ Google, Windows Hello или PIN");
  });

  it("запускает discoverable passkey без номера телефона", () => {
    expect(login).toContain('const phonePayload = normalized.length === 11 ? { phone: normalized } : {};');
    expect(login).toContain("beginPasskey.mutateAsync(phonePayload)");
    expect(login).toContain("finishPasskey.mutateAsync({ ...phonePayload, response })");
  });

  it("использует знак меню и не выводит лишнее пояснение о назначенных магазинах", () => {
    expect(login).toContain('import { BrandMark } from "@/components/AuditShell";');
    expect(login).toContain("<BrandMark theme={theme} />");
    expect(login).not.toContain("Доступ к показателям сети предоставляется только для назначенных магазинов");
  });

  it("показывает ошибку входа как отдельное тематичное danger-состояние в обеих темах", () => {
    expect(login).toContain('className="login-error"');
    expect(styles).toContain('html[data-audit-theme="light"] .login-gate .login-error {');
    expect(styles).toContain('border: 1px solid #d77988 !important;');
    expect(styles).toContain('background: #fff0f2 !important;');
    expect(styles).toContain('html[data-audit-theme="dark"] .login-gate .login-error {');
    expect(styles).toContain('border: 1px solid #a95268 !important;');
    expect(styles).toContain('background: #351b27 !important;');
  });

  it("дает магазинам отдельный логин без ключа доступа", () => {
    expect(login).toContain('const [storeLoginMode, setStoreLoginMode] = useState(false)');
    expect(login).toContain('storeLoginMode ? "Вход магазина" : "Вход в управление"');
    expect(login).not.toContain("Вход в управленческий контур");
    expect(login).toContain('Вход для магазинов');
    expect(login).toContain('Логин магазина');
    expect(login).toContain('storeLoginMode ? identifier.trim() : normalizeRussianPhone(identifier)');
    expect(login).toContain('!storeLoginMode && passkeySupported');
  });

  it("оформляет вход для магазинов доступным iOS-переключателем и тематичной иконкой", () => {
    expect(login).toContain('className="login-store-mode-switch" aria-hidden="true"');
    expect(accessStyles).toContain('.login-panel .login-store-mode-switch { position: relative; display: inline-block;');
    expect(accessStyles).toContain('border-radius: 999px;');
    expect(accessStyles).toContain('input:checked + .login-store-mode-switch');
    expect(accessStyles).toContain('.login-theme-toggle { color: #ffcf5c !important; }');
    expect(accessStyles).toContain('html[data-audit-theme="light"] .login-theme-toggle { color: #20202a !important; }');
  });
});
