import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { passkeyErrorText } from "@/lib/passkeyError";

describe("русские сообщения быстрого входа", () => {
  it("не показывает английский текст для типовых мобильных ошибок WebAuthn", () => {
    expect(passkeyErrorText(new Error("NotAllowedError: The operation was cancelled"))).toContain("ключа доступа");
    expect(passkeyErrorText(new Error("SecurityError: The relying party ID is invalid"))).toContain("защищенному адресу");
    expect(passkeyErrorText(new Error('Too small: expected string to have >=1 characters at path ["phone"]'))).toContain("Войти с ключом доступа");
    expect(passkeyErrorText(new Error("An unknown WebAuthn failure"))).toBe("Не удалось подтвердить быстрый вход. Используйте телефон и пароль, затем при необходимости включите быстрый вход заново в профиле.");
  });

  it("запускает discoverable key без обязательного номера телефона", () => {
    const page = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");
    expect(page).toContain('import { passkeyErrorText } from "@/lib/passkeyError";');
    expect(page).toContain('const hasPhone = Boolean(phone.replace(/\\D/g, ""));');
    expect(page).toContain('const normalized = hasPhone ? normalizeRussianPhone(phone) : "";');
    expect(page).toContain('const phonePayload = normalized.length === 11 ? { phone: normalized } : {};');
  });
});
