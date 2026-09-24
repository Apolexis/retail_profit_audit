import { describe, expect, it } from "vitest";
import { getPasskeyPlatform, passkeyPlatformGuidance } from "./passkeyPlatform";

describe("подсказки ключа доступа по устройству", () => {
  it("распознает Android и iOS по пользовательскому агенту", () => {
    expect(getPasskeyPlatform("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit Chrome/130 Mobile")).toBe("android");
    expect(getPasskeyPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari")).toBe("ios");
  });

  it("не дает iPhone инструкции для Android", () => {
    expect(passkeyPlatformGuidance("ios")).toContain("Face ID");
    expect(passkeyPlatformGuidance("ios")).not.toContain("Android");
    expect(passkeyPlatformGuidance("android")).toContain("Chrome");
  });
});
