import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

describe("VAPID configuration",()=>{
  it("содержит корректно сформированные ключи и идентификатор приложения",()=>{
    expect(ENV.webPushPublicKey).toMatch(/^[A-Za-z0-9_-]{60,}$/);
    expect(ENV.webPushPrivateKey).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(ENV.webPushSubject).toMatch(/^https:\/\//);
  });
});
