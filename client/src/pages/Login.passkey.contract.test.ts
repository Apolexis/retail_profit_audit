import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const login = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");

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
});
