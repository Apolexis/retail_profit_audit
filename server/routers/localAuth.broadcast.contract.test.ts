import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./localAuth.ts", import.meta.url), "utf8");

describe("адресная рассылка администратора", () => {
  it("принимает только явно заданную аудиторию: всех, активный аккаунт или роль", () => {
    expect(router).toContain('z.discriminatedUnion("kind"');
    expect(router).toContain('kind: z.literal("all")');
    expect(router).toContain('kind: z.literal("account")');
    expect(router).toContain('kind: z.literal("role")');
    expect(router).toContain("audience: broadcastAudience");
  });

  it("создает уведомления только активным получателям и записывает тип аудитории в журнал", () => {
    expect(router).toContain("const activeAccounts = (await listLocalAccounts()).filter(account => account.isActive)");
    expect(router).toContain("Для выбранной аудитории нет активных учетных записей");
    expect(router).toContain("const audience = input.audience");
    expect(router).toContain("let audienceId = \"all-active\"");
    expect(router).toContain("audience: input.audience");
  });
});
