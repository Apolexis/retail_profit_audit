import { describe, expect, it } from "vitest";
import { verifyBootstrapPassword } from "./localAuth";

describe("bootstrap password secret", () => {
  it("accepts the configured protected password and rejects a wrong value", () => {
    const configured = process.env.INITIAL_ADMIN_PASSWORD;
    expect(configured).toBeTruthy();
    expect(verifyBootstrapPassword(configured!)).toBe(true);
    expect(verifyBootstrapPassword("wrong-password")).toBe(false);
  });
});
