import { describe, expect, it } from "vitest";
import { passkeyErrorText } from "./Login";

describe("русские сообщения быстрого входа", () => {
  it("не показывает английский текст для типовых мобильных ошибок WebAuthn", () => {
    expect(passkeyErrorText(new Error("NotAllowedError: The operation was cancelled"))).toContain("Face ID");
    expect(passkeyErrorText(new Error("SecurityError: The relying party ID is invalid"))).toContain("защищенному адресу");
    expect(passkeyErrorText(new Error("An unknown WebAuthn failure"))).toBe("Не удалось подтвердить быстрый вход. Используйте телефон и пароль, затем при необходимости включите быстрый вход заново в профиле.");
  });
});
