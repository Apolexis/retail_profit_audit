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

  it("объясняет отказ Android passkey и не скрывает NotAllowedError", () => {
    expect(profile).toContain('import { passkeyErrorText } from "@/lib/passkeyError";');
    expect(profile).toContain('toast.error(passkeyErrorText(error), { duration: 9000 });');
    expect(profile).toContain("На Android нужен установленный PIN");
  });
});
