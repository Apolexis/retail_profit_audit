import { describe, expect, it } from "vitest";
import { passkeyErrorText } from "./passkeyError";

describe("ошибки ключа доступа", () => {
  it("объясняет Android NotAllowedError без технической ссылки и без ложного обещания биометрии", () => {
    const message = passkeyErrorText(new Error("The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/"), "android");
    expect(message).toContain("Chrome");
    expect(message).toContain("Подтвердить ключ на устройстве");
    expect(message).not.toContain("w3.org");
  });

  it("не упоминает Android в подсказке для iPhone", () => {
    const message = passkeyErrorText(new Error("NotAllowedError"), "ios");
    expect(message).toContain("Face ID");
    expect(message).not.toContain("Android");
  });
});
