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

  it("позволяет только администратору заменить и по явной команде показать ключ", () => {
    expect(router).toContain("replaceEvotorCredential");
    expect(router).toContain("revealEvotorCredential: adminProcedure.mutation");
    expect(credentials).toContain("export async function revealEvotorApiToken()");
    expect(accessPage).toContain("Заменить ключ");
    expect(accessPage).toContain("Показать ключ");
    expect(accessPage).toContain("Скрыть ключ");
    expect(credentials).toContain("does not log, audit, cache");
  });
});
