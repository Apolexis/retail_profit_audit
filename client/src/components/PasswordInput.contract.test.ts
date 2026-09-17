import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("./PasswordInput.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");
const login = readFileSync(new URL("../pages/Login.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../pages/Profile.tsx", import.meta.url), "utf8");
const access = readFileSync(new URL("../pages/AccessAdmin.tsx", import.meta.url), "utf8");
const imports = readFileSync(new URL("../pages/ImportData.tsx", import.meta.url), "utf8");

describe("показ пароля", () => {
  it("держит переключатель внутри поля и сообщает его состояние ассистивным технологиям", () => {
    expect(component).toContain('className="password-input"');
    expect(component).toContain('className="password-input-toggle"');
    expect(component).toContain('aria-label={label}');
    expect(component).toContain('aria-pressed={visible}');
    expect(component).toContain('type={visible ? "text" : "password"}');
    expect(styles).toContain('.password-input > input { width: 100%; min-width: 0; padding-right: 42px !important; }');
    expect(styles).toContain('.password-input-toggle:focus-visible');
  });

  it("заменяет все рабочие поля пароля сайта, включая импорт защищенной книги", () => {
    for (const source of [login, profile, access, imports]) expect(source).toContain("PasswordInput");
    expect(login).toContain('<PasswordInput autoComplete="current-password"');
    expect(profile).toContain('<PasswordInput value={currentPassword}');
    expect(access).toContain('<PasswordInput value={resetPassword}');
    expect(imports).toContain('<PasswordInput value={workbookPassword}');
  });
});
