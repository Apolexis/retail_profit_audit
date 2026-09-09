import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journal = readFileSync(new URL("./ChangeLog.tsx", import.meta.url), "utf8");
const overrides = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("компактный журнал изменений", () => {
  it("показывает конкретную смену как цветное Было → Стало", () => {
    expect(journal).toContain('className="audit-change-value before"');
    expect(journal).toContain('className="audit-change-value after"');
    expect(journal).toContain("Было");
    expect(journal).toContain("Стало");
    expect(overrides).toContain(".packet .audit-change-value {");
    expect(journal).toContain('className="audit-change-value after"');
  });

  it("не показывает технические идентификаторы у событий быстрого входа", () => {
    expect(journal).toContain('"passkey.register":"Быстрый вход включен"');
    expect(journal).toContain('"passkey.delete":"Быстрый вход отключен"');
    expect(journal).toContain("Ключ быстрого входа добавлен");
    expect(journal).toContain("Ключ быстрого входа удален");
  });
});
