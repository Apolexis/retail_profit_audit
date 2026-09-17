import { describe, expect, it } from "vitest";
import { assertAccountCanBeDeleted, assertAdminCanResetOtherPassword, isRussianMobileUsername, normalizeLocalUsername, verifyBootstrapPassword } from "./localAuth";

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

describe("admin password reset protections", () => {
  it("allows resetting another account but keeps own password change in the profile flow", () => {
    expect(() => assertAdminCanResetOtherPassword(8, 2)).not.toThrow();
    expect(() => assertAdminCanResetOtherPassword(2, 2)).toThrow("разделе профиля");
  });
});

describe("изолированный вход магазина", () => {
  it("принимает только логин продавца и сохраняет телефонный вход для остальных ролей", () => {
    expect(normalizeLocalUsername("СКЛАД_01", "seller")).toBe("склад_01");
    expect(normalizeLocalUsername("89537573636", "seller")).toBe("79537573636");
    expect(() => normalizeLocalUsername("СКЛАД 01", "seller")).toThrow("Логин магазина");
    expect(() => normalizeLocalUsername("СКЛАД_01", "analyst")).toThrow("российский номер телефона");
    expect(isRussianMobileUsername("79537573636")).toBe(true);
    expect(isRussianMobileUsername("склад_01")).toBe(false);
  });
});
