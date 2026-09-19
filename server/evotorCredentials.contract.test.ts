import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const credentials = readFileSync(new URL("./evotorCredentials.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/localAuth.ts", import.meta.url), "utf8");
const accessPage = readFileSync(new URL("../client/src/pages/AccessAdmin.tsx", import.meta.url), "utf8");

describe("серверный ключ Эвотор", () => {
  it("шифрует управляемое значение на сервере и не записывает секрет в аудит", () => {
    expect(credentials).toContain('const ALGORITHM = "aes-256-gcm"');
    expect(credentials).toContain("createCipheriv");
    expect(credentials).toContain("createDecipheriv");
    expect(credentials).toContain("createHash(\"sha256\")");
    expect(credentials).toContain("Never add token, ciphertext, IV, tag or fingerprint to audit JSON.");
    expect(credentials).toContain("evotor_credential.replace");
  });

  it("позволяет администратору заменить ключ, но не возвращает его через tRPC или UI", () => {
    expect(router).toContain("replaceEvotorCredential");
    expect(router).not.toContain("revealEvotorCredential");
    expect(credentials).not.toContain("revealEvotorApiToken");
    expect(accessPage).toContain("Заменить ключ");
    expect(accessPage).toContain("Его значение не выводится");
    expect(accessPage).not.toContain("Показать ключ");
  });
});
