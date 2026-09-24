import { describe, expect, it } from "vitest";
import { russianErrorMessage } from "./trpc";

describe("русские сообщения tRPC", () => {
  it("не раскрывает англоязычные внутренние ошибки пользователю", () => {
    expect(russianErrorMessage("INTERNAL_SERVER_ERROR", "Storage presign failed (400)")).toBe("Не удалось выполнить операцию. Повторите попытку позже.");
  });

  it("переводит системные коды доступа и сохраняет предметные русские сообщения", () => {
    expect(russianErrorMessage("UNAUTHORIZED", "Please login (10001)")).toBe("Требуется вход в систему.");
    expect(russianErrorMessage("FORBIDDEN", "You do not have required permission (10002)")).toBe("Недостаточно прав для выполнения действия.");
    expect(russianErrorMessage("BAD_REQUEST", "Дата начала не может быть позже даты окончания.")).toBe("Дата начала не может быть позже даты окончания.");
  });
});
