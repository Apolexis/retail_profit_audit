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

  it("дает безопасный сброс только локального PWA-кэша с обновлением service worker", () => {
    expect(profile).toContain("const clearPwaCache = async () =>");
    expect(profile).toContain('name.startsWith("rybny-analytics-")');
    expect(profile).toContain("navigator.serviceWorker.getRegistrations()");
    expect(profile).toContain("Кэш приложения очищен. Обновляем…");
    expect(profile).toContain("Сбросить кэш");
  });
});
