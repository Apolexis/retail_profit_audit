import { describe, expect, it } from "vitest";

describe("название приложения",()=>{
  it("использует согласованное название в конфигурации",()=>{
    expect(process.env.VITE_APP_TITLE).toBe("Аналитика «Рыбный»");
  });
});
