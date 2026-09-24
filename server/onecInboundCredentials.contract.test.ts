import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const credentials = readFileSync(new URL("./onecInboundCredentials.ts", import.meta.url), "utf8");
const root = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/OnecImportRegistry.tsx", import.meta.url), "utf8");

describe("защищенный входящий обмен 1С", () => {
  it("хранит ключ шифрованно, сравнивает его constant-time и не добавляет в аудит", () => {
    expect(schema).toContain("operationalOnecInboundCredentials");
    expect(credentials).toContain('const ALGORITHM = "aes-256-gcm"');
    expect(credentials).toContain("createCipheriv");
    expect(credentials).toContain("createDecipheriv");
    expect(credentials).toContain("timingSafeEqual");
    expect(credentials).toContain("Never returns plaintext, ciphertext, IV, tag or fingerprint");
    expect(credentials).toContain("operational_onec.inbound_credential.replace");
  });

  it("принимает JSON только по выделенному ключу и сохраняет изоляцию импорта", () => {
    expect(root).toContain('app.post("/api/integrations/1c/import"');
    expect(root).toContain("authorizeOnecInboundKey(header)");
    expect(root).toContain('req.is("application/json")');
    expect(root).toContain("importOnecPackage({ packet: req.body");
    expect(root).toContain("operational_onec.inbound_import");
    expect(root).toContain("no automatic shop stock or external write");
    expect(root).not.toContain("console.log(req.body)");
  });

  it("оставляет статус, смену и явное раскрытие ключа только администратору", () => {
    expect(router).toContain("onecInboundCredentialStatus: protectedProcedure");
    expect(router).toContain("revealOnecInboundCredential: protectedProcedure.mutation");
    expect(router).toContain("replaceOnecInboundCredential: protectedProcedure.input");
    expect(page).toContain("ВХОДЯЩИЙ ОБМЕН 1С");
    expect(page).toContain("Показать текущий");
    expect(page).toContain("Скрыть текущий");
    expect(page).toContain("/api/integrations/1c/import");
  });
});
