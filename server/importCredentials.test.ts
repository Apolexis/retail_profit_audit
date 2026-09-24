import { describe, expect, it } from "vitest";
import { decryptImportCredential, encryptImportCredential } from "./importCredentials";

describe("защищенная конфигурация импорта", () => {
  it("шифрует пароль без сохранения открытого текста и корректно расшифровывает его только на сервере", () => {
    const cipher = encryptImportCredential("временный-проверочный-пароль");
    expect(cipher).not.toContain("временный-проверочный-пароль");
    expect(decryptImportCredential(cipher)).toBe("временный-проверочный-пароль");
  });
});
