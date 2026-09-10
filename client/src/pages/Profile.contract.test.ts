import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const profile = readFileSync(new URL("./Profile.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Профиль»", () => {
  it("переносит инструкцию установки внутри карточки без переполнения", () => {
    expect(profile).toContain('className="install-guide"');
    expect(styles).toContain(".packet .push-settings-action:has(.install-guide)");
    expect(styles).toContain("inline-size: 100%");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("white-space: normal");
  });
});
