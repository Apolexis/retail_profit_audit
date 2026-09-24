import { describe, expect, it } from "vitest";
import { isSchedulerAuthenticationFailure, safeRussianDiagnostic } from "./httpRussianError";

describe("безопасные русские HTTP-диагностики", () => {
  it("сохраняет только короткое русское пояснение", () => {
    expect(safeRussianDiagnostic(new Error("Пакет не соответствует формату."), "Повторите запуск позднее.")).toBe("Пакет не соответствует формату.");
    expect(safeRussianDiagnostic(new Error("upstream timeout: token=secret"), "Повторите запуск позднее.")).toBe("Повторите запуск позднее.");
  });

	it("отличает отсутствующие служебные учетные данные от ошибки фоновой задачи", () => {
	  expect(isSchedulerAuthenticationFailure(new Error("Missing session cookie"))).toBe(true);
	  expect(isSchedulerAuthenticationFailure(new Error("Invalid session cookie"))).toBe(true);
	  expect(isSchedulerAuthenticationFailure(new Error("Неактивная задача синхронизации."))).toBe(false);
	});
});
