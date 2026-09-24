import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const profile = readFileSync(new URL("./Profile.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Профиль»", () => {
  it("оставляет инструкцию установки только во всплывающей подсказке", () => {
    expect(profile).not.toContain('className="install-guide"');
    expect(profile).toContain("getPwaInstallGuide");
    expect(profile).toContain('"Как добавить на экран"');
  });

  it("сбрасывает локальный кэш всего сайта с обновлением service worker без удаления серверных данных и sessionStorage", () => {
    expect(profile).toContain("const clearPwaCache = async () =>");
    expect(profile).toContain("await Promise.all(names.map(name => caches.delete(name)))");
    expect(profile).toContain("window.localStorage.clear()");
    expect(profile).not.toContain("window.sessionStorage.clear()");
    expect(profile).toContain("navigator.serviceWorker.getRegistrations()");
    expect(profile).toContain("window.location.replace(window.location.href)");
    expect(profile).toContain("Сбросить кэш приложения");
    expect(profile).toContain('className={clearingCache ? "subtle-button profile-cache-reset is-clearing"');
    expect(profile).toContain('className="profile-cache-reset-icon"');
    expect(profile).toContain('const visibleFor = new Promise<void>(resolve => window.setTimeout(resolve, 620));');
    expect(styles).toContain('.packet .profile-cache-reset.is-clearing .profile-cache-reset-icon');
  });

  it("сохраняет один шаг на iPhone и запускает Android prompt вторым прямым нажатием", () => {
    expect(profile).toContain('import { passkeyErrorText } from "@/lib/passkeyError";');
    expect(profile).toContain('import { getPasskeyPlatform, passkeyPlatformGuidance } from "@/lib/passkeyPlatform";');
    expect(profile).toContain("const [preparedPasskeyOptions, setPreparedPasskeyOptions]");
    expect(profile).toContain('if (getPasskeyPlatform() !== "android")');
    expect(profile).toContain("await startRegistration({ optionsJSON: options })");
    expect(profile).toContain("const confirmPasskeyOnDevice = async () =>");
    expect(profile).toContain("await startRegistration({ optionsJSON: preparedPasskeyOptions })");
    expect(profile).toContain("Подтвердить ключ на устройстве");
    expect(profile).toContain("passkeyPlatformGuidance(passkeyPlatform)");
    expect(profile).toContain("passkeyErrorText(error, getPasskeyPlatform())");
  });

  it("скрывает настройку ключа доступа для продавца", () => {
    expect(profile).toContain('const isSeller = account?.role === "seller"');
    expect(profile).toContain('enabled: Boolean(account) && !isSeller');
    expect(profile).toContain('{!isSeller && <section className="packet-card passkey-settings">');
    expect(profile).toContain('Логин магазина');
  });
});
