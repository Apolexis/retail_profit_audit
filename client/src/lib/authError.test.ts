import { describe, expect, it } from "vitest";
import { authErrorText } from "./authError";

describe("authErrorText", () => {
  it("скрывает технические детали запроса базы от пользователя", () => {
    const value = authErrorText(new Error("Failed query: select importAccessLevel from audit_local_accounts"));
    expect(value).toBe("Сервис авторизации обновляется. Повторите попытку через несколько секунд.");
    expect(value).not.toContain("Failed query");
  });
});
