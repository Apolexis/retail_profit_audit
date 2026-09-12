import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const login = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

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

  it("показывает обычную ошибку входа в светлой теме нейтрально, без коралловой палитры", () => {
    expect(login).toContain('className="login-error"');
    expect(styles).toContain('html[data-audit-theme="light"] .login-error { border-color: #bdd9f6 !important; background: #f5faff !important; color: #244864 !important; }');
  });
});
