import { describe, expect, it } from "vitest";
import { getPwaInstallGuide } from "./pwaInstallGuide";

describe("инструкция установки PWA", () => {
  it("дает путь Safari для iPhone и iPad", () => {
    expect(getPwaInstallGuide("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("На iPhone или iPad в Safari нажмите «Поделиться», затем выберите: На экран «Домой», и подтвердите добавление.");
    expect(getPwaInstallGuide("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toContain("На экран");
  });

  it("не обещает единственную Android-команду и дает альтернативу", () => {
    const guide = getPwaInstallGuide("Mozilla/5.0 (Linux; Android 14; Pixel 8)");
    expect(guide).toContain("если такая команда доступна");
    expect(guide).toContain("Chrome");
  });
});
