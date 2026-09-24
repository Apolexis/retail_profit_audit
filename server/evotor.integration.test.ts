import { describe, expect, it } from "vitest";

const EVOTOR_STORES_ENDPOINT = "https://api.evotor.ru/stores";

describe("Эвотор: безопасная проверка доступа", () => {
  it("запрашивает только список магазинов с серверным токеном", async () => {
    const token = process.env.EVOTOR_ACCESS_TOKEN;
    expect(token).toBeTruthy();

    const response = await fetch(EVOTOR_STORES_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token!}`,
        Accept: "application/vnd.evotor.v2+json",
      },
    });

    expect(response.status, "Токен Эвотора не дал доступ к чтению списка магазинов").toBe(200);
    const payload = await response.json();
    const stores = Array.isArray(payload) ? payload : payload?.items;
    expect(Array.isArray(stores), "API Эвотора вернул неожиданный формат списка магазинов").toBe(true);
  }, 20_000);
});
