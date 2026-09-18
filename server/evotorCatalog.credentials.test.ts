import { describe, expect, it } from "vitest";

const token = process.env.EVOTOR_API_TOKEN;
const runIfCredentialAvailable = token ? describe : describe.skip;

runIfCredentialAvailable("Эвотор Cloud API V2: серверный доступ", () => {
  it("читает метаданные списка магазинов без записи", async () => {
    const response = await fetch("https://api.evotor.ru/stores", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.evotor.v2+json",
        "Content-Type": "application/vnd.evotor.v2+json",
      },
    });

    // Никакие данные магазина, тела ответа или токен в test output не выводятся.
    expect(response.status).toBe(200);
    const payload = await response.json() as { items?: unknown[] };
    expect(Array.isArray(payload.items)).toBe(true);
  }, 15_000);
});
