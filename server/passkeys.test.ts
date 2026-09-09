import { describe, expect, it } from "vitest";
import { passkeyRelyingParty } from "./passkeys";

describe("контекст passkey", () => {
  it("использует фактический HTTPS Origin телефона даже при внутреннем host прокси", () => {
    expect(passkeyRelyingParty({ protocol: "http", headers: { host: "internal:3000", origin: "https://apolexis.manus.space", "x-forwarded-host": "internal.manus.computer", "x-forwarded-proto": "https" } })).toEqual({ rpId: "apolexis.manus.space", origin: "https://apolexis.manus.space" });
  });

  it("использует публичный forwarded host и HTTPS origin за прокси", () => {
    expect(passkeyRelyingParty({ protocol: "http", headers: { host: "internal:3000", "x-forwarded-host": "apolexis.manus.space", "x-forwarded-proto": "https" } })).toEqual({ rpId: "apolexis.manus.space", origin: "https://apolexis.manus.space" });
  });

  it("отделяет порт разработки от RP ID localhost", () => {
    expect(passkeyRelyingParty({ protocol: "http", headers: { host: "localhost:3000" } })).toEqual({ rpId: "localhost", origin: "http://localhost:3000" });
  });
});
