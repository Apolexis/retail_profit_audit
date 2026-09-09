import { describe, expect, it } from "vitest";
import { assertAccountCanBeDeleted, verifyBootstrapPassword } from "./localAuth";

describe("bootstrap password secret", () => {
  it("accepts the configured protected password and rejects a wrong value", () => {
    const configured = process.env.INITIAL_ADMIN_PASSWORD;
    expect(configured).toBeTruthy();
    expect(verifyBootstrapPassword(configured!)).toBe(true);
    expect(verifyBootstrapPassword("wrong-password")).toBe(false);
  });
});

describe("account deletion protections", () => {
  it("protects the current account and the final active administrator", () => {
    expect(() => assertAccountCanBeDeleted({ id: 4, role: "admin", isActive: true }, 4, 2)).toThrow("текущей сессии");
    expect(() => assertAccountCanBeDeleted({ id: 4, role: "admin", isActive: true }, 1, 1)).toThrow("последнего активного администратора");
    expect(() => assertAccountCanBeDeleted({ id: 4, role: "analyst", isActive: true }, 1, 1)).not.toThrow();
  });
});
