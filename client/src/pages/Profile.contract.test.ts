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
  });
});
