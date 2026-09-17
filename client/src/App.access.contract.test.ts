import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("начальный пароль магазина", () => {
  it("до замены начального пароля пропускает только профиль", () => {
    expect(app).toContain("function InitialPasswordGate");
    expect(app).toContain('const allowed = location === "/profile"');
    expect(app).toContain('if (!allowed) setLocation("/profile")');
    expect(app).toContain('if (session.data.mustChangePassword) return <InitialPasswordGate><Router /></InitialPasswordGate>');
  });
});
