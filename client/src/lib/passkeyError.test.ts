import { describe, expect, it } from "vitest";
import { passkeyErrorText } from "./passkeyError";

describe("ошибки ключа доступа", () => {
  it("объясняет Android NotAllowedError без технической ссылки WebAuthn", () => {
    const message = passkeyErrorText(new Error("The operation either timed out or was not allowed. See: https://www.w3.org/TR/webauthn-2/"));
    expect(message).toContain("PIN/отпечаток/лицо");
    expect(message).toContain("Android");
    expect(message).not.toContain("w3.org");
  });
});
