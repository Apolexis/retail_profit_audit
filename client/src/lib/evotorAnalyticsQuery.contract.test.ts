import { describe, expect, it } from "vitest";
import { evotorAnalyticsQueryOptions } from "./evotorAnalyticsQuery";

describe("кеш read-only агрегатов Эвотор", () => {
  it("сохраняет завершённый срез 45 секунд и обновляет его в фоне раз в минуту", () => {
    expect(evotorAnalyticsQueryOptions).toMatchObject({
      retry: false,
      staleTime: 45_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    });
  });
});
