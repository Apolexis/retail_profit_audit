import { describe, expect, it } from "vitest";
import { isAccessLevelAllowed, isImportAccessAllowed } from "./accessControl";

describe("гранулярные права магазина", () => {
  it("разрешает просмотр для просмотра и редактирования", () => {
    expect(isAccessLevelAllowed("view", "view")).toBe(true);
    expect(isAccessLevelAllowed("edit", "view")).toBe(true);
  });
  it("не дает редактировать при праве только на просмотр", () => {
    expect(isAccessLevelAllowed("view", "edit")).toBe(false);
    expect(isAccessLevelAllowed(undefined, "view")).toBe(false);
    expect(isAccessLevelAllowed(undefined, "edit")).toBe(false);
  });
  it("дает редактирование только с уровнем edit", () => {
    expect(isAccessLevelAllowed("edit", "edit")).toBe(true);
  });
});

describe("независимые уровни доступа к импорту", () => {
  it("дает загрузчику только добавление, а изменение — только уровню edit", () => {
    expect(isImportAccessAllowed("upload", "upload")).toBe(true);
    expect(isImportAccessAllowed("upload", "edit")).toBe(false);
    expect(isImportAccessAllowed("edit", "upload")).toBe(true);
    expect(isImportAccessAllowed("edit", "edit")).toBe(true);
    expect(isImportAccessAllowed("none", "upload")).toBe(false);
    expect(isImportAccessAllowed(undefined, "upload")).toBe(false);
  });
});
